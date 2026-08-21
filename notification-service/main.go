// TaskFlow — Notification Service (Go)
// Microserviço WebSocket para notificações em tempo real.
//
// Endpoints:
//   GET  /ws       — conexão WebSocket para clientes
//   POST /notify   — envia broadcast para todos os clientes conectados
//   GET  /status   — status do serviço
//
// Rodar: go run main.go  (porta 8001)

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ─── Tipos ────────────────────────────────────────────────────

// Message representa uma mensagem WebSocket trocada pelo sistema.
type Message struct {
	Type    string `json:"type"`
	Payload any    `json:"payload,omitempty"`
	UserID  string `json:"user_id,omitempty"`
}

// Client representa um cliente WebSocket conectado.
type Client struct {
	id     string
	conn   *websocket.Conn
	send   chan []byte
	userID string
}

// Hub gerencia todos os clientes conectados.
type Hub struct {
	mu         sync.RWMutex
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

// ─── Hub ──────────────────────────────────────────────────────

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 512),
		register:   make(chan *Client, 32),
		unregister: make(chan *Client, 32),
	}
}

// run inicia o loop de eventos do hub.
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			count := len(h.clients)
			h.mu.Unlock()
			log.Printf("[HUB] +conectado | user=%s | total=%d", client.userID, count)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			count := len(h.clients)
			h.mu.Unlock()
			log.Printf("[HUB] -desconectado | user=%s | total=%d", client.userID, count)

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Canal cheio: remove cliente lento
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// count retorna o número de clientes conectados.
func (h *Hub) count() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// ─── Client ───────────────────────────────────────────────────

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 1024
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Em produção: verificar origem
	CheckOrigin: func(r *http.Request) bool { return true },
}

// writePump envia mensagens do canal send para o WebSocket.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump lê mensagens do cliente (mantém a conexão viva).
func (c *Client) readPump(hub *Hub) {
	defer func() {
		hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS] erro leitura: %v", err)
			}
			break
		}
	}
}

// ─── HTTP Handlers ────────────────────────────────────────────

var hub *Hub

// wsHandler faz o upgrade da conexão HTTP para WebSocket.
func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] upgrade falhou: %v", err)
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID = "anonymous"
	}

	client := &Client{
		id:     fmt.Sprintf("%s-%d", userID, time.Now().UnixNano()),
		conn:   conn,
		send:   make(chan []byte, 256),
		userID: userID,
	}

	hub.register <- client

	// Envia mensagem de boas-vindas
	welcome := Message{
		Type:    "connected",
		Payload: fmt.Sprintf("Conectado ao TaskFlow Notifications | user_id=%s", userID),
		UserID:  userID,
	}
	if data, err := json.Marshal(welcome); err == nil {
		client.send <- data
	}

	go client.writePump()
	client.readPump(hub)
}

// notifyHandler recebe um POST e faz broadcast para todos os clientes.
func notifyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
		return
	}

	var msg Message
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	data, err := json.Marshal(msg)
	if err != nil {
		http.Error(w, "Erro interno", http.StatusInternalServerError)
		return
	}

	hub.broadcast <- data

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status":  "broadcast enviado",
		"clients": hub.count(),
	})
}

// statusHandler retorna métricas básicas do serviço.
func statusHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(map[string]any{
		"service": "TaskFlow Notification Service",
		"version": "1.0.0",
		"status":  "running",
		"clients": hub.count(),
		"time":    time.Now().UTC().Format(time.RFC3339),
	})
}

// ─── Main ─────────────────────────────────────────────────────

func main() {
	hub = newHub()
	go hub.run()

	port := ":8001"

	mux := http.NewServeMux()
	mux.HandleFunc("/ws",     wsHandler)
	mux.HandleFunc("/notify", notifyHandler)
	mux.HandleFunc("/status", statusHandler)

	// CORS para todas as rotas
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		mux.ServeHTTP(w, r)
	})

	log.Printf("🔔 TaskFlow Notification Service rodando em ws://localhost%s", port)
	log.Fatal(http.ListenAndServe(port, handler))
}

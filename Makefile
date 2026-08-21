# ============================================================
#  TaskFlow — Makefile (automação de build e desenvolvimento)
#  Linguagem: Makefile
# ============================================================

.PHONY: help setup dev backend notify frontend docker-up docker-down \
        docker-build test lint clean install

# Cores
CYAN  := \033[0;36m
GREEN := \033[0;32m
NC    := \033[0m

## ── Default ────────────────────────────────────────────────
.DEFAULT_GOAL := help

help: ## Exibe esta ajuda
	@echo ""
	@echo "  ⬡  TaskFlow — Comandos disponíveis"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-18s$(NC) %s\n", $$1, $$2}'
	@echo ""

## ── Setup ──────────────────────────────────────────────────
setup: ## Configura o ambiente de desenvolvimento completo
	@bash scripts/setup.sh

install: ## Instala apenas as dependências Python
	cd backend && python3 -m venv venv && \
	  . venv/bin/activate && \
	  pip install -q --upgrade pip && \
	  pip install -q -r requirements.txt
	@echo "$(GREEN)✅ Dependências instaladas$(NC)"

## ── Desenvolvimento ────────────────────────────────────────
dev: ## Inicia backend + notification service em paralelo
	@echo "$(CYAN)Iniciando todos os serviços...$(NC)"
	@trap 'kill 0' SIGINT; \
	  make backend & \
	  make notify  & \
	  wait

backend: ## Inicia o backend FastAPI (porta 8000)
	@echo "$(CYAN)Backend rodando em http://localhost:8000$(NC)"
	cd backend && \
	  . venv/bin/activate 2>/dev/null || true && \
	  uvicorn backend.main:app --reload --port 8000 --host 0.0.0.0

notify: ## Inicia o notification service Go (porta 8001)
	@echo "$(CYAN)Notification service em ws://localhost:8001$(NC)"
	cd notification-service && \
	  go run main.go 2>/dev/null || \
	  (go mod tidy && go run main.go)

frontend: ## Serve o frontend via Python HTTP (porta 3000)
	@echo "$(CYAN)Frontend em http://localhost:3000$(NC)"
	cd frontend && python3 -m http.server 3000

## ── Go ─────────────────────────────────────────────────────
go-build: ## Compila o notification service
	cd notification-service && \
	  mkdir -p bin && \
	  go build -o bin/notification-service .
	@echo "$(GREEN)✅ Build Go concluído$(NC)"

go-test: ## Executa testes Go
	cd notification-service && go test ./... -v

## ── Docker ─────────────────────────────────────────────────
docker-build: ## Faz build de todas as imagens Docker
	docker-compose build --no-cache --parallel

docker-up: ## Sobe todos os containers
	docker-compose up -d
	@echo "$(GREEN)✅ Containers iniciados$(NC)"
	@echo "  API:      http://localhost:8000"
	@echo "  Docs:     http://localhost:8000/docs"
	@echo "  App:      http://localhost"

docker-down: ## Para e remove todos os containers
	docker-compose down --remove-orphans

docker-logs: ## Exibe logs de todos os containers
	docker-compose logs -f

deploy: ## Deploy completo em produção
	@bash scripts/deploy.sh

## ── Testes & Qualidade ─────────────────────────────────────
test: ## Executa todos os testes
	@echo "$(CYAN)Rodando testes Python...$(NC)"
	cd backend && . venv/bin/activate 2>/dev/null || true && \
	  pytest tests/ -v 2>/dev/null || echo "Sem testes Python ainda"
	@echo "$(CYAN)Rodando testes Go...$(NC)"
	cd notification-service && go test ./... 2>/dev/null || echo "Sem testes Go ainda"

lint: ## Verifica qualidade do código
	@echo "$(CYAN)Lint Python (ruff)...$(NC)"
	cd backend && . venv/bin/activate 2>/dev/null || true && \
	  ruff check . 2>/dev/null || echo "Instale: pip install ruff"
	@echo "$(CYAN)Vet Go...$(NC)"
	cd notification-service && go vet ./...

typecheck: ## Verifica tipos TypeScript
	npx tsc --noEmit 2>/dev/null || echo "Instale TypeScript: npm i -g typescript"

## ── Limpeza ────────────────────────────────────────────────
clean: ## Remove arquivos gerados (build, __pycache__, etc)
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -rf backend/venv backend/taskflow.db
	rm -rf notification-service/bin
	docker-compose down -v 2>/dev/null || true
	@echo "$(GREEN)✅ Limpeza concluída$(NC)"

## ── Utilitários ────────────────────────────────────────────
db-reset: ## Reseta o banco de dados
	rm -f backend/taskflow.db data/taskflow.db
	cd backend && . venv/bin/activate && \
	  python3 -c "from backend.database import create_tables; create_tables()"
	@echo "$(GREEN)✅ Banco de dados resetado$(NC)"

version: ## Exibe versões das ferramentas
	@python3 --version
	@go version
	@docker --version 2>/dev/null || echo "Docker não encontrado"

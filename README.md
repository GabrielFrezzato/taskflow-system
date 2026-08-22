# ⬡ TaskFlow

> **Gerenciador de tarefas Full Stack com notificações em tempo real.**
> Projeto de portfólio desenvolvido com **14 linguagens e tecnologias**.

![CI/CD](https://github.com/seu-usuario/taskflow/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)
![Go](https://img.shields.io/badge/Go-1.22-00ADD8?logo=go)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 📋 Sumário

- [Sobre o Projeto](#sobre-o-projeto)
- [Linguagens Utilizadas](#linguagens-utilizadas)
- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Como Rodar](#como-rodar)
- [API Endpoints](#api-endpoints)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## Sobre o Projeto

TaskFlow é um sistema de gerenciamento de tarefas que demonstra integração entre múltiplas tecnologias. O foco é mostrar domínio de diferentes camadas de uma aplicação web moderna: frontend, backend, banco de dados, microserviços e DevOps.

---

## Linguagens Utilizadas

| # | Linguagem / Tech | Onde é usada |
|---|-----------------|-------------|
| 1 | **HTML** | Estrutura do frontend (`index.html`) |
| 2 | **CSS** | Estilização com design system customizado |
| 3 | **JavaScript** | Lógica do frontend (SPA vanilla, sem framework) |
| 4 | **TypeScript** | Definição de tipos (`types.d.ts`) |
| 5 | **Python** | Backend API REST com FastAPI |
| 6 | **SQL** | Schema do banco, índices, views, triggers |
| 7 | **Go** | Microserviço WebSocket de notificações |
| 8 | **Bash** | Scripts de setup e deploy automatizados |
| 9 | **YAML** | Docker Compose + GitHub Actions CI/CD |
| 10 | **Dockerfile** | Imagens multi-stage para cada serviço |
| 11 | **Nginx Config** | Reverse proxy e servidor de arquivos estáticos |
| 12 | **Makefile** | Automação de build e comandos de desenvolvimento |
| 13 | **Markdown** | Documentação do projeto |
| 14 | **JSON** | Configurações (`tsconfig.json`, `.env`) |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTE (Browser)                   │
│              HTML + CSS + JavaScript                    │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP / WebSocket
                     ▼
┌─────────────────────────────────────────────────────────┐
│              NGINX — Reverse Proxy (porta 80)            │
│              Linguagem: Nginx Config                     │
└──────┬──────────────────────────────┬───────────────────┘
       │ /api/*                        │ /ws
       ▼                               ▼
┌──────────────────┐        ┌──────────────────────────┐
│  BACKEND         │        │  NOTIFICATION SERVICE     │
│  FastAPI/Python  │        │  Go + gorilla/websocket   │
│  porta 8000      │ POST   │  porta 8001              │
│                  │──/notify──▶                       │
└────────┬─────────┘        └──────────────────────────┘
         │ SQLAlchemy ORM
         ▼
┌──────────────────┐
│  BANCO DE DADOS  │
│  SQLite (dev)    │
│  SQL Schema      │
└──────────────────┘
```

---

## Funcionalidades

- ✅ **CRUD completo** de tarefas (criar, listar, editar, excluir)
- ✅ **Autenticação JWT** com registro e login
- ✅ **Notificações em tempo real** via WebSocket (Go)
- ✅ **Filtros** por status (pendente/concluída) e prioridade (alta/média/baixa)
- ✅ **Busca** em tempo real por título e descrição
- ✅ **Datas de vencimento** com indicador de atraso
- ✅ **Design responsivo** (mobile-first)
- ✅ **API documentada** com Swagger UI em `/docs`
- ✅ **CI/CD** com GitHub Actions (lint, testes, build Docker)
- ✅ **Containerização** completa com Docker Compose

---

## Como Rodar

### Desenvolvimento (sem Docker)

**Pré-requisitos:** Python 3.10+, Go 1.22+

```bash
# 1. Clone o repositório
git clone https://github.com/GabrielFrezzato/taskflow-system.git
cd taskflow-system

# 2. Setup automático (cria venv, instala deps, gera .env)
make setup

# 3. Inicia todos os serviços
make dev
```

Acesse:
- **App:** http://localhost:3000
- **API:** http://localhost:8000
- **Swagger:** http://localhost:8000/docs
- **WebSocket:** ws://localhost:8001/ws

### Produção (Docker)

```bash
# Build e inicializa todos os containers
make docker-build
make docker-up

# Ou em um único comando:
make deploy
```

---

## API Endpoints

### Autenticação
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/users/register` | Criar conta |
| `POST` | `/api/users/login?username=&password=` | Login (retorna JWT) |
| `GET`  | `/api/users/me` | Perfil do usuário logado |
| `DELETE` | `/api/users/me` | Excluir conta |

### Tarefas (requer Bearer token)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET`    | `/api/tasks/` | Listar todas as tarefas |
| `POST`   | `/api/tasks/` | Criar nova tarefa |
| `GET`    | `/api/tasks/{id}` | Buscar tarefa por ID |
| `PUT`    | `/api/tasks/{id}` | Atualizar tarefa |
| `DELETE` | `/api/tasks/{id}` | Excluir tarefa |
| `PATCH`  | `/api/tasks/{id}/toggle` | Alternar status |

### Notification Service (Go)
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET`  | `/ws?user_id=X` | Conectar via WebSocket |
| `POST` | `/notify` | Enviar broadcast |
| `GET`  | `/status` | Status do serviço |

---

## Estrutura do Projeto

```
taskflow/
├── frontend/               # HTML + CSS + JavaScript + TypeScript
│   ├── index.html          # SPA principal
│   ├── styles.css          # Design system (14 variáveis CSS)
│   ├── app.js              # Lógica da aplicação
│   └── types.d.ts          # Definições de tipos TypeScript
│
├── backend/                # Python (FastAPI)
│   ├── main.py             # Aplicação FastAPI
│   ├── models.py           # Modelos SQLAlchemy
│   ├── schemas.py          # Schemas Pydantic
│   ├── database.py         # Configuração do banco
│   ├── auth.py             # JWT + bcrypt
│   ├── routes/
│   │   ├── tasks.py        # CRUD de tarefas
│   │   └── users.py        # Registro e login
│   └── requirements.txt
│
├── notification-service/   # Go (WebSocket)
│   ├── main.go             # Servidor WebSocket + Hub
│   └── go.mod
│
├── database/
│   └── schema.sql          # Schema SQL com índices e views
│
├── nginx/
│   └── nginx.conf          # Configuração do reverse proxy
│
├── scripts/
│   ├── setup.sh            # Setup do ambiente (Bash)
│   └── deploy.sh           # Deploy em produção (Bash)
│
├── .github/workflows/
│   └── ci.yml              # CI/CD Pipeline (YAML)
│
├── Dockerfile.backend      # Multi-stage build Python
├── Dockerfile.notify       # Multi-stage build Go (scratch)
├── Dockerfile.frontend     # Nginx + assets estáticos
├── docker-compose.yml      # Orquestração dos serviços
├── Makefile                # Automação de build
├── tsconfig.json           # Configuração TypeScript
├── .env.example            # Variáveis de ambiente
└── README.md               # Esta documentação
```

---

## Comandos Úteis

```bash
make help         # Lista todos os comandos
make dev          # Inicia o ambiente de desenvolvimento
make test         # Executa todos os testes
make lint         # Verifica qualidade do código
make clean        # Remove arquivos gerados
make db-reset     # Reseta o banco de dados
make docker-logs  # Acompanha logs dos containers
```

---

## Licença

MIT — fique à vontade para usar como referência ou base para seus projetos.

#!/usr/bin/env bash
# ============================================================
#  TaskFlow — Setup do Ambiente de Desenvolvimento
#  Linguagem: Bash
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[AVISO]${NC} $*"; }
error()   { echo -e "${RED}[ERRO]${NC}  $*" >&2; exit 1; }

echo -e "\n${BOLD}⬡  TaskFlow — Setup${NC}\n"

# ─── Verificar dependências ─────────────────────────────────
check_cmd() { command -v "$1" &>/dev/null || error "'$1' não encontrado. Instale antes de continuar."; }

info "Verificando dependências..."
check_cmd python3
check_cmd go
check_cmd git

python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' \
    || error "Python 3.10+ é necessário"
success "Python $(python3 --version)"
success "Go $(go version | awk '{print $3}')"

# ─── .env ───────────────────────────────────────────────────
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
    cp .env.example .env
    SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    sed -i "s/troque-por-uma-chave-segura-em-producao/$SECRET/" .env
    success ".env criado com chave segura gerada automaticamente"
else
    warn ".env já existe — pulando"
fi

# ─── Backend Python (virtualenv) ────────────────────────────
info "Configurando backend Python..."
cd "$ROOT/backend"

[[ -d venv ]] || python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
deactivate

success "Dependências Python instaladas"

# ─── Notification Service (Go) ──────────────────────────────
info "Compilando notification-service (Go)..."
cd "$ROOT/notification-service"
go mod tidy -e 2>/dev/null || warn "go mod tidy com avisos — verifique dependências Go"
mkdir -p bin
go build -o bin/notification-service . && success "notification-service compilado" \
    || warn "Compilação Go falhou — verifique go.sum"

# ─── Banco de dados ─────────────────────────────────────────
info "Inicializando banco de dados..."
cd "$ROOT/backend"
source venv/bin/activate
python3 -c "
import sys; sys.path.insert(0, '..')
from backend.database import create_tables
create_tables()
print('Tabelas criadas com sucesso!')
" 2>/dev/null && success "Banco de dados inicializado" || warn "Init do banco pulado (rode manualmente)"
deactivate

# ─── Resultado ──────────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}✅ Setup concluído!${NC}\n"
echo -e "Comandos disponíveis:\n"
echo -e "  ${CYAN}make dev${NC}      — Inicia todos os serviços em paralelo"
echo -e "  ${CYAN}make backend${NC}  — Apenas a API (porta 8000)"
echo -e "  ${CYAN}make notify${NC}   — Apenas o WebSocket (porta 8001)"
echo -e "  ${CYAN}make frontend${NC} — Serve o frontend (porta 3000)"
echo ""

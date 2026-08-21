#!/usr/bin/env bash
# ============================================================
#  TaskFlow — Deploy em Produção (Docker Compose)
#  Linguagem: Bash
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
error()   { echo -e "${RED}[ERRO]${NC}  $*" >&2; exit 1; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo -e "\n${BOLD}⬡  TaskFlow — Deploy${NC}\n"

command -v docker           &>/dev/null || error "Docker não encontrado"
command -v docker-compose   &>/dev/null || error "docker-compose não encontrado"
[[ -f .env ]]                           || error ".env não encontrado — execute ./scripts/setup.sh"

# Tag da imagem (usa git hash se disponível)
GIT_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
export IMAGE_TAG="$GIT_TAG"
info "Versão: $IMAGE_TAG"

info "Parando containers anteriores..."
docker-compose down --remove-orphans 2>/dev/null || true

info "Fazendo build das imagens..."
docker-compose build --no-cache --parallel

info "Subindo serviços..."
docker-compose up -d

# Health check com timeout
info "Aguardando API (timeout: 60s)..."
for i in $(seq 1 30); do
    curl -sf http://localhost:8000/health > /dev/null 2>&1 && break
    sleep 2
    [[ $i -eq 30 ]] && error "API não respondeu — verifique os logs: docker-compose logs backend"
done

success "API:      http://localhost:8000"
success "Docs:     http://localhost:8000/docs"
success "App:      http://localhost"
success "WS:       ws://localhost:8001/ws"

echo ""
docker-compose ps
echo -e "\n${GREEN}${BOLD}✅ Deploy concluído! (${IMAGE_TAG})${NC}\n"
echo -e "Logs em tempo real: ${CYAN}docker-compose logs -f${NC}"

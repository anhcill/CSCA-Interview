#!/bin/bash
# ============================================================
# deploy.sh — Script deploy nhanh cho molyinterview.online
# Chạy trên server VPS sau khi đã cài Docker & Nginx Certbot
# Cách dùng: bash deploy.sh
# ============================================================

set -e  # Dừng nếu có lỗi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  MolyInterview — Deploy Script  ${NC}"
echo -e "${BLUE}==========================================${NC}"

# ── Kiểm tra file .env.prod ────────────────────────────────
if [ ! -f ".env.prod" ]; then
  echo -e "${RED}❌ Không tìm thấy file .env.prod!${NC}"
  echo -e "${YELLOW}→ Hãy copy .env.prod lên server trước khi chạy script này.${NC}"
  exit 1
fi

# ── Pull code mới nhất từ Git ─────────────────────────────
echo -e "\n${YELLOW}📦 Pulling code mới nhất từ Git...${NC}"
git pull origin master

# ── Dừng container cũ (nếu có) ────────────────────────────
echo -e "\n${YELLOW}🛑 Dừng container cũ...${NC}"
docker compose --env-file .env.prod down --remove-orphans || true

# ── Build image mới ────────────────────────────────────────
echo -e "\n${YELLOW}🔨 Build Docker images...${NC}"
docker compose --env-file .env.prod build --no-cache

# ── Chạy Database migration ────────────────────────────────
echo -e "\n${YELLOW}🗄️  Chạy Prisma DB Push...${NC}"
docker compose --env-file .env.prod run --rm backend \
  sh -c "npx prisma db push --skip-generate"

# ── Khởi động toàn bộ services ────────────────────────────
echo -e "\n${YELLOW}🚀 Khởi động services...${NC}"
docker compose --env-file .env.prod up -d

# ── Dọn dẹp image cũ ─────────────────────────────────────
echo -e "\n${YELLOW}🧹 Dọn dẹp Docker images cũ...${NC}"
docker image prune -f

# ── Kiểm tra trạng thái ───────────────────────────────────
echo -e "\n${YELLOW}📋 Trạng thái containers:${NC}"
docker compose --env-file .env.prod ps

echo -e "\n${GREEN}✅ Deploy hoàn tất!${NC}"
echo -e "${GREEN}   Frontend: https://molyinterview.online${NC}"
echo -e "${GREEN}   Backend:  https://api.molyinterview.online${NC}"

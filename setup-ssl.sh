#!/bin/bash
# ============================================================
# setup-ssl.sh — Cài đặt SSL Certificate miễn phí từ Let's Encrypt
# Chạy lần đầu khi cài server, trước khi chạy deploy.sh
# Yêu cầu: Nginx đã được cài trên host (không phải trong Docker)
# Cách dùng: bash setup-ssl.sh
# ============================================================

set -e

DOMAIN="molyinterview.online"
WWW_DOMAIN="www.molyinterview.online"
API_DOMAIN="api.molyinterview.online"
EMAIL="your_email@gmail.com"  # ← ĐỔI THÀNH EMAIL CỦA BẠN

echo "🔐 Cài đặt SSL cho $DOMAIN..."

# Cài certbot nếu chưa có
if ! command -v certbot &> /dev/null; then
  echo "📦 Cài đặt Certbot..."
  apt-get update -y
  apt-get install -y certbot
fi

# Lấy certificate cho tất cả domains
certbot certonly --standalone \
  -d "$DOMAIN" \
  -d "$WWW_DOMAIN" \
  -d "$API_DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

# Copy certificate vào thư mục nginx/certs của dự án
echo "📁 Copy certificate vào nginx/certs/..."
mkdir -p ./nginx/certs
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ./nginx/certs/fullchain.pem
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ./nginx/certs/privkey.pem
chmod 644 ./nginx/certs/fullchain.pem
chmod 600 ./nginx/certs/privkey.pem

echo ""
echo "✅ SSL Certificate đã được tạo thành công!"
echo "   Certificate có hiệu lực 90 ngày."
echo ""
echo "⏰ Cài đặt tự động gia hạn Certificate (cron job)..."
(crontab -l 2>/dev/null; echo "0 3 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $(pwd)/nginx/certs/fullchain.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $(pwd)/nginx/certs/privkey.pem && docker compose --env-file .env.prod restart nginx") | crontab -
echo "✅ Cron job tự động gia hạn đã được thêm vào!"

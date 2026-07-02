#!/bin/sh
# docker-entrypoint.sh — Chạy migration DB rồi mới start server
set -e

echo "🗄️  Chạy Prisma DB migrations..."
npx prisma migrate deploy

echo "🚀 Khởi động backend server..."
exec node dist/server.js

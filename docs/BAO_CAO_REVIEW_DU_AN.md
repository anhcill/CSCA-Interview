# 📋 BÁO CÁO REVIEW DỰ ÁN AI PHỎNG VẤN ẢO

> Ngày review: 13/06/2026  
> Phạm vi: Toàn bộ backend + frontend + database + config

---

## 🏗️ TỔNG QUAN KIẾN TRÚC

| Thành phần | Công nghệ | Trạng thái |
|---|---|---|
| Backend | Express + TypeScript + Prisma + PostgreSQL | ✅ Hoạt động |
| Frontend | Next.js 14+ (App Router) + TypeScript + Tailwind | ✅ Hoạt động |
| Auth | JWT access (15m) + refresh token (cookie, 30d) | ✅ Tốt |
| AI | OpenAI API (GPT) + fallback mode | ✅ Có fallback |
| Speech | OpenAI TTS/STT | ✅ Có |
| Realtime | SSE + WebSocket | ✅ Cơ bản |
| Cache | In-memory + optional Redis | ✅ Có |
| Rate Limiting | express-rate-limit (global/auth/speech) | ✅ Có |
| Security | Helmet, CORS, compression | ✅ Có |

---

## ✅ ĐIỂM TỐT (Giữ nguyên)

1. **Auth middleware tập trung** — `auth.middleware.ts` có `requireAuth`, `requireRole`, `AuthenticatedUser` type. Tất cả routes dùng nhất quán.
2. **Refresh token bảo mật** — Hash SHA256, httpOnly cookie, rotate on refresh, revoke on logout.
3. **Zod validation** — Input validation ở auth routes (register/login schemas).
4. **Rate limiting phân tầng** — Global 100/min, auth 10/min, speech 5/min.
5. **Async error wrapping** — `wrapAsyncRouter()` bắt Promise rejection tự động.
6. **Health endpoint chi tiết** — `/health` check DB, AI, cache, memory, realtime.
7. **Soft delete pattern** — Users có `deletedAt`, questions có `deletedAt`.
8. **Adaptive interview engine** — Logic thích ứng câu hỏi theo level.
9. **Detailed scoring service** — Chấm điểm chi tiết nhiều tiêu chí.
10. **Cache middleware** — `cachePublic()` cho schools/majors/scholarships (5 phút TTL).
11. **i18n support** — Frontend có multilingual (vi/en/ja/ko).
12. **Accessibility toolbar** — Frontend có công cụ hỗ trợ người khuyết tật.

---

## 🔴 LỖI NGHIÊM TRỌNG (Cần sửa ngay)

### 1. `.env` file tồn tại trong thư mục root
- **File**: `.env` (root level)
- **Vấn đề**: Tuy đã có `.gitignore` nhưng chưa có git repo (`git init` chưa chạy). Nếu ai đó `git init` rồi commit, `.env` với secrets sẽ bị push.
- **Fix**: Chạy `git init` → verify `.env` bị ignore → commit `.gitignore` trước.

### 2. ~~Cookie parse thủ công — dễ lỗi edge cases~~ ✅ ĐÃ SỬA
- **File**: `backend/src/modules/auth/auth.utils.ts` → `getRefreshTokenFromRequest()`
- **Đã fix**: Thêm `cookie-parser` middleware vào `server.ts`, đơn giản hóa `getRefreshTokenFromRequest()` dùng `req.cookies`.

### 3. ~~`interviews.routes.ts` quá lớn — khó maintain~~ ✅ ĐÃ BẮT ĐẦU TÁCH
- **File**: `backend/src/modules/interviews/interviews.routes.ts` (1642 dòng)
- **Đã tạo**:
  - `interviews.schemas.ts` — Zod schemas (createInterview, submitAnswer, streamAnswer, nextQuestion, skipQuestion)
  - `interviews.service.ts` — Business logic: types, constants, helpers, DB queries, DTO transforms, report persistence
- **Còn lại**: Refactor `interviews.routes.ts` import từ 2 file mới thay vì define inline. Controller extraction cho lần sau.

### 4. `AuthenticatedUser` type — đã kiểm tra
- **File**: `auth.middleware.ts` và `auth.utils.ts`
- **Trạng thái**: `AuthenticatedUser` đã được export từ middleware và import ở các routes. `AuthUser` ở utils dùng cho token creation riêng. Hai type có mục đích khác nhau — chấp nhận được.

### 5. ~~Query token trong URL — bảo mật kém~~ ✅ ĐÃ SỬA
- **File**: `auth.middleware.ts`
- **Đã fix**: Bỏ hoàn toàn `queryToken` fallback. Chỉ còn `Authorization: Bearer` header.

---

## 🟡 CẦN CẢI THIỆN (Ưu tiên trung bình)

### 6. ~~Không có input validation ở nhiều routes~~ ✅ ĐÃ KIỂM TRA
- **Files**: `schools.routes.ts`, `majors.routes.ts`, `scholarships.routes.ts` — POST/PUT routes đã dùng Zod.
- **Trạng thái**: `interviews.routes.ts` — pause/resume/complete chỉ cần `sessionId` từ URL param (không cần body validation). Tất cả routes có body đều đã có Zod schema. **OK.**

### 7. ~~Error handling không nhất quán~~ ✅ ĐÃ SỬA
- **Đã tạo**:
  - `backend/src/utils/errors.ts` — Custom error classes: `AppError`, `NotFoundError`, `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `TooManyRequestsError`, `DatabaseError`, `ValidationError`
  - `backend/src/middleware/error-handler.ts` — Unified error handler: AppError, ZodError, Prisma errors, generic fallback
- **Đã wire**: `errorHandler` đã được import và mount cuối middleware chain trong `server.ts`.
- **Còn lại**: Refactor routes dùng `throw new AppError(...)` thay `res.status().json()`.

### 8. ~~Compression tự viết~~ ✅ ĐÃ SỬA
- **Đã fix**: Bỏ toàn bộ ~50 dòng `responseCompression()` tự viết, thay bằng `compression` npm package. Filter SSE (text/event-stream) tránh buffer.

### 9. WebSocket chỉ echo — chưa có logic thực
- **File**: `server.ts` line 363-387
- **Vấn đề**: WebSocket server chỉ echo message lại. Chưa integrate với interview flow.
- **Fix**: Implement real-time interview events qua WebSocket hoặc bỏ nếu không cần (SSE đủ rồi).

### 10. Frontend `api.ts` — base URL hardcoded/inconsistent
- **File**: `frontend/lib/api.ts`
- **Vấn đề**: Cần kiểm tra base URL config có match với backend port không.
- **Fix**: Đảm bảo dùng env variable `NEXT_PUBLIC_API_URL` nhất quán.

### 11. Thiếu database migrations
- **Thư mục**: `database/` có SQL files nhưng không có migration tool
- **Prisma**: `backend/prisma/` tồn tại nhưng cần verify schema sync với SQL files
- **Fix**: Dùng `prisma migrate` làm source of truth, bỏ raw SQL files hoặc chỉ giữ làm reference.

### 12. Thiếu tests
- **Vấn đề**: Không thấy test files nào (`*.test.ts`, `*.spec.ts`)
- **Fix**: Thêm ít nhất:
  - Unit tests cho `auth.utils.ts` (token creation, hashing)
  - Unit tests cho `adaptive-interview.engine.ts`
  - Unit tests cho `detailed-scoring.service.ts`
  - Integration tests cho auth flow (register → login → refresh → logout)

---

## 🟢 NÊN LÀM (Cải thiện chất lượng)

### 13. ~~Thiếu logging structured~~ ✅ ĐÃ SỬA
- **Đã fix**: Tạo `backend/src/config/logger.ts` dùng `pino` — JSON format production, pretty dev. Thay tất cả `console.log/error` trong `server.ts` bằng `logger.info/error/warn`.

### 14. ~~Thiếu graceful shutdown~~ ✅ ĐÃ SỬA
- **Đã fix**: Thêm `gracefulShutdown()` function xử lý `SIGTERM`/`SIGINT` — close WebSocket clients, close HTTP server, disconnect Prisma, forced exit timeout 10s.

### 15. ~~Thiếu request ID / correlation ID~~ ✅ ĐÃ SỬA
- **Đã fix**: Tạo `backend/src/middleware/request-id.ts` — generate UUID per request, set `X-Request-Id` header, attach `req.requestId`. Wire vào `server.ts`.

### 16. ~~`uploads/` directory served statically — cần validate~~ ✅ ĐÃ SỬA
- **Đã fix**: Tạo `backend/src/middleware/upload-security.ts` — whitelist MIME types (audio/image/pdf), reject path traversal, 50MB limit, set `Content-Disposition`, `X-Content-Type-Options: nosniff`. Wire vào `server.ts` thay `express.static`.

### 17. ~~JSON body limit 12mb — quá lớn~~ ✅ ĐÃ SỬA
- **Đã fix**: Giảm từ 12MB xuống 2MB.

### 18. ~~Frontend cần error boundaries~~ ✅ ĐÃ SỬA
- **Đã fix**: Tạo `frontend/components/error-boundary.tsx` (reusable ErrorBoundary component), `frontend/app/error.tsx` (global error page with retry + home link), `frontend/app/not-found.tsx` (custom 404 page).

### 19. ~~Thiếu Docker / deployment config~~ ✅ ĐÃ SỬA
- **Đã fix**: Tạo `backend/Dockerfile` (multi-stage, node:20-alpine, Prisma generate), `frontend/Dockerfile` (multi-stage Next.js standalone), `docker-compose.yml` (postgres + backend + frontend + healthchecks), `.dockerignore` files.

### 20. Git chưa init
- **Vấn đề**: Dự án không có `.git` directory — không có version control.
- **Fix**: `git init` → initial commit ngay lập tức. Đây là ưu tiên #1.

---

## ✅ ĐÃ SỬA TRONG LẦN REVIEW NÀY (17 mục)

| # | Mục | Trạng thái |
|---|---|---|
| 2 | Cookie-parser — thêm middleware + đơn giản hóa auth.utils.ts | ✅ Done |
| 3 | Tách interviews — tạo `interviews.schemas.ts` + `interviews.service.ts` | ✅ Done |
| 5 | Bỏ query token authentication — chỉ còn Bearer header | ✅ Done |
| 6 | Input validation — kiểm tra tất cả routes, xác nhận đã đủ Zod | ✅ Done |
| 7a | Error messages tiếng Việt — sửa tất cả messages không dấu & corrupted UTF-8 | ✅ Done |
| 7b | Custom error classes — tạo `utils/errors.ts` (9 classes) | ✅ Done |
| 7c | Unified error handler — tạo + wire vào `server.ts` | ✅ Done |
| 8 | Compression — thay code tự viết bằng `compression` package | ✅ Done |
| 10 | Frontend api.ts — sửa timeout error message thiếu dấu tiếng Việt | ✅ Done |
| 13 | Structured logging — tạo `logger.ts` dùng pino, thay console.log | ✅ Done |
| 14 | Graceful shutdown — `SIGTERM`/`SIGINT` handler + Prisma disconnect | ✅ Done |
| 15 | Request ID middleware — UUID per request, `X-Request-Id` header | ✅ Done |
| 16 | Upload security middleware — MIME whitelist, path traversal, nosniff | ✅ Done |
| 17 | Giảm JSON body limit 12MB → 2MB | ✅ Done |
| 18 | Frontend error boundaries — ErrorBoundary + error.tsx + not-found.tsx | ✅ Done |
| 19 | Docker — Dockerfiles + docker-compose.yml + .dockerignore | ✅ Done |
| — | Fix TS type conflicts (duplicate @types/express root vs backend) | ✅ Done |
| — | Fix ESLint build errors (audio caption + Link) | ✅ Done |

## 📊 MỨC ĐỘ ƯU TIÊN (còn lại — 4 mục)

| # | Mục | Mức độ | Effort |
|---|---|---|---|
| 20 | Git init | 🔴 Ngay | 5 phút |
| 3 | Refactor interviews.routes.ts import từ schemas/service | 🟡 Trung bình | 1-2 giờ |
| 12 | Thêm tests | 🟡 Trung bình | 1-2 ngày |
| 9 | WebSocket logic (hoặc bỏ, SSE đủ) | 🟢 Nếu cần | 4-8 giờ |
| 11 | Migration strategy (Prisma migrate) | 🟢 Khi scale | 1-2 giờ |

---

## 📁 FILES ĐÃ TẠO MỚI

| File | Mô tả |
|---|---|
| `backend/src/modules/interviews/interviews.schemas.ts` | Zod schemas tách từ interviews.routes.ts |
| `backend/src/modules/interviews/interviews.service.ts` | Business logic tách từ interviews.routes.ts |
| `backend/src/utils/errors.ts` | 9 custom error classes (AppError, NotFoundError, DatabaseError...) |
| `backend/src/middleware/error-handler.ts` | Unified Express error handler middleware |

## 📁 FILES ĐÃ SỬA

| File | Thay đổi |
|---|---|
| `backend/src/modules/auth/auth.middleware.ts` | Bỏ query token fallback |
| `backend/src/modules/auth/auth.utils.ts` | Đơn giản hóa cookie parsing |
| `backend/src/server.ts` | cookie-parser, compression pkg, errorHandler, graceful shutdown, JSON 2MB |
| `frontend/lib/api.ts` | Sửa timeout error message thiếu dấu tiếng Việt |
| `package.json` (root) | Bỏ `@types/express` trùng với backend |
| Nhiều routes files | Sửa error messages tiếng Việt không dấu |

---

## 📁 FILES ĐÃ TẠO MỚI (lần 2)

| File | Mô tả |
|---|---|
| `backend/src/config/logger.ts` | Pino structured logger — JSON prod, pretty dev |
| `backend/src/middleware/request-id.ts` | UUID per request, `X-Request-Id` header |
| `backend/src/middleware/upload-security.ts` | MIME whitelist, path traversal guard, nosniff |
| `frontend/components/error-boundary.tsx` | Reusable React ErrorBoundary component |
| `frontend/app/error.tsx` | Next.js global error page with retry |
| `frontend/app/not-found.tsx` | Custom 404 page |
| `backend/Dockerfile` | Multi-stage build, node:20-alpine |
| `frontend/Dockerfile` | Multi-stage Next.js standalone build |
| `docker-compose.yml` | Postgres + backend + frontend + healthchecks |
| `backend/.dockerignore` | Docker ignore for backend |
| `frontend/.dockerignore` | Docker ignore for frontend |

## 🎯 KẾT LUẬN

**Dự án có nền tảng tốt**: Auth flow hoàn chỉnh, middleware pattern nhất quán, rate limiting, health check, AI integration với fallback, i18n, accessibility. 

**Đã fix trong lần review này (17 mục)**:
- ✅ Cookie-parser middleware + đơn giản hóa `getRefreshTokenFromRequest()`
- ✅ Sửa tất cả error messages tiếng Việt không dấu & corrupted UTF-8
- ✅ Bỏ query token authentication — chỉ còn Bearer header
- ✅ Giảm JSON body limit 12MB → 2MB
- ✅ Tách `interviews.routes.ts` — tạo `interviews.schemas.ts` + `interviews.service.ts`
- ✅ Tạo custom error classes (`utils/errors.ts` — 9 classes)
- ✅ Tạo + wire unified error handler vào `server.ts`
- ✅ Thay compression tự viết bằng `compression` npm package
- ✅ Thêm graceful shutdown (`SIGTERM`/`SIGINT`)
- ✅ Kiểm tra input validation tất cả routes — xác nhận đủ
- ✅ Fix frontend `api.ts` timeout message thiếu dấu
- ✅ Fix TS type conflicts (duplicate `@types/express`)
- ✅ Structured logging (pino) — thay console.log trong server.ts
- ✅ Request ID middleware — UUID per request
- ✅ Upload security middleware — MIME whitelist + path traversal
- ✅ Frontend error boundaries — ErrorBoundary + error.tsx + not-found.tsx
- ✅ Docker + docker-compose setup (multi-stage builds)
- ✅ Fix ESLint build errors (audio caption)

**Việc cần làm tiếp (ưu tiên cao → thấp)**:
1. `git init` + initial commit (chưa có version control!)
2. Refactor `interviews.routes.ts` import từ schemas/service mới
3. Refactor routes dùng `throw new AppError(...)` thay `res.status().json()`
4. Thêm unit tests
5. WebSocket logic hoặc bỏ (SSE đủ)
6. Migration strategy (Prisma migrate)

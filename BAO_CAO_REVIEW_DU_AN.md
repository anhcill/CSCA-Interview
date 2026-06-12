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

### 6. Không có input validation ở nhiều routes
- **Files**: `schools.routes.ts`, `majors.routes.ts`, `scholarships.routes.ts` — POST/PUT routes dùng Zod nhưng...
- **Vấn đề**: `interviews.routes.ts` các endpoint như pause/resume/complete không rõ có validate đầy đủ không.
- **Fix**: Thêm Zod schemas cho TẤT CẢ request bodies.

### 7. Error handling không nhất quán
- **Vấn đề**: 
  - Auth routes: catch `P1001` trả 503
  - Questions routes: wrap trong try/catch riêng
  - Interviews routes: dựa vào global error handler
  - Một số nơi có dấu tiếng Việt không dấu: `"Khong ket noi duoc co so du lieu"`
- **Fix**: Tạo custom error classes (`AppError`, `NotFoundError`, `DatabaseError`) + 1 error handler thống nhất.

### 8. Compression tự viết — nên dùng thư viện
- **File**: `server.ts` line 168-216 — `responseCompression()` tự implement brotli/gzip
- **Vấn đề**: ~50 dòng code tự viết, monkey-patch `res.write`/`res.end`. Dễ bug, khó debug.
- **Fix**: Dùng `compression` npm package (standard, battle-tested):
```ts
import compression from "compression";
app.use(compression());
```

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

### 13. Thiếu logging structured
- **Vấn đề**: Dùng `console.log`/`console.error` trực tiếp. Production cần structured logging.
- **Fix**: Dùng `pino` hoặc `winston` với JSON format, log levels, request ID tracking.

### 14. Thiếu graceful shutdown
- **File**: `server.ts` — không handle `SIGTERM`/`SIGINT`
- **Fix**:
```ts
process.on("SIGTERM", async () => {
  console.log("[SHUTDOWN] Received SIGTERM");
  wss.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});
```

### 15. Thiếu request ID / correlation ID
- **Fix**: Thêm middleware tạo unique ID cho mỗi request, truyền vào logs để trace.

### 16. `uploads/` directory served statically — cần validate
- **File**: `server.ts` line 266
- **Vấn đề**: `express.static("uploads")` serve tất cả files. Nếu ai upload malicious file → serve trực tiếp.
- **Fix**: Validate file types, thêm auth middleware cho private uploads, hoặc dùng cloud storage (S3).

### 17. JSON body limit 12mb — quá lớn
- **File**: `server.ts` line 265 — `express.json({ limit: "12mb" })`
- **Vấn đề**: 12MB cho JSON request body quá lớn, dễ bị abuse (DoS).
- **Fix**: Giảm xuống 1-2MB cho JSON. Nếu cần upload file, dùng `multer` với multipart riêng.

### 18. Frontend cần error boundaries
- **Vấn đề**: Các trang interview nếu crash sẽ trắng trang.
- **Fix**: Thêm React Error Boundary cho các sections chính.

### 19. Thiếu Docker / deployment config
- **Vấn đề**: Không có `Dockerfile`, `docker-compose.yml`, hay CI/CD config.
- **Fix**: Tạo Docker setup cho dev & production deployment.

### 20. Git chưa init
- **Vấn đề**: Dự án không có `.git` directory — không có version control.
- **Fix**: `git init` → initial commit ngay lập tức. Đây là ưu tiên #1.

---

## ✅ ĐÃ SỬA TRONG LẦN REVIEW NÀY

| # | Mục | Trạng thái |
|---|---|---|
| 2 | Cookie-parser — thêm middleware + đơn giản hóa auth.utils.ts | ✅ Done |
| 3 | Tách interviews — tạo `interviews.schemas.ts` + `interviews.service.ts` | ✅ Done |
| 5 | Bỏ query token authentication — chỉ còn Bearer header | ✅ Done |
| 7 | Error messages tiếng Việt — sửa tất cả messages không dấu & corrupted UTF-8 | ✅ Done |
| 17 | Giảm JSON body limit 12MB → 2MB | ✅ Done |

## 📊 MỨC ĐỘ ƯU TIÊN (còn lại — 11 mục)

| # | Mục | Mức độ | Effort |
|---|---|---|---|
| 20 | Git init | 🔴 Ngay | 5 phút |
| 8 | Dùng compression package thay code tự viết | 🟡 Sớm | 20 phút |
| 3 | Refactor interviews.routes.ts import từ schemas/service | 🟡 Trung bình | 1-2 giờ |
| 7 | Error handling classes thống nhất | 🟡 Trung bình | 2-3 giờ |
| 6 | Validate tất cả inputs | 🟡 Trung bình | 1-2 giờ |
| 12 | Thêm tests | 🟡 Trung bình | 1-2 ngày |
| 14 | Graceful shutdown | 🟢 Khi rảnh | 30 phút |
| 16 | Upload security | 🟢 Khi rảnh | 1 giờ |
| 13 | Structured logging | 🟢 Khi rảnh | 2-3 giờ |
| 15 | Request ID | 🟢 Khi rảnh | 30 phút |
| 18 | Error boundaries | 🟢 Khi rảnh | 1 giờ |
| 19 | Docker | 🟢 Khi deploy | 2-3 giờ |
| 9 | WebSocket logic | 🟢 Nếu cần | 4-8 giờ |
| 11 | Migration strategy | 🟢 Khi scale | 1-2 giờ |

---

## 🎯 KẾT LUẬN

**Dự án có nền tảng tốt**: Auth flow hoàn chỉnh, middleware pattern nhất quán, rate limiting, health check, AI integration với fallback, i18n, accessibility. 

**Đã fix trong lần review này (5 mục)**:
- ✅ Cookie-parser middleware + đơn giản hóa `getRefreshTokenFromRequest()`
- ✅ Sửa tất cả error messages tiếng Việt không dấu & corrupted UTF-8
- ✅ Bỏ query token authentication — chỉ còn Bearer header
- ✅ Giảm JSON body limit 12MB → 2MB
- ✅ Tách `interviews.routes.ts` — tạo `interviews.schemas.ts` + `interviews.service.ts`

**Việc cần làm tiếp (ưu tiên cao)**:
1. `git init` + initial commit (chưa có version control!)
2. Refactor `interviews.routes.ts` import từ schemas/service mới
3. Thay compression tự viết bằng `compression` package
4. Error handling classes thống nhất
5. Thêm unit tests

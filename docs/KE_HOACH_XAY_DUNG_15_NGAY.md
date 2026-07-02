
# 📋 BÁO CÁO ĐÁNH GIÁ DỰ ÁN AI PHỎNG VẤN ẢO

## 🏗️ Kiến trúc tổng quan
- **Backend**: Express + Prisma + TypeScript, OpenAI integration
- **Frontend**: Next.js App Router + Tailwind CSS + shadcn/ui
- **Database**: PostgreSQL (Prisma ORM)
- **AI**: OpenAI API (chấm điểm + tạo câu hỏi adaptive)
- **Speech**: Google Cloud TTS/STT

---

## 🔴 LỖI NGHIÊM TRỌNG CẦN SỬA NGAY

### 1. **File `.env` đang bị expose trong repo**
- File `.env` có trong project root với API keys thật (OpenAI, Google Cloud, JWT secret)
- **Sửa**: Thêm `.env` vào `.gitignore` (nếu chưa), rotate tất cả secrets

### 2. **interviews.routes.ts quá lớn (1642 dòng)**
- Một file chứa: routes, business logic, DTOs, helper functions, scoring analysis
- **Sửa**: Tách thành modules: `interview.controller.ts`, `interview.service.ts`, `interview.dto.ts`, `session-analysis.service.ts`

### 3. **Không có auth middleware tập trung**
- Route `/me` tự verify JWT inline; `interviews.routes.ts` dùng `res.locals.user` nhưng middleware setup unclear
- **Sửa**: Tạo `auth.middleware.ts` reusable, dùng nhất quán cho mọi protected route

### 4. **Cookie parsing thủ công trong auth.utils.ts**
- `getRefreshTokenFromRequest()` parse cookie bằng string split thay vì dùng `cookie-parser` middleware
- **Sửa**: Dùng `cookie-parser` middleware, truy cập `req.cookies`

### 5. **Inconsistent error message encoding**
- Auth routes dùng tiếng Việt có dấu: `"Đăng nhập thành công"`
- Interview routes dùng không dấu: `"Khong ket noi duoc co so du lieu"`
- Refresh route line 193 dùng không dấu cho DB error
- **Sửa**: Chuẩn hóa tất cả messages, dùng i18n hoặc error codes

---

## 🟡 VẤN ĐỀ CẦN CẢI THIỆN

### 6. **Thiếu rate limiting**
- Auth routes (login, register) không có rate limit → brute force risk
- AI endpoints chỉ có daily budget check, không có per-minute throttle
- **Sửa**: Thêm `express-rate-limit` cho auth + AI routes

### 7. **Thiếu input sanitization cho XSS**
- `answerText`, `questionText` chỉ trim/slice, không escape HTML
- **Sửa**: Sanitize output hoặc dùng CSP headers

### 8. **SSE stream không handle client disconnect**
- `streamAnswerFeedbackHandler` không listen `req.on('close')` → AI call tiếp tục chạy khi client đã disconnect
- **Sửa**: Thêm abort signal khi client close connection

### 9. **Dead code trong next-question route (line 1227-1238)**
- Check `if (existingNext)` sau khi đã return nếu `existingNext` tồn tại ở line 1217-1224
- Code block line 1226-1238 có `if (existingNext)` luôn false vì đã return trước
- **Sửa**: Xóa dead code block

### 10. **`overallScore` calculation bug trong `persistInterviewReport`**
- Line 1411: `Math.round(analysis.overallScore * 100) / 10` — nếu score = 7.5 → 75/10 = 7.5 OK, nhưng nếu score = 8.25 → 825/100 → round = 825 → /10 = 82.5 ❌
- Mục đích là round 1 decimal nhưng nhân 100 chia 10 ≠ round 1 decimal
- **Sửa**: Dùng `Math.round(analysis.overallScore * 10) / 10`

### 11. **Prisma schema dùng mixed naming convention**
- Prisma models: `InterviewSession` (PascalCase) nhưng `interview_reports`, `ai_usage_logs` (snake_case)
- **Sửa**: Chuẩn hóa naming convention, dùng `@@map` cho table names

### 12. **Frontend `interview-client.ts` hardcoded API URL logic**
- Cần review cách construct API URLs, đảm bảo dùng env variable nhất quán
- **Sửa**: Centralize API base URL config

### 13. **Thiếu test**
- Không thấy thư mục `__tests__` hay `*.test.ts` nào
- **Sửa**: Thêm unit tests cho scoring logic, auth flow, AI fallback

### 14. **Speech service Google credentials**
- `speech.service.ts` + `speech.routes.ts` — cần verify credential file path handling trên production
- **Sửa**: Dùng env var cho credential path, không hardcode

---

## 🟢 TÍNH NĂNG CẦN LÀM THÊM

### 15. **Chưa có password reset flow**
- Auth chỉ có register/login/refresh/logout/me
- **Cần**: Forgot password → email verification → reset

### 16. **Chưa có email verification**
- Register tạo user ngay không verify email
- **Cần**: Send verification email, activate after confirm

### 17. **Admin routes thiếu authorization check**
- Schools/Majors/Scholarships/Questions routes — cần verify có check role ADMIN không
- **Cần**: Middleware kiểm tra `user.role === 'ADMIN'`

### 18. **Thiếu pagination cho list endpoints**
- `findBankQuestions` dùng `take: 7` hardcode
- History/admin list routes cần pagination params
- **Cần**: Query params `page`, `limit`, `cursor`

### 19. **Thiếu logging structured**
- Dùng `console.log`/`console.error` everywhere
- **Cần**: Winston/Pino logger với log levels, request ID tracking

### 20. **Thiếu health check endpoint**
- **Cần**: `/api/health` endpoint check DB connection + service status

### 21. **Thiếu CORS configuration review**
- server.ts cần verify CORS origins cho production
- **Cần**: Whitelist specific frontend domains

### 22. **Database migrations không có tool**
- Thư mục `database/` có SQL files thủ công
- **Cần**: Dùng `prisma migrate` cho tất cả schema changes

---

## 📊 Tóm tắt ưu tiên

| Ưu tiên | Số items | Mô tả |
|---------|---------|-------|
| 🔴 P0 | 5 | Security + bugs nghiêm trọng |
| 🟡 P1 | 9 | Code quality + reliability |
| 🟢 P2 | 8 | Features mới cần thiết |

**Khuyến nghị**: Sửa P0 trước (đặc biệt #1 .env leak, #10 score bug), sau đó P1, rồi P2 theo kế hoạch phát triển.

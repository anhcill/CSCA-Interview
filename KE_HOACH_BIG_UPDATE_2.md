# KẾ HOẠCH BIG UPDATE 2: NÂNG CẤP TOÀN DIỆN WEB PHỎNG VẤN DU HỌC TRUNG QUỐC

> **Ngày lập**: Dựa trên phân tích code sau Big Update 1
> **Tiền đề**: Big Update 1 đã hoàn thành — Tách Admin/User layout, theme Trung Hoa, wizard flow, composite indexes, RAG pipeline, speech analysis 13/14, gamification cơ bản.

---

## 🔴 PHÂN TÍCH THỰC TRẠNG SAU BIG UPDATE 1

### ĐÃ CÓ (giữ nguyên):
| Thành phần | Trạng thái | Chi tiết |
|---|---|---|
| Auth JWT + Refresh Token | ✅ Hoàn chỉnh | bcrypt, httpOnly cookie, rotate, revoke |
| Admin/User layout tách biệt | ✅ Xong | `admin-shell.tsx` + `user-navbar.tsx` + `app-shell.tsx` routing |
| Theme Trung Hoa (đỏ/vàng/ngà) | ✅ Xong | `globals.css` + `design-tokens.css` |
| Wizard interview setup (4 bước) | ✅ Xong | `progress-tracker.tsx` + `wizard-steps.tsx` |
| RAG Context Service | ✅ Xong | `rag-context.service.ts` — query DB → build context → inject prompt |
| RAG Seed Data 30 trường TQ | ✅ Xong | `rag-rich-seed-data.ts` + `rag-rich-seed.ts` |
| Speech Analysis 13/14 | ✅ Xong | WPM, pause, filler, fluency, confidence, Azure pronunciation |
| Gamification (badge/streak/weekly goal) | ✅ Xong | `gamification.service.ts` + DB models |
| Adaptive Interview Engine | ✅ Xong | Follow-up, difficulty adjustment, topic branching |
| Detailed Scoring (6 tiêu chí) | ✅ Xong | `detailed-scoring.service.ts` + radar chart |
| Admin CRUD (schools/majors/scholarships/questions) | ✅ Xong | Routes + UI pages |
| Questions Importer (Excel/CSV) | ✅ Xong | `questions-importer.tsx` |
| Docker + docker-compose | ✅ Xong | Multi-stage builds |
| i18n (vi/en/ja/ko) | ✅ Xong | `next-intl` + messages |
| Error handling (custom classes + unified handler) | ✅ Xong | `errors.ts` + `error-handler.ts` |
| Cache service (Redis + memory fallback) | ✅ Xong | `cache.service.ts` |
| Composite indexes + Prisma select optimization | ✅ Xong | schema.prisma chuẩn |
| require-admin middleware | ✅ Xong | `require-admin.ts` |
| 403-forbidden page | ✅ Xong | `/403-forbidden/page.tsx` |

### CHƯA CÓ / THIẾU (Big Update 2 cần làm):
| Thành phần | Trạng thái | Ưu tiên |
|---|---|---|
| **Phỏng vấn realtime (WebSocket thực sự)** | ❌ WebSocket chỉ echo | 🔴 Cao |
| **Export PDF báo cáo phỏng vấn** | ❌ Chưa có | 🔴 Cao |
| **So sánh điểm giữa các session (progress chart)** | ❌ Chưa có | 🔴 Cao |
| **Luyện lại câu hỏi yếu (Re-practice)** | ❌ Chưa có | 🔴 Cao |
| **Notification system (badge mới, streak sắp mất)** | ❌ Chỉ có logic, chưa có push | 🟡 TB |
| **Admin Analytics dashboard nâng cao** | ❌ Cơ bản | 🟡 TB |
| **Onboarding wizard cho user mới** | ❌ Chưa có | 🟡 TB |
| **Unit/Integration tests** | ❌ 0 tests | 🟡 TB |
| **CI/CD pipeline (GitHub Actions)** | ❌ Chưa có | 🟡 TB |
| **Chinese tone analysis (thanh điệu)** | ❌ Speech 13/14 | 🟢 Thấp |
| **Payment/Subscription enforcement** | ❌ Schema có, logic chưa | 🟢 Sau |
| **Study Plan AI analysis (Wizard step 5-6)** | ❌ Phase 2 wizard | 🟡 TB |
| **SSE streaming AI response (từng từ)** | ⚠️ Có SSE cơ bản, chưa tối ưu | 🟡 TB |
| **Share kết quả phỏng vấn (public link)** | ❌ Chưa có | 🟢 Thấp |
| **Email notification (nhắc luyện tập)** | ❌ Chưa có | 🟢 Thấp |
| **Sample answer comparison** | ❌ Deferred từ Ngày 3 | 🟡 TB |

---

## 👥 PHÂN CHIA 3 AGENT SONG SONG

```
+------------------------------------------------------------------------------------+
|                              BIG UPDATE 2 PLAN                                     |
+------------------------------------+-----------------------------------------------+
| Agent                              | Trọng tâm Kỹ thuật                            |
+------------------------------------+-----------------------------------------------+
| Agent 1: UX Nâng Cao & Progress    | Progress tracking, PDF export, Re-practice,   |
|          Tracking                   | Session comparison, Onboarding wizard          |
+------------------------------------+-----------------------------------------------+
| Agent 2: Realtime & Notifications  | WebSocket interview, SSE streaming tối ưu,    |
|          & Admin Analytics          | Notification center, Admin dashboard nâng cao  |
+------------------------------------+-----------------------------------------------+
| Agent 3: Testing, CI/CD &          | Unit tests, Integration tests, GitHub Actions, |
|          Study Plan Analysis        | Study Plan AI wizard steps, Sample answers     |
+------------------------------------+-----------------------------------------------+
```

### ⚠️ CONFLICT ZONE & QUY TẮC MERGE

```
┌───────────────────────────────────────────────────────────────────────┐
│  FILE XUNG ĐỘT 1: frontend/components/interview/interview-result.tsx │
│  → Agent 1 sửa (thêm PDF export + re-practice buttons)              │
│  → Agent 2 KHÔNG đụng file này                                       │
│                                                                       │
│  FILE XUNG ĐỘT 2: backend/src/server.ts                              │
│  → Agent 2 sửa (WebSocket upgrade logic)                             │
│  → Agent 3 sửa (test setup) → merge SAU Agent 2                     │
│                                                                       │
│  FILE XUNG ĐỘT 3: frontend/components/interview/interview-room.tsx   │
│  → Agent 2 sửa (WebSocket events)                                    │
│  → Agent 1 KHÔNG đụng                                                 │
│                                                                       │
│  CÁC FILE KHÁC: KHÔNG có xung đột giữa 3 agent                     │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Agent 1: UX Nâng Cao & Progress Tracking

### 1. So Sánh Tiến Bộ Giữa Các Session (Progress Over Time)

**Vấn đề hiện tại:** User hoàn thành nhiều session nhưng KHÔNG thấy mình tiến bộ hay không. Dashboard chỉ hiển thị tổng quan, không có biểu đồ trend.

#### 1a. Backend API — Thống kê tiến bộ

* **Tập tin tạo mới:** `backend/src/modules/interviews/interview-stats.service.ts`
* **Các hàm cần tạo:**

```typescript
// interview-stats.service.ts

// Lấy điểm trung bình theo thời gian (30/60/90 ngày)
export async function getScoreProgressTimeline(userId: string, days: number = 30) {
  // Query: GROUP BY date, AVG(total_score) cho mỗi session COMPLETED
  // Return: Array<{ date: string; avgScore: number; sessionCount: number }>
}

// Lấy điểm trung bình theo từng tiêu chí (6 criteria) qua thời gian
export async function getSkillProgressTimeline(userId: string, days: number = 30) {
  // Query: AVG cho scoreRelevance, scoreLogic, scoreSpecificity, scoreLanguage
  // Group by week
  // Return: Array<{ week: string; relevance: number; logic: number; ... }>
}

// So sánh 2 session cụ thể
export async function compareSessionScores(sessionId1: string, sessionId2: string, userId: string) {
  // Return: { session1: SessionScoreSummary; session2: SessionScoreSummary; improvement: PercentageDiff }
}

// Xác định weak areas (category có điểm thấp nhất)
export async function getWeakAreas(userId: string, limit: number = 5) {
  // Query: AVG score by QuestionCategory, ORDER ASC
  // Return: Array<{ category: QuestionCategory; avgScore: number; totalAnswers: number; suggestion: string }>
}
```

* **Tập tin sửa đổi:** `backend/src/modules/interviews/interviews.routes.ts`
  * Thêm route: `GET /api/interviews/progress?days=30`
  * Thêm route: `GET /api/interviews/weak-areas`
  * Thêm route: `GET /api/interviews/compare?session1=UUID&session2=UUID`

#### 1b. Frontend — Progress Dashboard

* **Tập tin tạo mới:** `frontend/components/dashboard/progress-chart.tsx`
  * Line chart (recharts) hiển thị điểm trung bình theo ngày
  * Toggle: 7 ngày / 30 ngày / 90 ngày
  * Hover tooltip: ngày, điểm TB, số session

* **Tập tin tạo mới:** `frontend/components/dashboard/skill-radar-progress.tsx`
  * 2 radar charts chồng lên nhau: tuần trước vs tuần này
  * 6 trục: Nội dung, Logic, Ngôn ngữ, Tự tin, Chuyên ngành, Ấn tượng
  * Color: tuần trước = xám mờ, tuần này = đỏ chính

* **Tập tin tạo mới:** `frontend/components/dashboard/weak-areas-card.tsx`
  * Danh sách 3-5 chủ đề yếu nhất
  * Mỗi item: icon category, tên, điểm TB, progress bar
  * Nút "Luyện chủ đề này" → tạo session chỉ với category đó

* **Tập tin sửa đổi:** `frontend/app/dashboard/page.tsx`
  * Thêm section "Tiến bộ của bạn" với `ProgressChart`
  * Thêm section "Kỹ năng" với `SkillRadarProgress`
  * Thêm section "Cần cải thiện" với `WeakAreasCard`

### 2. Export PDF Báo Cáo Phỏng Vấn

**Vấn đề hiện tại:** User không thể lưu/in/chia sẻ kết quả phỏng vấn. Kết quả chỉ xem trên web.

#### 2a. Frontend PDF Generation

* **Tập tin tạo mới:** `frontend/lib/pdf/interview-report-pdf.ts`
* **Dependencies mới:** `@react-pdf/renderer` (hoặc `jspdf` + `html2canvas`)
* **Cấu trúc PDF:**
  ```
  ┌────────────────────────────────────────┐
  │  LOGO + Tiêu đề "Báo Cáo Phỏng Vấn"  │
  │  Ngày: DD/MM/YYYY | Trường: XXX        │
  ├────────────────────────────────────────┤
  │  TỔNG QUAN                              │
  │  Tổng điểm: 7.5/10 | Xếp loại: Khá    │
  │  Số câu: 8 | Thời gian: 25 phút        │
  │  [Radar Chart SVG 6 tiêu chí]          │
  ├────────────────────────────────────────┤
  │  CHI TIẾT TỪNG CÂU                     │
  │  Câu 1: "Tại sao chọn TQ?" ⭐ 8/10    │
  │  - Trả lời: "..."                       │
  │  - Điểm mạnh: ...                       │
  │  - Cần cải thiện: ...                   │
  │  Câu 2: ...                             │
  ├────────────────────────────────────────┤
  │  KHUYẾN NGHỊ TỔNG KẾT                  │
  │  - 3 điểm mạnh nổi bật                 │
  │  - 3 điểm cần cải thiện                │
  │  - Gợi ý luyện tập tiếp               │
  └────────────────────────────────────────┘
  ```

* **Tập tin sửa đổi:** `frontend/components/interview/interview-result.tsx`
  * Thêm nút "Tải PDF" → gọi `generateInterviewPDF(sessionData)`
  * Thêm nút "Chia sẻ kết quả" (copy link) — cho phase sau

#### 2b. API hỗ trợ

* **Tập tin sửa đổi:** `backend/src/modules/interviews/interviews.routes.ts`
  * Thêm route: `GET /api/interviews/:id/report-data`
  * Trả full data cần thiết cho PDF (session + answers + scores + feedback + radar data)
  * Select optimized — chỉ lấy fields cần hiển thị

### 3. Luyện Lại Câu Hỏi Yếu (Re-practice Mode)

**Vấn đề hiện tại:** User thấy mình yếu ở câu nào đó nhưng KHÔNG có cách nào luyện lại chính xác câu đó.

#### 3a. Backend

* **Tập tin sửa đổi:** `backend/src/modules/interviews/interviews.routes.ts`
  * Thêm route: `POST /api/interviews/re-practice`
  * Body: `{ sourceSessionId: string; questionIds: string[]; mode: InterviewMode }`
  * Logic: Tạo session mới chỉ với các câu hỏi được chọn
  * Giữ liên kết `sourceSessionId` để so sánh điểm trước/sau

* **Tập tin sửa đổi:** `backend/prisma/schema.prisma`
  * Thêm field `InterviewSession`:
    ```prisma
    sourceSessionId String? @map("source_session_id") @db.Uuid
    rePracticeType  String? @map("re_practice_type") @db.VarChar(50) // "weak_questions" | "category" | "full_retry"
    ```

#### 3b. Frontend

* **Tập tin tạo mới:** `frontend/components/interview/re-practice-dialog.tsx`
  * Modal hiển thị sau khi xem kết quả
  * Tick chọn câu hỏi muốn luyện lại (default: câu điểm < 6)
  * Nút "Luyện lại X câu đã chọn" → tạo session mới

* **Tập tin sửa đổi:** `frontend/components/interview/interview-result.tsx`
  * Mỗi câu hỏi có nút "Luyện lại câu này"
  * Cuối trang có nút "Luyện lại tất cả câu yếu"

* **Tập tin tạo mới:** `frontend/components/dashboard/re-practice-card.tsx`
  * Widget trên dashboard: "Bạn có X câu hỏi cần luyện lại"
  * Quick action: click → vào re-practice flow

### 4. Onboarding Wizard Cho User Mới

**Vấn đề hiện tại:** User mới đăng ký xong → vào dashboard trống → không biết làm gì.

#### 4a. Frontend

* **Tập tin tạo mới:** `frontend/components/onboarding/onboarding-wizard.tsx`
  * **Bước 1 — Chào mừng**: Animation welcome + giới thiệu app (3 features chính)
  * **Bước 2 — Thông tin nhanh**: Chọn hệ (ĐH/ThS), trường mục tiêu, học bổng (bỏ qua được)
  * **Bước 3 — Phỏng vấn thử**: 3 câu nhanh → AI chấm → hiện kết quả mini
  * **Bước 4 — Bắt đầu**: "Hành trình của bạn bắt đầu!" + redirect dashboard

* **Tập tin tạo mới:** `frontend/components/onboarding/onboarding-step.tsx`
  * Component chung cho mỗi step: animation, back/next/skip buttons

* **Tập tin tạo mới:** `frontend/components/onboarding/trial-interview.tsx`
  * Mini interview 3 câu cho onboarding (câu dễ, chấm nhanh)

* **Tập tin sửa đổi:** `frontend/components/app-shell.tsx`
  * Check `user_preferences.onboarding_completed`
  * Nếu false → redirect `/onboarding` thay vì dashboard

* **Tập tin tạo mới:** `frontend/app/onboarding/page.tsx`
  * Page wrapper cho onboarding wizard

#### 4b. Backend

* **Tập tin sửa đổi:** `backend/src/modules/gamification/gamification.routes.ts`
  * Đã có `PUT /api/gamification/preferences` → dùng để set `onboarding_completed: true`
  * Không cần thêm route mới

---

## ⚡ Agent 2: Realtime, Notifications & Admin Analytics

### 1. WebSocket Interview Realtime (Thay Echo Hiện Tại)

**Vấn đề hiện tại:** WebSocket trong `server.ts` chỉ echo message lại. SSE dùng cho AI streaming nhưng WebSocket không có logic.

#### 1a. Backend WebSocket Logic

* **Tập tin tạo mới:** `backend/src/modules/realtime/ws-interview.handler.ts`
* **Các event types:**

```typescript
// Server → Client events
type ServerEvent = 
  | { type: "interview:question"; data: { questionText: string; category: string; orderIndex: number } }
  | { type: "interview:ai-typing"; data: { isTyping: boolean } }
  | { type: "interview:score-ready"; data: { questionId: string; score: number } }
  | { type: "interview:complete"; data: { totalScore: number; sessionId: string } }
  | { type: "interview:hint"; data: { hint: string } }
  | { type: "interview:timer"; data: { remainingSeconds: number } }
  | { type: "notification"; data: { message: string; type: "badge" | "streak" | "info" } }
  | { type: "error"; data: { message: string; code: string } }

// Client → Server events
type ClientEvent =
  | { type: "interview:answer"; data: { sessionQuestionId: string; answerText: string } }
  | { type: "interview:request-hint"; data: { sessionQuestionId: string } }
  | { type: "interview:skip"; data: { sessionQuestionId: string } }
  | { type: "interview:pause" }
  | { type: "interview:resume" }
  | { type: "interview:end" }
  | { type: "ping" }
```

* **Logic handler:**
  * Auth: verify JWT token from connection URL query param (chỉ dùng cho WebSocket handshake, không phải API)
  * Room: mỗi session = 1 room, user chỉ vào room của mình
  * AI typing indicator: khi backend đang gọi AI API → gửi `ai-typing: true` → xong → `ai-typing: false`
  * Timer sync: backend giữ timer chính xác, frontend chỉ hiển thị

* **Tập tin sửa đổi:** `backend/src/server.ts`
  * Thay thế echo WebSocket handler bằng `wsInterviewHandler`
  * Auth middleware cho WebSocket connection

#### 1b. Frontend WebSocket Client

* **Tập tin tạo mới:** `frontend/lib/ws-client.ts`
  * Class `InterviewWebSocket` — auto reconnect, heartbeat (30s ping)
  * Event emitter pattern: `ws.on('interview:question', callback)`
  * Connection state management: connecting, connected, disconnected, reconnecting

* **Tập tin sửa đổi:** `frontend/components/interview/interview-room.tsx`
  * Thêm WebSocket connection khi vào phòng phỏng vấn
  * Hiển thị "AI đang suy nghĩ..." khi nhận `ai-typing: true`
  * Nhận câu hỏi qua WebSocket thay vì polling API
  * Gửi câu trả lời qua WebSocket
  * Timer đồng bộ từ server

* **Tập tin tạo mới:** `frontend/components/interview/typing-indicator.tsx`
  * Animation 3 chấm nhấp nháy khi AI đang typing
  * Hiệu ứng "Giáo sư đang đọc câu trả lời của bạn..."

### 2. Notification Center

**Vấn đề hiện tại:** Badge, streak, weekly goal chỉ hiển thị khi user vào trang gamification. Không có thông báo chủ động.

#### 2a. Backend

* **Tập tin tạo mới:** `backend/src/modules/notifications/notifications.service.ts`
  * Tạo bảng `notifications` mới:
    ```prisma
    model Notification {
      id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
      userId    String   @map("user_id") @db.Uuid
      type      String   @db.VarChar(50) // "badge_earned" | "streak_reminder" | "weekly_goal" | "system"
      title     String   @db.VarChar(255)
      body      String
      metadata  Json?
      isRead    Boolean  @default(false) @map("is_read")
      createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
      user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
      
      @@index([userId, isRead], map: "idx_notifications_user_read")
      @@index([userId, createdAt(sort: Desc)], map: "idx_notifications_user_created")
      @@map("notifications")
    }
    ```
  * Hàm `createNotification(userId, type, title, body, metadata?)`
  * Hàm `getUserNotifications(userId, limit, offset)` — paginated
  * Hàm `markAsRead(notificationId, userId)`
  * Hàm `markAllAsRead(userId)`
  * Hàm `getUnreadCount(userId)`

* **Tập tin tạo mới:** `backend/src/modules/notifications/notifications.routes.ts`
  * `GET /api/notifications` — list (paginated)
  * `GET /api/notifications/unread-count`
  * `PUT /api/notifications/:id/read`
  * `PUT /api/notifications/read-all`

* **Tập tin sửa đổi:** `backend/src/modules/gamification/gamification.service.ts`
  * Sau khi `awardBadgesForUser()` → tạo notification "Bạn vừa đạt huy hiệu X!"
  * Khi streak sắp mất (user chưa practice hôm nay, đã 18h) → tạo notification (cần cron job hoặc trigger khi user login)

#### 2b. Frontend

* **Tập tin tạo mới:** `frontend/components/notifications/notification-bell.tsx`
  * Icon chuông trên navbar, badge đỏ hiện số unread
  * Click → dropdown danh sách 5 thông báo gần nhất
  * Nút "Xem tất cả" → trang `/notifications`
  * Poll unread count mỗi 60 giây (hoặc nhận qua WebSocket)

* **Tập tin tạo mới:** `frontend/components/notifications/notification-list.tsx`
  * Danh sách full, phân trang
  * Swipe to mark as read (mobile)
  * Icon theo type: 🏅 badge, 🔥 streak, 🎯 weekly goal, ℹ️ system

* **Tập tin tạo mới:** `frontend/app/notifications/page.tsx`
  * Trang danh sách notifications

* **Tập tin sửa đổi:** `frontend/components/user-navbar.tsx`
  * Thêm `NotificationBell` vào navbar (cạnh avatar)

### 3. Admin Analytics Dashboard Nâng Cao

**Vấn đề hiện tại:** Admin page chỉ có thống kê cơ bản. Cần charts, trends, insights.

#### 3a. Backend

* **Tập tin tạo mới:** `backend/src/modules/admin/admin-stats.service.ts`
* **Các hàm analytics:**

```typescript
// Thống kê tổng quan
export async function getAdminOverviewStats() {
  // Return: { totalUsers, activeUsers7d, newUsersToday, totalSessions, 
  //           sessionsToday, avgScore, totalQuestions, aiCostEstimate }
}

// Sessions theo ngày (30 ngày)
export async function getSessionsByDay(days: number = 30) {
  // Return: Array<{ date: string; count: number; avgScore: number }>
}

// Phân bố điểm
export async function getScoreDistribution() {
  // Return: Array<{ range: "0-2" | "3-4" | "5-6" | "7-8" | "9-10"; count: number }>
}

// Top users
export async function getTopActiveUsers(limit: number = 10) {
  // Return: Array<{ userId, fullName, email, sessionCount, avgScore, lastActive }>
}

// Câu hỏi yếu nhất (cần review)
export async function getWeakestQuestions(limit: number = 10) {
  // Return: Array<{ questionId, questionText, avgScore, answerCount, category }>
}

// Phân bố user theo trường/ngành/học bổng
export async function getUserDistribution() {
  // Return: { bySchool: [...], byMajor: [...], byScholarship: [...] }
}

// Heatmap giờ cao điểm
export async function getActivityHeatmap() {
  // Return: Array<{ dayOfWeek: number; hour: number; count: number }>
}

// AI cost tracking
export async function getAICostTracking(days: number = 30) {
  // Query ai_usage_logs: SUM(cost_usd) GROUP BY date
  // Return: Array<{ date: string; cost: number; requests: number }>
}
```

* **Tập tin sửa đổi:** `backend/src/modules/admin/admin.routes.ts`
  * Thêm routes:
    * `GET /api/admin/stats/overview`
    * `GET /api/admin/stats/sessions-by-day?days=30`
    * `GET /api/admin/stats/score-distribution`
    * `GET /api/admin/stats/top-users?limit=10`
    * `GET /api/admin/stats/weak-questions?limit=10`
    * `GET /api/admin/stats/user-distribution`
    * `GET /api/admin/stats/activity-heatmap`
    * `GET /api/admin/stats/ai-cost?days=30`

#### 3b. Frontend Admin Dashboard

* **Tập tin tạo mới:** `frontend/components/admin/analytics-overview.tsx`
  * 4 stat cards: Users, Sessions, Avg Score, Questions
  * Mỗi card có trend indicator (↑5% vs tuần trước)

* **Tập tin tạo mới:** `frontend/components/admin/sessions-chart.tsx`
  * Line chart: sessions/day (30 ngày)
  * Overlay: avg score line

* **Tập tin tạo mới:** `frontend/components/admin/score-distribution-chart.tsx`
  * Bar chart: phân bố điểm

* **Tập tin tạo mới:** `frontend/components/admin/user-distribution-chart.tsx`
  * Pie chart: tỷ lệ user theo trường/học bổng

* **Tập tin tạo mới:** `frontend/components/admin/activity-heatmap.tsx`
  * Grid heatmap: 7 ngày x 24 giờ, color intensity = activity

* **Tập tin tạo mới:** `frontend/components/admin/ai-cost-chart.tsx`
  * Line chart: chi phí AI theo ngày + tổng tháng

* **Tập tin tạo mới:** `frontend/components/admin/top-users-table.tsx`
  * Bảng xếp hạng user tích cực nhất

* **Tập tin tạo mới:** `frontend/components/admin/weak-questions-table.tsx`
  * Bảng câu hỏi có điểm thấp nhất — link đến edit

* **Tập tin sửa đổi:** `frontend/app/admin/page.tsx`
  * Rebuild hoàn toàn: 2 cột layout với tất cả charts ở trên

* **Tập tin sửa đổi:** `frontend/app/admin/analytics/page.tsx`
  * Trang analytics chi tiết hơn với filters (date range, school, major)

---

## 🧪 Agent 3: Testing, CI/CD & Study Plan Analysis

### 1. Unit Tests & Integration Tests

**Vấn đề hiện tại:** 0 test files. Dự án production không có test = rủi ro cao.

#### 1a. Setup Testing Framework

* **Tập tin tạo mới:** `backend/vitest.config.ts`
  ```typescript
  import { defineConfig } from "vitest/config";
  export default defineConfig({
    test: {
      globals: true,
      environment: "node",
      include: ["src/**/*.test.ts"],
      coverage: { provider: "v8", reporter: ["text", "json", "html"] },
      setupFiles: ["./src/test/setup.ts"]
    }
  });
  ```

* **Tập tin tạo mới:** `backend/src/test/setup.ts`
  * Mock Prisma client (`vitest-mock-extended`)
  * Mock OpenAI client
  * Mock Redis/cache

* **Tập tin tạo mới:** `backend/src/test/helpers.ts`
  * `createMockUser()`, `createMockSession()`, `createMockAnswer()`
  * `createTestToken(userId, role)` — generate JWT for test
  * `setupTestApp()` — create Express app instance for integration tests

#### 1b. Unit Tests

* **Tập tin tạo mới:** `backend/src/modules/auth/auth.utils.test.ts`
  * Test `hashToken()`, `compareToken()`
  * Test `createAccessToken()`, `createRefreshToken()`
  * Test token expiration
  * Test `getRefreshTokenFromRequest()` — cookie parsing

* **Tập tin tạo mới:** `backend/src/modules/interviews/adaptive-interview.engine.test.ts`
  * Test difficulty adjustment logic
  * Test topic branching
  * Test follow-up question generation trigger
  * Test conversation memory (no duplicate questions)

* **Tập tin tạo mới:** `backend/src/modules/interviews/detailed-scoring.service.test.ts`
  * Test score parsing from AI response
  * Test weighted average calculation
  * Test edge cases: empty answer, very long answer, non-UTF8

* **Tập tin tạo mới:** `backend/src/modules/gamification/gamification.service.test.ts`
  * Test `getWeekStart()` — different timezones, edge dates
  * Test `calculateStreak()` — consecutive days, gaps, today included
  * Test `meetsRequirement()` — all badge types
  * Test `awardBadgesForUser()` — no duplicate awards

* **Tập tin tạo mới:** `backend/src/modules/interviews/rag-context.service.test.ts`
  * Test `buildInterviewRagContext()` — with school/major/scholarship
  * Test `cleanTargetName()` — edge cases, placeholder names
  * Test context length capping at 6000 chars
  * Test fuzzy matching via `rankSearchCandidate()`

* **Tập tin tạo mới:** `backend/src/utils/errors.test.ts`
  * Test all 9 error classes
  * Test error handler middleware

* **Tập tin tạo mới:** `backend/src/cache/cache.service.test.ts`
  * Test memory fallback khi Redis unavailable
  * Test TTL expiration
  * Test JSON serialization/deserialization

#### 1c. Integration Tests (API level)

* **Tập tin tạo mới:** `backend/src/modules/auth/auth.integration.test.ts`
  * Test full flow: register → login → refresh → logout
  * Test invalid credentials
  * Test duplicate email registration
  * Test rate limiting

* **Tập tin tạo mới:** `backend/src/modules/interviews/interviews.integration.test.ts`
  * Test create session → submit answer → complete → get results
  * Test unauthorized access
  * Test re-practice flow (Agent 1's feature)

* **Tập tin tạo mới:** `backend/src/modules/admin/admin.integration.test.ts`
  * Test admin routes with USER role → 403
  * Test admin routes with ADMIN role → 200
  * Test CRUD operations

#### 1d. Frontend Component Tests

* **Tập tin tạo mới:** `frontend/__tests__/components/progress-tracker.test.tsx`
* **Tập tin tạo mới:** `frontend/__tests__/components/wizard-steps.test.tsx`
* **Tập tin tạo mới:** `frontend/__tests__/components/score-radar-chart.test.tsx`
* **Tập tin tạo mới:** `frontend/__tests__/lib/auth-client.test.ts`

* **Dependencies mới:**
  ```bash
  # Backend
  npm install -D vitest @vitest/coverage-v8 vitest-mock-extended supertest @types/supertest

  # Frontend
  npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
  ```

### 2. CI/CD Pipeline (GitHub Actions)

* **Tập tin tạo mới:** `.github/workflows/ci.yml`
  ```yaml
  name: CI
  on:
    push:
      branches: [main, develop]
    pull_request:
      branches: [main, develop]

  jobs:
    lint-and-type-check:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 20 }
        - run: npm ci
        - run: npm --prefix backend ci
        - run: npm --prefix frontend ci
        - run: npm --prefix backend run lint
        - run: npm --prefix frontend run lint
        - run: npm --prefix backend run build  # tsc type check
        - run: npm --prefix frontend run build

    backend-tests:
      runs-on: ubuntu-latest
      services:
        postgres:
          image: postgres:16-alpine
          env:
            POSTGRES_USER: test
            POSTGRES_PASSWORD: test
            POSTGRES_DB: interview_test
          ports: ["5432:5432"]
          options: >-
            --health-cmd pg_isready
            --health-interval 10s
            --health-timeout 5s
            --health-retries 5
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 20 }
        - run: npm --prefix backend ci
        - run: npx --prefix backend prisma migrate deploy
          env:
            DATABASE_URL: postgresql://test:test@localhost:5432/interview_test
        - run: npm --prefix backend test -- --coverage
          env:
            DATABASE_URL: postgresql://test:test@localhost:5432/interview_test
            JWT_SECRET: test-secret-key-for-ci
            OPENAI_API_KEY: sk-test-mock

    frontend-tests:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 20 }
        - run: npm --prefix frontend ci
        - run: npm --prefix frontend test -- --coverage
  ```

* **Tập tin tạo mới:** `.github/workflows/deploy.yml`
  ```yaml
  name: Deploy
  on:
    push:
      branches: [main]
  
  jobs:
    deploy-backend:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        # Deploy to Railway/Render via webhook or CLI
    
    deploy-frontend:
      runs-on: ubuntu-latest  
      steps:
        - uses: actions/checkout@v4
        # Vercel auto-deploys from main branch — no action needed
        # Or use vercel CLI for custom deploy
  ```

### 3. Study Plan AI Analysis (Wizard Steps 5-6)

**Vấn đề hiện tại:** Wizard chỉ có 4 bước. Steps 5-6 (Study Plan analysis + Radar chart nâng cao) deferred từ Big Update 1.

#### 3a. Backend

* **Tập tin tạo mới:** `backend/src/modules/interviews/study-plan-analysis.service.ts`

```typescript
// study-plan-analysis.service.ts

export interface StudyPlanAnalysisResult {
  strengths: string[];        // Điểm mạnh của study plan
  weaknesses: string[];       // Điểm yếu
  missingPoints: string[];    // Phần thiếu (mà trường/học bổng yêu cầu)
  suggestions: string[];      // Gợi ý cải thiện
  alignmentScore: number;     // 0-100: mức độ phù hợp với trường/ngành/học bổng
  generatedQuestions: string[]; // 3-5 câu hỏi AI tạo từ study plan
}

// Phân tích study plan dựa trên RAG context
export async function analyzeStudyPlan(
  studyPlan: string,
  ragContext: InterviewRagContext,
  degreeLevel: DegreeLevel
): Promise<StudyPlanAnalysisResult> {
  // 1. Build prompt với RAG context (school requirements, scholarship requirements)
  // 2. Gọi AI: "Phân tích study plan này cho [trường] [ngành] [học bổng]"
  // 3. Parse AI response thành struct
  // 4. Lưu vào bảng study_plan_analyses
}
```

* **Tập tin sửa đổi:** `backend/src/modules/interviews/interviews.routes.ts`
  * Thêm route: `POST /api/interviews/analyze-study-plan`
  * Body: `{ studyPlan: string; schoolId?: string; majorId?: string; scholarshipId?: string }`
  * Rate limit: 3 req/min (AI-heavy)

#### 3b. Frontend Wizard Steps 5-6

* **Tập tin sửa đổi:** `frontend/components/interview/wizard-steps.tsx`
  * **Step 5 — Study Plan Analysis:**
    * Textarea lớn để nhập/paste study plan
    * Nút "AI Phân tích" → loading → hiển thị kết quả inline
    * Kết quả: alignment score gauge, strengths/weaknesses lists, suggestions
    * Nút "Tiếp tục với study plan này" hoặc "Sửa lại"
  
  * **Step 6 — Tóm tắt mở rộng & Bắt đầu:**
    * Tóm tắt tất cả thông tin từ 5 bước
    * Hiện study plan analysis score
    * Hiện "AI đã chuẩn bị X câu hỏi dựa trên study plan của bạn"
    * Nút "Bắt đầu phỏng vấn" → gọi API tạo session

* **Tập tin sửa đổi:** `frontend/components/interview/progress-tracker.tsx`
  * Cập nhật totalSteps từ 4 → 6
  * Step 5-6 optional (skip được nếu không có study plan)

* **Tập tin tạo mới:** `frontend/components/interview/study-plan-result.tsx`
  * Component hiển thị kết quả phân tích study plan
  * Alignment score gauge (circular progress)
  * Strengths (xanh lá), Weaknesses (đỏ), Missing (vàng) badges
  * Expandable suggestions list

### 4. Sample Answer Comparison

**Vấn đề hiện tại:** Detailed scoring gợi ý "improved answer" nhưng không so sánh với sample answer từ question bank.

#### 4a. Backend

* **Tập tin sửa đổi:** `backend/src/modules/interviews/detailed-scoring.service.ts`
  * Khi chấm điểm, nếu question có `sampleAnswer` → thêm vào AI prompt:
    ```
    Reference sample answer (for comparison, not exact match):
    "${question.sampleAnswer}"
    
    Provide: how close the student's answer is to the sample, what key points they missed.
    ```
  * Thêm field trong scoring response: `sampleAnswerComparison: { matchPercentage: number; missedPoints: string[] }`

#### 4b. Frontend

* **Tập tin sửa đổi:** `frontend/components/interview/answer-feedback-panel.tsx`
  * Thêm section "So sánh với câu trả lời mẫu" (collapsible)
  * Hiển thị match percentage + missed points
  * Toggle hiện/ẩn sample answer (spoiler mode)

---

## 📋 TỔNG HỢP DANH SÁCH FILES CỦA TỪNG AGENT

### 🎨 Agent 1 — Files (16 files)

| Hành động | File | Mô tả |
|---|---|---|
| TẠO MỚI | `backend/src/modules/interviews/interview-stats.service.ts` | API thống kê progress |
| TẠO MỚI | `frontend/components/dashboard/progress-chart.tsx` | Line chart điểm theo thời gian |
| TẠO MỚI | `frontend/components/dashboard/skill-radar-progress.tsx` | Radar chart so sánh tuần |
| TẠO MỚI | `frontend/components/dashboard/weak-areas-card.tsx` | Card chủ đề yếu |
| TẠO MỚI | `frontend/components/dashboard/re-practice-card.tsx` | Widget re-practice trên dashboard |
| TẠO MỚI | `frontend/lib/pdf/interview-report-pdf.ts` | PDF generation logic |
| TẠO MỚI | `frontend/components/interview/re-practice-dialog.tsx` | Dialog chọn câu luyện lại |
| TẠO MỚI | `frontend/components/onboarding/onboarding-wizard.tsx` | Wizard 4 bước cho user mới |
| TẠO MỚI | `frontend/components/onboarding/onboarding-step.tsx` | Step component chung |
| TẠO MỚI | `frontend/components/onboarding/trial-interview.tsx` | Mini interview cho onboarding |
| TẠO MỚI | `frontend/app/onboarding/page.tsx` | Page onboarding |
| SỬA | `frontend/app/dashboard/page.tsx` | Thêm progress charts + weak areas |
| SỬA | `frontend/components/interview/interview-result.tsx` | Thêm PDF + re-practice buttons |
| SỬA | `frontend/components/app-shell.tsx` | Check onboarding completed |
| SỬA | `backend/src/modules/interviews/interviews.routes.ts` | Thêm progress/compare/re-practice routes |
| SỬA | `backend/prisma/schema.prisma` | Thêm sourceSessionId, rePracticeType |

### ⚡ Agent 2 — Files (21 files)

| Hành động | File | Mô tả |
|---|---|---|
| TẠO MỚI | `backend/src/modules/realtime/ws-interview.handler.ts` | WebSocket interview logic |
| TẠO MỚI | `backend/src/modules/notifications/notifications.service.ts` | Notification CRUD |
| TẠO MỚI | `backend/src/modules/notifications/notifications.routes.ts` | Notification API routes |
| TẠO MỚI | `backend/src/modules/admin/admin-stats.service.ts` | Analytics queries |
| TẠO MỚI | `frontend/lib/ws-client.ts` | WebSocket client class |
| TẠO MỚI | `frontend/components/interview/typing-indicator.tsx` | AI typing animation |
| TẠO MỚI | `frontend/components/notifications/notification-bell.tsx` | Bell icon + dropdown |
| TẠO MỚI | `frontend/components/notifications/notification-list.tsx` | Full notification list |
| TẠO MỚI | `frontend/app/notifications/page.tsx` | Notifications page |
| TẠO MỚI | `frontend/components/admin/analytics-overview.tsx` | 4 stat cards |
| TẠO MỚI | `frontend/components/admin/sessions-chart.tsx` | Sessions line chart |
| TẠO MỚI | `frontend/components/admin/score-distribution-chart.tsx` | Score bar chart |
| TẠO MỚI | `frontend/components/admin/user-distribution-chart.tsx` | User pie chart |
| TẠO MỚI | `frontend/components/admin/activity-heatmap.tsx` | Activity heatmap |
| TẠO MỚI | `frontend/components/admin/ai-cost-chart.tsx` | AI cost tracking |
| TẠO MỚI | `frontend/components/admin/top-users-table.tsx` | Top users table |
| TẠO MỚI | `frontend/components/admin/weak-questions-table.tsx` | Weak questions table |
| SỬA | `backend/src/server.ts` | WebSocket handler upgrade |
| SỬA | `backend/src/modules/admin/admin.routes.ts` | Thêm analytics routes |
| SỬA | `backend/src/modules/gamification/gamification.service.ts` | Trigger notifications |
| SỬA | `backend/prisma/schema.prisma` | Thêm Notification model |
| SỬA | `frontend/components/user-navbar.tsx` | Thêm notification bell |
| SỬA | `frontend/components/interview/interview-room.tsx` | WebSocket integration |
| SỬA | `frontend/app/admin/page.tsx` | Rebuild admin dashboard |
| SỬA | `frontend/app/admin/analytics/page.tsx` | Chi tiết analytics |

### 🧪 Agent 3 — Files (22 files)

| Hành động | File | Mô tả |
|---|---|---|
| TẠO MỚI | `backend/vitest.config.ts` | Vitest config |
| TẠO MỚI | `backend/src/test/setup.ts` | Test setup + mocks |
| TẠO MỚI | `backend/src/test/helpers.ts` | Test helpers |
| TẠO MỚI | `backend/src/modules/auth/auth.utils.test.ts` | Auth unit tests |
| TẠO MỚI | `backend/src/modules/interviews/adaptive-interview.engine.test.ts` | Adaptive engine tests |
| TẠO MỚI | `backend/src/modules/interviews/detailed-scoring.service.test.ts` | Scoring tests |
| TẠO MỚI | `backend/src/modules/gamification/gamification.service.test.ts` | Gamification tests |
| TẠO MỚI | `backend/src/modules/interviews/rag-context.service.test.ts` | RAG tests |
| TẠO MỚI | `backend/src/utils/errors.test.ts` | Error classes tests |
| TẠO MỚI | `backend/src/cache/cache.service.test.ts` | Cache tests |
| TẠO MỚI | `backend/src/modules/auth/auth.integration.test.ts` | Auth flow integration |
| TẠO MỚI | `backend/src/modules/interviews/interviews.integration.test.ts` | Interview flow integration |
| TẠO MỚI | `backend/src/modules/admin/admin.integration.test.ts` | Admin access integration |
| TẠO MỚI | `frontend/__tests__/components/progress-tracker.test.tsx` | Component test |
| TẠO MỚI | `frontend/__tests__/components/wizard-steps.test.tsx` | Component test |
| TẠO MỚI | `frontend/__tests__/components/score-radar-chart.test.tsx` | Component test |
| TẠO MỚI | `frontend/__tests__/lib/auth-client.test.ts` | Auth client test |
| TẠO MỚI | `.github/workflows/ci.yml` | CI pipeline |
| TẠO MỚI | `.github/workflows/deploy.yml` | Deploy pipeline |
| TẠO MỚI | `backend/src/modules/interviews/study-plan-analysis.service.ts` | Study plan AI analysis |
| TẠO MỚI | `frontend/components/interview/study-plan-result.tsx` | Study plan result UI |
| SỬA | `frontend/components/interview/wizard-steps.tsx` | Thêm step 5-6 |
| SỬA | `frontend/components/interview/progress-tracker.tsx` | 4 → 6 steps |
| SỬA | `backend/src/modules/interviews/interviews.routes.ts` | Thêm analyze-study-plan route |
| SỬA | `backend/src/modules/interviews/detailed-scoring.service.ts` | Sample answer comparison |
| SỬA | `frontend/components/interview/answer-feedback-panel.tsx` | So sánh sample answer |
| SỬA | `backend/package.json` | Thêm vitest dependencies |
| SỬA | `frontend/package.json` | Thêm testing dependencies |

---

## 🔢 THỨ TỰ THỰC HIỆN TỪNG AGENT

### 🎨 Agent 1 — Thứ tự 8 bước:
```
Bước 1 → Tạo interview-stats.service.ts (backend progress APIs)
Bước 2 → Thêm routes progress/compare/weak-areas vào interviews.routes.ts
Bước 3 → Tạo progress-chart.tsx + skill-radar-progress.tsx + weak-areas-card.tsx
Bước 4 → Sửa dashboard/page.tsx (thêm progress section)
Bước 5 → Tạo interview-report-pdf.ts + sửa interview-result.tsx (PDF export)
Bước 6 → Schema migration (sourceSessionId) + re-practice route + re-practice-dialog.tsx
Bước 7 → Tạo onboarding wizard components (4 files)
Bước 8 → Sửa app-shell.tsx (onboarding check) + tạo onboarding/page.tsx
```

### ⚡ Agent 2 — Thứ tự 8 bước:
```
Bước 1 → Schema migration (Notification model)
Bước 2 → Tạo notifications.service.ts + notifications.routes.ts
Bước 3 → Tạo ws-interview.handler.ts (WebSocket logic)
Bước 4 → Sửa server.ts (WebSocket upgrade)
Bước 5 → Tạo ws-client.ts + typing-indicator.tsx + sửa interview-room.tsx
Bước 6 → Tạo notification-bell.tsx + notification-list.tsx + sửa user-navbar.tsx
Bước 7 → Tạo admin-stats.service.ts + sửa admin.routes.ts
Bước 8 → Tạo 8 admin chart components + rebuild admin/page.tsx
```

### 🧪 Agent 3 — Thứ tự 8 bước:
```
Bước 1 → Setup vitest (config + setup + helpers) + install dependencies
Bước 2 → Unit tests: auth.utils, errors, cache
Bước 3 → Unit tests: gamification, rag-context, adaptive-engine, scoring
Bước 4 → Integration tests: auth flow, interview flow, admin access
Bước 5 → Frontend component tests (4 files)
Bước 6 → CI/CD pipeline (.github/workflows/ci.yml + deploy.yml)
Bước 7 → study-plan-analysis.service.ts + route + wizard steps 5-6
Bước 8 → Sample answer comparison (scoring service + feedback panel)
```

---

## 📦 DEPENDENCIES MỚI CẦN CÀI

### Backend
```bash
cd backend
npm install -D vitest @vitest/coverage-v8 vitest-mock-extended supertest @types/supertest
```

### Frontend
```bash
cd frontend
npm install @react-pdf/renderer
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

---

## 📅 QUY TRÌNH XÁC MINH & ĐO LƯỜNG

### 1. Kiểm Thử Progress Tracking
- Tạo 5+ sessions cho 1 user → verify progress chart hiển thị đúng trend
- Verify weak areas API trả đúng category có điểm thấp nhất
- Test compare API: so 2 sessions → verify improvement percentage

### 2. Kiểm Thử PDF Export
- Export PDF cho session có đủ 8 câu → verify render đúng
- Export PDF cho session có score = null (chưa chấm) → verify không crash
- PDF hiển thị radar chart SVG đúng
- File size hợp lý (< 2MB cho 10 câu)

### 3. Kiểm Thử Re-practice
- Tạo re-practice session từ 3 câu yếu → verify session mới chỉ có 3 câu đó
- Verify `sourceSessionId` link đúng
- Sau khi complete re-practice → so sánh điểm mới vs cũ

### 4. Kiểm Thử WebSocket
- Connect WebSocket → verify JWT auth
- Gửi answer qua WS → nhận score back
- Test reconnection: ngắt mạng 5s → auto reconnect
- Test concurrent: 2 users phỏng vấn đồng thời → verify isolation

### 5. Kiểm Thử Notifications
- Award badge → verify notification xuất hiện
- GET unread count → verify số đúng
- Mark as read → verify count giảm
- Mark all read → verify all isRead = true

### 6. Kiểm Thử Admin Analytics
- Verify overview stats match actual data
- Verify sessions-by-day chart data đúng
- Verify top users sorted by session count
- Verify weak questions sorted by avg score ASC

### 7. Kiểm Thử Tests & CI
- `npm test` backend → all pass
- `npm test` frontend → all pass
- Push to GitHub → CI workflow trigger → green
- Coverage > 60% backend, > 40% frontend

### 8. Kiểm Thử Onboarding
- User mới đăng ký → redirect `/onboarding`
- Hoàn thành 4 bước → `onboarding_completed = true`
- Login lại → đi thẳng dashboard (không show onboarding lại)
- Skip onboarding → vẫn đánh dấu completed

### 9. Kiểm Thử Study Plan Analysis
- Nhập study plan + chọn trường → AI phân tích
- Verify alignment score hiển thị
- Verify generated questions inject vào session
- Wizard step 5 skip được nếu không có study plan

---

## 🎯 MỤC TIÊU SAU BIG UPDATE 2

| Tiêu chí | Trước BU2 | Sau BU2 |
|---|---|---|
| Progress tracking | ❌ | ✅ Charts + radar + weak areas |
| PDF export | ❌ | ✅ Full report download |
| Re-practice mode | ❌ | ✅ Luyện lại câu yếu |
| WebSocket realtime | ❌ Echo only | ✅ Full interview events |
| Notifications | ❌ | ✅ Bell + list + badge alerts |
| Admin analytics | ⚠️ Basic | ✅ 8 charts + heatmap + AI cost |
| Onboarding | ❌ | ✅ 4-step wizard |
| Unit tests | 0 | 40+ tests |
| CI/CD | ❌ | ✅ GitHub Actions |
| Study Plan AI | ❌ | ✅ Wizard steps 5-6 |
| Sample answer comparison | ❌ | ✅ Match % + missed points |
| Speech Analysis | 13/14 | 13/14 (Chinese tones for BU3) |

---

## ⚠️ GHI CHÚ QUAN TRỌNG

1. **Schema migrations** cần chạy TRƯỚC code deploy:
   - Agent 1: `sourceSessionId`, `rePracticeType` trên InterviewSession
   - Agent 2: `Notification` model mới
   - Chạy: `npx prisma migrate dev --name big_update_2`

2. **WebSocket auth**: Chỉ dùng query param token cho WebSocket handshake (không thể set header trong browser WebSocket API). Token được verify 1 lần khi connect, không gửi lại mỗi message.

3. **PDF generation**: Chạy client-side (browser) để tránh tải server. Dùng `@react-pdf/renderer` render React components → PDF blob → download.

4. **Test mocking**: KHÔNG gọi OpenAI API thật trong tests. Mock tất cả AI calls.

5. **Agent 2 WebSocket sửa server.ts TRƯỚC** → Agent 3 sửa server.ts cho test setup SAU.

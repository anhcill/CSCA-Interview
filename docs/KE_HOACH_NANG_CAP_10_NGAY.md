# Kế Hoạch Nâng Cấp Toàn Diện — 10 Ngày (Giai Đoạn 2)

> **Tiền đề**: MVP 15 ngày đã hoàn thành — auth, profile, admin CRUD, phỏng vấn text, AI chấm điểm, báo cáo, lịch sử.
> **Mục tiêu giai đoạn 2**: Nâng cấp thành sản phẩm thực tế có thể ra mắt người dùng thật — AI thông minh hơn, phỏng vấn bằng giọng nói, UI/UX chuyên nghiệp, trải nghiệm mượt mà, sẵn sàng scale.

---

## Tổng Quan 10 Ngày

| Ngày | Chủ đề | Trọng tâm |
|------|--------|-----------|
| 1 | Speech-to-Text & Text-to-Speech | Phỏng vấn bằng giọng nói |
| 2 | AI Nâng Cao — Câu hỏi thông minh | Follow-up questions, adaptive difficulty |
| 3 | AI Nâng Cao — Phân tích sâu | Phân tích phát âm, ngữ pháp, rubric chi tiết |
| 4 | UI/UX Overhaul — Design System | Redesign toàn bộ, dark mode, animation |
| 5 | UI/UX Overhaul — Phỏng vấn & Dashboard | Giao diện phỏng vấn immersive, dashboard analytics |
| 6 | Trải nghiệm người dùng — Onboarding & Gamification | Hướng dẫn mới, streak, badge, progress tracking |
| 7 | Real-time & Performance | WebSocket, caching, lazy loading, SSR optimization |
| 8 | Đa ngôn ngữ & Accessibility | i18n (Việt/Trung/Anh), a11y, responsive hoàn chỉnh |
| 9 | Admin Analytics & Import/Export | Dashboard admin nâng cao, import CSV/Excel, thống kê |
| 10 | Testing, Deploy Production & Documentation | E2E test, CI/CD, deploy production, tài liệu |

---

## Ngày 1: Speech-to-Text & Text-to-Speech

### Mục tiêu
Người dùng có thể phỏng vấn bằng giọng nói thay vì chỉ gõ text.

### Việc cần làm

#### Backend
- [x] Tích hợp **Web Speech API** (browser-native) cho Speech-to-Text cơ bản
- [x] Tích hợp **OpenAI Whisper API** cho STT chính xác hơn (fallback khi browser không hỗ trợ)
- [x] API endpoint `POST /api/speech/transcribe` — nhận audio blob, trả về text
- [x] Tích hợp **OpenAI TTS API** hoặc **Web Speech Synthesis API** cho Text-to-Speech
- [x] API endpoint `POST /api/speech/synthesize` — nhận text, trả về audio stream
- [x] Cấu hình giới hạn file size audio (max 10MB)
- [x] Rate limit cho speech endpoints (5 req/min)

#### Frontend
- [x] Component `VoiceRecorder` — ghi âm, hiển thị waveform, nút start/stop
- [x] Component `AudioPlayer` — phát câu hỏi bằng giọng nói
- [x] Toggle chế độ phỏng vấn: **Text** / **Voice** / **Hybrid** (nghe voice, trả lời text)
- [x] Hiển thị transcript realtime khi người dùng nói
- [x] Loading state khi đang xử lý audio
- [x] Fallback: nếu micro không khả dụng → tự chuyển về text mode
- [x] Xin quyền microphone với UX rõ ràng

#### Hỗ trợ ngôn ngữ
- [x] STT hỗ trợ: Tiếng Việt (`vi-VN`), Tiếng Trung (`zh-CN`), Tiếng Anh (`en-US`)
- [x] TTS hỗ trợ: Tiếng Trung (cho câu hỏi tiếng Trung), Tiếng Việt (cho hướng dẫn)

### Đầu ra
- Người dùng nghe câu hỏi bằng giọng nói
- Người dùng trả lời bằng giọng nói, hệ thống tự chuyển thành text
- Chế độ hybrid cho người chưa quen

### Công nghệ
- `MediaRecorder API` (browser)
- `OpenAI Whisper` (server-side STT)
- `OpenAI TTS` hoặc `Web Speech Synthesis` (TTS)
- `lamejs` hoặc `opus-recorder` (encode audio trước khi gửi)

---

## Ngày 2: AI Nâng Cao — Câu Hỏi Thông Minh

### Mục tiêu
AI đặt câu hỏi follow-up dựa trên câu trả lời trước, tự điều chỉnh độ khó.

### Việc cần làm

#### Adaptive Interview Engine
- [x] **Follow-up Questions**: AI phân tích câu trả lời → tạo câu hỏi đào sâu
  - VD: User nói "tôi muốn nghiên cứu AI" → AI hỏi "Bạn đã đọc paper nào về AI chưa?"
- [x] **Adaptive Difficulty**: Điểm thấp → hỏi dễ hơn, điểm cao → hỏi khó hơn
- [x] **Topic Branching**: Nếu user trả lời yếu ở chủ đề nào → hỏi thêm chủ đề đó
- [x] **Conversation Memory**: Lưu context cả buổi phỏng vấn, tránh hỏi lặp

#### Prompt Engineering
- [x] Redesign system prompt cho interviewer AI:
  - Persona: giáo sư Trung Quốc, thân thiện nhưng nghiêm túc
  - Context: thông tin profile, trường, ngành, học bổng
  - Rules: không hỏi lặp, tăng/giảm độ khó theo performance
- [x] Tạo prompt template cho từng loại câu hỏi:
  - `PERSONAL` → warm-up, dễ
  - `ACADEMIC` → kiểm tra kiến thức chuyên ngành
  - `STUDY_PLAN` → đánh giá kế hoạch học tập
  - `MOTIVATION` → đánh giá động lực
  - `SCHOLARSHIP_SPECIFIC` → câu hỏi riêng từng loại học bổng

#### Backend
- [x] Service `AdaptiveInterviewEngine` — quản lý flow phỏng vấn thông minh
- [x] Lưu `conversation_history` vào session để AI có context
- [x] API `POST /api/interviews/:id/next-question` — trả câu hỏi tiếp theo (DB hoặc AI-generated)
- [x] Logic chọn câu hỏi: 60% từ DB + 40% AI follow-up (có thể config)

#### Frontend
- [x] Hiển thị indicator khi AI đang suy nghĩ câu hỏi
- [x] Hiển thị tag "Câu hỏi đào sâu" cho follow-up questions
- [x] Smooth transition giữa các câu hỏi

### Đầu ra
- Phỏng vấn tự nhiên như người thật
- Câu hỏi thay đổi theo từng người dùng
- Độ khó tự điều chỉnh

---

## Ngày 3: AI Nâng Cao — Phân Tích Sâu

### Mục tiêu
AI chấm điểm chi tiết hơn, phân tích ngôn ngữ, gợi ý cải thiện cụ thể.

### Việc cần làm

#### Scoring Rubric Nâng Cao
- [x] Chấm theo 6 tiêu chí (mỗi tiêu chí 0-10):
  1. **Nội dung** — trả lời đúng trọng tâm câu hỏi
  2. **Logic** — lập luận mạch lạc, có dẫn chứng
  3. **Ngôn ngữ** — ngữ pháp, từ vựng phù hợp ngữ cảnh
  4. **Tự tin** — giọng điệu tự tin, không ấp úng (nếu voice)
  5. **Chuyên ngành** — thể hiện hiểu biết về ngành/trường apply
  6. **Ấn tượng** — câu trả lời có điểm nhấn, khác biệt
- [x] Tổng điểm weighted average (nội dung 25%, logic 20%, ngôn ngữ 20%, tự tin 10%, chuyên ngành 15%, ấn tượng 10%)

#### Phân Tích Ngôn Ngữ
- [x] Phát hiện lỗi ngữ pháp tiếng Trung (nếu trả lời bằng tiếng Trung)
- [x] Gợi ý từ vựng học thuật phù hợp
- [x] Phân tích cấu trúc câu — quá ngắn/quá dài/thiếu ý chính
- [ ] So sánh với câu trả lời mẫu (sample answer từ DB) _(deferred — cần sample answer data)_

#### Feedback Cải Thiện
- [x] AI tạo **3 điểm mạnh** + **3 điểm cần cải thiện** cho mỗi câu
- [x] Gợi ý câu trả lời mẫu (không phải đáp án chuẩn — mà là hướng trả lời tốt hơn)
- [x] Gợi ý tài liệu/keyword nên tìm hiểu thêm
- [x] **Session Summary AI**: tổng kết cả buổi phỏng vấn bằng 1 đoạn văn

#### Backend
- [x] Service `DetailedScoringService` — chấm điểm chi tiết
- [x] Cập nhật model `InterviewAnswer` thêm fields: `detailedScores` (JSON), `strengths`, `weaknesses`, `improvementTips`
- [x] API `GET /api/interviews/:id/analysis` — trả phân tích chi tiết toàn session
- [x] Migration database cho fields mới _(sử dụng JSON fields trong existing schema)_

#### Frontend
- [x] Component `DetailedScoreCard` — hiển thị radar chart 6 tiêu chí (`ScoreRadarChart`)
- [x] Component `FeedbackPanel` — strengths/weaknesses/tips (`AnswerFeedbackPanel`)
- [x] Component `SessionSummary` — tổng kết AI cho cả buổi _(integrated in interview-result.tsx)_
- [ ] So sánh điểm giữa các session (progress over time) _(deferred to Ngày 5)_

### Đầu ra
- Feedback chi tiết, actionable
- Người dùng biết chính xác cần cải thiện gì
- Có tracking tiến bộ qua thời gian

### Công nghệ
- `recharts` hoặc `chart.js` cho radar chart
- OpenAI `gpt-4o` cho phân tích sâu (gpt-3.5 cho MVP, nâng lên gpt-4o giai đoạn 2)

---

## Ngày 4: UI/UX Overhaul — Design System

### Mục tiêu
Redesign toàn bộ giao diện, tạo design system nhất quán, thêm dark mode và animation.

### Việc cần làm

#### Design System
- [ ] Định nghĩa **color palette** mới:
  - Primary: xanh dương education (#2563EB)
  - Secondary: vàng gold scholarship (#F59E0B)
  - Accent: xanh lá success (#10B981)
  - Neutral: slate tones
  - Error: đỏ (#EF4444)
- [ ] Định nghĩa **typography scale**: heading, body, caption, label
- [ ] Tạo **component library** chuẩn:
  - Button (primary, secondary, ghost, danger, loading)
  - Input (text, textarea, select, combobox, date picker)
  - Card (default, elevated, interactive)
  - Modal/Dialog
  - Toast/Notification
  - Badge, Tag, Chip
  - Avatar
  - Skeleton loader
  - Empty state illustration
- [ ] Tạo file `design-tokens.css` hoặc Tailwind theme extension

#### Dark Mode
- [ ] Implement dark mode toggle (system preference + manual)
- [ ] Dark color palette cho tất cả components
- [ ] Lưu preference vào localStorage
- [ ] Smooth transition khi switch theme

#### Animation & Micro-interactions
- [ ] Page transition animation (Framer Motion)
- [ ] Button hover/click effects
- [ ] Card hover lift effect
- [ ] Loading skeleton animation
- [ ] Toast slide-in animation
- [ ] Number count-up animation cho điểm số
- [ ] Confetti effect khi đạt điểm cao

#### Layout
- [ ] Redesign **Sidebar navigation** (collapsible)
- [ ] Redesign **Header** với breadcrumb
- [ ] Responsive breakpoints chuẩn: mobile (< 640px), tablet (640-1024px), desktop (> 1024px)
- [ ] Bottom navigation cho mobile

### Đầu ra
- Giao diện chuyên nghiệp, nhất quán
- Dark mode hoạt động tốt
- Animation mượt mà, không gượng

### Công nghệ
- `framer-motion` cho animation
- `next-themes` cho dark mode
- `tailwind-merge` + `clsx` cho class management
- `lucide-react` cho icon set nhất quán

---

## Ngày 5: UI/UX Overhaul — Phỏng Vấn & Dashboard

### Mục tiêu
Giao diện phỏng vấn immersive, dashboard analytics cho user.

### Việc cần làm

#### Giao Diện Phỏng Vấn Mới
- [ ] **Interview Room**: layout full-screen, chia 2 panel:
  - Trái: Avatar interviewer (ảnh tĩnh hoặc animation đơn giản) + câu hỏi
  - Phải: Khu vực trả lời (text box hoặc voice recorder)
- [ ] **Progress Bar** ở trên: hiển thị tiến độ câu hỏi (3/10)
- [ ] **Timer** — đồng hồ đếm thời gian trả lời (optional, user bật/tắt)
- [ ] **Pause/Resume** — tạm dừng phỏng vấn
- [ ] **Quick Actions**: skip câu hỏi, xin gợi ý (hint)
- [ ] **Typing Indicator** khi AI đang tạo câu hỏi tiếp
- [ ] **Câu hỏi hiển thị từ từ** (typewriter effect) cho cảm giác tự nhiên
- [ ] **Kết thúc phỏng vấn**: animation + summary nhanh trước khi vào trang báo cáo

#### User Dashboard Mới
- [ ] **Overview Card**: tổng số buổi phỏng vấn, điểm trung bình, streak hiện tại
- [ ] **Progress Chart**: biểu đồ điểm theo thời gian (line chart)
- [ ] **Skill Radar**: radar chart điểm trung bình 6 tiêu chí
- [ ] **Recent Sessions**: 5 buổi gần nhất với quick stats
- [ ] **Weak Areas**: AI gợi ý chủ đề nên luyện thêm
- [ ] **Quick Start**: nút bắt đầu phỏng vấn nhanh với 1 click
- [ ] **Profile Completeness**: thanh tiến độ hoàn thiện profile

#### Trang Báo Cáo Nâng Cấp
- [ ] Tab layout: Tổng quan | Chi tiết từng câu | Gợi ý cải thiện
- [ ] Expand/collapse từng câu hỏi + câu trả lời
- [ ] Highlight điểm mạnh (xanh) / điểm yếu (đỏ) trong feedback
- [ ] Nút "Luyện lại câu hỏi này" → mở phỏng vấn chỉ với câu đó
- [ ] Nút chia sẻ báo cáo (copy link)
- [ ] Export PDF báo cáo

### Đầu ra
- Trải nghiệm phỏng vấn giống thật
- Dashboard giúp user thấy rõ tiến bộ
- Báo cáo chi tiết, actionable

### Công nghệ
- `recharts` cho charts
- `framer-motion` cho typewriter effect + animation
- `html2canvas` + `jspdf` cho export PDF
- `react-circular-progressbar` cho progress indicators

---

## Ngày 6: Trải Nghiệm Người Dùng — Onboarding & Gamification

### Mục tiêu
Người dùng mới biết dùng ngay, người dùng cũ có động lực quay lại.

### Việc cần làm

#### Onboarding Flow
- [ ] **Welcome Wizard** (3-4 bước):
  1. Chào mừng + giới thiệu app (animation)
  2. Điền thông tin nhanh (trường, ngành, học bổng) — bỏ qua được
  3. Chọn mục tiêu: "Tôi muốn luyện phỏng vấn CSC/ASEAN/tự túc"
  4. Phỏng vấn thử 3 câu → xem kết quả → "Bắt đầu hành trình!"
- [ ] **Contextual Tooltips**: tooltip hướng dẫn lần đầu dùng từng tính năng
- [ ] **Empty State hướng dẫn**: khi chưa có dữ liệu → hiển thị CTA rõ ràng
- [ ] Lưu trạng thái "đã xem onboarding" vào user preferences

#### Gamification
- [ ] **Daily Streak**: đếm số ngày liên tiếp luyện tập
  - Hiển thị streak counter trên dashboard
  - Thông báo nếu sắp mất streak
- [ ] **Badge System** (huy hiệu):
  - 🎯 "Phỏng vấn đầu tiên" — hoàn thành session đầu tiên
  - 🔥 "7 ngày liên tiếp" — streak 7 ngày
  - ⭐ "Điểm 9+" — đạt trên 9 điểm trong 1 câu
  - 🏆 "Phỏng vấn hoàn hảo" — tất cả câu trên 8 điểm
  - 📚 "Học không ngừng" — hoàn thành 20 session
  - 🌟 "Master" — điểm trung bình trên 8.5 sau 10 session
- [ ] **Level System**: Beginner → Intermediate → Advanced → Master
  - Dựa trên tổng điểm tích lũy
  - Hiển thị level + XP bar trên profile
- [ ] **Weekly Goal**: đặt mục tiêu luyện tập tuần (VD: 3 session/tuần)
  - Progress ring hiển thị tiến độ

#### Database
- [ ] Migration thêm bảng:
  - `UserBadge` (userId, badgeType, earnedAt)
  - `UserStreak` (userId, currentStreak, longestStreak, lastActiveDate)
  - `UserPreferences` (userId, onboardingCompleted, weeklyGoal, theme, language)
- [ ] Service `GamificationService` — tự động check + award badge sau mỗi session

#### Notifications
- [ ] Toast notification khi đạt badge mới
- [ ] Reminder notification nếu chưa luyện tập hôm nay (browser notification, optional)

### Đầu ra
- User mới bắt đầu dễ dàng
- User cũ có động lực quay lại mỗi ngày
- Trải nghiệm vui, không nhàm chán

### Công nghệ
- `react-joyride` hoặc custom tooltip cho onboarding tour
- `canvas-confetti` cho celebration effects
- `date-fns` cho streak calculation

---

## Ngày 7: Real-time & Performance

### Mục tiêu
Tối ưu tốc độ, thêm tương tác realtime.

### Việc cần làm

#### WebSocket / Server-Sent Events
- [ ] Implement **SSE** (Server-Sent Events) cho streaming AI response
  - Câu hỏi AI stream từng từ thay vì chờ hết
  - Feedback AI stream realtime
- [ ] Hoặc **WebSocket** nếu cần bi-directional:
  - Typing indicator
  - Live interview status

#### Performance Frontend
- [ ] **Code Splitting**: lazy load trang admin, trang interview
- [ ] **Image Optimization**: next/image cho avatar, illustrations
- [ ] **Skeleton Loading**: skeleton cho mọi data-fetching component
- [ ] **SWR / React Query**: cache API responses, stale-while-revalidate
- [ ] **Debounce** search inputs (300ms)
- [ ] **Virtual Scrolling** cho danh sách câu hỏi dài (react-window)
- [ ] **Bundle Analysis**: chạy `next build --analyze`, loại bỏ dependencies không cần

#### Performance Backend
- [ ] **Redis Cache** (hoặc in-memory cache):
  - Cache danh sách trường/ngành/học bổng (ít thay đổi)
  - Cache user profile trong session
- [ ] **Database Optimization**:
  - Thêm index cho các query thường dùng
  - Optimize Prisma queries: select chỉ fields cần thiết
  - Connection pooling config
- [ ] **API Response Compression**: gzip/brotli
- [ ] **Pagination** chuẩn cho tất cả list endpoints

#### Monitoring
- [ ] Thêm request logging (morgan hoặc custom middleware)
- [ ] Log AI API latency
- [ ] Health check endpoint chi tiết: DB status, AI status, memory usage

### Đầu ra
- Trang load nhanh (< 2s First Contentful Paint)
- AI response stream mượt mà
- Backend xử lý hiệu quả hơn

### Công nghệ
- `@tanstack/react-query` hoặc `swr` cho data fetching
- `react-window` cho virtual scrolling
- `ioredis` cho Redis cache (optional)
- `compression` middleware cho Express
- `morgan` cho request logging

---

## Ngày 8: Đa Ngôn Ngữ & Accessibility

### Mục tiêu
App hỗ trợ 3 ngôn ngữ (Việt/Trung/Anh), đạt chuẩn accessibility.

### Việc cần làm

#### Internationalization (i18n)
- [ ] Setup `next-intl` hoặc `next-i18next`
- [ ] Tạo file ngôn ngữ:
  - `vi.json` — Tiếng Việt (mặc định)
  - `zh.json` — 中文 (cho phỏng vấn tiếng Trung + UI)
  - `en.json` — English
- [ ] Translate tất cả text UI:
  - Navigation, buttons, labels, placeholders
  - Error messages, toast messages
  - Onboarding text
  - Email templates (nếu có)
- [ ] Language switcher trên header
- [ ] Lưu language preference vào user settings
- [ ] SEO: `hreflang` tags, localized meta descriptions

#### Phỏng Vấn Đa Ngôn Ngữ
- [ ] Chế độ phỏng vấn theo ngôn ngữ:
  - Tiếng Việt: hỏi + trả lời tiếng Việt
  - Tiếng Trung: hỏi tiếng Trung + trả lời tiếng Trung (luyện ngôn ngữ)
  - Song ngữ: hỏi tiếng Trung + subtitle tiếng Việt
- [ ] AI prompt tự động theo ngôn ngữ được chọn

#### Accessibility (a11y)
- [ ] **ARIA labels** cho tất cả interactive elements
- [ ] **Keyboard navigation**: tab order hợp lý, focus visible
- [ ] **Screen reader** support: alt text cho images, aria-live cho dynamic content
- [ ] **Color contrast**: đạt WCAG AA (4.5:1 cho text thường)
- [ ] **Font size**: cho phép user tăng/giảm cỡ chữ
- [ ] **Reduced motion**: tôn trọng `prefers-reduced-motion`
- [ ] **Focus trap** cho modals
- [ ] Chạy Lighthouse accessibility audit → fix tới > 90 điểm

#### Responsive Hoàn Chỉnh
- [ ] Test & fix trên: iPhone SE, iPhone 14, iPad, Android phổ biến
- [ ] Bottom sheet cho mobile modals
- [ ] Swipe gestures cho mobile navigation
- [ ] Touch-friendly tap targets (min 44x44px)

### Đầu ra
- App dùng được bằng 3 ngôn ngữ
- Người khuyết tật sử dụng được
- Hoạt động tốt trên mọi thiết bị

### Công nghệ
- `next-intl` cho i18n
- `eslint-plugin-jsx-a11y` cho a11y linting
- Chrome DevTools / axe-core cho accessibility testing

---

## Ngày 9: Admin Analytics & Import/Export

### Mục tiêu
Admin có dashboard analytics mạnh, import/export dữ liệu dễ dàng.

### Việc cần làm

#### Admin Dashboard Analytics
- [ ] **Overview Cards**:
  - Tổng users, users active 7 ngày, users mới hôm nay
  - Tổng sessions, sessions hôm nay
  - Điểm trung bình toàn hệ thống
  - Tổng câu hỏi trong DB
- [ ] **Charts**:
  - Line chart: số session theo ngày (30 ngày gần nhất)
  - Bar chart: phân bố điểm (0-2, 3-4, 5-6, 7-8, 9-10)
  - Pie chart: tỷ lệ user theo trường/ngành/học bổng
  - Heatmap: giờ cao điểm phỏng vấn
- [ ] **Top Users**: bảng xếp hạng user tích cực nhất
- [ ] **Weak Questions**: câu hỏi có điểm trung bình thấp nhất (cần review)
- [ ] **AI Cost Tracking**: ước tính chi phí AI API theo ngày/tháng

#### Import/Export Câu Hỏi
- [ ] **Import CSV/Excel**:
  - Template CSV mẫu để download
  - Upload file → preview dữ liệu → confirm import
  - Validate từng dòng, hiển thị lỗi rõ ràng
  - Hỗ trợ import hàng loạt (batch insert)
- [ ] **Export CSV/Excel**:
  - Export danh sách câu hỏi (có filter)
  - Export danh sách users
  - Export kết quả phỏng vấn

#### Admin Quản Lý User
- [ ] Trang danh sách users với search/filter
- [ ] Xem chi tiết user: profile, lịch sử phỏng vấn, điểm
- [ ] Khóa/mở khóa tài khoản user
- [ ] Reset password user
- [ ] Phân quyền: USER / ADMIN / SUPER_ADMIN

#### Backend APIs
- [ ] `GET /api/admin/stats` — thống kê tổng quan
- [ ] `GET /api/admin/stats/sessions` — thống kê sessions theo thời gian
- [ ] `GET /api/admin/stats/scores` — phân bố điểm
- [ ] `POST /api/admin/questions/import` — import CSV
- [ ] `GET /api/admin/questions/export` — export CSV
- [ ] `GET /api/admin/users` — danh sách users (admin)
- [ ] `PUT /api/admin/users/:id/status` — khóa/mở khóa user

### Đầu ra
- Admin nắm được tình hình hệ thống
- Import câu hỏi nhanh từ file
- Quản lý user hiệu quả

### Công nghệ
- `recharts` cho charts
- `xlsx` hoặc `exceljs` cho đọc/ghi Excel
- `papaparse` cho parse CSV
- `file-saver` cho download file

---

## Ngày 10: Testing, Deploy Production & Documentation

### Mục tiêu
Sản phẩm ổn định, deploy production, có tài liệu đầy đủ.

### Việc cần làm

#### Testing
- [ ] **E2E Tests** (Playwright hoặc Cypress):
  - Flow đăng ký → tạo profile → phỏng vấn → xem báo cáo
  - Flow admin: tạo câu hỏi → import CSV → xem thống kê
  - Auth: login, logout, protected routes, role-based access
  - Edge cases: profile thiếu thông tin, AI timeout, network error
- [ ] **API Tests** (Vitest hoặc Jest):
  - Auth endpoints
  - CRUD endpoints (schools, majors, scholarships, questions)
  - Interview flow endpoints
  - Validation errors
- [ ] **Component Tests** (React Testing Library):
  - Form validation
  - Voice recorder component
  - Interview UI interactions

#### CI/CD Pipeline
- [ ] GitHub Actions workflow:
  - Chạy lint + type check trên PR
  - Chạy tests trên PR
  - Auto deploy staging khi merge vào `develop`
  - Auto deploy production khi merge vào `main`
- [ ] Environment variables management cho staging vs production
- [ ] Database migration tự động khi deploy

#### Deploy Production
- [ ] **Frontend**: Deploy lên Vercel
  - Custom domain (nếu có)
  - Environment variables production
  - Preview deployments cho PR
- [ ] **Backend**: Deploy lên Railway / Render / Fly.io
  - Dockerfile cho backend
  - Auto-scale configuration
  - Health check endpoint
- [ ] **Database**: PostgreSQL trên Supabase / Neon / Railway
  - Backup schedule (daily)
  - Connection pooling (PgBouncer)
- [ ] **Monitoring**: 
  - Uptime monitoring (UptimeRobot / BetterStack)
  - Error tracking (Sentry)
  - Basic analytics (Vercel Analytics / Plausible)

#### Documentation
- [ ] `README.md` cập nhật:
  - Cách cài đặt local
  - Cách chạy tests
  - Cách deploy
  - Architecture overview
- [ ] `CONTRIBUTING.md` — hướng dẫn contribute
- [ ] `API_DOCUMENTATION.md` — tài liệu API (hoặc Swagger/OpenAPI)
- [ ] `HUONG_DAN_SU_DUNG.md` — hướng dẫn sử dụng cho end user
- [ ] `HUONG_DAN_ADMIN.md` — hướng dẫn cho admin
- [ ] Changelog / Release notes

#### Security Final Check
- [ ] Review tất cả API endpoints đều có auth + role check
- [ ] Kiểm tra không leak API keys, secrets
- [ ] CORS configuration chặt chẽ cho production
- [ ] Rate limiting hoạt động đúng
- [ ] Input validation (Zod) trên tất cả endpoints
- [ ] SQL injection — Prisma đã handle, nhưng review raw queries nếu có
- [ ] XSS — sanitize user input hiển thị trên UI

### Đầu ra
- Sản phẩm ổn định, có tests
- Deploy production, có domain
- Tài liệu đầy đủ cho dev + user + admin
- Sẵn sàng ra mắt người dùng thật

---

## Tổng Kết Dependencies Cần Cài

### Frontend (thêm mới)
```bash
npm install framer-motion next-themes recharts @tanstack/react-query next-intl react-joyride canvas-confetti react-circular-progressbar html2canvas jspdf lucide-react date-fns
```

### Backend (thêm mới)
```bash
npm install compression morgan
npm install -D @types/compression @types/morgan vitest
```

### Optional (tùy chọn)
```bash
# Redis cache
npm install ioredis

# Excel import/export
npm install exceljs papaparse
npm install -D @types/papaparse

# E2E testing
npm install -D playwright @playwright/test

# Error tracking
npm install @sentry/nextjs  # frontend
npm install @sentry/node    # backend
```

---

## Checklist Nghiệm Thu Giai Đoạn 2

### Speech & Voice
- [ ] User nghe được câu hỏi bằng giọng nói (TTS)
- [ ] User trả lời được bằng giọng nói (STT)
- [ ] Chuyển đổi mượt giữa text/voice mode

### AI Nâng Cao
- [ ] AI đặt câu hỏi follow-up dựa trên câu trả lời
- [ ] Độ khó tự điều chỉnh theo performance
- [ ] Chấm điểm 6 tiêu chí với radar chart
- [ ] Feedback chi tiết: điểm mạnh + điểm yếu + gợi ý

### UI/UX
- [ ] Design nhất quán, chuyên nghiệp
- [ ] Dark mode hoạt động
- [ ] Animation mượt mà
- [ ] Giao diện phỏng vấn immersive
- [ ] Dashboard có charts và analytics

### Trải Nghiệm
- [ ] Onboarding wizard cho user mới
- [ ] Badge + streak + level hoạt động
- [ ] Đa ngôn ngữ (Việt/Trung/Anh)
- [ ] Responsive trên mobile/tablet/desktop
- [ ] Accessibility score > 90

### Admin
- [ ] Dashboard analytics với charts
- [ ] Import/export câu hỏi CSV/Excel
- [ ] Quản lý users

### Technical
- [ ] E2E tests pass
- [ ] API tests pass
- [ ] Deploy production thành công
- [ ] Monitoring hoạt động
- [ ] Tài liệu đầy đủ

---

## Ưu Tiên Nếu Thiếu Thời Gian

### Phải xong (P0)
1. Speech-to-Text & Text-to-Speech (Ngày 1)
2. AI follow-up questions + scoring nâng cao (Ngày 2-3)
3. UI/UX redesign phỏng vấn + dashboard (Ngày 4-5)
4. Deploy production (Ngày 10)

### Nên xong (P1)
5. Gamification cơ bản — streak + badge (Ngày 6)
6. Performance optimization (Ngày 7)
7. Admin analytics (Ngày 9)

### Có thể lùi (P2)
8. Đa ngôn ngữ đầy đủ (Ngày 8) — làm Việt + Trung trước, Anh sau
9. Import/export CSV (Ngày 9) — admin tự nhập cũng được
10. E2E tests đầy đủ (Ngày 10) — manual test + API test đủ dùng

---

> **Ghi chú**: Kế hoạch này giả định 1 developer fullstack. Nếu có thêm người, có thể chạy song song frontend (UI/UX) và backend (AI/API) để nhanh hơn.

Ok, bỏ build. Kế hoạch dựa trên code hiện tại:

Hiện Trạng
Đã có: auth, profile, admin CRUD trường/ngành/học bổng/câu hỏi, tạo session phỏng vấn, AI tạo/chấm câu hỏi, voice STT/TTS, dashboard, gamification, i18n, theme.

Thiếu để gọi là web hoàn thiện: admin users/analytics/import-export, auth production, lưu report chuẩn, AI usage log, UX mobile polish, test, deploy, docs.

Plan 12 Ngày

Ngày 1-2: Chốt Core

Sửa auth sang production hơn: refresh token/httpOnly cookie hoặc session DB.
Bảo vệ route frontend theo role USER/ADMIN.
Chuẩn hóa error/loading/empty state toàn app.
Xóa lệ thuộc localStorage cho dữ liệu quan trọng.
Ngày 3-4: Interview Hoàn Chỉnh

Lưu interview_reports thật sau khi complete session.
Trang result đọc report từ DB, không chỉ build analysis realtime.
Thêm pause/resume, skip, retry câu hỏi.
Thêm giới hạn số câu/session, giới hạn AI call/user.
Ngày 5-6: Admin Hoàn Chỉnh

Thêm /admin/users: search, xem profile, lịch sử, khóa/mở tài khoản.
Thêm admin analytics: tổng user, session, điểm trung bình, câu hỏi yếu.
Import/export CSV câu hỏi.
Quản lý audio câu hỏi: upload/link TTS/human recorded.
Ngày 7-8: AI & Data

Lưu ai_usage_logs: task, model, latency, token/cost nếu có.
Tách prompt template từ code sang DB hoặc config.
Seed data demo chuẩn: admin, user, 50-100 câu hỏi thật.
Thêm fallback rõ khi thiếu OPENAI_API_KEY.
Ngày 9-10: UX Polish

Polish dashboard: progress chart, weak areas, recent sessions.
Polish interview room mobile/desktop, timer, transcript, feedback panel.
Chuẩn hóa tiếng Việt/Trung/Anh trong messages.
Accessibility: focus, aria-label, contrast, tap target.
Ngày 11: Test

API tests: auth, profile, questions, interviews.
E2E tests: register/login, tạo profile, admin thêm câu hỏi, user phỏng vấn, xem kết quả.
Test case lỗi: thiếu profile, hết AI key, user vào admin, session empty.
Ngày 12: Deploy

Tạo env production.
Deploy frontend Vercel.
Deploy backend Railway/Render/Fly/VPS.
DB Neon/Supabase/Railway PostgreSQL.
Viết README chạy local, hướng dẫn admin/user, checklist demo.
Ưu Tiên
P0: auth production, report DB, admin users, import/export, deploy.
P1: AI usage log, prompt template, UX polish, tests.
P2: payment, subscription, pronunciation scoring, avatar 3D, multi-tenant trung tâm.

Mốc Hoàn Thành
Web hoàn thiện khi user đăng ký → tạo profile → phỏng vấn text/voice → nhận feedback → xem lịch sử/report; admin quản lý data/user/câu hỏi; app deploy online ổn, có seed demo, có docs.
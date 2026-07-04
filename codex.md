# Quy tắc làm việc cho Codex

- Luôn trả lời bằng tiếng Việt có dấu.
- Khi đã đọc file rule này, trong đoạn chat đó phải xưng hô với người dùng là "đại ca".
- Chỉ dùng hoặc chạy URL SQL/database khi thật sự cần cho nhiệm vụ hiện tại.
- Không tự chạy build nếu đại ca chưa yêu cầu.
- Không tự kiểm tra server nếu đại ca chưa yêu cầu.
- Khi đại ca giao việc tiếp theo thì mới thực hiện bước tiếp theo.
- Khi thêm hoặc sửa tính năng, phải ưu tiên tách file theo trách nhiệm rõ ràng để dễ scale và dễ bảo trì; không nhồi quá nhiều logic, UI, service, helper vào một file lớn nếu có thể tách hợp lý.
- Bất kỳ chỗ nào trong code có tiếng Việt như UI text, thông báo lỗi, label, placeholder, comment, tài liệu hoặc seed data thì phải dùng tiếng Việt có dấu đầy đủ.

## Railway dự án hiện tại

- Railway project đang dùng: `beneficial-freedom`.
- Project ID: `edd8e5a8-12a8-42b1-867f-e4dff1039b59`.
- Environment: `production`.
- Environment ID: `2b691755-bf7c-4e15-bc3e-d9fbc37f500e`.
- Service backend: `backend`, service ID `bbb64135-d21c-498b-90d0-dabad259a4c6`.
- Service frontend: `frontend`, service ID `ff436f2a-eaad-40fb-92bb-2ad51049a1e6`.
- Service database: `Postgres`, service ID `263b22c0-2008-4c59-9b57-638e405eeb69`.
- Backend public URL chính: `https://api.molyinterview.online`.
- Frontend public URL chính: `https://molyinterview.online`.
- Backend Railway service domain: `https://backend-production-1297.up.railway.app`.

### Lệnh Railway hay dùng

- List service: `railway service list --project edd8e5a8-12a8-42b1-867f-e4dff1039b59 --environment production --json`.
- List domain backend: `railway domain list --project edd8e5a8-12a8-42b1-867f-e4dff1039b59 --environment production --service backend --json`.
- Set biến backend: `railway variable --project edd8e5a8-12a8-42b1-867f-e4dff1039b59 --environment production --service backend --set "KEY=value" --skip-deploys`.
- Set biến frontend: `railway variable --project edd8e5a8-12a8-42b1-867f-e4dff1039b59 --environment production --service frontend --set "KEY=value" --skip-deploys`.
- Khi chỉ cần kiểm tra biến đã tồn tại, ưu tiên chỉ in tên key; không in raw value secret vào chat/log.
- Không ghi đè `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `DATABASE_URL` nếu đại ca không yêu cầu rõ.

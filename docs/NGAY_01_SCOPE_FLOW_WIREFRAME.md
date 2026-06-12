# Ngày 1: Chốt yêu cầu và thiết kế luồng chính

## 1. Phạm vi MVP đã chốt

MVP tập trung vào phiên bản chạy được để demo và kiểm thử với người dùng thật. Các phần bắt buộc trong giai đoạn đầu:

- Đăng ký, đăng nhập, đăng xuất.
- Phân quyền cơ bản: người dùng, admin, super admin.
- Người dùng tạo profile apply du học.
- Admin quản lý trường, ngành, học bổng và kho câu hỏi.
- Người dùng bắt đầu một buổi phỏng vấn ảo.
- Hệ thống chọn câu hỏi theo profile.
- AI tạo thêm câu hỏi dựa trên study plan.
- Người dùng trả lời bằng text.
- AI chấm điểm và gợi ý cải thiện.
- Người dùng xem lịch sử và báo cáo phỏng vấn.

## 2. Chưa làm trong MVP Ngày 1

- Voice realtime.
- Phân tích phát âm tiếng Trung.
- Avatar 3D.
- Thanh toán.
- Import Excel nâng cao.
- Dashboard thống kê chuyên sâu.

## 3. Danh sách màn hình

### Người dùng

- Trang giới thiệu sản phẩm.
- Đăng ký tài khoản.
- Đăng nhập.
- Dashboard người dùng.
- Tạo/cập nhật profile apply.
- Phòng phỏng vấn ảo.
- Lịch sử phỏng vấn.
- Chi tiết báo cáo phỏng vấn.

### Admin

- Đăng nhập admin.
- Dashboard admin.
- Quản lý câu hỏi.
- Quản lý trường.
- Quản lý ngành.
- Quản lý học bổng.
- Xem danh sách người dùng.
- Xem kết quả phỏng vấn của người dùng.

## 4. Luồng người dùng

```text
Mở website
  -> Đăng ký hoặc đăng nhập
  -> Vào dashboard người dùng
  -> Tạo/cập nhật profile apply
  -> Bắt đầu phỏng vấn
  -> Hệ thống chọn câu hỏi từ kho dữ liệu
  -> AI tạo thêm câu hỏi cá nhân hóa
  -> Người dùng trả lời từng câu
  -> AI chấm điểm và nhận xét
  -> Kết thúc buổi phỏng vấn
  -> Xem báo cáo và lịch sử
```

## 5. Luồng admin

```text
Admin đăng nhập
  -> Vào dashboard admin
  -> Quản lý trường/ngành/học bổng
  -> Thêm hoặc cập nhật câu hỏi phỏng vấn
  -> Gắn câu hỏi theo hệ, trường, ngành, học bổng
  -> Theo dõi người dùng và kết quả phỏng vấn
```

## 6. Wireframe nhanh

### 6.1. Trang đăng nhập

```text
+-------------------------------------------------------------+
| Logo InterviewAI                                            |
|                                                             |
|  Luyện phỏng vấn du học Trung Quốc cùng AI    +-----------+ |
|  - Phỏng vấn theo profile                     | Đăng nhập | |
|  - Kho câu hỏi theo trường/ngành              | Email     | |
|  - AI chấm điểm và gợi ý cải thiện            | Mật khẩu  | |
|                                               | Button    | |
|                                               +-----------+ |
+-------------------------------------------------------------+
```

### 6.2. Trang đăng ký

```text
+-------------------------------------------------------------+
| Logo InterviewAI                                            |
|                                                             |
|  Tạo tài khoản luyện phỏng vấn                +-----------+ |
|  - Hệ Đại học/Thạc sĩ                         | Họ tên    | |
|  - Học bổng CSC, CIS, học bổng trường         | Email     | |
|  - Gợi ý câu trả lời theo AI                  | SĐT       | |
|                                               | Mật khẩu  | |
|                                               | Button    | |
|                                               +-----------+ |
+-------------------------------------------------------------+
```

### 6.3. Dashboard người dùng

```text
+-------------------------------------------------------------+
| Dashboard người dùng                              Đăng xuất |
+-------------------------------------------------------------+
| [Tạo/cập nhật profile] [Bắt đầu phỏng vấn] [Lịch sử]        |
+-------------------------------------------------------------+
```

### 6.4. Dashboard admin

```text
+-------------------------------------------------------------+
| Dashboard admin                                  Đăng xuất  |
+-------------------------------------------------------------+
| [Câu hỏi] [Trường] [Ngành] [Học bổng] [Người dùng]          |
+-------------------------------------------------------------+
```

## 7. API Ngày 1

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## 8. Database dùng trong Ngày 1

Đã dùng file schema chính:

```text
database/schema_full.sql
```

File seed demo cho Ngày 1:

```text
database/seed_day_01.sql
```

Chạy seed sau khi đã chạy schema:

```bash
psql -U postgres -d ai_phongvan -f database/seed_day_01.sql
```

Với Railway, chạy cùng connection string Railway trong terminal hoặc công cụ SQL của Railway.


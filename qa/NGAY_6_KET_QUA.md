# Kết quả QA Ngày 6

Ngày thực hiện: 2026-07-26

## Kết quả tự động

| Hạng mục | Kết quả |
|---|---|
| Backend test | Đạt – 16 file, 58 test |
| Frontend test | Đạt – 5 file, 13 test |
| Backend TypeScript/build | Đạt |
| Frontend TypeScript/build | Đạt |
| Backend lint | Đạt, không có lỗi chặn |
| Frontend lint | Đạt, không có lỗi chặn |
| Prisma schema validation | Đạt |

## Hạng mục đã bổ sung

- Kiểm tra câu trả lời bàn phím không tạo voice record.
- Kiểm tra báo cáo chỉ hiện audio khi có nguồn mic và chỉ số giọng nói thật.
- Kiểm tra GPA frontend theo hệ đại học và thạc sĩ.
- Tách test backend khỏi thư mục build để test ổn định sau khi build.
- Sáu hồ sơ QA mẫu.
- Checklist phát hành và phương án rollback.

## Cảnh báo không chặn

- Lint còn cảnh báo mã cũ chưa sử dụng và dependency của React Hook.
- Frontend build có cảnh báo cache động từ `next-intl`; build vẫn hoàn tất.

## Trạng thái phát hành production

Chưa triển khai production trong bước QA tự động. Trước khi deploy cần hoàn thành:

1. Chạy thủ công sáu hồ sơ QA và xác nhận không có lỗi P0.
2. Sao lưu database production.
3. Kiểm tra migration trên bản sao dữ liệu.
4. Chạy migration, backend, frontend theo đúng thứ tự trong checklist.
5. Kiểm tra nhanh một phiên production và theo dõi log.

# QA và phát hành – Ngày 6

## Bộ hồ sơ

Dùng sáu trường hợp trong `qa/interview-profiles.json`. Mỗi trường hợp phải chạy đủ một phiên trước khi phát hành chính thức.

## Checklist cho từng phiên

- [ ] Câu đầu tiên là phần giới thiệu bản thân 5 phút.
- [ ] Câu hỏi, TTS, STT và câu trả lời cải thiện đúng ngôn ngữ session.
- [ ] Không xuất hiện câu hỏi chuyên môn thuộc ngành khác.
- [ ] Không lặp lại câu hỏi đã hỏi.
- [ ] Có ít nhất hai tầng câu hỏi đào sâu khi câu trả lời đủ dữ liệu.
- [ ] Nghỉ nói 2 giây không làm mic tự ngắt.
- [ ] Transcript được xác nhận trước khi gửi.
- [ ] Tạm dừng dừng cả mic và TTS; tiếp tục không gửi callback cũ.
- [ ] Câu trả lời bàn phím không có nhận xét hoặc điểm giọng nói.
- [ ] Báo cáo ghi đúng nguồn mic/bàn phím.
- [ ] Không có câu trả lời gửi trùng.

## Cổng phát hành

- [ ] Toàn bộ test tự động đạt.
- [ ] TypeScript, lint và build frontend/backend đạt.
- [ ] Migration đã được kiểm tra trên bản sao dữ liệu.
- [ ] Không còn lỗi P0.
- [ ] Có bản sao lưu database ngay trước migration production.
- [ ] Kiểm tra nhanh API và một phiên phỏng vấn production sau deploy.

## Phương án rollback

1. Dừng phát hành mới nếu phát hiện lỗi P0.
2. Đưa frontend và backend về phiên bản ổn định gần nhất trên Railway.
3. Nếu migration chưa được ứng dụng, không thay đổi database.
4. Nếu migration đã chạy, cột `submission_id` có thể được giữ lại vì cho phép `NULL` và không làm hỏng dữ liệu cũ.
5. Chỉ xóa unique index khi xác nhận chính index gây lỗi; trước đó phải sao lưu database.
6. Chạy lại kiểm tra API đăng nhập, tạo session, gửi câu trả lời và xem báo cáo.

## Ghi chú migration

Migration thêm cột `submission_id` nullable và unique index. Dữ liệu cũ nhận `NULL`, do đó có thể triển khai theo hướng tương thích ngược: migration trước, backend sau, frontend cuối.

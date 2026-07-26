# Kế hoạch nâng cấp toàn diện hệ thống phỏng vấn trong 6 ngày

## 1. Mục tiêu

Sau 6 ngày, hệ thống cần đạt các yêu cầu:

- Ngôn ngữ được chọn hoạt động xuyên suốt câu hỏi, TTS, STT và câu trả lời mẫu.
- Câu đầu tiên là phần giới thiệu bản thân trong khoảng 5 phút.
- Câu hỏi đúng ngành, không lẫn câu hỏi chuyên môn của ngành khác.
- AI có ít nhất hai tầng câu hỏi đào sâu dựa trên câu trả lời trước.
- Mic không tự ngắt hoặc tự gửi câu trả lời ngoài ý muốn.
- Câu trả lời nhập bằng bàn phím không bị nhận xét về giọng nói.
- GPA được nhập và kiểm tra đúng theo từng hệ đào tạo.
- Báo cáo cuối buổi có dẫn chứng và phân biệt rõ câu trả lời text/audio.
- Có kiểm thử tự động cho các lỗi quan trọng.

## 2. Phạm vi triển khai

Sprint 6 ngày ưu tiên luồng phỏng vấn cốt lõi:

1. Hồ sơ và GPA.
2. Ngôn ngữ phỏng vấn.
3. Cấu trúc buổi phỏng vấn.
4. Lọc câu hỏi theo ngành.
5. Thu âm và nhận diện giọng nói.
6. Câu hỏi đào sâu.
7. Chấm điểm và feedback.
8. Báo cáo cuối buổi.
9. Kiểm thử và phát hành.

---

# Ngày 1 — Chuẩn hóa hồ sơ, GPA và ngôn ngữ

## Buổi sáng: Chuẩn hóa dữ liệu hồ sơ

### Công việc

- Rà soát dữ liệu từ:
  - Profile.
  - Form thiết lập phỏng vấn.
  - Payload tạo session.
  - Dữ liệu lưu trong session.
- Bắt buộc sử dụng `majorId`, `schoolId` và `degreeLevel` nếu người dùng đã chọn từ danh sách.
- Không để backend tự suy luận sang ngành gần giống khi đã có ID chính xác.
- Chuẩn hóa GPA:
  - Hệ đại học: điểm lớp 10, 11, 12 theo thang 10.
  - Hệ thạc sĩ: GPA đại học theo thang 4.
- Hỗ trợ dữ liệu GPA cũ để không làm hỏng profile đã tồn tại.
- Hiển thị lỗi cụ thể cho từng trường hợp dữ liệu sai.

### Kiểm thử

- GPA thạc sĩ `4.5` phải bị từ chối.
- GPA đại học thiếu điểm lớp 11 phải bị từ chối.
- Điểm lớp 12 lớn hơn 10 phải bị từ chối.
- Profile cũ có GPA dạng `3.6/4.0` của hệ thạc sĩ vẫn đọc được.

## Buổi chiều: Khóa ngôn ngữ phỏng vấn

### Công việc

- Tách hoàn toàn:
  - Ngôn ngữ giao diện.
  - Ngôn ngữ phỏng vấn.
- Mặc định buổi phỏng vấn mới là tiếng Trung.
- Lưu ngôn ngữ vào database khi tạo session.
- Trong phòng phỏng vấn, dùng ngôn ngữ từ session làm nguồn dữ liệu duy nhất.
- Không cho đổi ngôn ngữ giữa buổi.
- Đồng bộ ngôn ngữ cho:
  - Câu hỏi.
  - AI follow-up.
  - Giọng đọc TTS.
  - Nhận diện STT.
  - Chấm ngôn ngữ.
  - Câu trả lời cải thiện.

### Kiểm thử

Tạo lần lượt ba session:

- Tiếng Trung: toàn bộ câu hỏi và giọng đọc bằng tiếng Trung.
- Tiếng Anh: không xuất hiện câu hỏi tiếng Việt.
- Tiếng Việt: không xuất hiện câu hỏi tiếng Trung.
- Đổi ngôn ngữ giao diện không được làm thay đổi ngôn ngữ session.

## Kết quả cuối ngày

- Profile và GPA được lưu đúng.
- Ngôn ngữ phỏng vấn hoạt động thực tế, không chỉ là lựa chọn giao diện.
- Có test cho GPA và ánh xạ ngôn ngữ.

---

# Ngày 2 — Xây lại cấu trúc buổi phỏng vấn và lọc đúng ngành

## Buổi sáng: Điều phối cấu trúc buổi phỏng vấn

### Các giai đoạn của buổi phỏng vấn

1. Giới thiệu bản thân.
2. Học tập và thành tích.
3. Trường và ngành.
4. Kiến thức chuyên ngành.
5. Study Plan hoặc Research Proposal.
6. Học bổng và kế hoạch nghề nghiệp.
7. Phản biện hoặc tình huống.

### Trạng thái cần lưu trong session

- Chủ đề hiện tại.
- Độ sâu hiện tại.
- Các chủ đề đã hoàn thành.
- Thời gian còn lại.
- Số câu đã hỏi trong từng chủ đề.

### Phần giới thiệu 5 phút

- Câu đầu tiên luôn là giới thiệu bản thân.
- Nội dung câu hỏi phải đúng ngôn ngữ session.
- Hiển thị đồng hồ 5 phút riêng.
- Không tự ngắt mic khi đồng hồ kết thúc.
- Sau phần giới thiệu, AI chọn một ý trong câu trả lời để đào sâu.

### Phân bổ cho buổi 30 phút

| Phần | Thời lượng |
|---|---:|
| Giới thiệu | 5 phút |
| Học tập | 3 phút |
| Trường và ngành | 4 phút |
| Chuyên môn | 6 phút |
| Study Plan | 5 phút |
| Học bổng và nghề nghiệp | 4 phút |
| Phản biện | 3 phút |

## Buổi chiều: Lọc câu hỏi đúng ngành

### Thứ tự ưu tiên câu hỏi

1. Đúng ngành, trường và học bổng.
2. Đúng ngành và hệ đào tạo.
3. Đúng ngành.
4. Câu hỏi chung.

### Công việc

- Không lấy câu hỏi của ngành khác để bù số lượng.
- Kiểm tra:
  - `majorId`.
  - Tên ngành tiếng Việt.
  - Tên ngành tiếng Anh.
  - Tên ngành tiếng Trung.
- Nếu câu hỏi chung chứa tên ngành không khớp thì loại bỏ.
- Ràng buộc prompt:
  - Chỉ hỏi ngành mục tiêu.
  - Bỏ qua các ngành khác xuất hiện trong thông tin trường.
- Kiểm tra câu hỏi sau khi AI sinh:
  - Đúng ngôn ngữ.
  - Đúng ngành.
  - Không trùng.
  - Không chứa dữ kiện trường không có trong RAG.

### Bộ test bắt buộc

- Thương mại điện tử không xuất hiện câu hỏi về:
  - Quan hệ quốc tế.
  - Ngoại giao.
  - Chính trị quốc tế.
- Quan hệ quốc tế không xuất hiện câu hỏi về:
  - Lập trình.
  - Kiến trúc hệ thống.
  - Thuật toán.
- Câu hỏi chung về Study Plan vẫn được phép sử dụng cho mọi ngành.

## Kết quả cuối ngày

- Session có cấu trúc ổn định.
- Câu đầu tiên luôn là giới thiệu bản thân 5 phút.
- Không còn trộn câu chuyên môn giữa các ngành.

---

# Ngày 3 — Sửa toàn diện mic và luồng trả lời

## Buổi sáng: Xây state machine cho mic

### Trạng thái mic

```text
IDLE
→ REQUESTING_PERMISSION
→ LISTENING
→ SPEECH_DETECTED
→ WAITING_FOR_MORE
→ TRANSCRIBING
→ REVIEW
→ SUBMITTING
→ IDLE
```

### Công việc

- Không sử dụng nhiều boolean rời rạc gây xung đột trạng thái.
- Chỉ bắt đầu tính thời gian im lặng sau khi phát hiện có giọng nói.
- Không tự dừng vì:
  - Người dùng đang suy nghĩ.
  - Người dùng dừng giữa hai câu.
  - Âm lượng thấp trong thời gian ngắn.
- Khoảng im lặng mặc định: 4–5 giây.
- Thời lượng ghi tối thiểu: 2,5 giây.
- Hủy mic trước khi AI đọc câu hỏi.
- Chỉ mở mic sau khi TTS phát xong.
- Sử dụng request ID để callback cũ không tác động đến câu hỏi mới.

## Buổi chiều: Xác nhận trước khi gửi

### Công việc

Sau khi nhận transcript:

- Không gửi ngay.
- Hiển thị transcript cho người dùng.
- Cung cấp ba thao tác:
  - Gửi câu trả lời.
  - Tiếp tục nói.
  - Thu lại.
- Cho phép bật “Tự gửi sau 5 giây” trong phần cài đặt.
- Mặc định ưu tiên gửi thủ công.
- Nếu STT lỗi:
  - Giữ lại bản ghi.
  - Cho phép thử nhận diện lại.
  - Cho phép nhập bằng bàn phím.
- Nếu mất quyền mic:
  - Chuyển sang chế độ text.
  - Không xóa nội dung đang có.

### Chống gửi trùng

- Mỗi lần trả lời có một `submissionId`.
- Backend trả lại kết quả cũ nếu nhận cùng một `submissionId`.
- Khóa nút gửi khi request đang chạy.
- Callback mic cũ không được gửi câu trả lời vào câu hỏi tiếp theo.

### Kiểm thử

- Dừng nói 2 giây: mic vẫn bật.
- Dừng nói 5 giây: chuyển sang màn hình xác nhận.
- Nhấn gửi hai lần: backend chỉ tạo một câu trả lời.
- Bấm tạm dừng: mic và TTS dừng hoàn toàn.
- Chuyển câu hỏi: bản ghi cũ không được tự gửi.
- AI đọc câu hỏi không bị STT ghi lại thành câu trả lời.

## Kết quả cuối ngày

- Mic có hành vi ổn định và dự đoán được.
- Người dùng kiểm soát thời điểm gửi.
- Không còn tự ngắt và tự gửi tùy tiện.

---

# Ngày 4 — Nâng cấp AI đào sâu và hệ thống chấm điểm

## Buổi sáng: Câu hỏi đào sâu nhiều tầng

### Dữ liệu gửi cho AI

- Câu hỏi vừa hỏi.
- Câu trả lời mới nhất.
- Các câu đã hỏi.
- Các ý ứng viên đã đề cập.
- Chủ đề hiện tại.
- Độ sâu hiện tại.
- Ngành, trường và học bổng.
- Study Plan.
- Thời gian còn lại.
- Các nội dung còn thiếu.

### Chiến lược đào sâu

#### Tầng 1

- Làm rõ ý.
- Yêu cầu ví dụ.

#### Tầng 2

- Hỏi vai trò.
- Hỏi số liệu.
- Hỏi phương pháp.
- Hỏi kết quả.

#### Tầng 3

- Đặt tình huống phản biện.
- Kiểm tra hạn chế.
- Kiểm tra rủi ro.
- Yêu cầu phương án dự phòng.

### Điều kiện chuyển chủ đề

- Đã đủ hai tầng đào sâu.
- Câu trả lời đã đủ bằng chứng.
- Người dùng trả lời quá yếu hai lần.
- Chủ đề đã sử dụng quá thời lượng.
- Cần chuyển để bảo đảm đủ nhóm câu hỏi bắt buộc.

### Bộ kiểm tra câu hỏi AI

Nếu câu hỏi gặp một trong các lỗi sau thì sinh lại một lần:

- Sai ngôn ngữ.
- Sai ngành.
- Trùng câu cũ.
- Quá chung chung.
- Bịa thông tin trường.

Nếu lần sinh lại vẫn không đạt, sử dụng câu hỏi dự phòng an toàn.

## Buổi chiều: Tách chấm nội dung và giọng nói

### Đánh giá nội dung

- Mức độ liên quan.
- Logic.
- Độ cụ thể.
- Kiến thức chuyên môn.
- Mức độ phù hợp.
- Tính khả thi.
- Cách diễn đạt.

### Đánh giá audio

Chỉ chạy khi thực sự có bản ghi:

- Phát âm.
- Độ trôi chảy.
- Tốc độ.
- Khoảng ngắt.
- Từ đệm.
- Độ ổn định.

### Ràng buộc feedback

Nếu trả lời bằng text, AI không được sử dụng các nhận xét:

- “Giọng đọc”.
- “Ngữ điệu”.
- “Phát âm”.
- “Tốc độ nói”.
- “Nói dứt khoát”.
- “Âm lượng”.

Nếu đánh giá confidence từ text, phải sử dụng cách diễn đạt như:

- “Cách diễn đạt rõ ràng”.
- “Câu chữ thể hiện cam kết cụ thể”.
- “Lập luận còn do dự”.

### Feedback có dẫn chứng

Không chấp nhận:

> Câu trả lời khá tốt nhưng cần tự tin hơn.

Chấp nhận:

> Bạn nêu được mục tiêu làm việc trong thương mại điện tử, nhưng chưa đưa ra vị trí cụ thể hoặc kỹ năng cần phát triển.

## Kết quả cuối ngày

- AI hỏi sâu dựa trên câu trả lời thật.
- Câu trả lời text không bị chấm như audio.
- Feedback cụ thể, có căn cứ và không bịa.

---

# Ngày 5 — Báo cáo kết quả, giao diện và kiểm thử tích hợp

## Buổi sáng: Nâng cấp báo cáo

### Báo cáo theo từng câu

Hiển thị:

- Câu hỏi.
- Câu trả lời.
- Nguồn trả lời: mic hoặc bàn phím.
- Transcript nếu có.
- Điểm nội dung.
- Điểm ngôn ngữ.
- Điểm audio nếu có.
- Ý đã đạt.
- Ý còn thiếu.
- Câu trả lời cải thiện.
- Câu hỏi đào sâu gợi ý.

### Báo cáo toàn buổi

- Điểm tổng.
- Điểm từng tiêu chí.
- Chủ đề đã hoàn thành.
- Độ sâu đã đạt.
- Ba điểm mạnh có dẫn chứng.
- Ba lỗi quan trọng nhất.
- Các lỗi sai ngôn ngữ.
- Các câu trả lời chưa đúng ngành hoặc trọng tâm.
- Kế hoạch luyện tập 7 ngày.

### Câu trả lời cải thiện

- Giữ đúng ngôn ngữ session.
- Không tự thêm thành tích.
- Không tự thêm số liệu.
- Không bịa tên giáo sư hoặc phòng nghiên cứu.
- Sử dụng placeholder nếu thiếu dữ liệu.

## Buổi chiều: Hoàn thiện UX

### Phòng phỏng vấn

Hiển thị rõ:

- Chủ đề hiện tại.
- Số thứ tự câu hỏi.
- Thời gian còn lại.
- Trạng thái mic.
- Trạng thái AI.

Thông báo riêng cho từng trạng thái:

- Đang nghe.
- Đang chuyển giọng nói thành chữ.
- Đang chờ xác nhận.
- Đang gửi.
- Đang tạo câu hỏi đào sâu.

### Responsive và accessibility

- Kiểm tra desktop và mobile.
- Điều khiển được bằng bàn phím.
- Các nút mic có `aria-label`.
- Trạng thái có chữ mô tả, không chỉ dựa vào màu.
- Transcript dài không làm vỡ giao diện.

## Kiểm thử tích hợp

Chạy các kịch bản:

1. Tiếng Trung và mic.
2. Tiếng Trung và bàn phím.
3. Tiếng Anh và mic.
4. Từ chối quyền mic.
5. Tạm dừng và tiếp tục.
6. Hết thời gian.
7. Hoàn thành sớm.
8. Mạng lỗi khi gửi.
9. Tạo câu hỏi AI thất bại.
10. Chấm điểm AI thất bại.

## Kết quả cuối ngày

- Có luồng hoàn chỉnh từ tạo hồ sơ đến xem báo cáo.
- Giao diện thể hiện đúng trạng thái hệ thống.
- Các lỗi tích hợp chính đã được xử lý.

---

# Ngày 6 — QA, dữ liệu mẫu và phát hành

## Buổi sáng: Kiểm thử tự động

### Backend

- GPA theo hệ.
- Ngôn ngữ session.
- Lọc câu hỏi sai ngành.
- Chống câu hỏi trùng.
- Chống gửi câu trả lời trùng.
- Không tạo voice record cho text.
- Follow-up đúng ngành.
- Fallback đúng ngôn ngữ.

### Frontend

- GPA thay đổi đúng theo hệ.
- Ngôn ngữ hiển thị đúng session.
- State machine của mic.
- Xác nhận transcript.
- Không gửi khi đang transcribe.
- Không gửi callback cũ.
- Báo cáo ẩn phần audio khi trả lời text.

### Tiêu chí

- Các test mới phải chạy ổn định.
- Không bỏ qua test quan trọng.
- Không còn lỗi TypeScript.
- Không còn lỗi lint.
- Build frontend và backend thành công.

## Buổi chiều: Human QA và phát hành

### Bộ hồ sơ mẫu

Tạo tối thiểu sáu hồ sơ:

1. Thương mại điện tử – đại học – tiếng Trung.
2. Thương mại điện tử – thạc sĩ – tiếng Anh.
3. Quan hệ quốc tế – đại học – tiếng Trung.
4. Công nghệ thông tin – thạc sĩ – tiếng Trung.
5. Kinh tế – đại học – tiếng Việt.
6. Hồ sơ chuyển ngành – tiếng Trung.

### Kiểm tra thủ công

Mỗi hồ sơ chạy ít nhất một buổi 30 phút và đánh dấu:

- Đúng ngôn ngữ.
- Đúng ngành.
- Không trùng câu.
- Có đào sâu.
- Mic ổn định.
- Feedback có căn cứ.
- Báo cáo đúng nguồn text/audio.

### Điều kiện được phát hành

- Không còn lỗi P0.
- Không có câu hỏi sai ngành trong bộ QA.
- Không có câu hỏi sai ngôn ngữ.
- Không có feedback giọng nói cho câu trả lời text.
- Không có trường hợp gửi trùng.
- Build frontend và backend thành công.
- Migration an toàn.
- Có phương án rollback.

### Trình tự phát hành

1. Sao lưu database.
2. Chạy migration.
3. Deploy backend.
4. Kiểm tra API.
5. Deploy frontend.
6. Tạo một buổi phỏng vấn production thử nghiệm.
7. Theo dõi log AI, STT và lỗi session.
8. Nếu có lỗi P0, rollback ngay.

## Kết quả cuối ngày

- Hoàn tất kiểm thử tự động và thủ công.
- Có bản production đáp ứng các tiêu chí cốt lõi.
- Có phương án rollback khi phát sinh lỗi nghiêm trọng.

---

# 3. Mốc bàn giao

| Ngày | Bàn giao |
|---|---|
| Ngày 1 | Hồ sơ, GPA và ngôn ngữ chuẩn |
| Ngày 2 | Cấu trúc phỏng vấn và câu hỏi đúng ngành |
| Ngày 3 | Mic ổn định, có xác nhận trước khi gửi |
| Ngày 4 | AI đào sâu và chấm điểm đúng dữ liệu |
| Ngày 5 | Báo cáo hoàn chỉnh và UX ổn định |
| Ngày 6 | Test, QA, triển khai và rollback |

# 4. Mức độ ưu tiên

## P0 — Bắt buộc hoàn thành

- Khóa ngôn ngữ theo session.
- Giới thiệu bản thân 5 phút.
- Lọc câu hỏi sai ngành.
- Mic ổn định.
- Không tự gửi câu trả lời.
- Tách feedback text và audio.
- GPA đúng theo hệ.
- Chống gửi câu trả lời trùng.

## P1 — Cần hoàn thành trong sprint

- AI đào sâu nhiều tầng.
- Feedback có dẫn chứng.
- Báo cáo theo từng câu.
- Bộ kiểm tra đầu ra AI.
- Test tích hợp cho các luồng chính.

## P2 — Thực hiện nếu còn thời gian

- Cải thiện giao diện quản trị câu hỏi.
- Dashboard theo dõi lỗi AI.
- Thống kê chất lượng STT.
- Theo dõi tỷ lệ câu hỏi bị sinh lại.

# 5. Công việc tạm hoãn

Các hạng mục sau chưa đưa vào sprint 6 ngày:

- Dashboard phân tích AI nâng cao cho admin.
- Tự động nhập và làm sạch hàng nghìn câu hỏi.
- So sánh tiến bộ trong nhiều tháng.
- Chấm biểu cảm khuôn mặt chuyên sâu.
- Nhiều giám khảo AI trong cùng một buổi.
- Marketplace hoặc chia sẻ bộ câu hỏi.

# 6. Tiêu chí nghiệm thu cuối cùng

Sprint được xem là hoàn thành khi:

- Chọn ngôn ngữ nào thì phỏng vấn đúng ngôn ngữ đó.
- Câu đầu tiên luôn là giới thiệu bản thân 5 phút.
- Không có câu hỏi chuyên môn sai ngành trong bộ QA.
- AI có thể hỏi sâu dựa trên nội dung ứng viên vừa trả lời.
- Mic không tự ngắt vì khoảng nghỉ ngắn.
- Người dùng được xác nhận transcript trước khi gửi.
- Câu trả lời text không có nhận xét về giọng nói.
- Báo cáo chỉ hiển thị điểm audio khi thực sự có bản ghi.
- GPA được kiểm tra đúng theo hệ đào tạo.
- Không có trường hợp gửi trùng câu trả lời.
- Frontend và backend vượt qua kiểm thử, lint và build.

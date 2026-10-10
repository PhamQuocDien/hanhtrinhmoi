# Hành Trình Mới V29.0.0 — Phase 1 Foundations

## Thay đổi

### Đăng ký và hồ sơ
- Giữ xác thực ngày sinh thực tế ở server, tính tuổi từ ngày sinh thay vì tin tuổi do trình duyệt gửi.
- Khi đăng ký, tạo/đồng bộ bản Profile mới từ tài khoản legacy. Nếu đồng bộ thứ cấp gặp lỗi, tài khoản vẫn được giữ và API hồ sơ có fallback đọc tài khoản.
- Hồ sơ có thể cập nhật hoặc chủ động xóa ngày sinh; trường tuổi legacy được đồng bộ cùng ngày sinh.

### Survey và placement
- Thêm test chọn placement dựa trên cấp/lớp, mục tiêu TOEIC/IELTS/MOS và bối cảnh ngành Đại học.
- Nếu không có đủ thông tin để chọn phù hợp, giao diện để người dùng chọn thay vì tự chọn bài đầu tiên.
- Backend từ chối lượt placement thiếu câu trả lời bắt buộc, chứa ID câu không hợp lệ/trùng hoặc không đủ độ phủ tối thiểu theo kỹ năng. Client cũ thiếu danh sách questionIds được xử lý bằng cách suy ra ID từ câu trả lời nhưng vẫn phải qua cùng validator.

### Chấm điểm
- Loại bỏ so sánh đáp án dựa trên `JSON.stringify(...)` trong scorer khách quan cũ; thay bằng so sánh có kiểu, xử lý lựa chọn object, multiple choice không phụ thuộc thứ tự và matching.
- Câu không có answer key được đánh dấu `NEEDS_ANSWER_KEY`; coding, practical, timed simulation, essay và speaking được đưa vào review khi scorer này không thể chấm một cách đáng tin cậy.
- Ghi trạng thái chấm vào kết quả để frontend không nhầm câu chưa chấm với câu trả lời sai.

### Nhập tài liệu nhanh hơn
- Tệp `.docx` được gửi qua endpoint nhị phân `application/octet-stream`, không chuyển toàn tệp thành base64 rồi nhúng trong JSON. Điều này giảm overhead dữ liệu và chuyển đổi ở trình duyệt.
- Server giới hạn upload DOCX 3 MB và giới hạn phần XML giải nén tối đa 8 MB để giảm nguy cơ zip bomb; Markdown/TXT vẫn được đọc ở trình duyệt rồi gửi phần văn bản.

## Kiểm thử mới

`npm test` chạy thêm `scripts/test-v28-phase1-foundations.js`, bao gồm 18 ca về xác thực DOB/tuổi, đồng bộ profile, survey-placement, độ phủ placement, scoring typed answer, upload DOCX nhị phân và bảo đảm Admin không yêu cầu nhập JSON.

## Giới hạn đã biết

- Chưa thực hiện migration thay MongoDB hoặc xóa toàn bộ dữ liệu Mixed trong một lần; việc đó cần kế hoạch migration/backfill riêng và backup database.
- API có thể tiếp tục nhận/trả JSON vì đó là định dạng truyền thông phổ biến; thay đổi này nhằm loại bỏ việc giáo viên phải chỉnh JSON và tránh so sánh đáp án bằng chuỗi JSON.
- Các bài kiểm thử chạy độc lập trên source; chưa có kết nối đến MongoDB/Render production trong workspace này.

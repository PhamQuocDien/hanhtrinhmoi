# Hành Trình Mới V30.0.0 — Nội dung theo chủ đề và bài nộp tệp

## 1. Thay đổi đã làm trong V30

- Bổ sung luồng nộp sản phẩm dạng tệp nhị phân qua `application/octet-stream`, không chuyển tệp sang Base64 trong JSON. Tệp được lưu dưới dạng `Buffer` trong MongoDB, giới hạn 3 MB và lọc theo phần mở rộng; tệp tạm chưa gắn vào bài nộp tự hết hạn sau 24 giờ.
- Hỗ trợ nộp bài bằng văn bản, liên kết HTTP(S), tệp hoặc phối hợp các dạng trên. Một tệp không thể được gắn lại vào nhiều bài nộp; bài nộp chỉ nhận ở bài học đang mở khóa. Admin/giáo viên có quyền chấm có thể tải tệp từ hàng đợi chấm.
- Nội dung bài học chuyên môn có recipe theo mảng và chủ đề: lập trình (SQL, mảng, sắp xếp, vòng lặp, điều kiện, biến/toán tử), MOS (Excel, Word, PowerPoint), TOEIC (Listening/Reading) và mẫu tình huống thực tế. Bài học có lý thuyết theo phần, ví dụ, hướng dẫn từng bước, bài độc lập, tình huống thực tế và câu tự kiểm tra.
- Bài lập trình được tạo test theo loại nhiệm vụ thay vì dùng một câu sắp xếp cho mọi chủ đề. Các task có định dạng input/output, test công khai/ẩn và starter code theo ngôn ngữ đã chọn.
- TOEIC có câu hỏi nguyên bản tách theo nhóm Listening/Reading. MOS có tác vụ theo công thức Excel, Heading/Table of Contents trong Word, Slide Master trong PowerPoint và sản phẩm đầu ra `.xlsx`, `.docx`, `.pptx` cùng tiêu chí kiểm tra.
- Mở rộng bộ câu hỏi K–12 theo chủ đề phổ biến: phép cộng/trừ và số học cơ bản, so sánh, hình học đơn giản, phân số, chia hết, số nguyên, phương trình, hàm số/đạo hàm; Tiếng Anh tiểu học có nhóm gia đình, màu sắc, chào hỏi và số đếm. Các câu này được gắn tag `TOPIC_ALIGNED` hoặc `CONTENT_ALIGNED`.
- Đánh dấu nội dung chuyên môn tự sinh bằng `contentQualityStatus: AUTO_GENERATED_REQUIRES_TEACHER_REVIEW` để không nhầm nội dung do template sinh ra với nội dung đã được giáo viên chuyên môn duyệt.
- Gửi OTP có adapter cấu hình bằng biến môi trường: Resend cho email (`RESEND_API_KEY`, `OTP_EMAIL_FROM`) và Twilio cho SMS (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`). Không có thông tin xác thực thì luồng trả lỗi trung thực, không giả vờ gửi thành công.
- Đồng bộ phiên bản phát hành thành `30.0.0`, đồng bộ cache key API và các trang dùng luồng hồ sơ/khảo sát/placement để trình duyệt tải mã nguồn mới.

## 2. Luồng học tập và hồ sơ đã có từ V29, được giữ lại

- Đăng ký yêu cầu ngày/tháng/năm sinh hợp lệ; sau khi xác minh OTP, tài khoản được đăng nhập và chuyển tới khảo sát onboarding.
- Trang hồ sơ có thể nhập/sửa ngày sinh và hiển thị tuổi được tính tự động. Trường tuổi là chỉ đọc; backend tính tuổi từ ngày sinh, tránh tuổi thủ công bị lệch.
- Khảo sát lưu mục tiêu, lĩnh vực ưu tiên và hồ sơ học tập; placement được đề xuất dựa trên cấp/lớp, tuổi, ngành và mục tiêu khi có đủ dữ liệu; kết quả được dùng để cập nhật learning plan.
- Khóa học tải danh sách tóm tắt trước; nội dung từng bài được tải khi mở. Mở khóa bài tiếp theo yêu cầu hoàn thành bài trước/đạt ngưỡng đã cấu hình.
- Admin xem chi tiết tài khoản học sinh, tiến độ/kết quả và xóa tài khoản học sinh sau khi xác nhận tên tài khoản. Dữ liệu học tập liên quan được dọn và hành động có audit.
- CMS dùng biểu mẫu có kiểu dữ liệu trên MongoDB/Mongoose; không cần quản trị viên mở và chỉnh sửa file JSON thủ công.

## 3. Kiểm thử và giới hạn

- `npm test`: chạy toàn bộ regression chain, bao gồm test V30.
- `npm run validate`: kiểm tra cấu trúc trang/tệp theo validator của dự án.
- `node --check`: kiểm tra cú pháp những tệp JavaScript backend, frontend và test đã thay đổi.
- `scripts/test-v30-content-and-uploads.js`: kiểm tra bài coding theo input/output, mẫu TOEIC, tác vụ MOS, câu hỏi K–12, metadata rà soát nội dung, schema tệp, upload nhị phân, tải tệp cho người chấm, đăng ký/ngày sinh, quản trị học sinh và adapter gửi OTP giả lập.
- Để gửi OTP thật trên máy chủ, cấu hình biến môi trường tại dashboard triển khai; không điền secret vào ZIP. Tài khoản Resend/Twilio và người gửi phải được xác minh theo yêu cầu nhà cung cấp.

**Chưa thể xác nhận production trong gói này:** kiểm thử adapter OTP chỉ dùng fetch giả lập; môi trường làm việc chưa được kết nối MongoDB/Render của bạn nên chưa kiểm tra migration trên database thật, gửi OTP thật qua email/SMS, quyền đăng nhập thực tế hay tốc độ tải ở mạng production. Hãy sao lưu MongoDB và thử staging trước khi triển khai.

**Giới hạn chất lượng nội dung:** dự án có catalog lớn và nội dung sinh theo template. V30 cải thiện cấu trúc và các nhóm câu hỏi nhận diện được; không có căn cứ để khẳng định toàn bộ mọi bài lớp 1–12, tất cả môn đại học, toàn bộ khóa CNTT, MOS và TOEIC đã được con người viết/duyệt đầy đủ. Nội dung có cờ `AUTO_GENERATED_REQUIRES_TEACHER_REVIEW` cần được biên tập và duyệt theo môn/chương trước khi công bố như giáo trình chính thức.

## 4. Nguồn tham khảo về thiết kế trải nghiệm

- CodeLearn: tham khảo tổ chức chương/bài, bài thực hành và chấm theo input/output/test case — https://codelearn.io/
- PREP: tham khảo chia TOEIC theo kỹ năng/dạng câu hỏi, mini-test, thi mô phỏng có giới hạn thời gian và xem lại lỗi — https://prep.vn/
- Kmin: tham khảo định hướng lộ trình theo mục tiêu, chẩn đoán và năng lực còn thiếu — https://com.kmin.edu.vn/

Chỉ tham khảo phương pháp tổ chức trải nghiệm; nội dung câu hỏi trong V30 là nội dung tự tạo, không sao chép đề thi, nội dung khóa học hoặc tài sản độc quyền của các nền tảng tham khảo.

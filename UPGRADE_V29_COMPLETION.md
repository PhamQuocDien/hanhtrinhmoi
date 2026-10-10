# Hành Trình Mới V29.0.0 — Nâng cấp học tập, bài nộp và quản trị

## 1. Onboarding, hồ sơ và lộ trình

- Sau khi xác minh OTP khi đăng ký, ứng dụng đăng nhập phiên vừa tạo và chuyển thẳng đến khảo sát để thu thập mục tiêu học tập.
- Backend kiểm tra ngày sinh có thật và không ở tương lai; tuổi được tính ở máy chủ, không tin tuổi do trình duyệt tự gửi. Hồ sơ yêu cầu ngày sinh để cá nhân hóa; API từ chối xóa ngày sinh đang cần cho quy tắc này.
- Bộ chọn placement ưu tiên mục tiêu rõ ràng như TOEIC, IELTS, MOS; nếu là K–12 sẽ dùng lớp khai báo, cấp học và tuổi làm tín hiệu bổ sung; với đại học cần ngữ cảnh ngành. Không tự gán bài kiểm tra không liên quan chỉ vì nó đứng đầu catalog.
- Kết quả khảo sát/placement tiếp tục cập nhật hồ sơ học tập và learning plan trong kiến trúc MongoDB/Mongoose.

## 2. Nội dung khóa học và lộ trình bài học

- Trang khóa học tải danh sách tóm tắt trước; nội dung lý thuyết, ví dụ và bài test chỉ tải khi mở một bài đã được mở khóa. Việc này giảm payload ban đầu và tránh tải đề/đáp án trước khi học sinh đến bài đó.
- Áp dụng mở khóa tuần tự ở catalog khóa học chuẩn, starter catalog và adapter K–12. Bài kế tiếp yêu cầu đạt bài kiểm tra trước theo ngưỡng được cấu hình; bài test K–12/starter dự phòng được tạo vào MongoDB khi cần để không bị khóa do thiếu bản ghi assessment.
- Khi bài có practice task, học sinh có thể nộp lời giải dạng văn bản và/hoặc liên kết HTTP(S); bài nộp lưu theo tài khoản với trạng thái chờ chấm, điểm và phản hồi. Admin/giáo viên có hàng đợi chấm điểm được bảo vệ bằng quyền truy cập.
- Ví dụ Toán 12 “Tính đơn điệu và cực trị” được thay từ câu hỏi số học lệch chủ đề bằng 12 câu hỏi theo đạo hàm/cực trị, lý thuyết quy trình, ví dụ giải bước, bài độc lập, tình huống mô hình hóa và task có rubric. Có regression test nhằm ngăn quay lại các mẫu phép cộng/trừ không phù hợp.
- Bộ catalog hiện có nội dung khởi đầu cho lớp 1–12, các track Đại học, CNTT, tiếng Anh/TOEIC/IELTS và MOS. Nội dung được dựng từ template/adapter và vẫn mang trạng thái nguồn chưa thẩm định; số lượng bài tự sinh không đồng nghĩa toàn bộ bài đã được giáo viên bộ môn duyệt. Cần tiếp tục kiểm định theo môn/chương trước khi công bố production.

## 3. Quản trị học sinh và CMS

- Trang Admin thêm xem chi tiết tài khoản học sinh: thông tin hồ sơ, mục tiêu, khảo sát, placement, lộ trình, tiến độ và kết quả gần đây.
- Xóa tài khoản chỉ cho vai trò học sinh, yêu cầu xác nhận tên tài khoản, chặn việc xóa nhầm tài khoản admin/người dùng khác vai trò, dọn các dữ liệu học tập được liên kết và ghi audit event. Thao tác vật lý nên chỉ thực hiện theo chính sách lưu trữ và backup của tổ chức.
- Các biểu mẫu CMS dùng trường dữ liệu có kiểu; không yêu cầu người quản trị viết/nguyên khối JSON để sửa nội dung. MongoDB/Mongoose vẫn là nơi lưu trữ chính; API vẫn có thể truyền JSON như định dạng giao tiếp, không phải file JSON làm nguồn dữ liệu chính.

## 4. Tốc độ và tính ổn định

- DOCX upload dùng `application/octet-stream` thay cho chuyển tệp sang base64 nhúng trong JSON; giới hạn tải lên 3 MB và giới hạn XML giải nén.
- Media polling dừng khi trạng thái không còn chờ xử lý và có giới hạn retry; static middleware tiếp tục dùng ETag/cache.
- Migration dừng khi một migration thất bại theo mặc định. `/api/ready` phản ánh trạng thái DB, session secret và migration thay vì chỉ xác nhận process đang chạy.
- Phiên bản backend được đồng bộ thành `29.0.0`.

## 5. Nguyên tắc thiết kế tham khảo

- CodeLearn: mạch chương/bài học, thực hành lập trình và xác thực đầu ra bằng test case.
- PREP: tổ chức luyện thi theo kỹ năng/dạng câu hỏi, timed practice và review lỗi.
- Kmin: dùng thông tin đầu vào/diagnostic, kỹ năng còn yếu và mục tiêu để xây learning path theo thứ tự.

Đây là tham khảo cách tổ chức trải nghiệm, không sao chép nội dung, câu hỏi, giao diện hoặc tài sản có bản quyền từ các nền tảng đó. Mọi nội dung trong dự án tự sinh được gắn nguồn phù hợp và không tự nhận là đề thi/chương trình chính thức.

## 6. Xác minh trong workspace

- `npm test`: PASS; chuỗi regression hoàn chỉnh kết thúc với 23 kiểm thử của bộ V29/V28 foundation PASS.
- `npm run validate`: PASS; 53 trang HTML và 128 tệp JavaScript được kiểm tra.
- `node --check`: PASS đối với server, router, model và các tệp JavaScript quản trị đã thay đổi.

Chưa kết nối MongoDB/Render production trong workspace nên không thể tuyên bố đã chạy migration thật hoặc xác nhận tốc độ mạng/download trên môi trường trực tiếp. Trước production, backup database, deploy staging, chạy migration, thử đăng ký→OTP→khảo sát→placement→lộ trình, thử nộp/chấm bài, và kiểm tra dữ liệu Admin/delete trên MongoDB thật.

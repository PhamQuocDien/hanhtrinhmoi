# V5 Teacher Workspace

## Quyền truy cập

Tài khoản phải đăng nhập với `role=teacher`. Middleware `requireTeacher` bảo vệ toàn bộ route `/api/teacher/*`; endpoint học viên tại `/api/assignments/*` yêu cầu `student` hoặc `university_student`.

## Quy trình đầu tiên

1. Tạo tài khoản bằng trang `/register.html`, chọn vai trò giáo viên.
2. Vào `/teacher.html` và tạo lớp.
3. Chọn các khóa CNTT muốn theo dõi nếu lớp dạy Phát triển phần mềm.
4. Thêm tài khoản học viên bằng email đã đăng ký.
5. Giao bài, chọn bài nộp bằng văn bản hoặc đường dẫn, gắn khóa/mã bài nếu cần.
6. Khi học viên nộp tại `/assignments.html`, mở bài nộp ở không gian giáo viên, cho điểm và nhập nhận xét.

## Lưu dữ liệu

- Lớp lưu bằng `Classroom`; lưu trữ lớp sẽ chuyển trạng thái sang `archived` và đóng bài tập.
- Bài tập lưu bằng `TeacherAssignment`.
- Bài nộp, điểm và nhận xét lưu bằng `AssignmentSubmission`.
- Tiến độ bài phổ thông đọc từ `LearningProgress`; tiến độ các khóa nghề đọc từ `CareerEnrollment` nếu khóa được chọn theo dõi trong lớp.
- Các thao tác tạo/sửa/lưu trữ lớp, giao/xóa bài và chấm bài được ghi vào `ActivityLog`.

## Giới hạn V5

Không có email mời lớp tự động, không có upload tệp bài nộp và không gửi thông báo push/email. Xóa bài tập sẽ xóa các bài nộp/điểm gắn với bài đó; cần xác nhận rõ trước khi thực hiện. API sử dụng cùng session/CSRF protection của ứng dụng.

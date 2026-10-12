# Tổng quan kiến trúc — trạng thái V1

## Luồng chạy hiện tại

`Browser (HTML/CSS/JS) → Express API → Middleware (session / CSRF / rate limit / authorization) → Mongoose models → MongoDB`

Express phục vụ trang web cùng origin nên frontend không cần cấu hình CORS riêng. API là nơi xác thực dữ liệu và quyền truy cập; JavaScript giao diện chỉ điều khiển trải nghiệm, không thay thế kiểm tra quyền ở server.

## Các thành phần

- `apps/web`: trang chủ, đăng ký, đăng nhập, khảo sát, dashboard, trang quản trị.
- `apps/api`: bootstrap, endpoint, middleware, model và validation.
- `content`: tài liệu nguồn/nháp cho nội dung sẽ được soạn về sau; đây không phải database runtime.
- `services/code-runner`: ranh giới dự kiến cho hệ thống thực thi bài code độc lập. V1 chưa chạy code người học.
- `database`: sơ đồ và tài liệu thiết kế lưu trữ. V1 hiện dùng MongoDB theo `MONGO_URI`; các tệp migration SQL từ định hướng V0 chỉ là tài liệu định hướng, không được API V1 sử dụng.

## Authentication / authorization

- Người học và giáo viên đăng ký qua `/api/auth/register`; server chỉ nhận ba vai trò được cho phép: `student`, `university_student`, `teacher`.
- Người dùng dùng mật khẩu hash bcrypt và session lưu trong MongoDB.
- Admin đăng nhập ở `/api/auth/admin/login`, được so sánh với environment `ADMIN_USERNAME` / `ADMIN_PASSWORD`, không dùng form đăng ký và không lưu tài khoản admin trong collection `User`.
- Endpoint khảo sát chỉ cho role `student` và `university_student`; endpoint admin kiểm tra role session trên server.
- Các request thay đổi dữ liệu yêu cầu token CSRF double-submit.

## Giai đoạn sau

Có thể tách domain nghiệp vụ sang C#/.NET hoặc service riêng khi số lượng nghiệp vụ đủ lớn. C++/Java/C#/Python là các runtime học tập/chấm code tương lai, không nên chạy mã chưa tin cậy trong process của API chính. Khi thêm khóa học, cần mô hình hóa danh mục, lộ trình, course, chapter/module, lesson, activity, enrollment và progress rồi mới xuất bản nội dung.

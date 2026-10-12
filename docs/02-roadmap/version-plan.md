# Roadmap phiên bản

## V0 — Hoàn thành
- Tổ chức monorepo và thư mục mở rộng theo lĩnh vực.
- Ghi tầm nhìn, mô hình nội dung, quy ước và các quyết định kiến trúc ban đầu.

## V1.0 — Nền tảng và định danh
- [x] Trang chủ responsive.
- [x] Đăng ký học sinh/sinh viên/giáo viên.
- [x] Đăng nhập/đăng xuất theo session, hash mật khẩu.
- [x] Admin login bằng `ADMIN_PASSWORD` qua trang riêng.
- [x] Khảo sát đầu vào và lưu phản hồi theo user.
- [x] Dashboard người học/giáo viên và dashboard admin mức cơ bản.
- [x] API health check, validation tests cơ bản.
- [x] Giữ tên biến môi trường từ bộ cấu hình Hành Trình Mới; placeholder cho secret.
- [ ] Chạy tích hợp có MongoDB thật, kiểm tra end-to-end trong trình duyệt và triển khai staging.
- [ ] Thiết lập quy trình xác minh email, quên mật khẩu và chính sách riêng tư trước khi mời người dùng thật.

## V1.1 — Hồ sơ và vận hành
- Sửa hồ sơ, kiểm soát vòng đời tài khoản, quy trình giáo viên và reset mật khẩu.
- Email verification / OTP sử dụng nhà cung cấp mail có cấu hình thật.
- Bảo vệ dữ liệu, trang điều khoản/chính sách và logging/audit cần thiết.

## V1.2 — Danh mục nội dung
- Mô hình dữ liệu lĩnh vực, lộ trình, khóa học, chương, bài học, hoạt động.
- Trang quản trị soạn thảo/duyệt nội dung; chưa import khóa học giả.

## V1.3 — Học và theo dõi tiến độ
- Đăng ký khóa học, học bài, quiz, bài tập, điểm và tiến độ.
- Điều kiện hoàn thành, prerequisite và các báo cáo căn bản.

## V1.4+ — Thực chiến
- Dự án, portfolio, các lộ trình theo nghề.
- Tích hợp AI theo quota/rate limit.
- Code runner tách biệt, có sandbox, timeout, hạn chế tài nguyên và token giữa các dịch vụ.

**Nguyên tắc:** chỉ đánh dấu tính năng đã xong nếu code và kiểm thử tương ứng tồn tại; các mục ở tương lai không được mô tả như đã vận hành.

# Hành Tinh Mơ Ước 4.0

## 1. Giao diện hiện đại trên toàn hệ thống

- Tất cả 38 trang HTML đã dùng chung `modern-ui.css` và `modern-ui.js`.
- Đồng bộ màu sắc, nút bấm, biểu mẫu, bảng, thẻ nội dung và hiệu ứng chuyển trang.
- Có thanh điều hướng nhanh nổi: trạng thái mạng, quay lại, về trang chủ và đổi sáng/tối.
- Tương thích màn hình máy tính, máy tính bảng, điện thoại và vùng an toàn trên thiết bị di động.
- Các trang game toàn màn hình được giữ chế độ immersive để không làm hỏng canvas hoặc thế giới 3D.
- Bổ sung hỗ trợ bàn phím, focus rõ ràng, mô tả ảnh thiếu `alt` và giảm chuyển động theo cài đặt thiết bị.

## 2. Phòng kiểm tra thông minh

- Thiết kế lại hoàn toàn trang `bai-kiem-tra.html`.
- Hỗ trợ 6 môn: Toán, Tiếng Việt, Tiếng Anh, Khoa học, Lịch sử và Địa lý.
- Đầy đủ lớp 1 đến lớp 12, ba mức Dễ/Trung bình/Khó.
- Tối thiểu 100 câu cho mỗi tổ hợp môn × lớp × mức độ.
- Tổng ngân hàng chuẩn hóa: 21.600 câu.
- Mỗi đề có thể chọn 10, 20 hoặc 30 câu.
- Có bộ đếm giờ thích ứng, thanh tiến độ, danh sách câu, cảnh báo câu chưa làm và tự nộp khi hết giờ.
- Đáp án chỉ lưu ở session máy chủ; trình duyệt không nhận đáp án trước khi nộp.
- Sau khi chấm, hiển thị đáp án đúng và giải thích từng câu.
- Tất cả câu hỏi được chuẩn hóa ID duy nhất, đủ lựa chọn và đáp án hợp lệ.

## 3. Admin tự đồng bộ mật khẩu Environment

Tài khoản quản trị vẫn là:

```text
Admin
```

Mật khẩu luôn lấy từ:

```env
ADMIN_PASSWORD=mat_khau_moi_tu_10_den_72_ky_tu
```

Khi đổi `ADMIN_PASSWORD` trên Render và dịch vụ khởi động/redeploy lại:

1. Nếu chưa có tài khoản Admin, hệ thống tự tạo.
2. Nếu tài khoản đã tồn tại và mật khẩu khác, hệ thống tự băm và cập nhật mật khẩu mới.
3. Nếu quyền Admin bị thay đổi, hệ thống tự khôi phục role `admin`.
4. Khi Admin đăng nhập, hệ thống kiểm tra đồng bộ thêm một lần để tránh tình trạng vừa khởi động chưa cập nhật xong.
5. API reset mật khẩu thông thường không được phép đổi mật khẩu Admin.

Không ghi mật khẩu thật vào GitHub, `.env.example`, log hoặc giao diện.

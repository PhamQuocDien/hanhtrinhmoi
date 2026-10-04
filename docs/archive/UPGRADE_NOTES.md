# Nhật ký nâng cấp 3.0

## Lỗi đã sửa

1. Các API `/api/user/heartbeat`, `/api/parent/dashboard`, `/api/admin/send-notification`, `/api/admin/create-random-batch` và `/api/admin/transfer-child` trước đây được frontend gọi nhưng backend không tồn tại.
2. Nhiều API Admin trước đây không kiểm tra quyền; người chưa đăng nhập có thể gọi trực tiếp.
3. Đăng ký tài khoản tên `Admin` có thể tạo quyền quản trị trong một số trạng thái dữ liệu.
4. Mật khẩu Admin dự phòng được ghi cố định trong mã nguồn.
5. Đấu Toán PvP chuyển câu sau mỗi lần một người trả lời và không ghi trạng thái đã trả lời.
6. Người chơi có thể gửi một cấp độ rất lớn đến API chiến thắng để mở khóa vượt cấp.
7. Nhắc lịch và tự xử thua chỉ duyệt giải loại trực tiếp, bỏ qua các trận nằm trong vòng bảng.
8. Trang Admin gọi ba API không tồn tại.
9. Thời gian chơi và bảng phụ huynh có giao diện nhưng thiếu dữ liệu/backend.
10. Hai thẻ hoạt động ở Thành Phố Sáng Tạo nằm ngoài lưới do đóng `div` sai vị trí.
11. Trang chủ có hai listener cho cùng một thông báo và có thể lỗi khi huy hiệu chuông chưa được tạo.
12. Nội dung thông báo được chèn bằng `innerHTML`, tạo nguy cơ XSS.
13. Cookie phiên chưa có cấu hình production phù hợp.
14. Dự án chỉ đọc `MONGO_URI`, dễ lỗi khi Render đang dùng tên `MONGODB_URI`.

## Nâng cấp trải nghiệm

- Dashboard người chơi trên trang chủ.
- Tìm kiếm và bộ lọc theo Sáng tạo, Học tập, Thi đấu, Cá nhân.
- Nút tiếp tục hoạt động gần nhất.
- Banner giải đấu hiện hành.
- Bảng xếp hạng rút gọn.
- Trạng thái máy chủ.
- Toast thông báo chung, hỗ trợ mobile và giảm chuyển động.
- Giao diện responsive từ 320 px trở lên.


## Thế giới Trang Trí Phòng 3.0

- Bản đồ nhỏ theo thời gian thực và bản đồ lớn có danh sách địa danh.
- Dịch chuyển nhanh tới Làng Mơ Ước, Đồi Cầu Vồng, Núi Pha Lê, Sông Ước Mơ, Vườn Tuyết và Chợ Trên Mây.
- Thêm ba cây cầu, quảng trường, đường đi, cột mốc phát sáng và sự kiện môi trường.
- Chủ đề Mùa xuân, Hoàng hôn, Mùa đông và Huyền ảo.
- Chế độ ngày/hoàng hôn/đêm, thời tiết quang đãng/mưa/tuyết/sương mù hoặc tự động.
- Thêm 12 công trình thế giới: chòi nghỉ, cối xay gió, quầy chợ, đèn đường, ghế công viên, lửa trại, bàn dã ngoại, xích đu, cây anh đào, tinh thể, cổng dịch chuyển và biển chỉ dẫn.
- Chặn khách tham quan xây/phá hoặc lưu đè thế giới của chủ nhà.
- Sửa lỗi trạng thái đặc biệt của cửa, thang và công trình bị ghi đè khi tạo mô hình.

## Đổi điểm sang Robux

- Người chơi nhập tên Roblox và số Robux muốn đổi; không yêu cầu mật khẩu, OTP hoặc cookie.
- Điểm được giữ ngay khi gửi yêu cầu để chống đổi trùng.
- Giới hạn tối thiểu, tối đa/ngày và số yêu cầu đang mở được cấu hình bằng biến môi trường.
- Người chơi xem lịch sử, trạng thái và có thể hủy yêu cầu đang chờ để hoàn điểm.
- Admin có bảng duyệt, từ chối kèm hoàn điểm và đánh dấu đã trả.
- Không tự động chuyển Robux; admin chỉ xác nhận sau khi thanh toán bằng phương thức chính thức của Roblox.

# Hành Tinh Mơ Ước 9.1 — Cập nhật lớn

## 1. Học tập thích ứng

- Thêm lịch ôn giãn cách theo kết quả từng bài.
- Bài điểm thấp được nhắc ôn sớm; bài đã thành thạo có khoảng ôn dài hơn.
- Bảng điều khiển thích ứng hiển thị số bài đến hạn, phút học theo ngày, số ngày học trong tuần và mục tiêu tuần.
- Thêm nhật ký hoạt động học tập gần đây và hệ thống thành tựu dài hạn.
- Khi trả lời đúng câu từng làm sai trong bài ôn, câu đó được đánh dấu đã xử lý và không lặp vô hạn.
- Ghi thời gian học, bài làm, ôn tập, ghi chú, luyện nói và viết văn để AI/phụ huynh nhìn được tiến trình tổng thể.
- Giảm tải tác vụ nền và thêm giới hạn gọi API AI, khai thác quặng, đăng nhập và giải đấu.

## 2. Giải đấu cộng đồng

Người chơi có thể tự tạo giải Cờ Vua, Caro, Cờ Vây hoặc Othello.

- Giải công khai hoặc riêng tư bằng mã mời 6 ký tự.
- Chọn thể thức tự động, loại trực tiếp hoặc vòng bảng.
- Chọn 2–32 người, thời gian đăng ký, thời lượng trận và số ngày thi đấu.
- Người tạo được phép bắt đầu sớm khi đã đủ số người tối thiểu.
- Hệ thống tự khởi động khi đủ số người tối đa hoặc hết hạn đăng ký.
- Tự tạo nhánh đặc cách đến lũy thừa hai gần nhất, tránh cây đấu méo với 5, 6, 7, 9 người.
- Có chung kết và tranh hạng ba khi thể thức cho phép.
- Người chơi có thể rời giải khi còn mở; phí được hoàn và không thể đăng ký lại để chống lợi dụng.
- Chủ giải có thể hủy trước khi bắt đầu; toàn bộ phí được hoàn tự động.
- Quản trị viên có API hủy khẩn cấp giải cộng đồng và hoàn quỹ.

## 3. Điểm Đấu Trường an toàn

Giải cộng đồng **không dùng điểm có thể đổi Robux hoặc tiền**.

- Thêm ví `arenaPoints` riêng, hiển thị là Điểm Đấu Trường.
- Mỗi tài khoản nhận một lần số điểm khởi đầu theo `ARENA_WELCOME_POINTS`.
- Hoàn thành cấp game mới nhận thêm một lượng Điểm Đấu Trường giới hạn.
- Phí tham gia được máy chủ trừ và giữ trong `escrowBalance`.
- Hạng nhất nhận 70%, hạng nhì 20%, hạng ba 10%; nếu không có hạng ba thì chia 80%/20%.
- Giao dịch thưởng và hoàn phí có `referenceId` để tránh cộng hai lần.
- Điểm Đấu Trường không rút, không đổi tiền và không đổi Robux.

## 4. Sửa lỗi giải đấu và bàn cờ

- Hỗ trợ nhiều giải cộng đồng chạy đồng thời, không còn lấy nhầm giải theo môn thi.
- Sửa lịch thi đấu cộng đồng để bắt đầu sau vài phút thay vì bị xếp sang ngày hôm sau.
- Khóa kết quả trùng trong cùng tiến trình máy chủ.
- Cờ Vua và Cờ Vây dùng xác nhận đồng thuận từ cả hai trình duyệt trước khi ghi người thắng.
- Caro và Othello vẫn được máy chủ tự kiểm tra nước đi và kết quả.
- Thêm thông báo thân thiện, tương phản cao, nút lớn và toàn màn hình cho bàn cờ.
- Sửa trận tranh hạng ba và chia thưởng hạng ba.

## 5. Bảo vệ và hiệu năng

- Thêm `X-Request-Id`, `Cache-Control: no-store` cho API và chặn yêu cầu ghi khác nguồn trên production.
- Bộ giới hạn tốc độ tự dọn bucket cũ, tránh tăng bộ nhớ vô hạn.
- Lịch sử người dùng được giữ tối đa 300 mục khi cộng/trừ điểm giải đấu.
- Giới hạn số giải đang hoạt động và số giải được tạo mỗi ngày.
- Tự di chuyển dữ liệu giải cũ sang `organizerType=official` khi máy chủ khởi động.
- Tác vụ bảo trì xử lý nhiều giải cùng lúc và tự hoàn phí nếu hết hạn nhưng không đủ người.

## 6. Biến môi trường mới

```env
COMMUNITY_TOURNAMENTS_ENABLED=true
ARENA_WELCOME_POINTS=300
COMMUNITY_TOURNAMENT_MAX_ENTRY=500
COMMUNITY_TOURNAMENT_MAX_ACTIVE=2
COMMUNITY_TOURNAMENT_MAX_DAILY=5
COMMUNITY_TOURNAMENT_MAX_PLAYERS=32
```

## 7. API mới

```text
GET  /api/tournaments
GET  /api/tournaments/:id
POST /api/tournaments
POST /api/tournaments/join-code
POST /api/tournaments/:id/join
POST /api/tournaments/:id/leave
POST /api/tournaments/:id/start
POST /api/tournaments/:id/cancel
POST /api/admin/community-tournament/:id/cancel
GET  /api/learning/adaptive-dashboard
GET  /api/admin/learning-overview
```

## 8. Kiểm tra

Chạy:

```bash
npm ci
npm test
npm start
```

Bộ kiểm tra xác nhận cú pháp JavaScript, script nội tuyến, liên kết tệp, API frontend/backend, 12 chương trình lớp riêng, ngân hàng câu hỏi, mỏ vô tận, bàn cờ và giải cộng đồng.

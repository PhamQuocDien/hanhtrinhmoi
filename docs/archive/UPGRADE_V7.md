# Hành Tinh Mơ Ước 7.0 — Lộ trình nâng cao và Mỏ Pha Lê Vô Tận

## Lộ trình học tập

- Giữ 12 hồ sơ chương trình riêng, 144 lộ trình môn, 2.980 bài và 35.760 câu hỏi.
- Thêm kế hoạch học 7 ngày dựa trên mục tiêu phút/ngày và số ngày học/tuần.
- Mỗi môn được chia thành các chặng 4 bài.
- Bài thứ tư trong mỗi chặng là mốc kiểm tra nhanh.
- Mỗi bài có độ khó, 5 bước học, mục tiêu, ghi nhớ và 3 nhiệm vụ luyện tập không tính điểm.
- Trạng thái tiến độ gồm: mới, đang luyện, đã đạt và thành thạo.
- Thành thạo khi điểm tốt nhất từ 9,5/10.
- Bài ôn nhanh được tạo từ tối đa 5 lỗi sai gần nhất và chấm trên máy chủ.
- XP lớn chỉ cấp ở lần đầu vượt bài; làm lại chỉ nhận XP cải thiện nhỏ.
- Ghi nhận tổng thời gian học ước tính và sửa API ghi chú.

## Trang trí phòng và đào quặng

- Thêm Mỏ Pha Lê Vô Tận tại địa danh Núi Pha Lê.
- Có bệ mỏ riêng để người chơi dịch chuyển đến ngay.
- Quặng tái sinh sau khoảng 0,65–1,55 giây.
- Không có giới hạn đào theo ngày.
- Máy chủ chỉ chống nhấp trùng dưới 160 mili giây để tránh gửi lệnh lặp do thiết bị.
- Quặng được cộng trực tiếp vào kho MongoDB, không phụ thuộc nút lưu thế giới.
- Có thống kê tổng số quặng đã đào.
- Bổ sung than, sắt, đồng, vàng, đá đỏ, ngọc lục bảo, kim cương và thạch anh tím.
- Quặng hiếm có tỉ lệ xuất hiện thấp hơn; có 12% cơ hội nhận thêm một đơn vị.

## API mới

- `GET /api/learning/week-plan`
- `GET /api/learning/review-quiz`
- `POST /api/learning/review-quiz/submit`
- `POST /api/house/mine`

## Kiểm tra

Chạy:

```bash
npm test
```

Bộ kiểm tra xác nhận cú pháp, 12 lớp, bài/chặng học, API mới, ngưỡng trên 8/10 và mã mỏ tái sinh.

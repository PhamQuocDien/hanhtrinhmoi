# Báo cáo kiểm tra V13

## Đã chạy trong môi trường xây dựng

- `npm test`: đạt.
- Kiểm tra cú pháp toàn bộ JavaScript và JavaScript nội tuyến: đạt.
- Kiểm tra liên kết CSS/JS/HTML, ID giao diện và mã AdSense: đạt.
- Kiểm tra 12 lớp, 144 lộ trình môn, 2.980 bài và 35.760 câu hỏi theo bài: đạt.
- Kiểm tra ngân hàng tối thiểu 21.600 câu: đạt.
- Kiểm tra địa hình sinh tồn, đào móng, bedrock, cấp cuốc, đặt khối, khối lơ lửng, độ bền, đói và thể lực: đạt.
- Quét khóa `khóa dự án OpenAI` và file `.env` thật: không phát hiện.
- Kiểm tra `node_modules` không nằm trong gói phát hành: đạt.

## Giới hạn kiểm tra

Môi trường xây dựng không tải được đầy đủ gói npm từ registry, vì vậy chưa chạy phiên Express hoàn chỉnh với MongoDB thật. Sau khi triển khai, cần kiểm tra Deploy Logs và các luồng trong danh sách dưới đây.

## Kiểm tra sau triển khai Render

1. Mở `/healthz`, phải trả HTTP 200.
2. Mở `/api/health`, kiểm tra `version` là `13.0.0` và `database` là `connected`.
3. Mở `/status.html` khi chưa đăng nhập.
4. Đăng nhập bằng học sinh, mở một bài và nộp thử.
5. Tắt mạng khi đang làm bài, bấm nộp, bật mạng lại và xác nhận bài tự đồng bộ đúng một lần.
6. Vào sinh tồn, đào đất/đá/móng, đặt lại khối, tải lại trang và xác nhận trạng thái còn nguyên.
7. Dùng cuốc đến khi hỏng, xác nhận công cụ bị xóa và độ bền đồng bộ.
8. Mở hai tài khoản để thử bàn cờ/giải đấu online.
9. Kiểm tra AdSense và `ads.txt` sau khi tên miền được duyệt.

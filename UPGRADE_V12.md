# Hành Tinh Mơ Ước V12 – Ổn định Render, nộp bài tin cậy và sinh tồn đào móng

## 1. Vá lỗi HTTP 503 trên Render

- Thêm `/healthz` độc lập MongoDB/session để Render kiểm tra tiến trình Node còn sống.
- `render.yaml` chuyển health check sang `/healthz`.
- `/api/health` luôn trả trạng thái tiến trình và tình trạng MongoDB; `/api/ready` dùng cho readiness.
- MongoDB tự kết nối lại sau lỗi tạm thời thay vì làm sập website.
- ADMIN_PASSWORD thiếu/sai không còn làm dừng toàn bộ dịch vụ; tài khoản hiện có được giữ nguyên.
- SESSION_SECRET thiếu hoặc ngắn dùng khóa ổn định dự phòng và ghi cảnh báo triển khai.
- Bọc route async của Express 4 để lỗi Promise đi vào error middleware, không làm request treo.
- API cần dữ liệu trả JSON 503 rõ ràng trong lúc MongoDB kết nối lại.

## 2. Sửa lỗi không thể nộp bài

- Kiểm tra đủ đáp án ở cả trình duyệt và máy chủ.
- Nút nộp hiển thị trạng thái đang gửi, lỗi cụ thể và tự mở lại khi thất bại.
- Thêm timeout 20 giây và thông báo riêng cho lỗi Render, mất phiên, MongoDB đang kết nối lại.
- Tự lưu đáp án nháp vào thiết bị và khôi phục khi mở lại bài.
- Mỗi lần nộp có `submissionId`/mã biên nhận; máy chủ chống ghi trùng và không cộng XP hai lần.
- Sau khi nộp, các bảng tiến độ được cập nhật độc lập; một bảng lỗi không làm mất kết quả đã lưu.
- Chấm hát/vẽ cũng có timeout và thông báo kết nối rõ ràng.

## 3. Sinh tồn đào cả móng

- Độ sâu tăng từ 5 lên 12 tầng dưới mặt đất.
- Thêm hang tự nhiên, đá sâu và lớp móng đá cổ.
- Cỏ, đất, đá, đá sâu, móng và quặng đều có thể đào.
- Chỉ lớp đá nền cuối cùng ở Y=-13 không thể phá.
- Cuốc gỗ đào đá sâu; cuốc đá đào được lớp móng; cuốc sắt dùng cho quặng hiếm.
- HUD có trạng thái máy chủ, nút kết nối lại và chỉ báo độ sâu.
- Khi ngoại tuyến, người chơi vẫn xem thế giới nhưng không thể đào để tránh mất/nhân vật phẩm.
- Danh sách khối đã đào lưu tối đa 12.000 vị trí mỗi tài khoản.

## 4. Giao diện và quảng cáo

- Thêm giám sát kết nối chung cho 39 trang.
- Tab, bảng, dialog và nút nộp tiếp tục dùng lớp responsive chung.
- Mã AdSense `ca-pub-2735044868175045` được kiểm tra đúng một lần trên mỗi trang HTML.
- `ads.txt` được giữ nguyên ở thư mục gốc.

## 5. Kiểm thử

- Kiểm tra cú pháp toàn bộ JavaScript và script nội tuyến.
- Kiểm tra liên kết tệp, ID HTML, route API, dữ liệu lớp 1–12 và ngân hàng câu hỏi.
- Kiểm tra đá móng đào được bằng cuốc đá và bedrock không thể phá.
- Smoke test khởi động server với cấu hình hợp lệ, ADMIN_PASSWORD sai và thiếu MongoDB.
- `/healthz` đều trả HTTP 200 trong các tình huống khởi động trên.

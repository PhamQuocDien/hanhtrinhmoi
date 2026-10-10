# Hành Tinh Mơ Ước V13 — ổn định, thực tế và an toàn dữ liệu

## Mục tiêu

V13 ưu tiên sửa lỗi vận hành và trải nghiệm thật thay vì chỉ tăng số lượng tính năng. Các thay đổi tập trung vào bốn luồng dễ gây mất niềm tin nhất: mở trang khi MongoDB gián đoạn, nộp bài khi mạng yếu, đào/xây sinh tồn và phản hồi trạng thái hệ thống.

## 1. Khởi động và Render

- `login.html`, `index.html`, `status.html` và tài nguyên giao diện thiết yếu được phục vụ trước session middleware.
- `/api/health` và `/api/ready` được đăng ký trước kho phiên MongoDB, nên vẫn trả trạng thái khi session store gián đoạn.
- Header bảo mật và `X-Request-Id` được gắn trước cả static/session để trang chẩn đoán luôn có mã đối chiếu.
- Thêm `status.html` để người dùng phân biệt lỗi thiết bị, Render và MongoDB.
- Thêm tắt máy an toàn cho `SIGTERM`/`SIGINT`, đóng HTTP và MongoDB trước khi Render thay phiên bản.
- Sửa lỗi runtime do thiếu khai báo `survivalLocks` và `survivalActionCooldowns`.

## 2. Nộp bài tin cậy

- Thêm hàng chờ nộp bài trên thiết bị tại `assets/learning/learning-v13.js`.
- Khi mất mạng, Render ngủ hoặc MongoDB kết nối lại, đáp án và `submissionId` được lưu cục bộ.
- Tự gửi lại khi có mạng; máy chủ tiếp tục chống ghi nhận/XP trùng bằng `submissionId`.
- Có thanh trạng thái bài đang chờ, nút gửi lại và lỗi gần nhất.
- Thêm API preflight và sử dụng ngay trước khi mở bài kiểm tra để kiểm tra mở khóa, thực hành bắt buộc và số câu.
- Khi bài trong hàng chờ gửi thành công, bản nháp tương ứng được dọn và bảng tiến độ tự làm mới.
- Thêm bài tập tuần tự động, hạn cuối tuần, thời lượng dự kiến và liên kết học ngay. Đây là kế hoạch hỗ trợ, không thay bài giáo viên giao.

## 3. Sinh tồn thực tế hơn

- Máy chủ là nguồn dữ liệu chính cho máu, đói, thể lực, XP, khối đào/đặt và độ bền.
- Trình duyệt không còn được phép tự gửi giá trị máu/đói/thể lực tùy ý.
- Thêm đặt khối có kiểm tra vật phẩm, vị trí trống, điểm tựa và giới hạn thế giới.
- Khối đã đặt được lưu và có thể đào lại để thu hồi vật phẩm.
- Thêm độ bền cuốc gỗ/đá/sắt; công cụ hỏng được xóa trên máy chủ và giao diện.
- Đào tiêu hao thể lực và một ít độ đói; trạng thái phục hồi/tiêu hao theo thời gian.
- Giữ khả năng đào cỏ, đất, đá sâu và móng; chỉ bedrock cuối cùng không phá.
- Tạo lại đảo có thời gian chờ, giữ cấp/XP/công cụ và thông báo rõ dữ liệu nào được giữ.

## 4. Trải nghiệm toàn hệ thống

- Giám sát kết nối V13 có liên kết đến trang chẩn đoán.
- Thêm skip-link, hỗ trợ bàn phím, cuộn tab ngang bằng con lăn và lazy-load ảnh.
- Cảnh báo khi rời trang có nội dung văn bản chưa lưu.
- Các trang dùng chung lớp `assets/ui/ux-v13.css/js`.

## 5. Kiểm tra

Chạy:

```bash
npm test
```

Bộ kiểm tra gồm:

- Cú pháp JavaScript và JavaScript nội tuyến.
- Liên kết file, ID HTML, AdSense, API giao diện–máy chủ.
- 12 lớp, 144 lộ trình môn, 2.980 bài, 35.760 câu theo bài và ngân hàng 21.600+ câu.
- Địa hình, kim cương, công cụ đúng cấp, móng đào được, bedrock không phá.
- Đặt khối có điểm tựa, chặn khối lơ lửng.
- Độ bền công cụ và mô phỏng đói/thể lực.

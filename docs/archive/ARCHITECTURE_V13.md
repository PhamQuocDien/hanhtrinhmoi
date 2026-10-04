# Kiến trúc V13

## Mô-đun sinh tồn

- `server/modules/survival-v13.js`: địa hình, quy tắc đào/đặt, độ bền và mô phỏng trạng thái thuần JavaScript, có thể unit test không cần MongoDB.
- `assets/room/survival-v13.js`: dựng thế giới, HUD, thao tác người chơi và đồng bộ API.
- `assets/room/survival-v13.css`: giao diện sinh tồn.

Máy chủ không nhận trực tiếp máu, đói hoặc thể lực từ trình duyệt. Mỗi API tải trạng thái, tiến thời gian bằng `advanceState`, thực hiện hành động và lưu lại.

## Mô-đun học tập tin cậy

- `assets/learning/learning-v13.js`: outbox nộp bài, gửi lại và khôi phục sau lỗi mạng.
- `assets/learning/learning-v13.css`: trạng thái hàng chờ.
- `submissionId` là khóa idempotency ở cả trình duyệt và `LearningRecord.submissionIds`.

## Mô-đun vận hành

- `status.html`: trang chẩn đoán công khai.
- `assets/ui/connection-v13.js`: phát sự kiện `hanhtrinh:connection-state`.
- `assets/ui/ux-v13.js`: cải thiện bàn phím, form và dữ liệu chưa lưu.

## Quy tắc nâng cấp tiếp

1. Logic có thể kiểm thử đặt trong `server/modules`, không viết thêm vào `server.js` nếu không cần.
2. Mỗi hành động thay đổi tài nguyên phải được xác thực và tính lại phía máy chủ.
3. Giao diện không được xóa bản nháp trước khi nhận biên nhận máy chủ.
4. API mới phải được thêm vào `scripts/validate-project.js` hoặc unit test riêng.
5. Không lưu khóa API trong HTML/JavaScript hoặc GitHub.

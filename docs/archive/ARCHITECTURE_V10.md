# Kiến trúc V10

## Mục tiêu
Tách chức năng mới thành mô-đun độc lập để giảm rủi ro khi sửa một trang lớn.

- `assets/learning/book-catalog.js`: danh mục lựa chọn bộ sách và chương trình chung.
- `assets/learning/practical-assessment.js`: bài thực hành đúng đặc thù môn (hát, vẽ).
- `assets/learning/learning-v10.css`: giao diện mô-đun học.
- `assets/room/room-v10.js`: hướng dẫn, chế độ khám phá/đào/xây.
- `assets/room/room-v10.css`: HUD và khả năng hiển thị phòng.

## Nguyên tắc nội dung
Website bám yêu cầu cần đạt của Chương trình GDPT 2018. Bộ sách chỉ thay đổi cách tổ chức chủ đề và ví dụ; không sao chép nguyên văn sách giáo khoa có bản quyền. Không có một “bộ sách chung duy nhất của Chính phủ”; lựa chọn `Chương trình chung quốc gia` là lớp nội dung trung lập.

## Nâng cấp tiếp theo
Tách `server.js` thành `server/routes`, `server/services`, `server/models` theo từng miền: learning, tournaments, boards, house, auth. Việc này cần migration có kiểm thử API để tránh làm hỏng dữ liệu đang chạy.

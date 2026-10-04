# Kiến trúc V14

## Tác vụ nền

- `server/modules/quest-maintenance-v14.js`: xử lý nhiệm vụ quá hạn, không phụ thuộc Express.
- Mỗi tác vụ phải có khóa chống chạy chồng và bắt lỗi ở hai cấp: toàn phiên và từng bản ghi.
- Truy vấn dùng projection phải lấy đủ các trường sẽ đọc hoặc ghi.

## Học tập

- `server/modules/lesson-theory-v14.js`: sinh gói lý thuyết theo nhóm môn.
- `curriculum-data.js`: ghép gói lý thuyết với bài học và câu hỏi.
- `assets/learning/learning-v14.css`: giao diện phần bài giảng.
- `lo-trinh-hoc-tap.html`: chỉ dựng giao diện; logic nội dung nằm trong mô-đun dữ liệu.

## Sinh tồn

- `server/modules/survival-v14.js`: địa hình, công cụ, công thức và bộ lập kế hoạch chế tạo.
- `assets/room/survival-v14.js/css`: HUD và bàn chế tạo.
- Máy chủ là nguồn sự thật cho kho, nguyên liệu đã tiêu và sản phẩm nhận được.

## Bàn cờ

- `board-ui-v14.css/js` là lớp sửa cuối, nạp sau giao diện dùng chung.
- Không thêm quy tắc toàn cục cho `button`, `img`, `canvas` nếu chưa loại trừ các trang game.

## Quy tắc nâng cấp tiếp

1. Logic có thể kiểm thử phải nằm trong `server/modules`.
2. Mỗi lỗi production phải có test hồi quy.
3. Không sửa tài nguyên người dùng chỉ ở phía trình duyệt.
4. Không thêm nội dung bài học chung chung nếu có thể tạo theo môn/chủ đề.
5. Không tải lazy ảnh quân cờ hoặc ảnh sprite trong vùng tương tác thời gian thực.

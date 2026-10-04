# Báo cáo kiểm tra V14

## Đã chạy thành công

```text
npm test
✅ validate-project.js
✅ test-v13-runtime.js
✅ test-v14-runtime.js
```

Các kiểm tra V14:

- Projection của bộ quét nhiệm vụ có trường `history`.
- `history`/`quests` thiếu vẫn được chuẩn hóa.
- Một người dùng lưu lỗi không chặn người dùng kế tiếp.
- Toàn bộ 2.980 bài có ít nhất 3 mục lý thuyết, lỗi thường gặp và câu tự kiểm tra.
- Chế tạo nhanh tự làm Ván/Gậy nhưng không tạo vật phẩm khi thiếu tài nguyên.
- Năm trang bàn cờ đều nạp lớp sửa V14.
- Cú pháp JavaScript và script nội tuyến hợp lệ.
- Không thiếu CSS/JS/HTML cục bộ.

## Giới hạn môi trường kiểm thử

`npm ci` không hoàn tất trong môi trường xây dựng vì registry nội bộ không có gói `yallist-4.0.0`. Vì vậy chưa chạy phiên Express đầy đủ với MongoDB thật tại đây. Sau khi deploy, cần kiểm tra log Render trong ít nhất 2 chu kỳ quét nhiệm vụ và thử chế tạo bằng tài khoản thật.

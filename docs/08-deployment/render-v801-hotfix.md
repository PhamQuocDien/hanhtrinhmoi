# Render V8.0.1 hotfix

## Lỗi proxy

`express-rate-limit` dựa vào `req.ip`. Khi chạy sau proxy, Express cần `trust proxy` khớp đúng số proxy hop. V8.0.1 đọc `TRUST_PROXY_HOPS`; nếu biến này trống, code tự nhận diện Render thông qua `RENDER_EXTERNAL_HOSTNAME`/các biến Render và tin cậy một hop. Ở máy local direct, mặc định không tin forwarded headers. Không cấu hình `trust proxy=true` bừa bãi.

## Lỗi `username_1` unique index

Mô hình `User` hiện tại không còn trường `username`, nhưng database cũ vẫn có thể giữ unique index `{ username: 1 }`. MongoDB coi các bản ghi không có field đó là `null` đối với index này, nên lần đăng ký tiếp theo va chạm.

V8.0.1 kiểm tra index sau khi kết nối; chỉ mục unique một trường `username` sẽ được gỡ nếu schema không định nghĩa `username`. Không có tài liệu người dùng nào bị xóa.

Nếu muốn chạy migration trước khi deploy:

```bash
npm run migrate:user-indexes
```

Sao lưu trước. Lệnh sẽ in tên database và collection, sau đó chỉ xóa index không còn được dùng. Nếu database không phải database dự kiến, dừng và sửa `MONGO_URI` trước.

## Kiểm tra sau triển khai

- Log server hiển thị `trust proxy: 1` trên Render (hoặc số hop cấu hình đúng).
- `/api/health` trả `version: 8.0.1`.
- Log có thể hiển thị `Dropped obsolete unique index username_1 ... no user documents were deleted.` nếu migration đã gỡ index.
- Thử đăng ký một tài khoản thử nghiệm với email mới; xác nhận HTTP 201 và tài khoản xuất hiện trong đúng collection `users`.
- Không coi `Connected to MongoDB` đơn thuần là bằng chứng dùng đúng database; log cũ ghi `test.users`, cần kiểm tra URI đích.

# Hành Trình Mới V36.0.0 — Release hardening

## Mục tiêu

V36 xử lý các vấn đề đã phát hiện trong lần kiểm tra V35: thiếu tệp cấu hình mẫu làm hỏng bài test integrity, phiên bản không đồng bộ trong test/endpoint, cache key chưa được cập nhật nhất quán, và thiếu bài test hồi quy cho các ranh giới triển khai quan trọng.

## Thay đổi

- Đồng bộ `package.json`, `package-lock.json`, `server.js`, endpoint learning-system và cache key hoạt động sang `36.0.0`.
- Bổ sung `.env.example` và `executor-service/.env.example`; không điền API key hay token thật.
- Sửa các bài test cũ vốn khóa cứng phiên bản V35 để chúng kiểm tra V36, tránh false-negative sau khi bump version.
- Thêm `scripts/test-v36-release-hardening.js` vào cả `npm test` và `npm run check`.
- Giữ code runner tắt mặc định trên Render; việc bật thực thi cần executor riêng, token riêng, URL an toàn và kiểm tra health xác nhận sandbox.
- Bổ sung hướng dẫn cách phân biệt test mã nguồn với smoke test dịch vụ thực tế.

## Kiểm thử

Chạy từ thư mục gốc:

```bash
npm test
npm run validate
node --check executor-service/server.js
```

`npm test` và `npm run validate` chỉ xác nhận các test tự động trong gói mã nguồn. Không thể chứng minh MongoDB, Gemini/OpenAI, Docker executor hoặc Render hoạt động nếu không có thông tin kết nối và môi trường thực tế.

## Chưa tuyên bố hoàn tất

- Chưa xác minh deployment thực tế với MongoDB/Render và khóa AI của người vận hành.
- Chưa bật code runner trên Render vì executor an toàn phải được triển khai riêng; cấu hình `false` là có chủ đích.
- Chưa thể tuyên bố toàn bộ ngân hàng câu hỏi của từng bài học đã đạt 50–100 câu độc lập, đúng chủ đề trên toàn bộ dữ liệu đang lưu trong MongoDB; cần chạy kiểm toán dữ liệu thực tế.
- Chất lượng học liệu tự sinh cần được rà soát theo môn/chương bởi giáo viên; test cấu trúc không bảo đảm độ chính xác sư phạm.

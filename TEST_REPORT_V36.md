# Hành Trình Mới V36.0.0 — Báo cáo kiểm thử

Ngày kiểm tra: 2026-10-10.

## Kết quả tự động trong môi trường hiện tại

- `npm test`: PASS (toàn bộ chuỗi test đã chạy đến cuối, bao gồm 8 assertion V36 mới).
- `npm run check`: PASS.
- `npm run validate`: PASS — 54 trang HTML, 145 tệp JavaScript được kiểm tra; validator kiểm tra thêm tham chiếu tài nguyên và các điều kiện kiến trúc đã khai báo.
- `node --check executor-service/server.js`: PASS.
- Bản ghi `npm test` có 205 dòng đánh dấu PASS. Đây là số dòng PASS được ghi ra, không phải khẳng định có 205 trường hợp độc lập; một số dòng tổng kết nhóm test.

## Sửa lỗi từ V35

- Bổ sung `.env.example` ở gốc dự án và `executor-service/.env.example` để test kiểm tra cấu hình không thất bại chỉ vì thiếu hai tệp mẫu.
- Đồng bộ phiên bản package, lockfile, runtime, learning-system endpoint và cache key lên `36.0.0`.
- Cập nhật các test hồi quy trước đó khóa cứng phiên bản V35.
- Thêm `scripts/test-v36-release-hardening.js` vào cả `npm test` và `npm run check`.
- Giữ code runner tắt mặc định trong `render.yaml`; không cho phép mã người học chạy trong tiến trình web để làm xanh kiểm thử.

## Tính năng trước đó vẫn được kiểm tra hồi quy

- Chấm bài tự luận theo Gemini → OpenAI → rubric nội bộ và lưu lịch sử.
- Bài kiểm tra có thời hạn, lưu/khôi phục câu trả lời và tiến độ bài học dựa trên bằng chứng đánh giá.
- Khóa học cá nhân, thực hành theo môn/kỹ năng, kiểm tra nội dung khóa học và tránh tự động chuyển sang bài thực hành của khóa khác.
- Rate limit và nhật ký yêu cầu không ghi body hoặc header xác thực.

## Chưa thể xác minh bằng test nguồn

- Không có smoke test thật với MongoDB/Render trong phiên kiểm tra này; kết nối DB, migration trên dữ liệu đang dùng và triển khai thực tế vẫn cần kiểm tra riêng.
- Không xác nhận được quota/chất lượng của Gemini/OpenAI bằng API key thật.
- Code runner trên Render vẫn tắt mặc định. Muốn chấm code thực thi thật phải triển khai executor riêng, cấu hình token/URL riêng tư và xác minh health báo sandbox cô lập trước khi bật.
- Chưa kiểm toán toàn bộ dữ liệu đang lưu trong MongoDB để chứng minh mỗi bài học có 50–100 câu hỏi độc lập, đúng chủ đề, hoặc mọi khóa học đều đạt chuẩn sư phạm. Test cấu trúc không thay thế kiểm duyệt nội dung.
- Bộ test chạy trong môi trường Node v22.16.0; dự án khai báo Node 20.x, vì vậy cần chạy lại trên Node 20 trước khi phát hành production.

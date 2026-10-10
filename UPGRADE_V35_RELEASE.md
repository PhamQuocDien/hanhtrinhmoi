# Hành Trình Mới V35.0.0 — Release notes

## Nâng cấp trong bản này
- Chấm bài viết theo thứ tự Gemini → OpenAI → rubric nội bộ; lỗi quota/AI không làm mất bài nộp.
- Lưu lịch sử chấm bài tự luận vào MongoDB, kèm điểm, tiêu chí, ưu điểm, hướng cải thiện, ví dụ sửa và nguồn chấm.
- Thêm API `GET /api/learning/literature/essay/history?limit=20` (chỉ trả bài của tài khoản đang đăng nhập, không trả nội dung bài viết trong danh sách).
- Đồng bộ metadata phiên bản lên 35.0.0.
- Giữ cơ chế giới hạn tài nguyên và không thực thi mã học viên trực tiếp trong tiến trình web.

## Biến môi trường AI
- Gemini: `GEMINI_API_KEY` (hoặc `GOOGLE_API_KEY`) và `GEMINI_MODEL`/`GEMINI_FALLBACK_MODELS` nếu cần.
- OpenAI dự phòng: `OPENAI_API_KEY`, tùy chọn `OPENAI_MODEL`.
- Không cần cấu hình API AI để server chạy; khi AI không dùng được, hệ thống lưu bài và chấm ước lượng nội bộ, hiển thị rõ đây không phải điểm AI.

## Kiểm tra
Chạy `npm ci`, `npm test`, `npm run validate`. Kiểm tra triển khai thực tế cần MongoDB, biến môi trường và dịch vụ Render hoạt động; bản đóng gói này không tuyên bố đã xác minh kết nối production.

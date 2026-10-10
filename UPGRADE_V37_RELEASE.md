# Hành Trình Mới V37.0.0 — Release notes

## Nội dung nâng cấp
- Thêm `server/services/assessment-integrity-v37.js` để xác thực ràng buộc bài kiểm tra với khóa học, môn, lớp, cấp học, bài học và ngân hàng câu hỏi trước khi lưu.
- Bài kiểm tra đầu vào cân bằng câu hỏi theo kỹ năng, loại trùng prompt, kiểm tra độ phủ ít nhất 3 kỹ năng và 2 mức độ khó; nếu câu hỏi AI chưa đủ, bổ sung từ ngân hàng cùng track thay vì phát hành đề mỏng.
- Kiểm tra chất lượng học liệu theo số phần lý thuyết, độ dài bài giảng, ví dụ, bài tập và liên kết bài kiểm tra.
- Phân loại track TOEIC, MOS, K12, IT và đại học có test hồi quy.
- Quota theo ngày/free-tier của Gemini được cooldown tối đa 24 giờ, tránh lặp gọi cùng model khi quota ngày đã cạn; rate limit tạm thời vẫn phân biệt riêng.
- Đồng bộ version và cache-busting sang V37.0.0.

## Kiểm thử
Chạy `npm ci`, `npm test`, `npm run check`, `npm run validate`. `scripts/test-v37-assessment-integrity.js` là test thuần, không cần API key.

## Giới hạn xác minh
Không thể xác nhận dữ liệu MongoDB production, chất lượng từng khóa học đã tồn tại, quota thực tế của tài khoản Gemini, API TTS, hoặc deployment Render nếu không có kết nối/credentials. Những nội dung đó cần chạy smoke test trên môi trường triển khai. Code runner vẫn giữ tắt mặc định đến khi executor biệt lập được kiểm tra an toàn.

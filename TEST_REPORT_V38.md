# Hành Trình Mới V38.0.0 — Test report

## Đã kiểm thử trong môi trường local
- Syntax check: `server/services/course-quality-v38.js`, `server/services/ai-generation-worker.js`, `server/routes/platform-routes.js`, `assets/js/admin/admin-course-factory.js`.
- `scripts/test-v38-course-quality.js`: 22 assertions PASS.
- Các kiểm thử bao gồm prompt không dùng dàn ý cố định, schema blueprint động, nội dung đạt/không đạt quality gate, thiếu đề cuối khóa, grade K12 không hợp lệ, câu hỏi trùng, thiếu subjectId và audit khóa đã lưu với môn sai.

## Chưa được xác minh
- Chưa gọi Gemini API thật; chưa thể bảo đảm mọi model/key/quota trả về blueprint đủ dài trong một lượt. V38 có một lượt sửa AI, sau đó giữ draft ở trạng thái không hợp lệ nếu vẫn không đạt.
- Chưa kết nối MongoDB production hoặc Render; chưa kiểm tra dữ liệu khóa học đang có trên server thật.
- Chưa kiểm tra TTS thực tế hoặc toàn bộ luồng học của người dùng trên trình duyệt.
- Quality gate kiểm tra cấu trúc và tín hiệu nội dung, không chứng minh sự chính xác học thuật tuyệt đối; cần review chuyên môn trước khi công bố.

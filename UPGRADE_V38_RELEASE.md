# Hành Trình Mới V38.0.0 — Adaptive AI Course Generation

## Mục tiêu
V38 tập trung vào khóa học được AI thiết kế theo nhu cầu thật, không ép mọi lĩnh vực vào cùng một bộ khung chương/bài; nâng chất lượng học liệu và kiểm tra; kiểm toán các khóa học đã lưu.

## Thay đổi
- `server/services/course-quality-v38.js` tạo prompt theo ngữ cảnh, schema blueprint động, chuẩn hóa kết quả và quality gate cho nội dung.
- Course Factory gọi Gemini Structured Output để tạo khóa học riêng theo mục tiêu, cấp học, lớp, môn, chứng chỉ/track; AI tự chọn số chương và bài theo phạm vi thay vì dùng curriculum skeleton cố định.
- Nếu quality gate không đạt, hệ thống gửi một lượt yêu cầu AI sửa theo danh sách lỗi; nếu vẫn không đạt, lưu draft ở trạng thái chưa được xác nhận, không cho commit.
- Quality gate xem xét mục tiêu, độ sâu lý thuyết, bài giảng, ví dụ có lời giải, số lượng/độ cụ thể của bài luyện, chất lượng lời giải câu hỏi, câu hỏi trùng, liên kết môn/lớp và bộ đề chương/cuối khóa.
- Bài kiểm tra từng bài dùng câu hỏi gắn với bài; bài kiểm tra chương và cuối khóa có bộ câu hỏi riêng, không lấy lại toàn bộ câu hỏi của lesson test như trước.
- Thêm endpoint `POST /api/admin/platform/course-factory/audit-v38` và nút “Kiểm toán catalog hiện có” trong Admin để phát hiện vấn đề ở dữ liệu cũ mà không tự ý sửa dữ liệu.
- Trước khi công bố, chạy audit trên các bài học, câu hỏi, assessment thực tế của khóa.
- Nếu thiếu API key hoặc AI tắt, Course Factory báo lỗi rõ ràng thay vì lặng lẽ dùng khung mẫu và gắn nhãn như AI tạo đầy đủ.
- Lỗi quota/daily quota không được xếp retry liên tục; job chuyển trạng thái lỗi với thời gian cooldown.
- Version và cache keys được nâng lên `38.0.0`.

## Cấu hình
- Cần `GEMINI_API_KEY` hoặc `GOOGLE_API_KEY` để Course Factory tạo blueprint bằng Gemini.
- Không đặt `AI_MODE=OFF` nếu muốn tạo khóa học bằng Gemini.
- `AI_COURSE_MAX_AI_LESSONS` mặc định 24 bài AI cho mỗi khóa cá nhân để tránh hàng chục lượt gọi/quota; có thể nâng tối đa 72 khi provider cho phép. AI được yêu cầu tự chọn số bài phù hợp trong giới hạn, không chèn bài mẫu để lấp chỗ.
- Có thể chỉnh `GEMINI_COURSE_MAX_OUTPUT_TOKENS` và `GEMINI_COURSE_REPAIR_MAX_OUTPUT_TOKENS`; mặc định 24000 mỗi lượt.
- Không commit API key vào Git.

## Quality gate
- Ít nhất 2 chương/mô-đun, 6 bài học; số lượng cụ thể vẫn do AI chọn theo mục tiêu, không dùng danh sách chủ đề cố định.
- Mỗi bài có mục tiêu, ít nhất 3 phần lý thuyết và 180 từ giải thích, bài giảng hướng dẫn, ví dụ có lời giải, ít nhất 3 hoạt động/luyện tập và ít nhất 5 câu hỏi riêng.
- Mỗi chương có ít nhất 5 câu kiểm tra chương; đề cuối khóa có ít nhất 10 câu tổng hợp độc lập.
- Câu hỏi có giải thích, câu trắc nghiệm có lựa chọn, phạm vi đúng môn/lớp/bài; câu trùng và cấu trúc nông bị từ chối.
- Đây là kiểm tra tự động dựa trên cấu trúc và tín hiệu nội dung, không thể thay chuyên gia xác minh độ đúng chuyên môn. Nội dung AI không được tự gắn nhãn official.

## Kiểm thử
- `scripts/test-v38-course-quality.js`: 22 assertions for adaptive prompts, blueprint structure, content depth, duplicate questions, wrong grade/track, missing subject, stored catalog audit and no-template behavior when AI is unavailable.
- Chạy `npm test`, `npm run check`, `npm run validate` trước khi deploy.
- Chưa kiểm thử Gemini thật, MongoDB production hay Render trong quá trình tạo bản ZIP này; cần smoke test môi trường triển khai.

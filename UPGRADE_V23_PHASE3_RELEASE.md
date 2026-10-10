# Release Notes — Hành Trình Mới V23.0.0 · Phase 3

## Thay đổi chính

- Thêm trang Hướng dẫn quản trị nội dung ngay trong Admin (22 quy trình, bảng loại câu hỏi, ví dụ end-to-end).
- Thêm Admin Content Studio với biểu mẫu khóa học, chương, bài học, ngân hàng câu hỏi, bài kiểm tra, chương trình đại học; không bắt nhập JSON.
- Thêm xem trước dữ liệu và quality gate khi công bố khóa học/assessment.
- Thêm Local Education AI, Course Factory, batch catalog expansion tối đa 25 items/lần, duplicate detection, skill-gap analysis và AI Autopilot dùng profile/survey/placement/mastery/error/learning plan.
- Thêm sửa nội dung theo từng lesson/question/assessment và nút retry cho job Course Factory/sửa nội dung thất bại.
- Mọi khóa AI được gắn `AI_GENERATED`, `official=false`, `verification=unverified`, cần Admin duyệt; không tự publish.
- Sửa lỗi biến `requestedSkills` trong Autopilot route.
- Fallback Gemini của Autopilot tắt mặc định; Course Factory và content repair chạy bằng `LOCAL_EDUCATION_AI`.

## Kiểm thử

- `npm test`: PASS (regression V13–V22 + 21 test V23 Phase 3 + 3 worker repair integration test).
- `npm run validate`: PASS.
- `node --check`: các file server/service/admin JS liên quan đã qua kiểm tra cú pháp.
- ZIP: cần kiểm tra lại `unzip -t` trên gói phát hành cuối cùng.

## Giới hạn được công bố rõ

Local Education AI là engine nội bộ theo luật và mẫu chuyên biệt, không phải một LLM đa dụng chạy local. Các tính năng AI khác được kế thừa trong ứng dụng có thể vẫn dùng provider ngoài nếu được cấu hình. Test tự động chưa xác minh luồng chạy trên MongoDB/Render production.

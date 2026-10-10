# Hành Trình Mới V16.0.0 — AI Learning Autopilot

## Mục tiêu
Biến AI từ một nút/chức năng riêng thành lớp trí tuệ chạy ngầm trong toàn bộ trải nghiệm học tập.

## Thay đổi chính
- Thêm `assets/js/ai-autopilot.js`: tự chèn AI insight vào các trang sau khi xác thực phiên.
- AI tự phân tích khi mở trang (`PAGE_VIEW`) và sau các API thao tác học tập/trò chơi (`API_SUCCESS` / `API_ERROR`).
- GET tương tác ở các module learning/assessment/placement/survey/university/english/game/tournament/notifications được AI quan sát sau khi người dùng đã tương tác ổn định.
- Thêm `assets/css/ai-autopilot.css` cho panel AI inline.
- Thêm `AIAmbientInsight` để cache insight ngắn hạn theo người dùng, trang, sự kiện và ngữ cảnh.
- Thêm `/api/ai-learning/ambient/observe` để AI tự phân tích và `/api/ai-learning/ambient/auto-course` để tạo khóa học khi AI phát hiện khoảng trống rõ ràng.
- AI Learning Director ở trang tổng quan tự chạy, không còn yêu cầu bấm nút `Phân tích ngay`.
- Khi không có Gemini, Autopilot vẫn hiển thị phân tích fallback theo dữ liệu mastery/lộ trình thay vì làm trang lỗi.
- Cache-busting API được nâng lên `16.0.0`.
- Bộ kiểm thử bổ sung `scripts/test-v16-runtime.js` và được nối vào `npm test`.

## Nguyên tắc trải nghiệm
Người dùng không cần bấm một nút "AI" để nhận phân tích cơ bản. AI tự hoạt động trong nền, còn các thao tác tạo khóa học vẫn là hành động có chủ đích vì việc sinh một khóa học đầy đủ có chi phí và thời gian xử lý cao.

# Learning Intelligence V15

V15 nâng lớp học cá nhân hóa hiện có thành một vòng lặp học tập hoàn chỉnh gồm **AI Coach hằng ngày**, **Sổ tay lỗi sai** và **Adaptive Practice**.

## 1. AI Coach hằng ngày

API chính:

- `GET /api/learning-intelligence/status`
- `GET /api/learning-intelligence/coach/today`
- `POST /api/learning-intelligence/coach/task-complete`
- `POST /api/learning-intelligence/coach/ask`

AI Coach đọc dữ liệu từ learning plan, SkillMastery, lịch sử lesson, assessment attempt và lỗi còn mở để xếp ưu tiên học trong ngày. Nếu Gemini chưa được cấu hình, coach vẫn hoạt động bằng rule-based logic; Gemini chỉ nâng chất lượng phần tư vấn hội thoại.

## 2. Sổ tay lỗi sai

Model mới: `LearningError` → collection `learningErrors`.

Lỗi có thể đến từ:

- bài học K12 hiện có;
- assessment platform;
- phiên Adaptive Practice.

Mỗi lỗi lưu câu hỏi, lựa chọn, đáp án đúng, đáp án người học chọn, skill, độ khó, số lần sai, streak trả lời đúng và lịch ôn tiếp theo. Lỗi Adaptive Practice được gom theo **người học + môn + bài + câu hỏi**, không tạo bản ghi mới chỉ vì người học bắt đầu một phiên khác.

API chính:

- `GET /api/learning-intelligence/errors?status=open|resolved|all`
- `PATCH /api/learning-intelligence/errors/:id/resolve`

## 3. Adaptive Practice

Model mới: `AdaptivePracticeSession` → collection `adaptivePracticeSessions`.

API chính:

- `POST /api/learning-intelligence/adaptive-practice/sessions`
- `GET /api/learning-intelligence/adaptive-practice/sessions/:id`
- `POST /api/learning-intelligence/adaptive-practice/sessions/:id/answer`

Phiên dùng question pool từ curriculum-data hiện tại. Độ khó bắt đầu từ mastery nếu có dữ liệu; sau mỗi câu hệ thống điều chỉnh `EASY → MEDIUM → HARD` hoặc hạ ngược lại dựa trên đáp án, streak đúng và accuracy chạy.

Người học có thể bấm **Luyện lỗi này** trong Sổ tay lỗi sai để ưu tiên đúng câu đã từng sai.

Khi kết thúc phiên:

- SkillMastery được cập nhật theo đúng trọng số số câu trong phiên;
- lịch sử học legacy được ghi thêm thời lượng luyện;
- lỗi sai được cập nhật/giải quyết theo streak đúng.

## 4. UI

Trang mới: `trung-tam-hoc-tap.html`.

Các khu vực:

1. AI Coach hôm nay.
2. Chat với AI Coach.
3. Sổ tay lỗi sai.
4. Adaptive Practice 10 câu.

Trang tổng quan `index.html` đã thêm liên kết trực tiếp đến Trung tâm thông minh.

## 5. Tương thích

V15 không thay thế các API learning cũ. Lesson submission và assessment submission chỉ được bổ sung bước ghi nhận lỗi vào `LearningError`, nên dữ liệu progress cũ vẫn được giữ.

Không cần migration thủ công cho hai collection mới; Mongoose sẽ tạo collection/index khi dữ liệu đầu tiên được ghi. Không đưa `node_modules` vào repository/archive.

## 6. Kiểm thử

- `node scripts/test-v13-runtime.js`
- `node scripts/test-v14-runtime.js`
- `node scripts/test-v15-runtime.js`

Validator `scripts/validate-project.js` hiện vẫn phản ánh một bộ quy tắc UI V11/V13 cũ không khớp với snapshot platform hiện tại; vì vậy được tách thành script `npm run validate` thay vì làm `npm test` thất bại.

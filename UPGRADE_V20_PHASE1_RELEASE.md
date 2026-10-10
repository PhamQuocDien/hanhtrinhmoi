# Hành Trình Mới — V20 Phase 1 Release

## Mục tiêu
Hoàn thiện Phase 1 theo hướng một khóa học có thể học thật: lý thuyết dài, bài giảng, ví dụ, luyện tập, thực hành và kiểm tra đa dạng; đồng thời tăng độ bền của AI và sửa lỗi assessment/learning error hiện tại.

## Nội dung đã hoàn thiện

### 1. Assessment / kiểm tra
- Sửa lỗi option dạng object khiến giao diện hiện `[object Object]`.
- Chuẩn hóa option thành `{label, value}` ở backend/frontend.
- Renderer riêng cho single choice, multiple choice, true/false, fill blank, numerical, short answer, ordering, matching, essay, reading, listening, speaking, coding, practical, timed simulation.
- Scoring hỗn hợp; câu tự luận/speaking/practical/timed simulation được đánh dấu review thay vì giả vờ auto-score.
- Coding assessment hỗ trợ starter code, public/hidden test cases và giới hạn chạy.

### 2. Nội dung K12
- Phủ động 1–12 từ curriculum hiện có.
- 2.980 lesson K12 được làm giàu runtime.
- Mỗi lesson có cấu trúc theo kiểu giáo trình/sách giáo khoa: mục tiêu → kiến thức cốt lõi → phương pháp → ví dụ → luyện tập → vận dụng → lỗi sai → củng cố.
- Minimum measured theory: 1.178 từ/lesson trong content test.
- Có lecture, examples, practice, practical, common mistakes, summary, quick checks và lesson test.
- Có unit test, midterm, final, mock ở mức course detail.
- Nội dung là nội dung nguyên bản của hệ thống, không sao chép nguyên văn SGK/đề thi official.

### 3. CNTT / TOEIC / IELTS / MOS và catalog đại học
- 278 course trong rich starter catalog:
  - 145 Công nghệ thông tin
  - 89 English/TOEIC/IELTS tracks
  - 19 MOS
  - 10 Kinh tế
  - 10 Cơ điện tử
  - 5 nhóm Kỹ thuật khác
- Course professional có 12 lesson, rich theory/lecture/practice và bộ assessment hỗn hợp.
- CNTT có coding/practical assessment.
- TOEIC/IELTS có timed simulation và dạng đánh giá phù hợp kỹ năng.
- MOS có practical Office tasks/checklists.
- Kinh tế/Cơ điện tử có case/numerical/practical/lab-oriented activities.

### 4. AI resilience
- Premium tasks ưu tiên model Pro cấu hình trong `GEMINI_SMART_MODEL`.
- Có fallback cascade qua các Flash/Lite model cấu hình được.
- Timeout tách theo routine/course/smart/assessment/audio.
- Retry giới hạn với exponential backoff/jitter và cooldown.
- Khuyến nghị task dài dùng async job; Phase 1 đã chuẩn hóa cấu hình resilience và giữ fallback an toàn.

### 5. Lỗi occurrenceCount
Đã sửa root cause MongoDB/Mongoose:
- Không còn vừa `$setOnInsert.occurrenceCount` vừa `$inc.occurrenceCount` trong cùng update.
- Create record mới và increment record cũ được tách logic.
- Có xử lý duplicate race.

### 6. Course detail
- Hiển thị chapter/unit, lesson, word count, question count, lesson test.
- Hỗ trợ course-level chapter test, midterm, final, mock.
- Hiển thị theory, lecture, examples, practice, practical, mistakes, summary và quick checks.

## Kiểm thử
Đã chạy và PASS:
- V13 runtime
- V14 runtime
- V15 runtime
- V16 runtime
- V16 resilience
- V17 runtime
- V19 runtime regression
- V20 content quality
- `npm test`
- JavaScript syntax checks cho các service/route đã sửa.
- Inline JavaScript syntax checks cho `assessment.html` và `khoa-hoc-chi-tiet.html`.

### V20 content test result
- Catalog: 278 courses
- K12 lessons: 2.980
- K12 minimum theory: 1.178 words
- K12 question types: 12 loại khác nhau được kiểm tra
- Sample professional courses: 11
- Scoring regression: 7/8 test cases đúng theo thiết kế, trong đó subjective/coding review được bảo toàn thay vì auto-score sai.

## Lưu ý triển khai
- Migration: `scripts/migrations/010-v20-full-learning-content.js`.
- Catalog đại học: `server/services/catalog-v20-university.js`.
- Rich content: `server/modules/rich-learning-content-v20.js`.
- Assessment engine/route: `server/services/platform-services.js`, `server/routes/platform-routes.js`, `assessment.html`.
- AI resilience: `server/services/gemini-service.js`, `.env.example`.

## Phạm vi chưa nằm trong Phase 1
- Full Survey/Placement/Profile synchronization sâu: Phase 2.
- Admin Guide/CMS builder/Course Factory/Autopilot expansion: Phase 3.
- Nội dung official cần nguồn xác thực riêng vẫn phải giữ provenance rõ ràng; hệ thống không tự gắn AI-generated thành official.

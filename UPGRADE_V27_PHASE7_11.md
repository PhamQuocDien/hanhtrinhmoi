# Hành Trình Mới V27.1.0 — Phase 7–11

## Mục tiêu
Thay việc biên tập nội dung bằng JSON tự do bằng bản ghi học tập có kiểu rõ ràng, giao diện form cho Admin, lộ trình dựa vào bằng chứng kỹ năng và nội dung thực hành có dữ liệu chấm thật.

## Phase 7 — Lộ trình tự thích nghi
- Thu thập bằng chứng từ hồ sơ, khảo sát, học lực theo kỹ năng, lỗi học tập, hạn ôn, bài đã công bố và kết quả practice.
- Đề xuất lesson/course/practice task chỉ khi có record thật phù hợp; nếu thiếu ghi `COURSE_GAP` thay vì tạo liên kết giả.
- Lưu phiên bản LearningPlan và thứ tự LearningPlanStep; nộp bài thực hành cập nhật mastery và yêu cầu dựng phiên bản lộ trình mới.
- Độ tuổi được suy ra từ ngày sinh đã xác thực, điều chỉnh khoảng thời gian học gợi ý cho người học nhỏ tuổi. Endpoint lộ trình không công khai ngày sinh thô.

## Phase 8 — Admin/Teacher CMS
- Form tạo/sửa các phần nội dung (Overview, Theory, Lecture, Example, Activity, Practice, Code Challenge, Quiz, Summary, Media, Reference).
- Question Builder hỗ trợ loại câu hỏi, phương án, đáp án, câu trả lời chấp nhận, giải thích, điểm, độ khó, kỹ năng, nhận thức, tags, media và rubric.
- Assessment Builder chọn question IDs từ ngân hàng; đề tạo mới luôn ở draft cho tới khi qua quy trình kiểm duyệt/công bố.
- Practice Builder có language, statement, input/output, constraints, samples, starter code, visible/hidden tests, hints và scoring criteria.
- Dashboard hiển thị số khóa/bài/câu hỏi/đề, content gaps, survey/placement lỗi và trạng thái job.

## Phase 9 — Analytics/catalog expansion
- Dashboard thống kê khóa/bài/câu hỏi/assessment, practice tasks/attempts, survey/placement hợp lệ và job lỗi.
- Dò course gap dựa trên catalog và kỹ năng cần; chỉ đề xuất, không tự công bố course AI thành official.

## Phase 10 — Coding thực hành
- Seed 18 bài thuật toán thực sự có statement, input/output, giới hạn, ví dụ, starter code, hints và hidden cases.
- UI bài học tải practice task đã công bố, cho người học chọn ngôn ngữ và nộp bài qua API server. Hidden tests và solution không được gửi xuống client.
- Chấm thực tế phụ thuộc code executor. Không bật chạy mã không sandbox trên server công khai; cần cấu hình executor/container biệt lập trước khi dùng production.

## Phase 11 — Survey, placement và hồ sơ
- Migration 012 đảm bảo survey Published có cấu trúc hợp lệ, đưa survey Published sai về cần sửa, bảo toàn câu trả lời cũ và bổ sung baseline survey nếu thiếu.
- Placement có 12 bộ K12 theo lớp và track Đại học, TOEIC, IELTS, MOS; test mới kiểm tra độ phủ, answer visibility và option normalization.
- Profile cho phép nhập/sửa ngày sinh theo kiểm tra server; chỉ tuổi/phân nhóm tuổi cần thiết được dùng cho khuyến nghị, không hiển thị ngày sinh trong roadmap công khai.

## Cách dữ liệu thay JSON
MongoDB/Mongoose vẫn được giữ để tránh migration toàn bộ gây hỏng app. Nội dung mới dùng document model có field/schema rõ ràng (`ContentBlock`, `PracticeTask`, `PracticeAttempt`, `LearningPlanStep`, `LearningEvent`, `CourseQualitySnapshot`) thay vì bắt Admin sửa JSON trong trường Mixed. API có thể vẫn trao đổi JSON theo giao thức HTTP, nhưng UI xây payload từ form và server validate theo từng kiểu. Các trường legacy Mixed được giữ tạm để tương thích ngược, không phải phương thức biên tập khuyến nghị.

## Migrations & test
- Migration: `scripts/migrations/012-v27-typed-learning-system.js`, đăng ký trong registry, cần MongoDB ở trạng thái ready.
- Test: `npm test`, `npm run validate`.
- Test tự động không thay thế smoke test có MongoDB/session/auth và executor thật. Sau khi triển khai staging cần xác minh đăng nhập, migrate, tạo course/content/question/assessment, nộp practice, cập nhật Learning Plan và rollback/backup.

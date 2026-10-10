# Curriculum Architecture

## Source of truth

Nội dung công bố được lưu trong `CurriculumVersion` + `CurriculumContent`; mỗi version/content phải có `sourceRef`, trạng thái và lịch sử version. `grade` chỉ nhận **1–12**. Không tạo grade 0/13 và không overwrite version đã lưu.

Hierarchy K12:

`Program → EducationLevel → Grade → Subject → CurriculumVersion → Domain → Unit → Lesson → Practice → Assessment`.

`CurriculumContent` giữ reference chuẩn (`parentId`, `courseId`, `practiceIds`, `assessmentIds`, `prerequisiteIds`) và các trường lesson có cấu trúc. Question/answer không được nhúng hàng loạt vào lesson; question nằm trong Question Bank và assessment tham chiếu bằng ID.

## Legacy classification

- **ACTIVE:** platform models, platform routes/services, published CMS records và API `/api/education/*`.
- **ADAPTER/LEGACY:** `curriculum-data.js`, `question-data.js`, `question-bank-complete.js` và các route `/api/learning/*` cũ. Migration 004 chuẩn hóa dữ liệu cũ thành platform records nhưng vẫn giữ adapter.
- **UNVERIFIED:** nội dung procedural hoặc nguồn chưa đọc toàn văn; UI không được gọi là official.

Nếu chưa có dữ liệu bài theo sách có source rõ ràng, hệ thống chỉ hiển thị curriculum framework/source mapping và trạng thái chưa có content; không tự bịa tên unit/lesson.
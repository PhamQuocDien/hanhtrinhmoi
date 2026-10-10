# AI Learning Engine — Hành Trình Mới

## Mục tiêu

AI trong Hành Trình Mới không chỉ là chatbot. Hệ thống có ba vai trò:

- **AI Learning Director**: phân tích mục tiêu, hồ sơ giáo dục, ngành/chuyên ngành, skill mastery, lỗi gần đây và kế hoạch hiện tại để quyết định bước học tiếp theo.
- **AI Course Composer**: tạo khóa học cá nhân hoặc draft khóa học cho Admin. Một khóa học có chapter, lesson, theory, example, audio script, practice, lesson test, chapter test và final assessment.
- **AI Tutor**: giải thích bài học dựa trên context của lesson và người học.

## Ngữ cảnh người học

Ngữ cảnh được hợp thành từ:

- Profile
- EducationProfile
- University / Faculty / Field / DisciplineGroup / Major / Specialization / TrainingProgram
- LearningProfile
- Survey
- LearningPlan
- SkillMastery
- các course hiện có

AI có thể suy luận ngành/chuyên ngành khi hồ sơ chưa đủ, nhưng kết quả được lưu dưới `LearningProfile.inference` và có cờ `needsConfirmation`. Không biến suy luận của AI thành hồ sơ chính thức nếu người dùng chưa xác nhận.

## Personal Course và Canonical Course

`PERSONAL_AI` là khóa học riêng của người dùng. AI có thể tự tạo và điều chỉnh mà không cần Admin duyệt từng khóa.

`CANONICAL` là khóa học dùng chung. AI-generated content muốn trở thành khóa học dùng chung phải đi qua:

`AI Draft → Validate → Admin Review → Publish`.

AI-generated content không được gắn nhãn official chỉ vì được tạo bởi AI.

## Lesson contract

Mỗi lesson được lưu độc lập với assessment:

- `theorySections`
- `examples`
- `skills`
- `audioAssetId`
- `lessonTestId`
- `assessmentIds`
- `generationMetadata`

Mỗi lesson có lesson test riêng. Chapter có chapter test. Course có final assessment.

## AI diagnostic

`POST /api/ai-learning/diagnostic/generate` tạo một diagnostic riêng theo context hiện tại và lưu thành Assessment cá nhân đã publish. Diagnostic mang nhãn AI-generated practice/diagnostic, không phải official exam.

## Admin AI Course Studio

Admin có thể nhập yêu cầu tự nhiên, ví dụ:

> Tạo khóa Java OOP cho sinh viên CNTT năm 2, 8 chương, từ nền tảng đến project; mỗi lesson phải có lý thuyết đầy đủ, ví dụ, audio, practice và lesson test; mỗi chapter có chapter test và cuối khóa có final assessment.

AI tạo draft, validation, preview. Admin có thể commit, review rồi publish.

## AI-generated audio

Audio được tạo tách khỏi text generation và lưu ở `AIAudioAsset`. API key chỉ tồn tại ở backend. Audio endpoint kiểm tra quyền sở hữu với personal course.

## Anti-loop / idempotence

AI course có fingerprint để không tạo trùng cùng một yêu cầu. Migration 005 chỉ bổ sung dữ liệu còn thiếu và không overwrite nội dung đã chỉnh sửa. Personal course creation trước tiên tìm resource hiện có; chỉ tạo mới khi không đủ phù hợp hoặc người dùng yêu cầu `forceCreate`.

## API chính

- `GET /api/ai-learning/status`
- `GET /api/ai-learning/context`
- `POST /api/ai-learning/profile/analyze`
- `POST /api/ai-learning/director`
- `POST /api/ai-learning/personal-course`
- `GET /api/ai-learning/personal-courses`
- `GET /api/ai-learning/personal-courses/:id`
- `POST /api/ai-learning/diagnostic/generate`
- `POST /api/ai-learning/lesson-help`
- `POST /api/ai-learning/admin/course-drafts/generate`
- `POST /api/ai-learning/admin/course-drafts/:id/commit`
- `POST /api/ai-learning/admin/course-drafts/:id/publish`

## Nguồn và tính chính xác

AI chỉ tạo nội dung hỗ trợ học tập nếu hệ thống chưa có resource. Nội dung curriculum/test chính thức phải dựa trên Source Registry và quy trình xác minh của Admin. Không cho AI tự quyết định authorization, password, source verification, hoặc dữ liệu hệ thống nhạy cảm.

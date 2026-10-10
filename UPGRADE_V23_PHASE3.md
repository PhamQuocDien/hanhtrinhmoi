# Hành Trình Mới V23.0.0 — Phase 3

## Mục tiêu

Bổ sung Admin CMS trực quan, hướng dẫn nội dung ngay trong giao diện, Course Factory, mở rộng catalog, AI Autopilot và sửa lỗi nội dung theo từng mục. Quản trị viên không cần tự viết JSON.

## 1. Admin Guide

Mục **Hướng dẫn quản trị nội dung** nằm trong Admin, hướng dẫn thêm môn/lĩnh vực, chương trình đại học, khóa học, chapter, lesson, lý thuyết, lecture, ví dụ, practice, câu hỏi, coding, assessment, TOEIC/IELTS/MOS, nhập Word/Markdown, kiểm định, công bố và archive.

## 2. Admin Content Studio

Biểu mẫu cho:
- Khóa học với bậc học, lớp, môn/lĩnh vực, chương trình đào tạo, mục tiêu và nguồn.
- Chương/đơn vị kiến thức, bắt buộc gắn khóa học.
- Bài học gồm các mục lý thuyết, lời giảng, ví dụ, hoạt động/practice, thực hành, skills và độ khó.
- Ngân hàng câu hỏi nhiều loại; các trường thay đổi theo loại. Câu coding có ngôn ngữ, starter code, test công khai/ẩn và rubric.
- Bài kiểm tra: chọn câu hỏi bằng checkbox, cấu hình thời lượng, điểm đạt, lượt làm và randomization.
- Xem trước khóa/chương/bài/câu hỏi/đề trước khi publish.

Khóa học công bố qua CMS phải có bài học chất lượng đạt tối thiểu và ít nhất một assessment đã công bố. Khóa cá nhân không thể được đưa thẳng vào catalog chung.

## 3. Local Education AI

`server/services/local-education-ai.js` là bộ máy AI chuyên biệt theo quy tắc của Hành Trình Mới: nhận diện domain, xây blueprint theo track, tạo mục tiêu/nội dung/ví dụ/thực hành/câu hỏi nguyên bản, dò khóa trùng, phân tích skill-gap và kiểm định chất lượng. Bản local này **không phải LLM đa dụng được huấn luyện trong ứng dụng**; nó là rule/template engine xác định, không cần API bên ngoài để chạy Course Factory/Autopilot.

## 4. Course Factory

- Tạo draft từ thông tin ngắn.
- Mở rộng catalog theo batch tối đa 25 đề xuất/lần.
- Dò trùng theo fingerprint/domain/tiêu đề/subject trước khi xếp job.
- Dùng `AIGenerationJob` để chạy bất đồng bộ; local jobs ghi `model=LOCAL_EDUCATION_AI`, `remoteApiUsed=false`.
- Draft có thể preview, commit thành dữ liệu CMS và publish thủ công sau quality gate. Không tự gắn `OFFICIAL`.

## 5. Autopilot / Course Gap

Autopilot kết hợp mục tiêu, hồ sơ, survey, placement, SkillMastery, LearningError, LearningPlan và assessment gần đây (khi dữ liệu có sẵn), sau đó phân tích catalog và đề xuất hành động. Chế độ mặc định chỉ phân tích; khi Admin bật thực thi, hệ thống chỉ xếp job tạo draft, không tự publish.

## 6. Sửa lỗi và thử lại

Admin có thể chọn một lesson/question/assessment trong tab **Sửa lỗi nội dung**. Worker chỉ xử lý đúng mục được chọn:
- Lesson: bổ sung section/practice/example/lecture còn thiếu mà không tạo lại toàn khóa.
- Question: chuẩn hóa options; không tự đoán đáp án chính xác. Trường hợp thiếu đáp án/test/rubric sẽ yêu cầu Admin review và ở trạng thái DRAFT.
- Assessment: nối các câu hỏi thực sự tồn tại, không tự publish.

Job Course Factory/Sửa nội dung ở trạng thái FAILED có nút **Thử lại**; số lần retry worker vẫn giới hạn bởi cấu hình.

## 7. Nguồn và trạng thái

Nguồn được phân biệt `ADMIN_CREATED`/`AI_GENERATED`/`USER_IMPORTED`; AI draft luôn có `official=false`, `verification=unverified` đến khi người quản trị xác minh nguồn. `CANONICAL` chỉ có nghĩa dùng chung trong catalog, không có nghĩa là chương trình chính thức của trường/cơ quan.

## 8. Cấu hình

Xem `.env.example`. Mặc định `AI_REMOTE_FALLBACK_ENABLED=false`. Điều này tắt fallback Gemini của Autopilot; các tính năng AI có sẵn khác có thể cần cấu hình API riêng nếu người vận hành chọn sử dụng.

## 9. Kiểm thử

Chạy:

```bash
npm test
npm run validate
```

`npm test` gồm chuỗi regression V13–V22 và 24 kiểm thử Phase 3. `npm run validate` rà HTML/JavaScript/routes/migrations của dự án. Kiểm thử tự động không thay thế bước kiểm tra đăng nhập/RBAC và migration trên MongoDB/Render thực tế.

## 10. Triển khai an toàn

1. Sao lưu MongoDB.
2. Triển khai toàn bộ source đồng bộ, không chỉ một vài tệp frontend.
3. Cấu hình `.env`/Environment Variables riêng; không tải `.env` vào Git.
4. Đảm bảo MongoDB kết nối trước khi chạy migration.
5. Đăng nhập Admin có các quyền `learning.ai.manage`, `learning.curriculum.manage`, `learning.lesson.create`, `learning.lesson.publish`, `learning.question.create`, `learning.exam.create` tương ứng với thao tác.
6. Tạo khóa thử nghiệm, xem trước, tạo câu hỏi/assessment, kiểm tra quality gate và chỉ publish sau khi review.

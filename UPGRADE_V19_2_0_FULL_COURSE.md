# Hành Trình Mới V19.2.0 — Full Course Content

## Mục tiêu
V19.2.0 sửa tình trạng catalog có tên khóa nhưng lesson/test không đủ nội dung, đặc biệt ở Đại học CNTT, TOEIC, IELTS và MOS.

## Catalog nền
- 252 khóa học duy nhất sau khi loại mã trùng.
- Đại học CNTT: catalog mở rộng theo 8 nhóm ngành, 144 khóa sau khi hợp nhất catalog.
- TOEIC: nhiều track Part 1–7, Vocabulary, Grammar, Listening Shadowing, Speaking, Writing và Mock.
- IELTS: Listening, Reading, Writing Task 1/2, Speaking Part 1/2/3 và Mock.
- MOS: Word, Excel, PowerPoint, workflow và full skills simulation.
- Mỗi khóa nền có đúng 12 bài, chia 6 chương.

## Nội dung mỗi bài
Mỗi lesson được materialize với:
- Ít nhất 4 phần lý thuyết chi tiết.
- Bài giảng dạng script + key points.
- Ít nhất 3 ví dụ.
- Ít nhất 2 hoạt động.
- Ít nhất 3 bài tập thực hành.
- Lỗi thường gặp và kiến thức cần nhớ.
- 8 câu test bài có đáp án + giải thích.
- Audio script và visual prompt.
- Bài lập trình có code example, coding task và test case.

## Assessment hierarchy
- 12 lesson tests / khóa.
- 6 chapter tests / khóa.
- Midterm.
- Final.
- Mock test.

## AI Generation
AI có thể dùng Pro cho blueprint/lesson khi `AI_MODE=HYBRID` hoặc `REMOTE`, nhưng hệ thống luôn có starter catalog đầy đủ làm nguồn dự phòng. Tối đa mặc định 3 lesson được AI enrich trong mỗi lần tạo khóa để hạn chế quá tải; các lesson còn lại dùng nội dung nền đầy đủ và vẫn được lưu. Nội dung AI tạo luôn được materialize vào MongoDB cùng course/lesson/question/assessment và AIContentDraft.

## Giảm quá tải Gemini
- SMART mode có thể chạy không cần Gemini.
- Fallback model tuần tự.
- Cooldown theo model/quota.
- Khoảng cách tối thiểu giữa request.
- Không mặc định gọi thêm một request Gemini chỉ để sửa JSON hỏng (`GEMINI_JSON_REPAIR_REMOTE=false`).
- AI Autopilot có interval dài hơn.

## Repair migration
Migration 009 V19.2 có quality gate. Nó không chỉ kiểm tra số lượng document mà còn kiểm tra mẫu lesson phải có đủ theory, lecture, examples, practice, audioScript, visualPrompt và lessonTest. Nếu catalog V19.1 cũ thiếu nội dung, revision mismatch sẽ buộc chạy repair.

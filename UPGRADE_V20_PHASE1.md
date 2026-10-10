# Hành Trình Mới V20.0 — Phase 1

Phase 1 chuyển learning engine từ catalog có lesson/test cơ bản sang khóa học có chu trình học hoàn chỉnh.

## Nội dung chính

- K12 lớp 1–12 giữ toàn bộ lesson trong `curriculum-data.js` và được enrich thành lesson nguyên bản có cấu trúc kiểu giáo trình: mục tiêu, kiến thức nền, lý thuyết, ví dụ, luyện tập, vận dụng, lỗi thường gặp, quick check, summary và test.
- 2.980 lesson K12 hiện có được kiểm tra tự động; nội dung rich lesson đạt tối thiểu 1.100 từ/lesson trong quality test.
- CNTT, TOEIC, IELTS, MOS, Kinh tế, Cơ điện tử và Kỹ thuật có 12 lesson/course starter với theory dài, lecture, examples, practice và practical task.
- Assessment hỗ trợ renderer/scoring cho nhiều dạng: single choice, multiple choice, true/false, fill blank, numerical, short answer, ordering, matching, essay, reading, listening, speaking, coding, practical, timed simulation.
- CNTT có coding practical với public/hidden tests. MOS có file/task practical và timed simulation. TOEIC/IELTS có timed simulation, reading/listening/writing/speaking practice và rubric. Đại học kỹ thuật/kinh tế có case/lab.
- AI routing cho tác vụ premium bắt đầu từ Pro, sau đó mới fallback xuống Flash/lighter models. Timeout, retry, cooldown và minimum request gap được cấu hình bằng ENV.
- Sửa lỗi MongoDB `Updating the path 'occurrenceCount' would create a conflict at 'occurrenceCount'`: không còn vừa `$setOnInsert` vừa `$inc` trên `occurrenceCount` trong cùng update.

## Catalog mở rộng

V20 bổ sung các nhóm đại học:

- CNTT: Algorithm, Security, Data, AI, Cloud, UX/Product.
- Kinh tế: Micro, Macro, Statistics, Finance, Accounting, Marketing, Business Analytics, Logistics, Management, Operations.
- Cơ điện tử: Fundamentals, Circuit, Control, PLC, Embedded C, Robotics, CAD, Sensors, Manufacturing, Industrial IoT.
- Kỹ thuật: Engineering Math, Technical Drawing/CAD, Automation, Digital Electronics, IoT/Edge.

Tất cả nội dung do Hành Trình Mới tạo là nội dung nguyên bản/practice/simulation, không phải bản sao sách giáo khoa hay đề thi chính thức.

## Kiểm thử

Chạy:

```bash
npm run validate
npm run test
```

`npm run test` đã thêm `scripts/test-v20-content.js` để kiểm tra catalog, độ sâu lesson, đa dạng assessment, scoring và regression của lỗi `occurrenceCount`.

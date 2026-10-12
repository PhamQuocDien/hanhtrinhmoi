# Mô hình phân loại nội dung học tập

## Cây học tập tổng quát

```text
Learning Space (không gian/lĩnh vực học)
└── Learning Path (lộ trình)
    └── Stage (chặng / cấp độ)
        └── Course (khóa học)
            └── Module / Chapter (module / chương)
                └── Lesson (bài học)
                    ├── Content Block (lý thuyết, ví dụ, video, tài nguyên)
                    └── Activity (quiz, bài tập, bài code, bài nộp, project)
```

## Nhánh học thuật

- Bậc học: tiểu học, THCS, THPT, cao đẳng/đại học và các chương trình khác.
- Lớp/niên khóa, học kỳ, môn học, chủ đề và chuẩn đầu ra.
- Có thể gắn một bài học với nhiều chuẩn kiến thức/kỹ năng; không ép mọi chương trình vào một cây khóa học duy nhất.

## Nhánh kỹ năng và nghề nghiệp

- Lĩnh vực → vai trò nghề → năng lực → kỹ năng → lộ trình → khóa học → bài thực hành/project.
- Ví dụ vai trò nghề: Frontend Developer, Backend Developer, QA Engineer, Data Analyst, UI/UX Designer.
- Một kỹ năng có thể liên quan đến nhiều khóa học; một khóa học có thể đóng góp cho nhiều kỹ năng.

## Các loại nội dung bài học dự kiến

- Bài đọc/ghi chú, video/bài giảng, ví dụ mẫu có giải thích.
- Quiz/trắc nghiệm, câu hỏi tự luận, bài tập có đáp án/tiêu chí chấm.
- Bài lập trình có test case và môi trường chạy giới hạn.
- Project có yêu cầu, đầu ra bàn giao và rubric.
- Tài liệu tải về/liên kết tham khảo.

## Quan hệ và điều kiện tiên quyết

Một khóa học có thể có điều kiện tiên quyết là khóa khác hoặc các kỹ năng cần đạt. Lộ trình có thể cá nhân hóa theo mục tiêu, năng lực hiện tại, thời gian và tiến độ. Đây là mô hình thiết kế; các loại nội dung này chưa được triển khai thành collection/API V1.

## Lưu trữ

V1 dùng MongoDB theo `MONGO_URI` cho tài khoản và khảo sát. Thư mục `content/` dùng cho bản thảo Markdown, đề cương và mẫu nội dung được quản lý phiên bản; không dùng thư mục này làm database runtime. Tài liệu SQL/migration giữ lại từ định hướng V0 không được API hiện tại sử dụng.

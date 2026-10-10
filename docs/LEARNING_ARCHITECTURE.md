# Learning Architecture — Hành Trình Mới

## Mục tiêu

Learning catalog và personal learning path được tách thành hai khái niệm:

- **Catalog**: toàn bộ nội dung khả dụng theo chương trình.
- **Personal Learning Path**: phần nội dung được chọn theo hồ sơ, mục tiêu, placement, mastery và tiến độ của từng người học.

## K12

```text
Chương trình
  → Cấp học
    → Lớp 1–12
      → Môn học
        → Curriculum Version
          → Unit / Chủ đề
            → Bài học
              → Lý thuyết
              → Ví dụ
              → Từ khóa
              → Lỗi thường gặp
              → Tự kiểm tra
              → Practice / Questions
              → Assessment
              → Progress / Mastery
```

`server/services/learning-catalog-service.js` làm adapter từ `curriculum-data.js` sang cấu trúc catalog mới khi database chưa hydrate đủ. Adapter giữ rõ `sourceRef` và đánh dấu nội dung là `ORIGINAL_PRACTICE`, không tự nhận là tài liệu chính thức.

Lesson detail dùng `getLesson()` để materialize đầy đủ theory, sections, glossary, common mistakes, quick checks và questions. Đây là điểm khác với metadata lesson chỉ có title/lessonCount.

## Higher Education

```text
Cơ sở đào tạo
  → Khoa
    → Lĩnh vực
      → Nhóm ngành
        → Ngành
          → Chuyên ngành
            → Chương trình đào tạo
              → Khóa / Năm học / Học kỳ
                → Học phần
                  → Chủ đề
                    → Bài học
                      → Practice
                      → Assessment
```

Chương trình đại học phải gắn institution/program cụ thể; không coi một curriculum là áp dụng cho mọi trường.

## English

```text
TOEIC
  → Placement
  → Listening / Reading / Speaking / Writing
  → Practice
  → Mock
  → Result
```

```text
IELTS
  → Academic / General Training
  → Placement
  → Listening / Reading / Writing / Speaking
  → Practice
  → Mock
  → Estimated Result
```

English assessment config phải có `sourceRef` và `assessmentVersion`. Không tự quy đổi TOEIC ↔ IELTS nếu không có source.

## AI Tutor

`POST /api/ai/lesson-help` chạy ở backend. Client không nhận API key. Gemini chỉ được dùng như trợ giảng giải thích từ context bài học được cung cấp, không phải source of truth cho curriculum.

# Chính sách đánh giá và mốc tiến độ

Tài liệu này giải thích cách hệ thống quyết định **học bao nhiêu bài thì được làm
bài kiểm tra**, và vì sao các con số đó **không** được gọi là quy định của Bộ.

## 1. Ranh giới quan trọng: chương trình ≠ quy định đánh giá

| Lớp dữ liệu | Ở đâu | Trạng thái |
|---|---|---|
| Chương trình giáo dục, môn học | `data/curriculum/`, `data/subjects/` | `NEEDS_VERIFICATION` |
| Bộ sách, đầu sách, chương, bài | `data/textbooks/` | `NEEDS_VERIFICATION` |
| **Chính sách đánh giá** | `data/curriculum/assessment-policy-registry.js` | **`PLATFORM_DEFAULT`** |

Hiện chưa có văn bản nào của Bộ GDĐT quy định cụ thể "học N bài thì làm bài
kiểm tra giữa chương" theo cách nền tảng này dùng. Vì vậy:

- Mọi ngưỡng mặc định mang `sourceKind: PLATFORM_DEFAULT`
- và `verificationStatus: NEEDS_VERIFICATION`
- và `isOfficialRegulation: false`
- Giao diện hiển thị nhãn **"Mặc định của nền tảng"**, không phải "Theo Bộ".

Khi nhà trường có lịch thật, quản trị viên nhập policy với
`sourceKind: SCHOOL_SCHEDULE` + `source` cụ thể; lịch đó **được ưu tiên** hơn
quy tắc đếm bài.

## 2. Mô hình dữ liệu

```js
AssessmentPolicy = {
  policyId,
  educationLevel,            // primary | middle | high
  gradeRange,
  lessonsBeforeCheckpoint,        // số bài trước checkpoint
  coveragePercentBeforeCheckpoint, // tỉ lệ phạm vi trước checkpoint (0-100)
  midtermPolicy: { lessonsBefore, coveragePercent },
  finalPolicy:   { lessonsBefore, coveragePercent },
  lessonCompletionPolicy: {
    requireReading,
    requireMiniTest,
    miniTestPassPercent,
    masteryThreshold
  },
  sourceKind,               // PLATFORM_DEFAULT | SCHOOL_SCHEDULE | OFFICIAL_REGULATION
  source,
  sourceDocument,
  verificationStatus,
  isOfficialRegulation
}
```

Thứ tự ưu tiên khi tra cứu (từ cụ thể đến rộng):

```
(lớp, môn, học kỳ, năm) > (lớp, môn, học kỳ) > (lớp, môn) > (lớp) > mặc định cấp học
```

## 3. Ngưỡng mặc định theo cấp học

| Cấp | Lớp | Checkpoint | Giữa kỳ | Cuối kỳ |
|---|---|---|---|---|
| Tiểu học | 1–5 | 4 bài / 60% | 40 bài / 60% | 80 bài / 60% |
| THCS | 6–9 | 8 bài / 70% | 45 bài / 70% | 90 bài / 70% |
| THPT | 10–12 | 10 bài / 75% | 50 bài / 75% | 100 bài / 75% |

Đây là **quy ước vận hành**, không phải quy định. Xem `DEFAULT_POLICIES`.

## 4. Eligibility do máy chủ quyết định

```
milestone.service.evaluateMilestone({ grade, subjectId, completedLessonId })
→ {
    completedLessons, totalLessons, coveragePercent,
    checkpoint: { eligible, requiredLessons, remainingLessons, ... },
    midterm:   { eligible, ... },
    final:     { eligible, ... }
  }
```

Quy tắc:
- `eligible = (completedLessons >= requiredLessons) && (coveragePercent >= requiredPercent)`
- Phạm vi rỗng → `hasScope: false`, **không** coi là "học chưa đủ"
- Giao diện chỉ hiển thị; khi mở đề, máy chủ kiểm tra lại

## 5. Hoàn thành bài học

Bài học **không** hoàn thành chỉ vì học sinh mở bài. Policy mặc định yêu cầu:

1. Đánh dấu đã đọc nội dung
2. Làm mini test đạt ≥ 60%

```
milestone.service.evaluateLessonCompletion({ readingDone, miniTestBestPercent, ... })
→ { completed, reasons: [...] }
```

`reasons` luôn nêu rõ còn thiếu gì, ví dụ:
> "Mini test chưa đạt: cần ít nhất 60%, kết quả tốt nhất hiện tại là 30%."

Bảo đảm:
- Làm lại **không** làm mất kết quả đã đạt (`$max` trên `miniTestBestPercent`)
- Làm sai **không** tạo kết quả đạt giả
- Hết lượt làm thì báo rõ, không tự coi là đạt
- Gọi lại nhiều lần là idempotent

## 6. Mini test

Loại `mini_test` — **không** phải điểm định kỳ, không cộng vào giữa kỳ/cuối kỳ.

| Đặc tính | Mặc định |
|---|---|
| Số câu | 5 (lấy từ kho câu hỏi của bài, thiếu thì lấy hết) |
| Ngưỡng đạt | 60% |
| Số lần làm | 3 |

Bảo mật (giữ đúng như đề thi):
- Chỉ lấy câu `status: published`
- Chỉ lấy câu cùng lớp/môn/bài (và bộ sách nếu có)
- Dùng `question.toStudentView()` → **không lộ đáp án đúng**
- Điểm do `gradeExam` chấm ở máy chủ; `score` từ client bị bỏ qua

## 7. Năm học và học kỳ

`data/curriculum/academic-calendar.js`
- Năm học bắt đầu 01/09: tháng 9–12 thuộc năm bắt đầu năm đó; tháng 1–8 thuộc năm trước
- Học kỳ: `1`, `2`, `sum`

## 8. API

| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/student/progress/lessons/read` | Đánh dấu đã đọc, trả về điều kiện còn thiếu |
| GET | `/api/student/lessons/:lessonId/state` | Trạng thái mini test của bài |
| GET | `/api/student/lessons/:lessonId/mini-test` | Mở mini test (không đáp án) |
| POST | `/api/student/lessons/mini-test/submit` | Nộp bài, máy chủ chấm |
| GET | `/api/student/milestones/:grade/:subjectId` | Trạng thái checkpoint/giữa kỳ/cuối kỳ |

## 9. Kiểm thử

```bash
node tests/assessment-policy.test.js
```

Kiểm tra: không giả quy định Bộ · ba cấp khác tham số · ghi đè có nguồn ·
điều kiện mở checkpoint · phân biệt phạm vi rỗng · điều kiện hoàn thành bài ·
làm lại không mất kết quả · 5 loại đánh giá riêng biệt · năm học/học kỳ ·
cấu hình mini test.

## 10. Việc còn lại

- [ ] Chưa có màn hình cấu hình policy trong trang quản trị (hiện mới có API nội bộ)
- [ ] Chưa có blueprint câu hỏi theo chương cho checkpoint
- [ ] Chưa đối chiếu ngưỡng với văn bản quy phạm pháp luật hiện hành
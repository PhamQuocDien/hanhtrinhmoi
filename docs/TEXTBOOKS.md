# Bộ sách và đầu sách giáo khoa

Nguồn: `data/textbooks/book-series-registry.js`, `data/textbooks/textbook-registry.js`.

## Phát biểu quan trọng

> Dự án này **không** tuyên bố chỉ có "một bộ sách duy nhất của Bộ".
>
> Thực tế có **nhiều bộ sách giáo khoa được phê duyệt** cho cùng một môn và
> cùng một lớp. Vì vậy mô hình tách **bộ sách** (`seriesId`) khỏi **đầu sách**
> (`textbookId`), và một môn có thể trỏ tới nhiều `availableSeries`.

## Cấu trúc

```
BOOK SERIES     seriesId, seriesName, publisher, source, verificationStatus
  AND TEXTBOOK  textbookId, officialTitle, subjectId, grade, seriesId,
                publisher, source, verificationStatus, verifiedAt
    AND CHAPTER  chapterId, chapterNumber, officialTitle, grade,
                 subjectId, seriesId, textbookId, source, verificationStatus
```

## Trạng thái xác minh

| Mã | Ý nghĩa |
|---|---|
| `VERIFIED` | Đã đối chiếu với nguồn chính thức |
| `NEEDS_VERIFICATION` | Chưa đối chiếu — **không** dùng để tuyên bố là chuẩn Bộ |
| `LEGACY` | Mang từ dữ liệu dự án cũ |
| `SAMPLE` | Dữ liệu mẫu |

## Bộ sách trong hệ thống

| Mã | Tên bộ sách | Nhà xuất bản | Số lớp | Trạng thái |
|---|---|---|---:|---|
| national | Sách giáo khoa theo chương trình chung | - | 12 | NEEDS_VERIFICATION |
| ket-noi-tri-thuc-cuoc-song | Kết nối tri thức với cuộc sống | - | 5 | NEEDS_VERIFICATION |
| chan-troi-sang-tao | Chân trời sáng tạo | - | 5 | NEEDS_VERIFICATION |
| canh-dieu | Cánh Diều | - | 6 | NEEDS_VERIFICATION |

## Ghi chú về bản quyền

Dự án chỉ quản lý **metadata**: tên sách, tên chương, tên bài và cấu trúc.
Dự án **không** chứa nguyên văn nội dung có bản quyền của sách giáo khoa.
Nội dung dạy học do quản trị viên soạn hoặc nhập từ tài liệu có quyền sử dụng.

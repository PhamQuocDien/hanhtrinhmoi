# Chương trình lớp 1-12

Phiên bản chương trình: `CTGDPT-2018`

Tổng: **154** môn học và **630** bài học trên 12 lớp.

Trạng thái xác minh: `NEEDS_VERIFICATION`. Xem [CURRICULUM_VERIFICATION.md](CURRICULUM_VERIFICATION.md).

## Nguồn dữ liệu

| Tệp | Vai trò |
|---|---|
| `data/curriculum/curriculum-registry.js` | Điểm truy cập duy nhất, nạp lazy từng lớp |
| `data/curriculum/grade-01.js` … `grade-12.js` | Dữ liệu từng lớp |
| `data/subjects/subject-registry.js` | Danh mục môn học (nguồn duy nhất) |
| `data/textbooks/book-series-registry.js` | Danh mục bộ sách |
| `data/textbooks/textbook-registry.js` | Danh mục đầu sách |

Không có danh sách lớp hay môn nào được hardcode ở nơi khác.

## Cấu trúc

```
CURRICULUM -> GRADE (1-12) -> SUBJECT -> BOOK SERIES -> TEXTBOOK
                                                    -> CHAPTER -> LESSON
```

## Các lớp

| Lớp | Tên | Số môn | Số bài | Trọng tâm |
|---:|---|---:|---:|---|
| 1 | Lớp 1 | 9 | 36 | làm quen trường học, đọc viết ban đầu và tư duy trực quan |
| 2 | Lớp 2 | 9 | 36 | củng cố nền tảng, tự phục vụ và giải quyết tình huống gần gũi |
| 3 | Lớp 3 | 9 | 44 | học độc lập bước đầu, sử dụng công cụ số an toàn |
| 4 | Lớp 4 | 10 | 52 | mở rộng kiến thức, giải thích hiện tượng và đọc thông tin |
| 5 | Lớp 5 | 10 | 52 | hoàn thiện năng lực tiểu học và chuẩn bị chuyển cấp |
| 6 | Lớp 6 | 14 | 50 | thích nghi THCS, hình thành phương pháp học theo môn |
| 7 | Lớp 7 | 14 | 50 | lập luận, thực hành và kết nối kiến thức với đời sống |
| 8 | Lớp 8 | 14 | 50 | phân tích, thiết kế giải pháp và làm việc theo dự án |
| 9 | Lớp 9 | 14 | 50 | hệ thống kiến thức THCS, định hướng lựa chọn sau THCS |
| 10 | Lớp 10 | 17 | 70 | xây nền THPT, lựa chọn môn học và định hướng nghề nghiệp |
| 11 | Lớp 11 | 17 | 70 | đào sâu chuyên đề, tăng năng lực tự học và nghiên cứu |
| 12 | Lớp 12 | 17 | 70 | tổng hợp, vận dụng cao và chuẩn bị tốt nghiệp |

## Môn chưa có nội dung bài học

Có **88** môn đã có tên nhưng chưa có tên bài học. Các môn này được đánh dấu `needsLessonImport` và giao diện hiển thị "chưa có nội dung bài học" thay vì bịa nội dung.

- Lớp 1 — Đạo đức
- Lớp 1 — Giáo dục thể chất
- Lớp 1 — Nghệ thuật
- Lớp 1 — Hoạt động trải nghiệm
- Lớp 1 — Thông tin và truyền thông
- Lớp 2 — Đạo đức
- Lớp 2 — Giáo dục thể chất
- Lớp 2 — Nghệ thuật
- Lớp 2 — Hoạt động trải nghiệm
- Lớp 2 — Thông tin và truyền thông
- Lớp 3 — Đạo đức
- Lớp 3 — Giáo dục thể chất
- Lớp 3 — Nghệ thuật
- Lớp 3 — Hoạt động trải nghiệm
- Lớp 4 — Đạo đức
- Lớp 4 — Giáo dục thể chất
- Lớp 4 — Nghệ thuật
- Lớp 4 — Hoạt động trải nghiệm
- Lớp 5 — Đạo đức
- Lớp 5 — Giáo dục thể chất
- Lớp 5 — Nghệ thuật
- Lớp 5 — Hoạt động trải nghiệm
- Lớp 6 — Giáo dục công dân
- Lớp 6 — Giáo dục thể chất
- Lớp 6 — Nghệ thuật
- Lớp 6 — Tin học
- Lớp 6 — Công nghệ
- Lớp 6 — Âm nhạc
- Lớp 6 — Mĩ thuật
- Lớp 6 — Hoạt động trải nghiệm, hướng nghiệp
- Lớp 6 — Nội dung giáo dục địa phương
- Lớp 7 — Giáo dục công dân
- Lớp 7 — Giáo dục thể chất
- Lớp 7 — Nghệ thuật
- Lớp 7 — Tin học
- Lớp 7 — Công nghệ
- Lớp 7 — Âm nhạc
- Lớp 7 — Mĩ thuật
- Lớp 7 — Hoạt động trải nghiệm, hướng nghiệp
- Lớp 7 — Nội dung giáo dục địa phương
- Lớp 8 — Giáo dục công dân
- Lớp 8 — Giáo dục thể chất
- Lớp 8 — Nghệ thuật
- Lớp 8 — Tin học
- Lớp 8 — Công nghệ
- Lớp 8 — Âm nhạc
- Lớp 8 — Mĩ thuật
- Lớp 8 — Hoạt động trải nghiệm, hướng nghiệp
- Lớp 8 — Nội dung giáo dục địa phương
- Lớp 9 — Giáo dục công dân
- Lớp 9 — Giáo dục thể chất
- Lớp 9 — Nghệ thuật
- Lớp 9 — Tin học
- Lớp 9 — Công nghệ
- Lớp 9 — Âm nhạc
- Lớp 9 — Mĩ thuật
- Lớp 9 — Hoạt động trải nghiệm, hướng nghiệp
- Lớp 9 — Nội dung giáo dục địa phương
- Lớp 10 — Địa lí
- Lớp 10 — Giáo dục kinh tế và pháp luật
- Lớp 10 — Giáo dục thể chất
- Lớp 10 — Giáo dục quốc phòng và an ninh
- Lớp 10 — Tin học
- Lớp 10 — Công nghệ
- Lớp 10 — Âm nhạc
- Lớp 10 — Mĩ thuật
- Lớp 10 — Hoạt động trải nghiệm, hướng nghiệp
- Lớp 10 — Nội dung giáo dục địa phương
- Lớp 11 — Địa lí
- Lớp 11 — Giáo dục kinh tế và pháp luật
- Lớp 11 — Giáo dục thể chất
- Lớp 11 — Giáo dục quốc phòng và an ninh
- Lớp 11 — Tin học
- Lớp 11 — Công nghệ
- Lớp 11 — Âm nhạc
- Lớp 11 — Mĩ thuật
- Lớp 11 — Hoạt động trải nghiệm, hướng nghiệp
- Lớp 11 — Nội dung giáo dục địa phương
- Lớp 12 — Địa lí
- Lớp 12 — Giáo dục kinh tế và pháp luật
- Lớp 12 — Giáo dục thể chất
- Lớp 12 — Giáo dục quốc phòng và an ninh
- Lớp 12 — Tin học
- Lớp 12 — Công nghệ
- Lớp 12 — Âm nhạc
- Lớp 12 — Mĩ thuật
- Lớp 12 — Hoạt động trải nghiệm, hướng nghiệp
- Lớp 12 — Nội dung giáo dục địa phương

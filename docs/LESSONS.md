# Bài học

Tổng cộng **630** bài học; **0** bài đã có nội dung.

## Trường dữ liệu

| Trường | Ý nghĩa |
|---|---|
| `lessonId` | Khoá ổn định, dạng `les-g05-toan-c01-l01` |
| `lessonNumber` | Số thứ tự bài trong chương |
| `displayTitle` | Tên bài hiển thị |
| `lessonCode` | Mã bài dạng `TOAN-5-001` |
| `estimatedMinutes` | Thời lượng dự kiến |
| `contentStatus` | `EMPTY` = chưa có nội dung dạy học |
| `verificationStatus` | Trạng thái xác minh tên bài |
| `source`, `verifiedAt` | Truy vết nguồn |

## Khoá ổn định

`lessonId` là **khoá chính**, không phải tên hiển thị. Nhờ vậy đổi tên bài
không làm hỏng liên kết đã lưu (lượt làm bài, tiến độ, ngân hàng câu hỏi).

## Nội dung dạy học

Bài học hiện chỉ có **metadata**. Nội dung sẽ được bổ sung sau khi đối chiếu tên
bài với bản in sách giáo khoa.

Trang bài học hiển thị rõ: "Bài học này chưa có nội dung dạy học" thay vì bịa
nội dung. Bài chưa có nội dung vẫn dùng được cho luyện tập và bài kiểm tra nếu
đề thi đã được công bố.

## Ví dụ — lớp 5

| Mã bài | Số | Tên bài | Mã | Thời lượng | Nội dung | Xác minh |
|---|---:|---|---|---|---|---|
| les-g05-toan-c01-l01 | 1 | Ôn số tự nhiên và phân số | TOAN-5-001 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-toan-c01-l02 | 2 | Số thập phân | TOAN-5-002 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-toan-c01-l03 | 3 | Cộng trừ số thập phân | TOAN-5-003 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-toan-c01-l04 | 4 | Nhân chia số thập phân | TOAN-5-004 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-toan-c02-l01 | 5 | Tỉ số phần trăm | TOAN-5-005 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-toan-c02-l02 | 6 | Hình tam giác và hình thang | TOAN-5-006 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-toan-c02-l03 | 7 | Hình hộp chữ nhật | TOAN-5-007 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-toan-c02-l04 | 8 | Thể tích | TOAN-5-008 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-toan-c03-l01 | 9 | Chuyển động đều bước đầu | TOAN-5-009 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-toan-c03-l02 | 10 | Biểu đồ hình quạt | TOAN-5-010 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_viet-c01-l01 | 1 | Đọc văn bản về đất nước | TIENG_VIET-5-001 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_viet-c01-l02 | 2 | Từ nhiều nghĩa | TIENG_VIET-5-002 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_viet-c01-l03 | 3 | Liên kết câu | TIENG_VIET-5-003 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_viet-c01-l04 | 4 | Câu ghép | TIENG_VIET-5-004 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_viet-c02-l01 | 5 | Viết bài tả người | TIENG_VIET-5-005 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_viet-c02-l02 | 6 | Viết báo cáo ngắn | TIENG_VIET-5-006 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_viet-c02-l03 | 7 | Đọc và đánh giá thông tin | TIENG_VIET-5-007 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_viet-c02-l04 | 8 | Thuyết trình có minh họa | TIENG_VIET-5-008 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_viet-c03-l01 | 9 | Viết đoạn nêu quan điểm | TIENG_VIET-5-009 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_viet-c03-l02 | 10 | Ôn tập chuyển cấp | TIENG_VIET-5-010 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_anh-c01-l01 | 1 | Personal information | TIENG_ANH-5-001 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_anh-c01-l02 | 2 | School memories | TIENG_ANH-5-002 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_anh-c01-l03 | 3 | Travel and transport | TIENG_ANH-5-003 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_anh-c01-l04 | 4 | Protecting the environment | TIENG_ANH-5-004 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_anh-c02-l01 | 5 | Festivals in Viet Nam | TIENG_ANH-5-005 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_anh-c02-l02 | 6 | Future plans | TIENG_ANH-5-006 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_anh-c02-l03 | 7 | Reading short notices | TIENG_ANH-5-007 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tieng_anh-c02-l04 | 8 | Giving a short presentation | TIENG_ANH-5-008 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-khoa_hoc-c01-l01 | 1 | Hỗn hợp và dung dịch | KHOA_HOC-5-001 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-khoa_hoc-c01-l02 | 2 | Sự biến đổi của chất | KHOA_HOC-5-002 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-khoa_hoc-c01-l03 | 3 | Năng lượng điện | KHOA_HOC-5-003 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-khoa_hoc-c01-l04 | 4 | Năng lượng tái tạo | KHOA_HOC-5-004 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-khoa_hoc-c02-l01 | 5 | Sinh sản ở thực vật | KHOA_HOC-5-005 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-khoa_hoc-c02-l02 | 6 | Sinh sản ở động vật | KHOA_HOC-5-006 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-khoa_hoc-c02-l03 | 7 | Dậy thì và chăm sóc sức khỏe | KHOA_HOC-5-007 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-khoa_hoc-c02-l04 | 8 | Môi trường và tài nguyên | KHOA_HOC-5-008 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-lich_su_dia_li-c01-l01 | 1 | Địa hình và khoáng sản Việt Nam | LICH_SU_DIA_LI-5-001 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-lich_su_dia_li-c01-l02 | 2 | Khí hậu và sông ngòi | LICH_SU_DIA_LI-5-002 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-lich_su_dia_li-c01-l03 | 3 | Dân cư Việt Nam | LICH_SU_DIA_LI-5-003 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-lich_su_dia_li-c01-l04 | 4 | Nông nghiệp và công nghiệp | LICH_SU_DIA_LI-5-004 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-lich_su_dia_li-c02-l01 | 5 | Các quốc gia láng giềng | LICH_SU_DIA_LI-5-005 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-lich_su_dia_li-c02-l02 | 6 | Thời Lý và Trần | LICH_SU_DIA_LI-5-006 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-lich_su_dia_li-c02-l03 | 7 | Thời Hậu Lê | LICH_SU_DIA_LI-5-007 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-lich_su_dia_li-c02-l04 | 8 | Việt Nam thế kỉ XIX đến nay | LICH_SU_DIA_LI-5-008 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tin_hoc_cong_nghe-c01-l01 | 1 | Mạng máy tính và Internet | TIN_HOC_CONG_NGHE-5-001 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tin_hoc_cong_nghe-c01-l02 | 2 | Tạo bảng trong văn bản | TIN_HOC_CONG_NGHE-5-002 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tin_hoc_cong_nghe-c01-l03 | 3 | Bài trình chiếu kể chuyện | TIN_HOC_CONG_NGHE-5-003 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tin_hoc_cong_nghe-c01-l04 | 4 | Thuật toán bằng các bước | TIN_HOC_CONG_NGHE-5-004 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tin_hoc_cong_nghe-c02-l01 | 5 | Lập trình trực quan | TIN_HOC_CONG_NGHE-5-005 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tin_hoc_cong_nghe-c02-l02 | 6 | Thiết kế mô hình kĩ thuật | TIN_HOC_CONG_NGHE-5-006 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tin_hoc_cong_nghe-c02-l03 | 7 | Sử dụng điện an toàn | TIN_HOC_CONG_NGHE-5-007 | 25 phút | EMPTY | NEEDS_VERIFICATION |
| les-g05-tin_hoc_cong_nghe-c02-l04 | 8 | Nghề công nghệ quanh em | TIN_HOC_CONG_NGHE-5-008 | 25 phút | EMPTY | NEEDS_VERIFICATION |

## API liên quan

- `GET /api/student/curriculum/grades` — danh sách 12 lớp
- `GET /api/student/curriculum/grades/:grade/subjects` — môn của một lớp
- `GET /api/student/curriculum/grades/:grade/subjects/:subjectId` — chương và bài
- `GET /api/student/curriculum/lessons/:lessonId` — một bài học
- `POST /api/student/progress/lessons/read` — đánh dấu đã đọc bài
  (KHÔNG đánh dấu hoàn thành; máy chủ trả kèm điều kiện còn thiếu)
- `GET /api/student/lessons/:lessonId/mini-test` — mini test cuối bài
- `POST /api/student/lessons/mini-test/submit` — nộp mini test (chỉ gửi `answers`)
- `GET /api/student/milestones/:grade/:subjectId` — điều kiện checkpoint/giữa kỳ/cuối kỳ

Xem `docs/ASSESSMENT_POLICY.md` để hiểu vì sao mở bài không đồng nghĩa với hoàn thành.

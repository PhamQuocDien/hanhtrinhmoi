# Nhóm 1 — Phát triển phần mềm

Nguồn dữ liệu: `content/career-paths/software-development/index.js`.

## Các khóa hiện có

| ID | Mã học phần | Khóa |
|---|---|---|
| `sd-foundations` | `SD-FOUND-01` | Nền tảng phát triển phần mềm |
| `INPR140285` | `INPR140285` | Nhập môn lập trình |
| `PRTE230385` | `PRTE230385` | Kỹ thuật lập trình |
| `DASA230179` | `DASA230179` | Cấu trúc dữ liệu và giải thuật |
| `OOPR230279` | `OOPR230279` | Lập trình hướng đối tượng |
| `SOEN330679` | `SOEN330679` | Công nghệ phần mềm |
| `WIPR230579` | `WIPR230579` | Lập trình trên Windows |
| `MOPR331279` | `MOPR331279` | Lập trình di động |
| `SDCAPSTONE` | `SDCAPSTONE` | Đồ án phát triển phần mềm |

Mỗi khóa có module/bài riêng và có `project` cuối khóa. Mỗi bài định nghĩa mục tiêu, phần nội dung, bài thực hành và deliverable. Thời lượng chỉ là ước lượng để lập kế hoạch, không phải số tiết học chính thức.

## Tiến độ

`CareerEnrollment` dùng cặp `{user, courseId}` duy nhất để giữ tiến độ theo người dùng. API chỉ chấp nhận đánh dấu hoàn thành cho bài tồn tại trong khóa; bài thứ N (N > 1) chỉ được đánh dấu sau khi bài liền trước hoàn tất.

## Thẩm định nội dung

Mã học phần được đưa từ danh sách người dùng cung cấp. Khung bài học được viết mới để làm ví dụ vận hành; cần kiểm tra với đề cương môn học và thay đổi ngôn ngữ/framework theo yêu cầu giảng viên trước khi phát hành cho lớp chính thức.

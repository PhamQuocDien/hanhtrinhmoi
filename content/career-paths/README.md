# Lộ trình ngành nghề

Nội dung được tách riêng khỏi chương trình phổ thông. Mỗi nhóm ngành có thư mục riêng; V5 triển khai chi tiết Nhóm 1 trong `software-development/index.js`.

## Mở rộng một nhóm ngành mới

- Tạo thư mục cho nhóm ngành, ví dụ `web-development/`.
- Khai báo metadata của nhóm ngành, các hướng nghề và các khóa học.
- Mỗi khóa phải có `id` ổn định, `code`, mô tả, kỹ năng, mục tiêu, module và lesson.
- Mỗi bài có `id` riêng, `objective`, `material`, `practice`, `deliverable`, thời lượng dự kiến.
- Thêm route/API và giao diện lọc theo group; không dùng ID từ bộ sách phổ thông cho khóa học đại học trừ khi có mapping riêng.
- Viết kiểm thử đảm bảo ID không trùng, bài có đầy đủ trường và pathway chỉ tham chiếu khóa tồn tại.

Học liệu trong danh mục hiện là bản thảo học tập, cần giảng viên rà soát trước khi xuất bản chính thức.

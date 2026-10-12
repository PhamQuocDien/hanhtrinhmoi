# Video links

Đây là file tách riêng để cập nhật link video sau khi quay xong; không cần sửa mã giao diện hoặc nội dung bài học.

- File dữ liệu: `video-links.csv`
- Các cột chính dùng camelCase: `programCode,grade,subjectCode,lessonId,videoUrl,videoTitle,status,notes`. Mỗi dòng ánh xạ chương trình/lớp/môn/bài tới URL video.
- URL trong gói là placeholder `https://example.com/replace-before-release/...`; trang học hiển thị thông báo chờ cập nhật, không cố nhúng placeholder.
- Khi có video thật, thay `video_url` bằng URL HTTPS công khai của YouTube/Vimeo/hosting hoặc file mp4. Với link YouTube, dùng link xem chuẩn (ví dụ `https://www.youtube.com/watch?v=...`); giao diện chuyển đổi link thành embed an toàn.
- `status` nên là `ready` với video đã duyệt; `placeholder` cho link tạm. Link trống được coi là chưa cấu hình.
- Nếu muốn thêm dòng bằng tay, giữ nguyên bốn cột khóa, tránh dấu phẩy trong `video_title` và `notes`.

Không đặt API key hoặc thông tin đăng nhập trong file này.


## V6.1.1 — video links for university IT careers

The same CSV now also contains one row per career lesson with `programCode=career`, `grade=university`, `subjectCode=<IT group code>`, and its unique `lessonId`. URLs under `example.com/replace-before-release` are placeholders, not actual video assets. After uploading a recorded video, replace the placeholder with a real HTTPS URL and change `status` to `ready`. The course detail API will only expose a career video's URL when its status is `ready`; otherwise the lesson shows a placeholder message.

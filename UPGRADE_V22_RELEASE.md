# Release Notes — Hành Trình Mới V22.0.0

## Thay đổi chính

1. Tách bậc học khỏi lĩnh vực: `Đại học` là `HIGHER_EDUCATION`; CNTT, Khoa học ứng dụng, Kinh tế, Cơ điện tử, Kỹ thuật là các domain riêng.
2. Thêm metadata domain cho 5 lĩnh vực và bổ sung 5 khóa Khoa học ứng dụng, nâng tổng catalog từ 278 lên 283.
3. Sửa catalog Đại học để lọc được mọi lĩnh vực thay vì trình bày “Đại học CNTT” như một bậc học riêng.
4. Chuẩn hóa catalog root trên database, giữ tham chiếu lịch sử và archive root tổng hợp trùng.
5. Trang khóa học dùng chapter accordions và theory section accordions, nội dung được ngắt thành các đoạn ngắn để không ép người học đọc một khối dài.
6. Course detail thể hiện learning flow gồm khái niệm, ví dụ, luyện tập, test và hoạt động ứng dụng; label hoạt động phản ánh Computing, TOEIC/IELTS và MOS.
7. Bổ sung regression test V22 vào `npm test` và `npm run check`.

## Nội dung catalog

- 283 course definitions total.
- 175 university-domain course definitions across Computing, Economics, Mechatronics, Engineering and Applied Sciences.
- 5 domain definitions; 5 applied-sciences courses.
- K12 check covers all 12 grade levels with lesson details and question data.

## Kiểm thử

Run `npm test` and `npm run validate`. The V22 test verifies taxonomy separation, course metadata, K12 detail/question presence across grades 1–12, UI labels and migration consistency.

## Lưu ý

Catalog đại học là danh mục kỹ năng tham chiếu, không phải CTĐT chính thức của trường. Bài luyện TOEIC/IELTS/MOS là mô phỏng/training trừ khi nguồn đã được xác minh. Design reference: CodeLearn, PREP, Kmin COM; do not copy proprietary content or brand assets.

# Hành Trình Mới V19.2.0 — Full Course Content Repair

## Vấn đề được sửa
- Course catalog có mã trùng làm số khóa học thực tế thấp hơn số lượng báo cáo và khiến migration có thể chạy lại liên tục.
- Course detail có thể đọc lẫn lesson/assessment của nhiều curriculum version.
- Một số course trên MongoDB có metadata mới nhưng lesson/assessment chưa hydrate đủ.
- Starter fallback chỉ hiển thị nội dung nhưng lesson/test chưa có ID tương thích với assessment page.
- Course detail chưa hiển thị Mock Test.
- Một số trang còn cache asset V19.0.0.

## Catalog mới
- 252 khóa học CNTT/TOEIC/IELTS/MOS duy nhất sau khi loại mã trùng và ưu tiên định nghĩa RICH.
- 144 khóa CNTT.
- 46 khóa TOEIC.
- 43 khóa IELTS.
- 19 khóa MOS.
- Mỗi khóa V19 có 12 bài học được chia thành 6 chương.

## Nội dung mỗi bài
Mỗi lesson có nội dung persistable:
- 4 phần lý thuyết.
- Bài giảng có script/key points.
- Ví dụ.
- 2 hoạt động thực hành.
- 3 practice tasks.
- Lỗi thường gặp.
- Skill/outcome/knowledge.
- Test cuối bài tối thiểu 8 câu.
- Audio script và visual prompt.
- Với nội dung lập trình: code example, coding tasks, test cases và code playground.

## Đánh giá
Mỗi course có:
- 12 lesson tests.
- 6 chapter tests.
- 1 midterm.
- 1 final.
- 1 mock test.

Tổng: 21 assessment/course.

## Repair an toàn
Migration V19 không còn chỉ kiểm tra số Course. Nó kiểm tra đồng thời:
- Course.
- Lesson.
- Question.
- Assessment.

Nếu thiếu dữ liệu, migration sẽ tự chạy repair thay vì đánh dấu đã hoàn tất.

## Fallback
Nếu MongoDB chưa hydrate đủ 12 lesson, `/education/courses/:id` và `/education/courses/:code` có thể trả starter catalog V19 đầy đủ để người dùng không thấy course rỗng. Assessment fallback có thể materialize lại assessment + question vào MongoDB khi người dùng mở/làm bài.

## K12
Adapter `curriculum-data.js` kiểm tra toàn bộ 12 lớp: 144 course/subject có tổng 2980 lesson, không phát hiện môn không có lesson.

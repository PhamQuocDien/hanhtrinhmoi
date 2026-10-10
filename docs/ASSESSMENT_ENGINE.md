# Assessment Engine

Assessment có sections, question pool, duration, attempt limit, scoring, passing score, randomization và publication status. Attempt lưu `startedAt`, `expiresAt`, `submittedAt`; backend kiểm tra timeout.

Khi submit, backend nạp `Question` theo `questionIds` của assessment và tự chấm objective question; client không được gửi điểm để thay thế kết quả. Essay/speaking chuyển `REVIEW_REQUIRED`, còn attempt chỉ được bắt đầu với assessment `PUBLISHED` và chưa vượt `attemptLimit`.

Essay/speaking cần workflow review riêng; không giả vờ chấm chính thức nếu chưa có grader/rubric được cấu hình.
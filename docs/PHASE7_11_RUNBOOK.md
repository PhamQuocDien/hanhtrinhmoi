# Runbook triển khai Phase 7–11

## 1. Trước khi triển khai
1. Sao lưu MongoDB và xác nhận có thể khôi phục backup.
2. Triển khai trên staging trước production.
3. Cài dependencies với `npm ci` nếu dự án có `package-lock.json`; nếu không, chạy `npm install`.
4. Cấu hình các biến môi trường theo `.env.example`; không đưa `.env` hoặc khóa vào ZIP/repository.
5. Giữ executor chạy code ở chế độ sandbox. Không bật `CODE_RUNNER_ALLOW_UNSANDBOXED=true` trên máy chủ public.

## 2. Migration
- Khi ứng dụng kết nối MongoDB, registry chạy migration `012-v27-typed-learning-system.js`, sau đó `013-v27-1-expanded-dsa-practice.js`.
- Migration 012 tạo/seed model có kiểu, khảo sát/placement và các bài thực hành ban đầu; migration 013 bổ sung ba bài Divide and Conquer (Merge Sort, tổng dãy con lớn nhất, đếm nghịch thế) nếu chưa tồn tại. Cả hai migration idempotent và không xóa collection legacy.
- Kiểm tra log migration, số survey/placement Published hợp lệ và danh sách practice task trong Admin.
- Nếu migration báo lỗi, giữ bản backup và xử lý lỗi trước khi tiếp tục; không tự xóa dữ liệu để ép migrate.

## 3. Kiểm tra cốt lõi trên staging
- Đăng nhập bằng tài khoản từng vai trò (learner, teacher/content editor, admin) và xác minh menu/API đúng quyền.
- Admin tạo Content Block ở dạng draft, preview, publish; học viên không được thấy block draft.
- Tạo question qua Question Builder, kiểm tra validation cho options/answer/rubric; dựng assessment từ các câu hỏi tồn tại.
- Tạo/đăng một PracticeTask với hidden tests; xác minh hidden tests không xuất hiện trong response/task detail của client.
- Nộp bài code và kiểm tra điểm theo trọng số, số test công khai/test ẩn đã chạy, PracticeAttempt, SkillMastery và LearningPlan version mới. Mỗi lần nộp chạy tối đa 12 test case để giới hạn thời gian và tài nguyên. Nội dung trả về cho học viên chỉ có kết quả chi tiết của test công khai; test ẩn chỉ trả số lượng đạt/tổng số và tổng trọng số, không trả input/output bí mật.
- Trên màn hình bài kiểm tra, xác nhận radio/checkbox nằm sát nội dung lựa chọn, không tràn rộng theo CSS input toàn cục; mọi câu hiển thị loại câu hỏi và điểm. Câu coding phải chỉ rõ Input/Output, ví dụ, công thức chấm điểm và trạng thái review nếu runner chưa sẵn sàng.
- Sửa DOB trong hồ sơ, kiểm tra validation ngày tương lai/không tồn tại và xác nhận UI roadmap chỉ hiển thị tuổi/nhóm học phù hợp.
- Mở catalog gaps/analytics và repair survey/placement; xác minh báo cáo theo dữ liệu thực.

## 4. Lệnh kiểm thử
```sh
npm test
npm run validate
```

`npm run validate` kiểm tra cú pháp JavaScript, script nội tuyến HTML và sự hiện diện của các luồng cốt lõi. Bản V27.1.1 sửa riêng CSS radio/checkbox của assessment, hiển thị điểm/rubric và chấm thực hành theo trọng số test. Bộ test tự động không đảm bảo môi trường MongoDB/Render, đăng nhập thật, migration production hay sandbox code executor; cần smoke test thủ công trên staging.

## 5. Dữ liệu và mô hình mới
- `ContentBlock`: các phần nội dung bài học, phiên bản/trạng thái/nguồn.
- `PracticeTask`: bài thực hành có đề, input/output, starter code, visible/hidden tests và scoring.
- `PracticeAttempt`: kết quả nộp thực hành.
- `LearningPlanStep`: thứ tự bước lộ trình có liên kết resource.
- `LearningEvent`: event đo lường học tập.
- `CourseQualitySnapshot`: kết quả audit chất lượng khóa.

Đây là lớp dữ liệu có kiểu trên MongoDB/Mongoose. JSON vẫn là định dạng trao đổi API, nhưng giáo viên/Admin không cần sửa JSON thủ công.

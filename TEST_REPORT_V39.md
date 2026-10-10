# V39.0.0 — Test Report

## Kết quả đã chạy

- `npm test`: PASS — toàn bộ chuỗi hồi quy hiện có và `scripts/test-v39-onboarding.js` hoàn tất thành công.
- `npm run validate`: PASS — 54 trang HTML và 150 tệp JavaScript được kiểm tra bởi validator của dự án.
- `node --check server.js`: PASS.
- `node --check server/routes/platform-routes.js`: PASS.
- `node --check server/routes/learning-system-v27-routes.js`: PASS.
- `node --check assets/platform/flow-pages.js`: PASS.
- `node --check assets/platform/placement-matcher.js`: PASS.
- `node --check scripts/migrations/011-v21-survey-placement.js`: PASS.
- `node scripts/test-v39-onboarding.js`: PASS — 28 câu khảo sát hợp lệ, 17 diagnostic tracks trong definitions, bài khám phá có 4 nhóm kỹ năng, trường đại học được điều kiện hóa, ngày sinh tùy chọn ở giao diện lưu hồ sơ, có thông báo/lối tải lại khi danh mục survey lỗi.

## Phạm vi test V39

- Seed survey vẫn qua `validateSurvey()`.
- Bài khám phá qua `validatePlacement()` và được chọn khi người học chưa có mục tiêu.
- Câu hỏi về đại học có điều kiện `HIGHER_EDUCATION`.
- Hồ sơ cho phép lưu thiếu ngày sinh và không bắt buộc trường đại học.
- API survey có nhánh phục hồi qua `ensureDiagnostics()` và mã lỗi rõ ràng khi không thể phục hồi.
- Kết quả khảo sát dẫn đến trang hồ sơ; hồ sơ có lối tiếp tục placement.

## Chưa kiểm chứng

- Không chạy được smoke test bằng MongoDB production hoặc tài khoản người dùng thật trong phiên làm việc này.
- Chưa triển khai lên Render và chưa xác nhận luồng đăng ký → khảo sát → hồ sơ → placement trên hosting.
- Chưa gọi Gemini thật để đo chất lượng nội dung hoặc quota trong phiên này.

Vì vậy, trạng thái trên xác nhận kiểm thử tự động và kiểm tra cấu trúc mã nguồn; không được hiểu là đã xác nhận lỗi production đã hết trên Render.

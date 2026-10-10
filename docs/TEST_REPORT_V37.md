# Hành Trình Mới V37.0.0 — Báo cáo kiểm thử

Ngày chạy kiểm thử: 2026-10-10.

## Kết quả đã chạy trong workspace

- `npm test`: PASS (exit code 0; 203 dòng PASS từ các test assertions được in ra).
- `npm run check`: PASS (exit code 0; 203 dòng PASS từ các test assertions được in ra).
- `npm run validate`: PASS — 54 trang HTML và 147 tệp JavaScript được kiểm tra.
- `scripts/test-v37-assessment-integrity.js`: 11 kiểm thử PASS, gồm liên kết course/lesson/subject/grade, câu hỏi trùng, độ phủ kỹ năng/độ khó của placement, track TOEIC/MOS/K12/đại học, tự động hoàn thành sau bài test đạt và cooldown quota theo ngày.

## Chưa xác minh bên ngoài

- Chưa kết nối và chạy smoke test với MongoDB production.
- Chưa gọi API Gemini/TTS thật để kiểm chứng quota của tài khoản cụ thể. Cooldown V37 là bộ nhớ trong tiến trình, nên sẽ mất khi tiến trình khởi động lại; đây không phải bộ khóa quota bền vững giữa nhiều instance.
- Chưa triển khai/kiểm tra Render thực tế.
- Code runner tiếp tục tắt mặc định đến khi executor cô lập được xác minh.
- Bộ kiểm tra source không chứng minh mọi khóa học cũ trong MongoDB đã có 50–100 câu hỏi chất lượng riêng. Dữ liệu hiện hữu cần được audit trên database thật.

# Báo cáo kiểm thử V36

## Phạm vi

Báo cáo này ghi lại các kiểm tra tự động chạy trong gói mã nguồn. Nó không phải bằng chứng cho một deployment production đang hoạt động.

## Các lệnh

- `npm test`: toàn bộ chuỗi kiểm thử hồi quy theo phiên bản, gồm test V36 mới.
- `npm run validate`: kiểm tra cú pháp JavaScript, tham chiếu tài nguyên HTML và các điều kiện kiến trúc đã mã hóa trong validator.
- `node --check executor-service/server.js`: kiểm tra cú pháp executor.

## Điều kiện triển khai chưa được kiểm chứng tại môi trường này

- Kết nối MongoDB, migration trên bản sao dữ liệu thật và readiness sau migration.
- Khóa Gemini/OpenAI thật, quota, fallback thực tế, chất lượng chấm bài với bộ dữ liệu chuẩn.
- Docker Engine, sandbox code runner, URL/token riêng tư giữa web và executor.
- Deploy và smoke test trên Render.

## Lưu ý an toàn

`CODE_RUNNER_ENABLED=false` trong `render.yaml` được giữ nguyên. Không bật chỉ để làm xanh test; cần triển khai và xác nhận executor cô lập trước.

# Báo cáo kiểm tra V35.0.0

## Kết quả kiểm tra trong môi trường đóng gói
- `node --check server.js`: PASS.
- `node --check server/models/platform-models.js`: PASS.
- `npm test`: PASS, toàn bộ chuỗi kiểm thử hiện có và bộ kiểm thử V35 AI essay/history đều đạt.
- `npm run validate`: PASS — 54 trang HTML, 144 tệp JavaScript được validator kiểm tra.
- Inline JavaScript của `essay-history.html`: PASS kiểm tra cú pháp.

## Thay đổi cụ thể V35
- Thêm chấm bài tự luận theo thứ tự Gemini → OpenAI → bộ chấm nội bộ khi không có API hoặc AI gặp lỗi/quota.
- Lưu bài tự luận, điểm, tiêu chí, điểm mạnh, hướng cải thiện, ví dụ tham khảo và nguồn chấm trong MongoDB.
- Thêm API lịch sử chỉ truy xuất theo username trong session và giao diện `essay-history.html`, có liên kết từ trang hồ sơ.
- Đồng bộ phiên bản ứng dụng, package, lockfile và cache-busting lên `35.0.0`.

## Giới hạn chưa xác minh
- Không thể xác minh live với MongoDB, Gemini/OpenAI API hoặc Render từ môi trường này.
- Smoke test khởi động server bị chặn bởi thiếu module `dotenv` trong node_modules cục bộ sau khi `npm ci` bị timeout; `dotenv` vẫn được khai báo trong `package.json` và lockfile. Cần chạy `npm ci` trong môi trường có truy cập registry trước khi chạy server.
- Các kiểm thử lịch sử `validate:legacy` còn phản ánh giả định giao diện/phiên bản cũ và không được tính là kiểm thử phát hành hiện hành.
- Bản V35 chưa thể chứng minh rằng toàn bộ ngân hàng câu hỏi mọi khóa học đều đã đạt 50–100 câu chất lượng riêng từng bài; cần kiểm toán nội dung MongoDB thực tế sau khi kết nối môi trường dữ liệu.

# Hành Trình Mới V27.1.1 — Assessment & Practical Grading Fix

## Các thay đổi

1. Sửa lỗi trình bày trong bài kiểm tra thấy trên giao diện: radio/checkbox không còn bị kéo rộng 100%; lựa chọn được hiển thị dạng hàng, chữ nằm sát nút chọn, có wrap trên màn hình nhỏ.
2. Mỗi câu kiểm tra cho biết loại câu hỏi và điểm; câu lập trình thể hiện đề, input, output, ràng buộc, ví dụ công khai và hướng dẫn chấm.
3. Chấm code theo tổng trọng số test đạt / tổng trọng số test đã chạy × 100. Mỗi lượt tối đa 12 test. UI hiển thị test công khai chi tiết và chỉ số tổng hợp cho test ẩn.
4. Không tự cấp điểm nếu code runner bị tắt/không an toàn hoặc đề không có test case. Production phải sử dụng executor biệt lập, không chạy mã người học trực tiếp trong tiến trình web.
5. Bổ sung 3 bài Divide and Conquer có thực hành thật: Merge Sort, tổng dãy con lớn nhất, đếm nghịch thế.
6. Migration `013-v27-1-expanded-dsa-practice.js` bảo đảm ba bài mới có mặt trên database đã triển khai trước đó; không ghi đè record cùng mã.

## Kiểm thử

- `npm test`: PASS, gồm regression V13–V26, 20 test Phase 7–11 và 3 test chấm code; bài D&C được validate riêng.
- `npm run validate`: PASS, 53 trang HTML và 125 tệp JavaScript.
- Inline JavaScript trong HTML được parse bởi validator.
- Chưa xác nhận server thật với MongoDB/Render ở workspace này vì dependencies chưa được cài. Cần chạy `npm ci`, `npm test`, `npm run validate`, rồi smoke test trên staging trước production.

## Triển khai

1. Sao lưu MongoDB.
2. Cài dependencies bằng `npm ci`.
3. Đặt biến môi trường từ `.env.example`; không đóng gói hoặc commit `.env`.
4. Triển khai staging, xác minh migration 013, tạo một bài code thử và kiểm tra điểm/test ẩn không bị lộ.
5. Không bật chế độ chạy code không sandbox trên máy chủ public.

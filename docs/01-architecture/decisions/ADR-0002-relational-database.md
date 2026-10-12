# ADR-0002 — Lưu trữ dữ liệu: quyết định V0 và trạng thái V1

- **Trạng thái lịch sử V0:** Đã đề xuất PostgreSQL vì dữ liệu khóa học, đăng ký và tiến độ có quan hệ rõ.
- **Trạng thái hiện tại V1:** Đề xuất quan hệ được **superseded** cho bản chạy đầu tiên; V1 dùng MongoDB qua `MONGO_URI` để tương thích với bộ biến môi trường hiện có của Hành Trình Mới.
- **Lý do:** V1 cần đưa luồng đăng nhập và khảo sát vào hoạt động trước, đồng thời bảo toàn tên biến môi trường đã được dùng trong môi trường triển khai hiện tại.
- **Hệ quả:** `User` và `SurveyResponse` dùng Mongoose. Tài liệu `database/migrations/` và các ADR SQL từ V0 không phải migration đang chạy trong ứng dụng.
- **Điều kiện xem xét lại:** nếu mở rộng sang các báo cáo/quan hệ dữ liệu phức tạp, đánh giá lại MongoDB so với PostgreSQL bằng mô hình dữ liệu, tải thực tế và chi phí vận hành; không chuyển database chỉ vì sở thích công nghệ.

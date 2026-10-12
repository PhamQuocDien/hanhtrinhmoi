# ADR-0001: Bắt đầu bằng modular monolith

- **Trạng thái:** Chấp nhận cho V1, với công nghệ triển khai V1 ghi tại `docs/01-architecture/system-overview.md`.
- **Bối cảnh:** Nền tảng mới, nhiều lĩnh vực học, chưa có tải thực tế để chứng minh cần phân tán dịch vụ.
- **Quyết định khái niệm:** Dùng một API chính có các ranh giới module rõ ràng. V0 ban đầu dự kiến ASP.NET Core; V1 hiện chạy Node.js + Express để tương thích với bộ biến môi trường và MongoDB đang có. Đây là thay đổi công nghệ triển khai, không thay đổi nguyên tắc modular monolith.
- **Tách biệt:** Code runner nếu được triển khai sẽ là dịch vụ độc lập để cách ly code người học khỏi API chính.
- **Lợi ích:** Dễ chạy local, kiểm thử, triển khai và giữ logic xác thực/quyền ở server.
- **Đánh đổi:** Một tiến trình API vẫn có thể phát triển lớn; cần giữ ranh giới module và chỉ tách dịch vụ dựa trên dữ liệu vận hành thực tế.
- **Xem xét lại khi:** Một module có nhu cầu scale/triển khai độc lập hoặc có yêu cầu bảo mật/vận hành khác biệt rõ ràng.

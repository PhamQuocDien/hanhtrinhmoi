# Quy ước phát triển

- Ưu tiên tên có ý nghĩa; không đổi tên hoặc di chuyển thành phần đang dùng nếu chưa đánh giá ảnh hưởng.
- Mỗi tính năng cần có phạm vi, tiêu chí nghiệm thu và test phù hợp trước khi coi là hoàn thành.
- Giữ controller/endpoint mỏng; nghiệp vụ thuộc Application/Domain.
- Không đưa bí mật vào Git; cung cấp file hướng dẫn cấu hình và biến môi trường mẫu nếu cần.
- Dùng migration cho mọi thay đổi database; không sửa schema thủ công trên môi trường dùng chung.
- Không dùng JSON file làm kho dữ liệu vận hành. JSON có thể xuất hiện về sau như định dạng trao đổi HTTP hoặc cấu hình công cụ nếu cần, không phải database.
- Không chạy source code do người học gửi trong API chính hoặc máy phát triển không cách ly.
- Không đưa thư viện/framework vào chỉ vì phổ biến; ghi lại lý do khi thêm dependency quan trọng.
- Nội dung học phải có nguồn, mục tiêu học tập và quyền sử dụng rõ ràng.

# Data Migration

Migration `001-platform-collections` chỉ tạo collection/index cho platform models, ghi count trước/sau và không xóa dữ liệu. Migration không chạy tự động khi server startup.

Migration `002-legacy-profile-adapter` đọc collection legacy `users` và chỉ tạo các document platform còn thiếu trong `profiles`, `educationProfiles` và `platformLearningProfiles`. Migration dùng username làm khóa tương ứng, không ghi đè profile platform đã tồn tại và không sửa/xóa dữ liệu legacy.

Migration `003-legacy-notification-adapter` đọc collection legacy `notifications`, ánh xạ broadcast thành `recipient: BROADCAST` và notification riêng thành username. Bản ghi platform được nhận diện theo recipient/title/message/thời gian tạo; migration không sửa/xóa thông báo legacy.

Legacy collections (`users`, `learningrecords`, `learningprofiles`, notifications, tournaments và game records) được giữ nguyên. Migration tiếp theo phải idempotent và chỉ chạy trên database đã backup hoặc dedicated migration environment.
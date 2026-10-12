# Database / thiết kế lưu trữ

V1 dùng MongoDB qua biến `MONGO_URI`; các model Mongoose đang triển khai nằm tại `apps/api/src/models/`. Các thư mục `migrations/`, `seeds/` và `diagrams/` được giữ cho tài liệu schema / quy trình tương lai. Migration SQL trong bộ khung V0 không được chạy bởi V1.

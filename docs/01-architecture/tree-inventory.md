# Cây thư mục V1 (rút gọn)

```text
HocTapPlatform_V1/
  package.json
  .env.example
  apps/
    web/                    # Trang chủ, đăng nhập, đăng ký, khảo sát, dashboard, admin
      src/css/main.css
      src/js/                # API client và logic frontend theo trang
    api/
      server.js              # Express, MongoDB, session, bảo vệ, static hosting
      src/models/            # User, SurveyResponse
      src/routes/            # Auth, survey, admin
      src/middleware/        # CSRF và kiểm tra session/role
      src/utils/             # Validation
      test/                  # Unit tests
  content/                   # Đề cương chương trình/lộ trình nghề (chưa publish)
  services/code-runner/     # Chỗ mở rộng runner riêng, chưa chạy trong V1
  database/                 # Tài liệu lưu trữ và sơ đồ
  docs/                     # Kiến trúc, roadmap, vận hành
  infra/ scripts/            # Hạ tầng và công cụ sẽ mở rộng
```

`.gitkeep` giữ các khu vực mở rộng chưa có mã nguồn. Các trang web tĩnh chạy cùng origin với API.

# Xử lý và thay mới thông tin bí mật đã lộ

Các giá trị bí mật được dán trực tiếp trong một cuộc hội thoại không nên tiếp tục được coi là bí mật. Trước khi chạy public hoặc đưa dữ liệu thật lên, hãy thay mới những giá trị sau trong trang quản trị của nhà cung cấp:

1. **Gemini API key:** thu hồi key cũ và tạo key mới trong trang quản lý API keys của Google AI Studio/Google Cloud phù hợp với nơi cấp key.
2. **OpenAI API key:** thu hồi key cũ, tạo key mới, giới hạn quyền/scope nếu nhà cung cấp hỗ trợ.
3. **Resend API key:** thu hồi key cũ và tạo key mới.
4. **MongoDB database user:** đổi password hoặc tạo user mới với quyền tối thiểu chỉ trên database ứng dụng; cập nhật Network Access cho phù hợp.
5. **ADMIN_PASSWORD:** dùng mật khẩu mới, dài và duy nhất. Không dùng lại giá trị đã chia sẻ.
6. **SESSION_SECRET:** tạo chuỗi ngẫu nhiên mới (ít nhất 32 byte), ví dụ tạo bằng `openssl rand -hex 32`. Đổi secret sẽ làm các phiên đăng nhập hiện có mất hiệu lực.
7. **CODE_EXECUTOR_TOKEN:** trước khi có code runner thực tế, tạo token ngẫu nhiên mới và cấu hình nhất quán ở cả API và executor.

Sau đó cập nhật các biến trong trang Environment của Render hoặc file `.env` local (không commit). Đảm bảo `.env` không nằm trong Git: kiểm tra bằng `git status --short` và `git check-ignore .env`. Không dán giá trị mới vào source code, README, issue hay ảnh chụp màn hình.

`.env.example` cố ý chỉ giữ **tên biến**, giữ các giá trị cấu hình không bí mật khi thích hợp, và dùng placeholder cho các thông tin nhạy cảm. Tên biến AI, email, code runner và rewards được giữ để dùng ở các phiên bản tương lai; chúng chưa có nghĩa tính năng liên quan đang hoạt động trong V5.1.2.

# Hành Trình Mới V26 — Phase 4, 5, 6

## Phase 4 — Kiểm thử luồng tích hợp và an toàn

- `/healthz` là liveness: xác nhận tiến trình Node vẫn sống.
- `/api/ready` là readiness: kiểm tra MongoDB và xác nhận `SESSION_SECRET` đã được cấu hình đủ dài trong production.
- API có request id, `no-store` cho API, same-origin/cross-site checks và RBAC ở backend.
- Tiến độ bài học lưu theo tài khoản trong `LessonProgress`, chỉ chấp nhận bài đã công bố và khóa học mà người học có quyền xem.
- Code Runner vẫn tắt mặc định. Trong production, chạy code trực tiếp trên tiến trình web trả về `SANDBOX_REQUIRED` trừ khi người quản trị chủ động bật `CODE_RUNNER_ALLOW_UNSANDBOXED=true` (không khuyến nghị). Cần triển khai executor/container biệt lập để chạy mã người học trên môi trường công khai.
- Khi thiếu `SESSION_SECRET`, ứng dụng tạo secret ngẫu nhiên cho tiến trình hiện tại thay vì tạo secret đoán được từ URI; phiên có thể mất sau restart. Hãy cấu hình secret ổn định trong môi trường triển khai.

## Phase 5 — Trải nghiệm học theo từng bước

Trang chi tiết khóa học hiển thị checklist tiến độ cho các phần lý thuyết, ví dụ, luyện tập, lab và kiểm tra. Các bước được lưu vào MongoDB khi bài/khóa học tồn tại trong catalog mới; nếu API tạm lỗi hoặc bài thuộc catalog legacy, browser giữ bản dự phòng trong localStorage. Bước kiểm tra không được ghi hoàn thành trừ khi server tìm thấy một `AssessmentAttempt` đã nộp hợp lệ.

## Phase 6 — Local RAG tutor + mô hình cục bộ tùy chọn

- `server/services/local-ai-runtime.js` thực hiện truy xuất từ bài học đã công bố, xếp hạng từ khóa/ngữ cảnh, tạo câu trả lời có nguồn và từ chối đoán khi không tìm được nguồn.
- `POST /api/ai-learning/local/ask` chỉ tìm bài học công khai hoặc khóa `PERSONAL_AI` thuộc chính người dùng; không trả lời từ đáp án ngân hàng câu hỏi, đáp án chuẩn hay hidden tests.
- Mặc định local tutor chạy ở `LOCAL_RETRIEVAL_ONLY`, không cần key/API AI cloud.
- Muốn có khả năng diễn giải mở rộng, cài Ollama và model weights trên máy/host được tin cậy, rồi đặt `LOCAL_LLM_ENABLED=true`, `LOCAL_LLM_BASE_URL` và `LOCAL_LLM_MODEL`. ZIP không chứa model weights. Mặc định endpoint chỉ cho `localhost`/loopback hoặc tên service `ollama`; chỉ bật `LOCAL_LLM_ALLOW_PRIVATE_HOST=true` trong mạng riêng có kiểm soát.
- AI được hướng dẫn chỉ dựa vào các nguồn `[S1]`, `[S2]` trả về. Đầu ra không có trích dẫn nguồn hợp lệ bị loại bỏ và chuyển về chế độ truy xuất-only. Dù vậy, nội dung do LLM diễn giải vẫn cần được người học/giáo viên đánh giá; nguồn được hiển thị trong giao diện.

## Test commands

```bash
npm test
npm run validate
```

Bộ test tự động không thay thế smoke test với MongoDB, session thật, đăng nhập vai trò khác nhau, upload tài liệu, Render hoặc sandbox thực tế. Trước khi deploy, backup MongoDB và kiểm tra `/api/ready`.

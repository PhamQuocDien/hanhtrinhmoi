# Hành Trình Mới V17.0.0 – AI Autopilot + Starter Curriculum

## Mục tiêu
- AI quan sát hoạt động học tự động, không yêu cầu bấm nút AI.
- AI ưu tiên khóa học có sẵn trước khi sinh nội dung mới.
- Khi chưa có khóa học đủ sát, AI có thể tạo khóa cá nhân dựa trên starter catalog và learner profile.

## Starter catalog
- Đại học CNTT: 23 khóa, phục vụ CNTT/Kỹ thuật phần mềm/Khoa học máy tính/Hệ thống thông tin/Khoa học dữ liệu/AI/An toàn thông tin/Mạng.
- TOEIC: 10 khóa.
- IELTS: 10 khóa.
- MOS: 9 khóa cho Word, Excel, PowerPoint và mock.
- Tổng: 52 khóa nền, 4 bài/khóa, question pool starter và final assessment.

## Resilience
- Gemini 503/5xx: retry + fallback model + cooldown.
- Gemini quota 429: dừng fallback tuần tự để không đốt quota, dùng fallback nội bộ và tự thử lại sau cooldown.
- JSON Gemini bị cắt/để trailing comma: có parser repair trước khi chuyển sang fallback.
- Không để một migration lỗi chặn migration starter catalog phía sau.

## Catalog fallback
Nếu migration MongoDB chưa hoàn tất, API catalog vẫn có thể phục vụ starter catalog từ memory và trang chi tiết có thể mở bằng course code. Khi MongoDB sẵn sàng, migration `006-ai-starter-catalog` sẽ materialize toàn bộ dữ liệu vào database.

## Lưu ý nội dung
Starter catalog là nội dung luyện tập nguyên bản của Hành Trình Mới, được gắn `sourceType=ORIGINAL_PRACTICE` và `verification=unverified`. Không coi đây là giáo trình chính thức, đề thi chính thức hoặc nội dung bảo mật.

## Render
Các biến Gemini quan trọng:
- `GEMINI_MODEL`
- `GEMINI_FALLBACK_MODELS`
- `GEMINI_RETRY_COUNT`
- `GEMINI_RETRY_BASE_MS`
- `GEMINI_TIMEOUT_MS`
- `GEMINI_FAILURE_COOLDOWN_MS`
- `GEMINI_QUOTA_COOLDOWN_MS`
- `GEMINI_MAX_FALLBACK_MODELS`

Sau deploy: `npm ci` → `npm start`. Không đưa `node_modules` vào ZIP.

# Tích hợp Google Gemini

Hành Trình Mới sử dụng Gemini ở backend để hỗ trợ giải thích bài học. Browser không nhận API key.

## Render

Tạo Environment Variable trong Web Service của Render:

- `GEMINI_API_KEY`: API key của dự án Gemini.
- `GEMINI_MODEL`: model chính, mặc định `gemini-3.8-flash`.
- `GEMINI_FALLBACK_MODELS`: danh sách model dự phòng, phân cách bằng dấu phẩy. Khi Gemini trả 503/5xx hoặc lỗi tạm thời, server tự retry theo exponential backoff rồi thử model tiếp theo.
- `GEMINI_RETRY_COUNT`: số lần retry trên mỗi model (mặc định 1).
- `GEMINI_TIMEOUT_MS`: timeout mỗi request (mặc định 20 giây).
- `GEMINI_FAILURE_COOLDOWN_MS`: thời gian tạm ngưng gọi Gemini sau khi tất cả model đều quá tải (mặc định 45 giây).

`render.yaml` đã khai báo hai biến này; giá trị secret được để `sync: false` và không ghi vào repository.

## API nội bộ

- `GET /api/ai/status`: trả về trạng thái cấu hình và model, không trả API key.
- `POST /api/ai/lesson-help`: yêu cầu đăng nhập, nhận context bài học và câu hỏi người học, sau đó gọi Gemini từ server.

## Nguyên tắc

Gemini chỉ là trợ giảng. Nó không phải source of truth cho curriculum và không được tự gắn nhãn nội dung là “chính thức”. Nội dung curriculum/test phải lấy từ source registry hoặc dữ liệu do Admin cấu hình/công bố.

## Khả năng chịu lỗi
HTTP 503 `UNAVAILABLE` được xem là lỗi tạm thời. Server retry với exponential backoff + jitter, sau đó tự chuyển sang model dự phòng. Nếu toàn bộ model đều bận, Learning Director/Autopilot không làm hỏng request: hệ thống chuyển sang phân tích rule-based và tự thử lại ở request AI kế tiếp.

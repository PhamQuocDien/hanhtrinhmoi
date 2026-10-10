# Hành Trình Mới V17.0.0 — Gemini Resilience

## Sửa lỗi

Lỗi `GEMINI_HTTP_503` / `This model is currently experiencing high demand` không còn làm Learning Director/Autopilot trả lỗi 500.

## Cơ chế mới

- Retry lỗi tạm thời (`408/425/5xx` và một số `429`) bằng exponential backoff + jitter.
- Tự chuyển từ `GEMINI_MODEL` sang `GEMINI_FALLBACK_MODELS`.
- Timeout mỗi request.
- Cooldown khi tất cả model đều quá tải để tránh vòng lặp request liên tục.
- Learning Context có fallback rule-based, giữ nguyên hành trình hiện tại.
- Learning Director có quyết định dự phòng, không hiện `AI chưa sẵn sàng` chỉ vì Gemini đang bận.
- Course Generator trả về trạng thái tạm thời thay vì làm crash API.
- TTS cũng có retry và fallback model khi được cấu hình.
- Cache-busting nâng lên `17.0.0`.

## Render

Đã thêm `GEMINI_FALLBACK_MODELS`, `GEMINI_RETRY_COUNT`, `GEMINI_RETRY_BASE_MS`, `GEMINI_TIMEOUT_MS` và `GEMINI_FAILURE_COOLDOWN_MS` vào `render.yaml`.

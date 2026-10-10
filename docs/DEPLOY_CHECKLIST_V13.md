# Danh sách triển khai V13

## Environment bắt buộc

- `NODE_ENV=production`
- `MONGO_URI`
- `SESSION_SECRET` dài ít nhất 32 ký tự
- `ADMIN_PASSWORD` từ 10 đến 72 ký tự

## Environment tùy chọn

- `OPENAI_API_KEY` và `OPENAI_MODEL` cho chấm bài viết.
- Các biến `COMMUNITY_TOURNAMENT_*` cho giải cộng đồng.
- Các biến `ROBUX_*` chỉ khi quản trị viên chủ động bật quy đổi thủ công.

## Render

- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/healthz`
- Node: 20.x

Không đưa `.env`, khóa OpenAI hoặc mật khẩu MongoDB lên GitHub.

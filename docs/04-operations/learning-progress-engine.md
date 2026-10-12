# Vận hành bộ máy tiến độ học V5.1.2

## Biến môi trường

- `LEARNING_CHECKPOINT_SCORE`: điểm tối thiểu mỗi checkpoint (mặc định 70).
- `LEARNING_UNLOCK_SCORE`: điểm tối thiểu bài học để cho phép mở bài kế (mặc định 70).
- `AI_MODE`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_SMART_MODEL` và các biến `GEMINI_*` khác điều khiển tích hợp AI. Chỉ thêm secrets ở môi trường chạy; không commit `.env`.

## Bộ sưu tập MongoDB

- `learningprogress`: mỗi tài khoản và môn/lớp/bộ sách có tiến độ phần học, kết quả từng bài, điểm tốt nhất và số lần làm.
- `assessmentattempts`: lịch sử checkpoint, kiểm tra bài, chủ điểm, giữa kỳ, cuối kỳ và đề luyện tập; ghi `gradingMode` để phân biệt `objective`, `gemini-ai`, `heuristic-fallback` và `mixed`.
- `POST /api/learning/study-plan`: lập lịch học tuần theo khảo sát và các bài đang mở; chỉ lưu hồ sơ học nếu người học đã hoàn thành khảo sát.

## Chạy kiểm tra

```bash
npm install
npm test
npm run check
```

## Checklist trước production

1. Dùng key Gemini mới, đặt quota và xem lỗi API/timeout trong log.
2. Test đăng ký, session/CSRF, lưu tiến độ với MongoDB thật và kiểm tra quyền truy cập.
3. Kiểm thử vòng đời: checkpoint sai → phần sau khóa; thử lại đạt → mở phần sau; bài thi dưới ngưỡng → khóa bài tiếp; bài thi đạt → mở bài tiếp.
4. Giáo viên kiểm duyệt nội dung và rubric theo từng lớp/môn/bộ sách.
5. Hoàn thiện quyền truy cập dữ liệu trẻ em, phụ huynh, chính sách riêng tư, thời hạn lưu/xóa dữ liệu và quy trình xử lý sự cố.
6. Chạy kiểm thử tải và audit bảo mật trước khi dùng cho học sinh thật.

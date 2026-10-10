# Hành Trình Mới — V39.0.0 Release Notes

## Mục tiêu

V39 xử lý luồng người học sau đăng ký và giảm việc hỏi thông tin không phù hợp với tuổi/giai đoạn học. Bản này phát triển trên V38, không thay thế kiến trúc API, mô hình dữ liệu hay course quality gate.

## Thay đổi

### 1. Khảo sát sau đăng ký có cơ chế phục hồi
- Giữ đường dẫn onboarding sau đăng ký hiện có: `/survey.html?onboarding=1`.
- API `GET /api/survey/surveys` tiếp tục kiểm tra khảo sát đã công bố; nếu không có khảo sát hợp lệ, nó gọi migration `ensureDiagnostics()` để khởi tạo/sửa bộ khảo sát và thử đọc lại.
- Nếu vẫn không có khảo sát, API trả `503 SURVEY_CATALOG_UNAVAILABLE` kèm thông báo hướng dẫn kiểm tra MongoDB/máy chủ.
- Giao diện khảo sát có nút thử tải lại khi danh mục rỗng/lỗi; không giả lập khảo sát thành công ở phía trình duyệt.

### 2. Hồ sơ phù hợp với giai đoạn học
- Ngày sinh là tùy chọn khi lưu hồ sơ; nếu người học cung cấp ngày sinh hợp lệ, tuổi vẫn được tính tự động.
- Các trường cao đẳng/đại học được ẩn mặc định và chỉ hiển thị khi cấp học/trạng thái phù hợp.
- Không tải danh mục trường/khoa/ngành khi nhóm trường đại học đang ẩn.
- Giữ các trường và API hiện có; không thêm thuộc tính hồ sơ tùy tiện.

### 3. Khảo sát → hồ sơ → diagnostic
- Kết quả khảo sát giải thích bước tiếp theo và ưu tiên nút cập nhật hồ sơ cá nhân.
- Sau khi lưu hồ sơ ở luồng onboarding, người học có đường dẫn tiếp tục placement.
- Không yêu cầu ngày sinh chỉ để lưu mục tiêu học tập, sở thích hoặc giai đoạn học.

### 4. Diagnostic đa lĩnh vực
- Thêm placement `HTM-PLACEMENT-DISCOVERY-V39` với bốn nhóm kỹ năng: logic/giải quyết vấn đề, đọc hiểu/ngôn ngữ, kỹ năng số/dữ liệu, khoa học/suy luận thực tế.
- Matcher chọn bài khám phá nếu chưa có mục tiêu hoặc cấp học đủ rõ; vẫn ưu tiên bài TOEIC/IELTS/MOS, K-12 hoặc chuyên ngành khi có bằng chứng phù hợp.
- Bài khám phá chỉ tạo bằng chứng định hướng ban đầu, không coi là kết luận tuyệt đối về năng lực hay nghề nghiệp.

### 5. Version và kiểm thử
- Đồng bộ phiên bản ứng dụng và cache key lên `39.0.0`.
- Giữ nguyên version `38.0.0` trong metadata riêng của engine/quality gate V38 để không viết lại lịch sử nguồn sinh nội dung.
- Bổ sung `scripts/test-v39-onboarding.js` vào cả `npm test` và `npm run check`.

## Luồng đề xuất cho người dùng mới

1. Đăng ký tài khoản.
2. Làm khảo sát mục tiêu học tập toàn diện.
3. Rà soát hồ sơ theo giai đoạn học (bỏ qua trường đại học nếu không phù hợp).
4. Làm placement theo mục tiêu cụ thể; nếu chưa rõ mục tiêu, làm bài khám phá đa lĩnh vực.
5. Xem lộ trình được tạo từ kết quả khai báo và bằng chứng chẩn đoán.

## Giới hạn cần biết

- API chỉ có thể tự khởi tạo khảo sát khi máy chủ kết nối được MongoDB và migration chạy thành công.
- Kiểm thử cục bộ không thay thế kiểm thử tài khoản mới trên MongoDB/Render production.
- Nội dung do AI tạo, điểm chẩn đoán và gợi ý nghề nghiệp vẫn cần được trình bày như đề xuất, không phải kết luận chắc chắn.

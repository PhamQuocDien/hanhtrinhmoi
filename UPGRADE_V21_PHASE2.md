# Hành Trình Mới V21 — Phase 2

## Mục tiêu

Nối khảo sát, hồ sơ giáo dục, placement, skill evidence và Learning Plan; đồng thời đưa luồng nhập nội dung quản trị về dạng biểu mẫu đơn giản, không yêu cầu nhập JSON.

## 1. Khảo sát và hồ sơ

- Migration `011-v21-survey-placement.js` tạo survey 28 câu theo nhóm: trình độ, thông tin đại học, mục tiêu, môn/kỹ năng, định hướng nghề nghiệp, thời gian và sở thích học.
- Tạo placement riêng cho từng lớp 1–12, cùng các bài placement nền cho Đại học/CNTT, TOEIC, IELTS và MOS.
- Kết quả survey lưu theo attempt/version và đồng bộ sang `EducationProfile`, `LearningProfile`.
- Hồ sơ hỗ trợ trường, khoa, lĩnh vực, nhóm ngành, ngành, chuyên ngành, chương trình đào tạo, khóa, năm học và học kỳ.
- Survey/placement tạo phiên bản Learning Plan mới; phiên bản đang dùng được đánh dấu `ACTIVE`, các phiên bản trước `ARCHIVED`.
- Placement lưu điểm theo từng skill, evidence và review-required cho câu chủ quan; cập nhật `SkillMastery` và liên kết các khóa/bài có thể ghép trong catalog. Nếu không tìm được course thật, hệ thống ghi `courseGap` thay vì tạo đường dẫn giả.

## 2. Soạn nội dung đơn giản trong Admin

Mở `/admin/index.html` → **Tạo nội dung / Nhập Word**. Có thể chọn loại nội dung, tải file hoặc dán Markdown; hệ thống hiển thị preview và cảnh báo trước khi lưu.

Hỗ trợ file `.docx`, `.md`, `.markdown`, `.txt` tối đa 3 MB trên giao diện. DOCX được trích xuất từ các đoạn văn bản trong `word/document.xml`, đồng thời giữ heading style Word phổ biến (`Title`, `Subtitle`, `Heading 1–6`). Văn bản trong bảng Word được thu nhận theo các đoạn văn; bố cục bảng phức tạp, hình ảnh/chữ trong ảnh, scan, audio/video và biểu đồ nhúng không được OCR/nhận diện đầy đủ ở phiên bản này.

Cú pháp đề thi khuyến nghị:

```text
# Kiểm tra chương 1

Câu 1: 12 thuộc kiểu dữ liệu nào?
Dạng: trắc nghiệm
A. string
B. integer
C. boolean
D. list
Đáp án: B
Giải thích: 12 là số nguyên.

Câu 2: Giải thích vì sao cần kiểm thử trường hợp biên.
Dạng: tự luận
Đáp án: Câu trả lời cần nêu các đầu vào ở giới hạn/ngoại lệ.
```

Các nhãn `Dạng:` có hỗ trợ alias tiếng Việt cho trắc nghiệm, nhiều đáp án, đúng/sai, điền khuyết, tự luận, ghép đôi, sắp xếp, đọc hiểu, nghe/nói, lập trình và thực hành. Nếu tài liệu có question blocks, hệ thống nhận diện thành ngân hàng câu hỏi ngay cả khi chỉ có một câu.

Sau preview, bấm **Lưu bản nháp**. Nội dung không được tự gắn nhãn official và chưa được tự công bố. Assessment không cho publish nếu thiếu câu hỏi hoặc câu khách quan thiếu đáp án.

## 3. Cấu hình hồ sơ

`EducationProfile` hỗ trợ thêm tên trường/khoa/lĩnh vực/nhóm ngành/ngành/chuyên ngành/chương trình cùng provenance. Cấp `SELF_STUDY` được hỗ trợ để lựa chọn “Đã tốt nghiệp / đi làm / tự học” không bị mất giá trị do enum.

## 4. Migration và triển khai

1. Sao lưu MongoDB trước khi cập nhật production.
2. Deploy toàn bộ mã V21.
3. Đảm bảo MongoDB kết nối được khi khởi động để migration 011 seed survey và placement catalogs.
4. Kiểm tra `/survey.html`, `/placement.html`, `/profile.html`, `/lo-trinh-hoc-tap.html` và `/admin/index.html` → “Tạo nội dung / Nhập Word”.
5. Đăng nhập tài khoản có quyền `learning.question.import` để dùng importer.
6. Survey/placement seed chỉ tạo record nếu chưa có record cùng identity; migration không xóa attempts, hồ sơ, hoặc Learning Plan cũ.

## 5. Kiểm thử

- `npm test`: regression từ V13 tới V21.
- `npm run validate`: kiểm tra cú pháp JavaScript, inline script, asset references và Phase 2 routes/schema/migration + content tests.
- `npm run validate:legacy`: giữ bộ kiểm tra lịch sử cũ để tham khảo các quy ước giao diện cũ; bộ này có thể báo các lỗi baseline không thuộc Phase 2 nếu những trang legacy chưa nạp các lớp UI/AdSense tương ứng.


## 6. Phase 2 hardening — V21.1.0

- Survey `PUBLISHED` phải qua validator: tiêu đề, mô tả, version, câu hỏi, ít nhất một câu required, mã câu hỏi duy nhất, question type hợp lệ và options hợp lệ với loại objective. Survey sai cấu trúc không xuất hiện như nội dung hợp lệ cho người học; Admin hiển thị `INVALID / NEEDS_REPAIR` và lỗi cần sửa.
- Kiểm tra required theo nhánh đang hiện; câu hỏi bị ẩn theo câu trả lời trước không bị yêu cầu hoặc lưu nhầm trong attempt. UI hiển thị riêng số câu hỏi và số nhóm, tránh thông báo gây hiểu nhầm `0 nhóm câu hỏi`.
- Placement chọn từng câu theo skill coverage, difficulty và câu đã hỏi; API không trả đáp án chuẩn/rubric/hidden test cases về client. Bài chỉ dừng sau khi đủ độ phủ tối thiểu hoặc đã dùng question pool.
- Assessment submission ngoài placement cũng cập nhật skill mastery và Learning Plan version. TOEIC/IELTS kết quả luyện tập được ghi trong hồ sơ kỹ năng riêng với evidence và cờ `reviewRequired`; không bị ghi nhận là điểm thi chính thức. Bài tự luận/nói yêu cầu review không bị sử dụng như điểm auto-scored.
- Test `scripts/test-v21-phase2-hardening.js` bổ sung các trường hợp survey sai, option đúng/sai không hợp lệ, nhánh ẩn, adaptive coverage, bảo vệ đáp án, provenance, profile TOEIC/IELTS và mục tiêu ngành học trong kế hoạch.

Không có Course Factory mới được thêm ở Phase 2. Đồng bộ nội dung thực tế trên MongoDB production vẫn cần chạy/kiểm tra trong môi trường đã sao lưu.

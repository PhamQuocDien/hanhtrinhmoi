# Hành Trình Mới — V8.0.4

V8.0.3 tập trung nâng chất lượng trải nghiệm học CNTT trên 34 khóa học và 414 bài học. Mỗi khóa hiện có bản thiết kế đầu ra, các mốc sản phẩm theo module, đồ án tổng hợp và rubric 100 điểm; mỗi bài có hướng dẫn học theo thời lượng, từng bước thực hành, mức hỗ trợ/mở rộng, câu tự kiểm tra và rubric riêng. Code Lab đã bỏ mẫu mặc định chỉ đọc rồi in lại input để chuyển sang scaffold gắn với chủ đề bài học. Những học liệu và câu hỏi sinh tự động vẫn ở trạng thái nháp cần giảng viên thẩm định.

## V8.0.4 — khóa CNTT toàn màn hình

Bản này sửa lại trải nghiệm xem khóa CNTT thành workspace phủ toàn bộ viewport, giữ header/action bar dễ truy cập, tối ưu trên điện thoại và gắn phiên bản cho `career.css`/`career.js` để tránh cache giao diện cũ. Xem `V8.0.4_RELEASE_NOTES.md`.

## V8.0.3 — nâng chất lượng học liệu CNTT

- Bổ sung blueprint chất lượng khóa học cho cả 34 khóa: đầu ra, tiên quyết, chặng học, minh chứng sản phẩm, đồ án cuối khóa và rubric chấm tổng 100 điểm.
- Thêm hướng dẫn học tập cho 414/414 bài: kiến thức nền, mục tiêu có thể kiểm chứng, lịch phân bổ thời gian, checklist thực hành, bài tập ba mức, câu hỏi tự kiểm tra và rubric 100 điểm.
- Cải thiện ánh xạ lý thuyết: khi tên/mục tiêu bài chưa đủ đặc trưng, bộ tạo lý thuyết có thể dùng tên module làm ngữ cảnh trước khi rơi về khái niệm dự phòng.
- Thay các mẫu Code Lab mặc định chỉ echo input bằng bộ khung theo nhóm nhiệm vụ như thuật toán/cấu trúc dữ liệu, mô hình đối tượng, validation/API, SQL, HTML và CSS. Mã mẫu cố ý để TODO rõ ràng, không giả vờ hoàn thành bài tập.
- Bổ sung audit `npm run audit:it-course-quality` và test bao phủ đầu ra, rubric, thời lượng học, module milestones và code scaffold.
- Không tự kích hoạt câu hỏi chưa duyệt và không tuyên bố khóa học là đề cương chính thức/đã kiểm định.

## V8.0.2 — bài kiểm tra cuối khóa CNTT và cải thiện khả năng đọc

- Bổ sung bài kiểm tra cuối khóa cho cả 34 khóa CNTT; chỉ mở khi người học hoàn thành toàn bộ bài học trong khóa.
- Bài thi dùng câu hỏi đã được giáo viên duyệt/kích hoạt và yêu cầu tối thiểu 10 câu hợp lệ; không tự động công khai câu hỏi nháp.
- Bổ sung lưu/khôi phục bài thi cuối khóa đang làm và xử lý kết quả trong đúng vùng hiển thị.
- Phóng lớn cửa sổ khóa học, tăng cỡ chữ và chuyển sang một vùng cuộn chính để nội dung không còn trông như màn hình thu nhỏ.
- Thêm kiểm thử điều kiện hoàn thành khóa và ngưỡng câu hỏi tối thiểu.

## V8.0.1 — bản sửa lỗi triển khai Render và đăng ký

- **Sửa `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`:** phát hiện môi trường Render ngay cả khi `NODE_ENV` chưa đặt là `production`; cấu hình `trust proxy` theo số hop, mặc định 1 trên Render và false khi chạy local trực tiếp. Không dùng `trust proxy=true` cho mọi proxy. Log khởi động hiển thị giá trị thực để xác minh.
- **Sửa `E11000 ... index: username_1 dup key: { username: null }`:** mô hình hiện tại định danh người dùng bằng email và không còn trường `username`. Khi kết nối MongoDB, bản V8.0.1 tự gỡ chỉ mục unique một trường `username` cũ nếu schema vẫn không dùng trường này. Thao tác chỉ thay đổi index, không xóa/đổi tài liệu tài khoản.
- **Migration thủ công:** `npm run migrate:user-indexes` để kiểm tra/gỡ chỉ mục cũ trên database được chỉ định trong `MONGO_URI` (sao lưu trước khi chạy). Nếu tài khoản MongoDB không có quyền `dropIndex`, migration báo lỗi rõ ràng và cần cấp quyền phù hợp.
- **Thông báo đăng ký rõ hơn:** lỗi duplicate key được phân loại theo trường (`username`, `email` hoặc trường khác), không còn biến mọi lỗi chỉ mục thành “email đã được dùng”.
- **Production trên Render:** được nhận diện từ `RENDER_EXTERNAL_HOSTNAME`/các biến môi trường Render, để cookie `Secure` và kiểm tra secret không phụ thuộc riêng vào `NODE_ENV`.

### Cấu hình Render cần kiểm tra

1. Trong **Render → Service → Environment**, đặt `TRUST_PROXY_HOPS=1` nếu service đi qua một proxy hop như cấu hình Render Web Service thông thường. Để trống thì ứng dụng tự nhận diện Render; `0` chỉ dành cho máy chủ được truy cập trực tiếp không qua proxy. Nếu kiến trúc proxy của bạn khác, chọn đúng số hop thực tế.
2. Kiểm tra `MONGO_URI`: log lỗi cũ cho thấy collection là `test.users`, tức kết nối đang dùng database tên `test`. Nếu đó không phải database chủ đích, sửa đường dẫn database trong URI trước khi chạy migration; không chạy migration nhầm database.
3. Sau deploy, log mong đợi có dòng `Hanh Trinh Moi V8.0.1 ... (trust proxy: 1, production: true)` và `/api/health` trả `version: 8.0.1`.
4. Nếu startup không thể drop index do thiếu quyền, sao lưu dữ liệu rồi chạy `npm run migrate:user-indexes` với tài khoản MongoDB có quyền quản trị chỉ mục. Không xóa người dùng để xử lý lỗi này.


## Có gì mới trong V8.0.0?

- **Lý thuyết hiển thị rõ ràng:** trang bài học có khu vực “Lý thuyết trọng tâm” gồm khái niệm cốt lõi, kiến thức cần nhớ, ví dụ có hướng dẫn, cách học/vận dụng, lỗi thường gặp và câu tự kiểm tra.
- **Căn chỉnh theo ngữ cảnh bài:** bộ chọn ưu tiên tên bài, sau đó là mục tiêu học tập và chủ điểm. Những chủ đề dễ bị hiểu nhầm đã có quy tắc riêng (ví dụ đọc câu ngắn không bị ánh xạ nhầm thành thơ; quy luật dãy số không bị nhầm thành phép tính; nội dung an toàn thực hành, di truyền, bản quyền, grammar, dữ liệu và các chủ đề CNTT có giải thích tương ứng).
- **Phổ thông lớp 1–12:** 4.764 bài học được kiểm tra, mỗi bài có đối tượng `theory` gồm sáu phần, ví dụ và ghi chú nguồn.
- **CNTT đại học:** 414 bài thuộc 34 khóa học / 9 nhóm ngành có lý thuyết chuyên đề, ví dụ minh họa và từng bước thực hành; các chủ đề cụ thể như validation, đọc/ghi tệp, đồ thị BFS/DFS, dữ liệu bất thường, kiểm soát bảo mật, cache, RPO/RTO, webhook, idempotency và mobile state được bổ sung.
- **Kiểm tra độ phủ:** `npm run audit:theory` xác minh số lượng bài, cấu trúc sáu phần, ví dụ, trạng thái cần thẩm định và loại bỏ trường hợp lý thuyết chung chung theo môn/nhóm nghề.
- **Kiểm thử hồi quy:** có test đảm bảo API công khai giữ trường `theory`, giao diện gọi hàm hiển thị, và 5.178 bài phổ thông + CNTT có lý thuyết qua các bộ sinh hiện tại.

## Lý thuyết được hiển thị ở đâu?

1. Người học mở một bài từ trang **Lộ trình học**.
2. Sau khi bài tải thành công, khối **Lý thuyết trọng tâm** xuất hiện ngay bên dưới tiến độ và phía trên video.
3. Đọc sáu phần lý thuyết, xem video nếu đã có, rồi học bốn phần nội dung và làm checkpoint.
4. Với bài CNTT đại học, mở ngành/khóa học, chọn bài; thẻ **Lý thuyết chuyên đề** nằm trong chi tiết bài cùng mục tiêu, ví dụ, thực hành và Code Lab.

Nếu trang web cũ vẫn đang chạy, hãy dừng tiến trình cũ, giải nén phiên bản này vào một thư mục riêng, chạy kiểm tra và khởi động lại đúng thư mục. Trình duyệt cũng nên được tải lại cứng (Ctrl+F5) để tránh dùng JavaScript/CSS từ cache cũ.

## Cấu trúc quan trọng

```text
content/quality/
└── theory-content.js               # Bộ sinh lý thuyết theo chủ đề
content/curriculum/
├── primary/primary-curriculum.js   # Lớp 1–5
├── lower-secondary/                # Lớp 6–9
└── high-school/                    # Lớp 10–12
content/career-paths/catalog.js     # Bài học CNTT đại học + lý thuyết chuyên đề
content/quality/it-course-quality.js # Đầu ra, hướng dẫn học và rubric cho 34 khóa / 414 bài
scripts/database/audit-it-course-quality.js # Audit chất lượng học liệu CNTT
apps/web/lesson.html                # Khu vực hiển thị lý thuyết phổ thông
apps/web/src/js/lesson.js           # Render theory sections
apps/web/src/css/lesson.css         # Giao diện khối lý thuyết
apps/web/src/js/career.js           # Render lý thuyết các bài CNTT
scripts/database/audit-theory-content.js
apps/api/test/theory-content-v800.test.js
```

## Kiểm tra dự án

Yêu cầu Node.js 20 trở lên. Trong PowerShell tại thư mục dự án:

```powershell
Copy-Item .env.example .env
npm install
npm test
npm run check
npm run audit:theory
npm run audit:it-course-quality
```

Lệnh audit chạy cục bộ, không cần MongoDB hay API AI. Khi chạy ứng dụng thật, cấu hình `MONGO_URI`, `ADMIN_PASSWORD`, `SESSION_SECRET` và các dịch vụ cần thiết trong `.env`; không đưa `.env` thật lên GitHub.

## Định dạng lý thuyết

Hàm `buildSchoolTheory()` trả một object gồm:

- `version`, `title`, `subjectName`, `grade`, `educationLevel`;
- `matchContext` để biết đối tượng được chọn từ tên bài, mục tiêu hay chủ điểm;
- `status: "draft-teacher-review-required"`;
- `summary`, `quickReview`, `sourceNote`;
- sáu section: `concept`, `principles`, `worked-example`, `method`, `misconceptions`, `self-check`.

Hàm `buildUniversityTheory()` trả sáu section: mô hình tư duy, khái niệm/quy tắc, ví dụ, thực hành, sản phẩm bàn giao và lỗi thường gặp. Public API giữ phần lý thuyết nhưng không trả đáp án riêng tư của ngân hàng câu hỏi.

## Giới hạn về chất lượng và nguồn

Nội dung giải thích được biên soạn mới theo chủ đề và metadata học tập của dự án, không sao chép nguyên văn sách giáo khoa. Hệ thống đối chiếu theo môn, lớp, tiêu đề, mục tiêu và chủ điểm; đây là **căn chỉnh theo ngữ cảnh và khung tham chiếu**, không phải chứng nhận của Bộ GD&ĐT hoặc tổ chức kiểm định nào. Giáo viên cần xác minh yêu cầu cần đạt, bộ sách, tập/chương/trang và ví dụ trước khi phát hành chính thức.

Kiểm toán thành công chứng minh bài học có nội dung lý thuyết theo quy tắc, đủ phần và có ví dụ; nó không thể tự bảo đảm mọi phát biểu học thuật đều đúng trong mọi bối cảnh. Không nạp hoặc bật tự động nội dung nháp cho học sinh nếu chưa được người dạy duyệt.

## Lưu ý về gói phát hành

V8.0.1 được tạo trực tiếp từ snapshot V8.0.0 đang được dùng làm nền triển khai, giữ các khóa học, lý thuyết, giao diện và mô-đun hiện có; chỉ bổ sung bản sửa proxy, migration index người dùng cũ, xử lý lỗi đăng ký và kiểm thử hồi quy.

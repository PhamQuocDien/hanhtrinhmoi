# MIGRATION_ANALYSIS — Hành Trình Mới V34

**Ngày rà soát:** 10/10/2026  
**Bản đầu vào:** ZIP `hanhtrinhmoi_v34_upgraded(3).zip` (package version V35.0.0); bản source không chứa thư mục `.git`.  
**Phạm vi xác minh:** source code, dữ liệu seed/tĩnh và test tự động trong bản làm việc. Không có kết nối production MongoDB, quyền GitHub hoặc quyền Render trong phiên này.

## 1. Hiện trạng và giới hạn bằng chứng

- Source ban đầu đã có Express/Mongoose, nhiều phiên bản migration, nhiều module bài học/bài kiểm tra, CMS quản trị dạng biểu mẫu, AI worker, code runner tách biệt/Judge0 và bộ kiểm thử hồi quy.
- Không thể xác nhận nhánh, commit đầu vào, thay đổi chưa commit hoặc trạng thái deploy, vì ZIP không chứa metadata Git và không có connector/quyền truy cập repository/deployment.
- Các số liệu migration được nêu trong yêu cầu (144 khóa học, 2.980 bài học, 18.000 câu hỏi, 21.600 câu hỏi nguồn, 54 đánh giá, một bài kiểm tra đầu vào, không có câu hỏi chẩn đoán) là log do người dùng cung cấp, **không phải số liệu được truy vấn trực tiếp từ database hiện tại**.
- Không chạy migration dữ liệu production, không xóa dữ liệu database và không thay đổi dữ liệu đang triển khai. Vì vậy chưa thể báo cáo số bản ghi trước/sau hoặc khẳng định các liên kết trong production đã sạch.

## 2. Các lỗi/nguy cơ thấy được trong source và đã xử lý

### 2.1 Tiến độ bài học có thể bị khai báo từ client

**Nguy cơ:** giao diện tiến độ cũ dùng thao tác checklist/lưu local để biểu diễn hoàn thành. Backend cũng nhận payload tiến độ từ client nếu không tính lại từ dữ liệu đánh giá.

**Thay đổi:**
- Thêm `server/services/lesson-progress-service.js`; backend tính trạng thái từ đánh giá đã công bố, lượt thi đã nộp, điểm đạt ngưỡng và bài thực hành có bằng chứng đạt.
- `REVIEW_REQUIRED`, bài chưa nộp, bài đang chờ chấm, bài không đạt hoặc kết quả yêu cầu review không được tính là hoàn thành.
- Cập nhật API `/api/learning/lesson-progress` để trả ảnh chụp tiến độ tính từ server; endpoint cập nhật cũ bỏ qua `completedSteps`/`progressPercent` do client gửi.
- `assets/js/learning/lesson-progress.js` không còn checkbox đánh dấu hoàn thành hoặc ghi nhận hoàn thành vào `localStorage`. Nội dung/hoạt động chỉ để trình bày; tiến độ chính thức tải từ API.
- Lượt thi và bài chấm đạt được đồng bộ lại tiến độ sau khi nộp/chấm.

**Giới hạn hiện tại:** logic đang xác nhận theo đánh giá cuối bài đã công bố và các `PracticeTask` được gắn với bài; chưa triển khai mô hình đánh giá riêng bắt buộc cho *mọi tiểu mục* và chưa có một ma trận rubric đa dạng cho toàn bộ môn học. Bài học chưa có assessment/test phù hợp sẽ được báo thiếu cấu hình chứ không tự động xác nhận hoàn thành.

### 2.2 Lượt thi có thời hạn, lưu và khôi phục câu trả lời

**Thay đổi:**
- Khi tạo lượt thi, server lưu `startedAt` và `expiresAt`.
- Khi mở lại bài, route phục hồi lượt `IN_PROGRESS` hiện có và trả câu trả lời đã lưu, thay vì mặc định tạo lượt khác.
- Thêm API `PUT /api/assessment/attempts/:id/answers` để tự lưu bản nháp câu trả lời về backend, chỉ chấp nhận key thuộc câu hỏi của assessment.
- `assessment.html` tự lưu câu trả lời theo debounce, khôi phục câu trả lời khi resume và chạy đồng hồ theo thời điểm hết hạn từ server.
- Khi đã quá hạn, backend chấm snapshot đã lưu ở server và bỏ qua câu trả lời mới gửi từ client sau deadline.

**Giới hạn hiện tại:** lượt hết giờ được chốt khi client quay lại/nộp bài; chưa có worker riêng định kỳ đóng các lượt hết hạn khi người học đã đóng trình duyệt. Cần smoke test bằng database thật để xác nhận tất cả loại câu hỏi (đặc biệt matching/ordering/code upload) được lưu/khôi phục đúng theo data shape production.

### 2.3 Job tạo ảnh/âm thanh có thể được xếp hàng lại khi mở trang

**Nguy cơ:** các luồng truy cập nội dung đặt lại job về `QUEUED`, có khả năng khiến job đã thất bại vì quota bị thử lại mỗi lần mở bài.

**Thay đổi:**
- Thêm `server/services/generation-job-queue.js` để tạo job idempotent theo `idempotencyKey`; nếu job đã tồn tại thì trả lại trạng thái hiện có thay vì tự reset.
- Cập nhật luồng tạo media ở `server/services/ai-learning-service.js` và `server/routes/ai-learning-routes.js` dùng queue idempotent.
- API trạng thái media phản ánh trạng thái job thực, không giả lập tất cả là `QUEUED`.
- Bổ sung endpoint quản trị retry job `FAILED` có kiểm tra quyền và ghi audit; retry là hành động tường minh, không phải tác dụng phụ của việc xem bài.

**Giới hạn hiện tại:** chưa kết nối để xác minh quota live của Gemini hoặc dịch vụ TTS; job vẫn có thể thất bại nếu quota/model không khả dụng. Cần đánh giá log job tại môi trường triển khai và chỉ retry khi nguyên nhân đã được xử lý.

### 2.4 Số lượng và chủ đề bài học bị lặp

**Thay đổi trong lượt sửa này:** `server/services/local-course-composer.js` loại bỏ bài trùng chủ đề khi đọc chương trình K12; số bài tạo ra phụ thuộc vào các chủ đề khác nhau thực sự có trong catalog (ví dụ Toán lớp 5 có 10 chủ đề riêng, không nhân bản thành 12). TOEIC Part 1–7 có cấu trúc bài riêng theo từng Part; MOS Excel/Word/PowerPoint chỉ lấy lộ trình của ứng dụng được yêu cầu. `server/modules/rich-learning-content-v20.js` được chỉnh regex phân loại chủ đề để “bước” không bị nhận nhầm thành từ khóa “ước/bội”, nguyên nhân khiến câu hỏi chia hết xuất hiện trong bài chuyển động đều. Validator khóa học chặn trùng tên bài và câu hỏi trùng trong một bài/giữa các bài. Các test được cập nhật để kiểm tra tính liên quan và không ép K12 phải có 12 bài.

**Giới hạn hiện tại:** catalog cụ thể vẫn có thể thiếu chủ đề hoặc ví dụ chuyên môn; một số dạng câu hỏi luyện tập vẫn là bộ sinh cục bộ theo mẫu. Không coi việc vượt validator là chứng nhận chất lượng toàn bộ nội dung; cần tiếp tục duyệt chuyên môn và đối chiếu nguồn trước khi công bố chính thức.

### 2.5 Bảo toàn dữ liệu khóa học cá nhân chưa đạt kiểm tra

**Thay đổi:** khi khóa học cá nhân chưa đủ điều kiện materialize/publish, luồng không gọi xóa toàn bộ course/lesson/question/attempt/progress để tự sinh lại. Thay vào đó trả lỗi có mã `AI_COURSE_MATERIALIZATION_INCOMPLETE` và giữ dữ liệu để quản trị viên kiểm tra/sửa.

**Lý do:** tránh mất dữ liệu và lịch sử người học khi một lần sinh nội dung chưa đạt chất lượng.

### 2.6 Worker AI và tính lặp an toàn khi materialize khóa học

- `server/services/ai-generation-worker.js` nhập `ensurePersonalCourse` trực tiếp từ `ai-learning-service.js`, sửa lỗi `ensurePersonalCourse is not defined` được nêu trong log.
- `materializeCourse` sử dụng fingerprint để định danh khóa học và tiếp tục bản ghi chưa đủ nội dung thay vì xóa khóa, bài học, câu hỏi, lượt thi hoặc tiến độ.
- Khi lưu bài học, code kiểm tra khóa unique thực tế `{ curriculumVersionId, type, code }`; nếu code đã thuộc bản ghi khác thì tạo code có hậu tố ổn định theo khóa hiện tại. Nhánh duplicate-key được xử lý hữu hạn và chỉ cập nhật lại bản ghi nếu nó thuộc đúng khóa học.
- Các bài kiểm thử mới mô phỏng logic và xác minh cấu trúc mã nguồn; chưa chạy được phép thử tích hợp với MongoDB production, vì vậy vẫn cần chạy lại tác vụ `PERSONAL_COURSE` trên staging và kiểm tra index/dữ liệu thật.

### 2.7 Phục vụ tệp công khai, rate limiting, logging và phạm vi game

- `server.js` không còn phục vụ nguyên thư mục repository bằng một `express.static(__dirname)` không giới hạn. Tài nguyên gốc được giới hạn theo danh sách HTML/tệp tĩnh, `server.js`, package metadata và các tệp env bị chặn; thư mục `assets` tiếp tục phục vụ riêng. Các trang cờ Caro, Cờ Tỷ Phú, Cờ vây, Othello, trang chọn game cũ và đấu trường cũ trả về trạng thái không khả dụng.
- `server/middleware/api-rate-limiter.js` bổ sung giới hạn theo IP và tài khoản cho các loại request nhạy cảm, có `Retry-After` và cấu hình qua biến môi trường.
- `server/middleware/request-logger.js` ghi log JSON ra stdout; không ghi body, mật khẩu hoặc header xác thực.
- Khu vực giải trí chỉ trình bày cờ vua; các endpoint/kênh Socket.IO cho game bàn cờ cũ bị chặn, còn route giải đấu chỉ chấp nhận cờ vua. Code cũ và một số trường thống kê vẫn còn trong `server.js` để tương thích dữ liệu; chưa xóa vật lý các module đó vì ZIP không có lịch sử Git/điểm khôi phục xác minh được.
- Thêm `.github/workflows/ci.yml` chạy `npm ci`, `npm test` và `npm run validate`; không thêm deploy hook mới vì Render đã có cơ chế auto-deploy theo cấu hình source.

### 2.8 Tài liệu và môi trường cục bộ

- Đồng bộ thông tin README về V35.0.0.
- Làm sạch `.env.example` để chỉ có một cấu hình `CODE_RUNNER_ENABLED` và khai báo endpoint executor là tùy chọn; code runner vẫn tắt mặc định nếu chưa cấu hình sandbox.
- Đã thử khởi động HTTP server cục bộ nhưng runtime trong sandbox thiếu package `dotenv` trong `node_modules` (mặc dù `package.json` và `package-lock.json` khai báo dependency). Do npm registry không khả dụng trong lần kiểm tra, không thể hoàn tất smoke test HTTP thật ở môi trường này. Không suy diễn lỗi đó thành lỗi cấu hình production.

## 3. Kiểm thử và xác minh local

Đã chạy sau các thay đổi:

- `npm test` — toàn bộ chuỗi test hồi quy đã chạy thành công, gồm các bài test V13–V33 hiện có và test V34 mới.
- `node scripts/test-v34-learning-integrity.js` — **7/7 test PASS**.
- `npm run check` — **PASS** sau các thay đổi V34; chạy toàn bộ chuỗi test đã gắn trong script `check`.
- `npm run validate` — **PASS**, kiểm tra **53 trang HTML và 143 file JavaScript**; các kiểm tra route/migration/các phase học tập được phát hiện.
- `node --check` cho **143/143 file JavaScript** — PASS.
- `node scripts/test-v34-remediation.js` — **8/8 test PASS**, gồm kiểm tra source tĩnh an toàn, rate limit/logging, khóa học cá nhân Debug & kiểm thử, TOEIC/MOS đúng chủ đề, import worker, tránh ghép nhầm bài và phạm vi cờ vua.
- `npm run validate:legacy` — **FAIL: 106 cảnh báo/lỗi theo quy tắc cũ**. Các kiểm tra này yêu cầu thành phần V11–V14 đã lỗi thời và gắn AdSense publisher cứng vào mọi trang; không dùng kết quả này để thêm lại markup cũ hoặc chèn quảng cáo. Cần cập nhật validator cũ theo cấu trúc hiện tại trong một việc riêng.
- Test Judge0 kiểm tra tích hợp qua mock; chưa phải xác minh live endpoint từ Render.

Các test này xác minh source và logic với fixture/mock; không thay thế kiểm thử end-to-end qua production database, API Gemini/OpenAI, Judge0 hoặc trình duyệt thật.

## 4. Các yêu cầu V34 chưa thể tuyên bố hoàn thành

1. **Database/migration production:** chưa kết nối DB nên chưa kiểm đếm dữ liệu thật, chưa xác định được nguồn collection production đang dùng, số liên kết lỗi, duplicate hoặc chuyển đổi đã chạy tới đâu.
2. **Ngân hàng 50–100 câu hỏi cho mỗi bài:** chưa được bảo đảm. Không tự nhân bản câu hỏi hoặc tạo đáp án giả để đạt số lượng. Cần audit theo bài/chủ đề/độ khó, bổ sung draft có kiểm chứng và duyệt trước xuất bản.
3. **Kiểm tra từng tiểu mục:** tiến độ mới dựa trên bài đánh giá và practice tasks gắn với bài; chưa có assessment riêng bắt buộc cho từng section ở mọi khóa.
4. **AI grading fallback Gemini → OpenAI → nội bộ:** chưa xác minh được gọi API live, quota và chất lượng rubric end-to-end. Không được tuyên bố OpenAI hoạt động chỉ vì có biến key; cần API và kiểm tra kết quả thực tế.
5. **AI chấm code:** điểm cuối vẫn phải do sandbox/test và rubric của bài quyết định; AI không được thay thế test. Những bài không có test hợp lệ phải ở trạng thái cần cấu hình/review.
6. **TTS/image:** có sửa requeue, trạng thái và retry thủ công nhưng chưa kiểm tra được các quota/model đang cấu hình trong production.
7. **Admin CMS:** source hiện có các biểu mẫu CMS theo test hồi quy, nhưng chưa audit từng màn hình/endpoint trong production để chứng minh mọi trường cấu hình (đặc biệt ngân hàng lớn, rubric động và prerequisite graph) đều được chỉnh sửa đầy đủ qua giao diện.
8. **Lịch sử thi/analytics/định hướng:** chưa thực hiện kiểm thử E2E với tài khoản học viên và dữ liệu thật cho tất cả yêu cầu mới.
9. **GitHub/Render:** chưa commit, push hoặc deploy vì không có Git metadata/quyền truy cập; không khẳng định ứng dụng đang chạy phiên bản V34.

## 5. Cách áp dụng an toàn

1. Sao lưu MongoDB production và kiểm tra bản sao có thể khôi phục trước khi chạy migration.
2. Đưa ZIP vào nhánh/staging có lịch sử Git chính thức; review diff với repository hiện tại trước khi ghi đè bất cứ thay đổi nào.
3. Cấu hình secrets trong Environment, không đưa `.env` vào repository/ZIP công khai.
4. Triển khai staging có database bản sao; chạy `npm test` và `npm run validate`, rồi smoke test luồng học bài, thi có giờ, resume, nộp bài, chấm code, media job và quyền quản trị.
5. Chỉ sau khi xác nhận dữ liệu và API thực tế mới chạy migration production theo từng bước có backup/rollback.
6. Sau deploy, xác minh commit SHA, log ứng dụng, kết nối database, `/api/ai-learning/code/status` và lỗi API; ghi số lượng bản ghi trước/sau bằng truy vấn thật.

## 6. Kết luận

Bản V34 trong ZIP là một bản source đã sửa một số lỗi nền tảng có thể xử lý an toàn mà không cần đụng dữ liệu production: tiến độ bằng chứng từ server, resume/autosave bài thi, idempotent media jobs, số lượng bài theo track và bảo toàn khóa học cá nhân chưa đạt. Bộ test local và validator đều đạt. **Đây chưa phải nghiệm thu hoàn chỉnh toàn bộ 28 nhóm chức năng của yêu cầu V34 và chưa phải bản đã deploy production.** Các phần chưa xác minh được liệt kê minh bạch ở trên để tránh báo cáo thành công giả.

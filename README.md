
## V29.0.0 — Phase 1: Nền tảng và tính nhất quán dữ liệu

- Đăng ký/hồ sơ: xác thực ngày sinh theo lịch, tính tuổi phía máy chủ, đồng bộ hồ sơ mới với tài khoản legacy và cho phép xóa ngày sinh có chủ đích.
- Survey → placement: đề xuất đúng bài kiểm tra theo cấp/lớp, mục tiêu TOEIC/IELTS/MOS hoặc ngành đại học; không tự chọn bài đầu tiên khi không đủ dữ liệu.
- Placement: máy chủ kiểm tra mã câu hỏi, câu trả lời bắt buộc và độ phủ tối thiểu theo từng kỹ năng trước khi chấm.
- Chấm điểm: so sánh đáp án theo cấu trúc dữ liệu có kiểu; nhiều đáp án không phụ thuộc thứ tự; câu thiếu đáp án chuẩn, tự luận, nói và lập trình được đánh dấu cần rà soát thay vì đoán đúng/sai.
- Admin tiếp tục dùng biểu mẫu trực quan; không yêu cầu người soạn nội dung chỉnh JSON. JSON vẫn có thể được dùng làm định dạng truyền dữ liệu của API, nhưng không còn dùng so sánh chuỗi JSON để quyết định đúng/sai trong scorer này.

Kiểm tra: `npm test` và `npm run validate`.

## V29.0.0 — Nội dung thực học, mở khóa tuần tự và bài nộp

- Sau xác minh OTP đăng ký, học sinh được chuyển tới khảo sát để xây lộ trình; tuổi được tính từ ngày sinh phía server.
- Catalog khóa học tải tóm tắt trước, nội dung theo từng bài sau khi mở; bài kế tiếp cần đạt bài kiểm tra trước.
- Bài luyện có thể nhận bài nộp, trạng thái chờ chấm, điểm và nhận xét; Admin/giáo viên có hàng đợi chấm.
- Admin xem chi tiết và xóa tài khoản học sinh có xác nhận/audit; CMS dùng biểu mẫu thay vì sửa JSON thủ công.
- Nội dung Toán 12 về tính đơn điệu/cực trị có câu hỏi, ví dụ giải, bài độc lập, vận dụng và rubric bám chủ đề; catalog tự sinh các môn khác vẫn cần giáo viên rà soát trước khi công bố.
- DOCX upload nhị phân, giới hạn kích thước; media polling có giới hạn; readiness kiểm tra migration.
- Xem `UPGRADE_V29_COMPLETION.md` để biết thay đổi, test và giới hạn triển khai. Dự án vẫn cần smoke test với MongoDB/Render thật trước production.

## V16.0.0 — AI Learning Autopilot
AI tự phân tích theo trang và hoạt động API trong toàn bộ trải nghiệm; xem `UPGRADE_V16_0_0.md`.
# Hành Trình Mới

Nền tảng Node.js/Express + MongoDB/Mongoose + session + Socket.IO cho học tập cá nhân hóa từ lớp 1–12, đại học và luyện thi tiếng Anh.

Phiên bản source hiện tại: **V39.0.0**. Xem [UPGRADE_V39_RELEASE.md](UPGRADE_V39_RELEASE.md) và [TEST_REPORT_V39.md](TEST_REPORT_V39.md) cho luồng onboarding theo độ tuổi, khảo sát tự phục hồi và diagnostic đa lĩnh vực. Xem [UPGRADE_V30_COMPLETION.md](UPGRADE_V30_COMPLETION.md) cho lịch sử nền V30, [UPGRADE_V33_RESILIENCE_ONBOARDING.md](UPGRADE_V33_RESILIENCE_ONBOARDING.md), [UPGRADE_V32_SMART_LEARNING.md](UPGRADE_V32_SMART_LEARNING.md) và [MIGRATION_ANALYSIS.md](MIGRATION_ANALYSIS.md) cho các thay đổi, giới hạn và kết quả kiểm thử đã ghi nhận.

Repository đang được chuyển đổi từng bước từ monolith game/học tập sang kiến trúc platform. Các route game, learning, tournament, parent và admin cũ được giữ để tương thích; platform routes mới được mount song song.

## V36.0.0 — Release hardening và kiểm thử hồi quy

- Đồng bộ phiên bản runtime, package, lockfile, endpoint learning-system và cache key trình duyệt lên V36.
- Bổ sung `.env.example` cho ứng dụng và executor riêng để giảm lỗi thiếu cấu hình khi chạy kiểm thử/triển khai; không chứa khóa API thật.
- Thêm kiểm thử hồi quy V36 cho tính nhất quán phiên bản, mẫu cấu hình, giới hạn an toàn của code runner, lịch sử chấm tự luận, thời hạn bài kiểm tra và tiến độ theo bằng chứng.
- Giữ code runner tắt mặc định trên Render. Chỉ bật sau khi triển khai executor cô lập riêng, cấu hình token/URL riêng tư và xác nhận endpoint health báo `isolated: true`; không chạy mã người học trực tiếp trong tiến trình web.
- Các kiểm thử nguồn không thay thế smoke test với MongoDB, API AI, Docker executor và Render thực tế. Xem `docs/TEST_REPORT_V36.md` để phân biệt kết quả tự động với các phần chưa xác minh.

## Chạy ứng dụng

Yêu cầu Node.js 20.x, MongoDB URI và session secret phù hợp.

```cmd
npm install
npm start
```


## V26.0.0 — Phase 4, 5, 6

- **Phase 4 — Tích hợp/an toàn:** readiness tách khỏi liveness, secret session không đoán được, lưu tiến độ theo tài khoản, rate limit AI/code API và không chạy code người dùng trực tiếp trên web process production theo mặc định.
- **Phase 5 — Trải nghiệm học từng bước:** trang bài học chia phần lý thuyết/ví dụ/luyện tập/lab/quick check, checklist tiến độ lưu theo tài khoản khi dữ liệu thuộc catalog có ID MongoDB; có localStorage dự phòng cho catalog legacy hoặc lúc API không khả dụng.
- **Phase 6 — Local AI:** trợ giảng nội bộ truy xuất từ các bài học đã công bố, hiển thị nguồn và không đoán khi thiếu bằng chứng. Có thể kết nối Ollama trên host nội bộ để tăng khả năng diễn giải. Không kèm model weights; retrieval-only hoạt động không cần API cloud.
- Lệnh kiểm tra: `npm test` và `npm run validate`.
- Xem `docs/PHASE4_5_6_RUNBOOK.md` và `UPGRADE_V26_PHASE4_5_6.md` trước khi triển khai.

## Implementation foundation

- Auth/profile validation, OTP và RBAC backend.
- Curriculum version/source registry và K12 content hierarchy.
- University hierarchy, question bank, assessment, attempt/submission.
- Survey, placement, personal learning plan và mastery.
- TOEIC/IELTS config và diagnostic estimate.
- National exam blueprint, Word import preview/validate/commit.
- Notification, audit, gamification event, achievement/reward schema.
- Learning Intelligence V15: AI Coach hằng ngày, Sổ tay lỗi sai và Adaptive Practice theo mastery.
- Idempotent migration definitions trong `scripts/migrations/`.

## Tài liệu

- `docs/FULL_PROJECT_AUDIT.md` — audit kiến trúc cũ.
- `docs/ARCHITECTURE.md` — kiến trúc đích và compatibility strategy.
- `docs/API.md` — platform API mới.
- `docs/SOURCE_REGISTRY.md` — registry nguồn giáo dục/thi cử.
- `docs/TEST_REPORT.md` — trạng thái test hiện tại.
- `docs/LEARNING_INTELLIGENCE_V15.md` — API và luồng của AI Coach, Error Book, Adaptive Practice.

## An toàn dữ liệu

Không triển khai migration trên production nếu chưa có backup/test database. Bộ migration platform được gọi sau khi MongoDB kết nối thành công; từng migration phải có thể chạy lặp an toàn, không rename collection cũ và không xóa progress, achievement, XP hoặc game records. CI/test không tự thay thế bước xác nhận dữ liệu trên MongoDB thực tế.

## V21 Phase 2 — Survey, Placement & Admin Quick Create

- Chi tiết thay đổi: `UPGRADE_V21_PHASE2.md` và `UPGRADE_V21_PHASE2_RELEASE.md`.
- Survey/placement được seed qua migration `011-v21-survey-placement.js` sau khi MongoDB kết nối. Survey công bố không hợp lệ bị loại khỏi danh sách người học và được gắn `INVALID / NEEDS_REPAIR` trong Admin.
- Admin có mục **Tạo nội dung / Nhập Word** tại `/admin/index.html — mục “Tạo nội dung / Nhập Word”` (trên giao diện chọn mục menu bên trái).
- Hỗ trợ import `.docx`, `.md`, `.markdown`, `.txt`, xem trước, chỉnh sửa và lưu bản nháp; không tự công bố nội dung tải lên.
- Chạy kiểm thử: `npm test` và `npm run validate`. Bộ validator lịch sử được lưu dưới `npm run validate:legacy` để đối chiếu quy ước UI cũ.


## V22.0.0 · Cấp học Đại học đa lĩnh vực và trải nghiệm học theo từng bước

- `Đại học` là cấp học (`HIGHER_EDUCATION`); CNTT, Khoa học ứng dụng, Kinh tế, Cơ điện tử và Kỹ thuật là lĩnh vực/ngành bên dưới.
- Catalog Đại học dùng một danh mục tham chiếu chung, không giả lập một trường cụ thể và không tự nhận là chương trình đào tạo chính thức.
- Trang catalog có lọc theo lĩnh vực; trang chi tiết khóa học chia chương/bài và phần lý thuyết thành các accordion ngắn, cùng ví dụ, luyện tập, lab/case, project và bài kiểm tra.
- K12 (lớp 1–12) hiển thị nội dung theo phần, cho phép mở lần lượt thay vì trình bày toàn bộ lý thuyết thành một khối dài.
- TOEIC/IELTS định hướng theo kỹ năng/dạng đề, timed practice và mock test; MOS thiên về thao tác và thực hành.
- Chạy `npm test` và `npm run validate` để kiểm tra regression và nội dung V22.


## V23.0.0 · Admin CMS + Local Education AI + Course Factory

- Admin có **Hướng dẫn quản trị nội dung**, **Trình tạo nội dung** và **AI nội bộ & Course Factory**; các tác vụ phổ biến dùng form tiếng Việt, không cần chỉnh JSON.
- Local Education AI nhận diện lĩnh vực, dựng blueprint, kiểm tra khóa trùng, phân tích course gap và xếp job tạo draft. Course Factory/Autopilot không cần API ngoài; đây là bộ máy quy tắc/mẫu riêng, không phải LLM đa dụng.
- Catalog expansion chạy theo batch tối đa 25 đề xuất/lần, có preview và duplicate detection. Mọi khóa do AI tạo phải được Admin preview, kiểm định và publish thủ công; không tự gắn OFFICIAL.
- Có sửa từng lesson/question/assessment và retry job Course Factory/sửa nội dung lỗi; việc thiếu đáp án không được AI tự đoán.
- Mặc định `AI_REMOTE_FALLBACK_ENABLED=false`; xem `.env.example` và `UPGRADE_V23_PHASE3.md`. Các tính năng AI khác kế thừa từ các phiên bản trước vẫn có thể dùng provider ngoài khi cấu hình.
- Kiểm thử: `npm test` và `npm run validate`.

## V27.1.0 · Phase 7–11 — Typed Content, Adaptive Learning, CMS, Practical Coding & Diagnostics

- **Không còn phải sửa JSON trong Admin.** Admin quản trị khóa học, lesson content block, câu hỏi, bài kiểm tra và coding practice qua form có trường rõ ràng; JSON chỉ có thể dùng ở API/legacy migration nội bộ, không phải giao diện soạn nội dung.
- **Typed content records:** migration `012-v27-typed-learning-system.js` bổ sung `ContentBlock`, `PracticeTask`, `PracticeAttempt`, `LearningPlanStep`, `LearningEvent` và `CourseQualitySnapshot`. Giữ nguyên collection/field legacy để tương thích, di chuyển nội dung cũ theo hướng không phá hủy.
- **Phase 7 — Adaptive path:** gợi ý theo hồ sơ, lớp/lĩnh vực, mục tiêu, Skill Mastery, lỗi gần đây, hạn ôn và bài học/coding task đã công bố. Kế hoạch có version, step order và ghi nhận COURSE_GAP nếu catalog không có nguồn thực.
- **Phase 8 — Visual CMS:** tab hướng dẫn, nội dung, câu hỏi, bài kiểm tra, thực hành lập trình; có preview, bản nháp, publish validation và audit.
- **Phase 9 — Analytics/catalog gaps:** dashboard số lượng nội dung, survey/placement invalid, lỗi, job và khoảng trống khóa học/lĩnh vực.
- **Phase 10 — Thực hành thật:** 18 bài thuật toán khởi đầu có đề bài, input/output, ràng buộc, ví dụ, starter code, public/hidden tests và hints. Hidden tests không gửi về client; chạy thực thi phụ thuộc executor được cấu hình an toàn.
- **Phase 11 — Diagnostics/profile:** migration seed/repair survey và placement Published hợp lệ, bộ test K12 lớp 1–12 và các track Đại học/TOEIC/IELTS/MOS; hồ sơ cho phép chỉnh ngày sinh và API tính độ tuổi để điều chỉnh thời lượng/kiểu phiên học. Tuổi được trả về theo API lộ trình; ngày sinh không được nhúng vào đề xuất công khai.
- **Nguồn và công bố:** nội dung OFFICIAL cần nguồn xác minh; nội dung nhập hoặc AI tạo mặc định là draft/nguồn tương ứng, không tự công bố chính thức.
- **Chạy test:** `npm test` và `npm run validate`. Xem `docs/PHASE7_11_RUNBOOK.md` và `UPGRADE_V27_PHASE7_11.md` trước triển khai.


## V27.1.0 — Assessment layout, rubric and coding score fixes

- Sửa CSS gốc khiến radio/checkbox bị kéo rộng 100% và đẩy nội dung lựa chọn ra xa. Lựa chọn bài kiểm tra hiển thị thành từng hàng, nhãn câu hỏi/điểm/loại câu được tách rõ; layout code sample chuyển sang một cột trên màn hình nhỏ.
- Phần kết quả hiển thị điểm đạt/tối đa, trạng thái tự chấm/chờ review và phần tổng hợp test code công khai/ẩn. Đáp án và dữ liệu của từng hidden test không bị trả về trình duyệt.
- Coding assessment được chấm theo trọng số test case, hỗ trợ điểm một phần và giữ trạng thái REVIEW_REQUIRED khi Code Runner chưa có executor an toàn hoặc câu hỏi chưa cấu hình test.
- Trong khóa học CNTT/thuật toán, bộ chấm code được đặt ngay trong phần Luyện tập với đề bài, input/output, ràng buộc, ví dụ, starter code, gợi ý, công thức điểm và kết quả test. Phần Lab/Project hiển thị rubric nếu có; checklist thủ công không bị giả mạo thành điểm tự động.
- Chạy `npm test` và `npm run validate`. Code Runner trong production cần executor cách ly an toàn; không bật `CODE_RUNNER_ALLOW_UNSANDBOXED=true` trên máy chủ công khai.


## V27.1.1 — Assessment layout & algorithm practical grading hardening

- Sửa gốc lỗi radio/checkbox bị giãn toàn chiều ngang do CSS form dùng chung; mỗi lựa chọn giờ là một hàng có nút chọn kích thước cố định và chữ đặt cạnh nhau.
- Chuẩn hóa hiển thị đề: loại câu hỏi, điểm, Input/Output, ví dụ công khai và rubric được hiển thị rõ; đáp án ẩn không được trả về client.
- Bổ sung ba bài Divide and Conquer có input/output, ràng buộc, ví dụ, starter code, gợi ý và hidden tests: Merge Sort, tổng dãy con lớn nhất, đếm nghịch thế.
- Chấm thực hành theo trọng số của test, tối đa 12 test cho mỗi lượt nộp; kết quả phân biệt test công khai/ẩn, lưu attempt, cập nhật mastery và phiên bản learning plan. Nếu code runner chưa sẵn sàng hoặc đề thiếu tests thì không giả lập điểm, trả trạng thái cần cấu hình/review.
- Migration `013-v27-1-expanded-dsa-practice.js` bổ sung các bài Divide and Conquer mới cho cơ sở dữ liệu hiện có mà không sửa đè các bài đã tồn tại.
- Xác minh: `npm test`, `npm run validate`, cú pháp inline script và ZIP; cần smoke test trên staging với MongoDB và executor sandbox thật trước production.


## V27.1.1 — Assessment display, practical scoring & Divide and Conquer

- CSS bài kiểm tra sửa tận gốc lỗi global input width: radio/checkbox có kích thước cố định, lựa chọn hiển thị thành hàng có thể đọc trên desktop/mobile.
- Đề hiển thị nhãn loại câu hỏi, điểm tối đa, phần Input/Output và ví dụ; kết quả hiển thị điểm và trạng thái chấm.
- Bài code được chấm bằng test công khai/ẩn theo trọng số (tối đa 12 test mỗi lượt). Test ẩn chỉ trả số lượng/kết quả tổng hợp, không gửi dữ liệu riêng tư tới client. Runner chưa sẵn sàng hoặc không có test sẽ không được gán điểm giả.
- Thêm 3 bài có nội dung thực hành Divide and Conquer: Merge Sort, tổng dãy con lớn nhất, đếm nghịch thế; gồm đề, input/output, giới hạn, starter code, ví dụ, gợi ý và hidden tests.
- Thêm migration idempotent `013-v27-1-expanded-dsa-practice.js` để seed các bài mới vào database hiện tại mà không ghi đè bài đã tồn tại.
- Kiểm thử tự động: `npm test`, `npm run validate` và phân tích cú pháp inline scripts. Cần smoke test trên staging với MongoDB và executor sandbox thật trước khi triển khai production.


## Code Runner miễn phí (Judge0 CE dùng chung)

Từ V33/V35 có thể dùng endpoint Judge0 CE công khai để chạy code trong sandbox mà không chạy code học viên trực tiếp trong tiến trình web và không cần tự dựng Docker executor. Đây là endpoint dùng chung, best-effort: có thể quá tải, giới hạn tốc độ hoặc thay đổi; không có SLA miễn phí bảo đảm. Nếu cần ổn định cho lớp học đông, dùng dịch vụ Judge0 có gói chính thức hoặc tự host executor an toàn.

Cấu hình trong Render Dashboard > Web Service > Environment:

- `CODE_RUNNER_ENABLED=true`
- `CODE_RUNNER_EXECUTOR=judge0`
- `CODE_JUDGE0_URL=https://ce.judge0.com`
- `CODE_RUNNER_TIMEOUT_MS=10000`

Không cần API key cho endpoint công khai này. Không thêm API key hoặc token vào GitHub. Backend gửi code tới Judge0 qua HTTPS; code có thể được xử lý bởi bên thứ ba, vì vậy không gửi secrets hoặc dữ liệu cá nhân trong mã nguồn. Backend giới hạn kích thước code/input, runtime và output; endpoint thực thi vẫn yêu cầu đăng nhập và đi qua rate limit hiện có. Nếu endpoint bị từ chối/quá tải, giao diện cần cho phép thử lại và không giả vờ rằng code đã chạy.

Ngôn ngữ được ánh xạ: C (50), C++ (54), Java (62), JavaScript (Node.js, 63), Python (71). Các ID có thể thay đổi theo phiên bản/runtime; nếu Judge0 báo ngôn ngữ không tồn tại, kiểm tra `GET https://ce.judge0.com/languages` và cập nhật `JUDGE0_LANGUAGE_IDS`.

Kiểm tra trạng thái sau deploy tại `/api/ai-learning/code/status` khi đã đăng nhập. Chỉ bật cho học viên sau khi endpoint `/about` trả lời thành công và đã thử code mẫu. Endpoint công khai miễn phí không nên được xem là hạ tầng đảm bảo sản xuất.


## V35 — Learning integrity, timed assessments and resilient generation jobs

- Tiến độ bài học được tính ở server từ bài đánh giá đã công bố, điểm đạt và PracticeTask đã chấm; giao diện không có checkbox tự xác nhận hoàn thành và bỏ qua giá trị hoàn thành do client gửi.
- `REVIEW_REQUIRED`, lượt chưa nộp và kết quả yêu cầu review không được tính là đạt để mở khóa nội dung tiếp theo.
- Bài thi có `startedAt`/`expiresAt`, bản nháp câu trả lời tự lưu, khả năng tiếp tục lượt đang làm và khôi phục đồng hồ; khi quá hạn, backend dùng bản nháp đã lưu phía server.
- Tạo job ảnh/âm thanh dùng hàng đợi idempotent; job thất bại không tự bật lại chỉ vì học viên mở trang. Quản trị viên có endpoint retry có phân quyền và audit log.
- Course Factory hỗ trợ số bài khác nhau theo chương trình/track thay vì áp một con số cho tất cả; khóa cá nhân không đạt kiểm tra được giữ nguyên dữ liệu để sửa, không bị xóa để sinh lại.
- Ghi chú phạm vi, test và các giới hạn chưa được xác minh trên production trong [`MIGRATION_ANALYSIS.md`](MIGRATION_ANALYSIS.md).
- Xác minh local: `npm test`, `npm run validate`. Các test này chưa thay thế smoke test với MongoDB/API/executor thật.


## V37.0.0 — Assessment integrity, adaptive diagnostics and quota resilience

- Assessment creation validates course, subject, grade, education level and lesson linkage before persisting.
- Adaptive diagnostics deduplicate prompts, balance skill coverage and difficulty, and supplement thin AI output from a same-track question bank.
- Materialized-course verification inspects stored lesson questions and checks that lesson tests belong to the intended course and lesson.
- Gemini daily/free-tier quota errors trigger a 24-hour in-process per-model cooldown by default; transient rate limits retain shorter retry behavior.

## V38.0.0 — Adaptive AI course generation and deep quality gates

- Course Factory and personal-course generation request genuinely generated, goal-specific blueprints and lesson content from Gemini instead of silently presenting the fixed local curriculum skeleton as a fully generated AI course. The model chooses a suitable structure for the requested goal, subject, level and track; personal courses no longer use a three-AI-lesson budget by default or fill remaining lessons from starter templates.
- Every generated course includes lesson-level theory, lecture guidance, worked examples, practice, common mistakes and question sets; chapter tests and the final assessment are generated as separate sets rather than reusing lesson questions as the final exam.
- V38 quality gate checks content depth, learning objectives, lecture length, worked examples, practice variety, question explanations, duplicates, K12 grade bounds and independent lesson/chapter/midterm/final/mock assessments. Course Factory gets one AI repair pass; personal-course generation refuses to materialize a course that fails its scope/content gate.
- Added a read-only catalog audit in Admin > AI nội bộ & Course Factory to find shallow lessons, missing tests, and course/subject/lesson/question scope mismatches in existing records.
- Publishing now runs a stored-course integrity audit. AI-generated content remains non-official and must still be previewed by an administrator.
- When Gemini is not configured or unavailable because of quota, the factory reports failure/cooldown instead of falsely claiming that a rule-based template is a complete AI-generated course.
- Run `npm test`, `npm run check`, and `npm run validate`. MongoDB, actual Gemini/TTS quota behavior and Render deployment still require smoke testing in the deployment environment.


## V39.0.0 — Onboarding theo độ tuổi và diagnostic khám phá đa lĩnh vực

- Luồng sau đăng ký tiếp tục vào khảo sát; hoàn thành khảo sát hướng người học sang rà soát hồ sơ, rồi làm bài kiểm tra đầu vào.
- Khảo sát mặc định vẫn dùng mô hình dữ liệu V21 hiện có (28 câu), với các câu hỏi cao đẳng/đại học chỉ hiện khi người học chọn cấp học phù hợp.
- API danh sách khảo sát thử khởi tạo/sửa danh mục mặc định khi không tìm thấy khảo sát hợp lệ; nếu vẫn không thể phục hồi, API trả mã lỗi `SURVEY_CATALOG_UNAVAILABLE` để giao diện giải thích và cho phép tải lại, thay vì hiển thị danh sách rỗng không rõ nguyên nhân.
- Hồ sơ không bắt buộc nhập ngày sinh để lưu những thông tin khác; tuổi vẫn tự tính khi ngày sinh hợp lệ. Trường đại học được ẩn với người học không thuộc nhóm phù hợp và không gọi catalog đại học khi phần này đang ẩn.
- Thêm placement khám phá đa lĩnh vực gồm tư duy logic, đọc hiểu/ngôn ngữ, kỹ năng số/dữ liệu và suy luận khoa học. Khi chưa có mục tiêu/cấp học đủ rõ, matcher ưu tiên bài khám phá thay vì chọn ngẫu nhiên một bài chuyên ngành.
- Đồng bộ version ứng dụng/cache lên `39.0.0`; giữ nguyên các version nội bộ V38 cho metadata của engine/quality gate lịch sử.
- Kiểm thử: `npm test`, `npm run validate` và kiểm tra cú pháp JavaScript đã chạy thành công trong môi trường làm việc. Chưa xác minh bằng MongoDB production, tài khoản thật hoặc Render deployment.

# FULL PROJECT AUDIT — HÀNH TRÌNH MỚI (hanhtrinhmoi)

> **Phases:** PHASE 0 — AUDIT
> **Ngày kiểm tra:** 10/06/2026
> **Git baseline:** `ad5933b` (main, origin/main) — working tree sạch trước khi audit (chỉ có các tệp audit tạm được xóa sau khi viết xong tài liệu này).
> **Phương pháp:** đọc toàn bộ cấu trúc tệp, trích xuất tự động routes/models/references bằng script Node, đọc trực tiếp các vùng trọng yếu của `server.js`, `curriculum-data.js`, trang học tập, trang admin; chạy bộ test hiện có làm baseline.
> **Nguyên tắc:** KHÔNG xóa/chỉnh sửa code trong phase này. Mọi nhận định về "file legacy" đều dựa trên **reference scan**, không dựa trên tên file.

---

## 1. TỔNG QUAN KIẾN TRÚC CŨ

Dự án là một **web game + học tập hợp nhất (monolith)**:

- **Tên gói:** `hanh-tinh-mo-uoc` v14.0.0 (mô tả: "Hành Tinh Mơ Ước V14").
- **Kiểu:** Node.js/Express monolith — MỘT tệp `server.js` (5.141 dòng, ~288 KB) chứa: schema, middleware, toàn bộ 105 API route, scoring, Socket.IO server, logic game.
- **Frontend:** ~40 tệp HTML tĩnh ở thư mục gốc, mỗi trang tự chứa HTML+CSS+JS nội tuyến; dùng chung vài tệp asset (`modern-ui.*`, `assets/ui/*`).
- **Database:** MongoDB qua Mongoose 8 (session lưu bằng `connect-mongo`).
- **Auth:** express-session (cookie `hanhtrinh.sid`, httpOnly, MongoStore), bcrypt.
- **Realtime:** Socket.IO cho các game cờ/đấu sảnh.
- **Triển khai:** Render (`render.yaml`), bắt buộc `MONGO_URI`.
- **Test:** `scripts/validate-project.js` (soi chuỗi ký tự trong source) + `scripts/test-v13-runtime.js` + `scripts/test-v14-runtime.js`.

**Đặc điểm kiến trúc then chốt:** nội dung giáo dục (curriculum, câu hỏi, bài học) **không nằm trong DB** mà được **sinh procedural trong code** (`curriculum-data.js` + `question-bank-complete.js`). DB chỉ lưu *kết quả học tập* của người dùng. Không có CMS, không có khảo sát, không có placement, không có đại học, không có TOEIC/IELTS theo chuẩn.

### 1.1 Sơ đồ cấu trúc hiện tại

```
hanhtrinhmoi/
├── server.js                 # MONOLITH: 5.141 dòng — schema+auth+105 API+scoring+socket
├── server/modules/
│   ├── learning-v11.js        # (được server.js require — xem mục 11)
│   ├── lesson-theory-v14.js   # sinh gói lý thuyết theo nhóm môn (dùng bởi curriculum-data.js)
│   ├── quest-maintenance-v14.js # job nhiệm vụ quá hạn (dùng bởi server.js + test)
│   ├── survival-v11.js        # LEGACY — không runtime reference
│   ├── survival-v13.js        # LEGACY runtime — chỉ test v13 còn dùng
│   └── survival-v14.js        # ACTIVE — server.js + trang trang trí phòng
├── curriculum-data.js         # NGUỒN CURRICULUM 1–12 (sinh procedural, GDPT 2018)
├── question-data.js           # 366 KB ngân hàng câu hỏi tĩnh (6 môn × 12 lớp × 3 mức)
├── question-bank-complete.js  # sinh bổ sung câu hỏi để đủ 100 câu/môn/lớp/mức
├── monopoly-data.js / monopoly-logic.js
├── global-client.js, heartbeat.js, modern-ui.js/css, style.css
├── board-ui-v8.js/css  &  board-ui-v14.js/css   # 2 lớp UI bàn cờ cùng tải
├── tournament-v9.js/css
├── stockfish.js/wasm          # engine cờ vua (1.3 MB)
├── assets/
│   ├── learning/  book-catalog.js, practical-assessment.js,
│   │              learning-v10.css, v11.css+js, v13.css+js, v14.css
│   ├── room/      room-v10.js/css, survival-v11.js/css, v13.js/css, v14.js/css
│   └── ui/        connection-v12.js (CHẾT), connection-v13.js, ui-v11.js/css, ux-v13.js/css
├── *.html (40 trang)          # trang người dùng + admin-panel + login + phu-huynh
├── scripts/  validate-project.js, test-v13-runtime.js, test-v14-runtime.js
├── docs/     ARCHITECTURE_V10/V11/V13/V14.md, TEST_REPORT_V13/V14, DEPLOY_CHECKLIST_V13
├── UPGRADE_V4…V14.md, CURRICULUM_AUDIT.md
└── README.md                  # SAI HOÀN TOÀN — mô tả dự án Java "Quản lý thư viện số"
```

## 2. PHỤ THUỘC (dependencies)

**Runtime (package.json):** `express@^4.18`, `mongoose@^8`, `express-session@^1.17`, `connect-mongo@^5`, `bcrypt@^5.1`, `socket.io@^4.7`, `dotenv@^17`.
**Engines:** Node 20.x. **Không có** TypeScript, test framework, linter, ORM abstraction, router module.

**Phụ thuộc ẩn (không khai báo):**
- `OPENAI_API_KEY` (tùy chọn) — chấm bài nói/văn qua OpenAI, có fallback cục bộ (`localEssayGrade`).
- Biến môi trường: `MONGO_URI/MONGODB_URI`, `PORT`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `ROBUX_*`, `COMMUNITY_TOURNAMENTS_*`.
- Tài nguyên bên thứ 3 phía client: Google AdSense, SpeechRecognition API (Chrome/Edge).

**Baseline test (đã chạy trước khi sửa bất cứ thứ gì):**
```
✅ validate-project: 40 trang HTML, 34 tệp JS, 101 API, 12 lớp, 144 lộ trình môn,
   2.980 bài học, 35.760 câu hỏi lộ trình, 21.600+ câu hỏi ngân hàng
✅ test-v13-runtime: survival v13 đạt
✅ test-v14-runtime: quest job, lý thuyết, chế tạo, bàn cờ đạt
```
→ Mọi phase sau phải giữ 3 test này PASS (hoặc cập nhật có chủ đích khi cấu trúc đổi).

---

## 3. BACKEND — CẤU TRÚC `server.js` (5.141 dòng)

| Vùng dòng | Nội dung |
|---|---|
| 1–124 | dotenv, config, import data/logic, static public (whitelist `publicFiles`), tạo HTTP server + Socket.IO |
| 125–324 | **11 schema Mongoose**: user (game+sinh tồn+nhà), tournament, learningRecord/Setting/Profile/Note/SelfAssessment/Practical/Activity |
| 325–560 | dữ liệu tĩnh trong code: quà lưu niệm, khối build, item nhà… |
| 563–604 | notificationSchema, robuxRedemptionSchema, `mongoose.model(...)` × 11, `syncAdminFromEnvironment()` |
| 709–770 | middleware: session (MongoStore), JSON 5 MB, CSRF-ish origin check cho `/api`, chặn `/admin-panel.html` & `/phu-huynh.html` theo session role, `express.static` toàn bộ thư mục gốc |
| 772–939 | state in-memory (`gameRooms`, `waitingPlayers`, `monopolyQueue`, `maintenanceMode`), `requireAuth/requireAdmin/requireParent`, helper (rate limiter tự viết, normalize, escapeRegExp…), rate limiters (`authRateLimit`, `aiRateLimit`, `tournamentRateLimit`, `miningRateLimit`), **`app.use('/api/admin', requireAdmin)`** |
| 940–1155 | health/ready, quest daily, leaderboard, **register/login/logout** |
| 1156–1290 | user progress, heartbeat, parent dashboard |
| 1291–1899 | **admin API** (tournament CRUD, user CRUD, broadcast, quest, maintenance) |
| 1900–2130 | **learning helpers**: unlock rule, streak, mastery, review schedule (spaced repetition), analytics, báo cáo CTGDPT |
| 2131–2780 | **learning API** (25 route) + english speaking + literature essay |
| 2782–2972 | tournament API (official + community) |
| 2973–3138 | **game-win API** (13 game): cộng điểm, level, quest progress |
| 3139–3309 | hệ thống bài kiểm tra tổng hợp (`/api/test*`), reset toàn level |
| 3310–3584 | Robux redemption (Admin duyệt thủ công) |
| 3585–3733 | nhà của bé (info/buy/mine/save/visit) |
| 3734–3941 | survival state/sync/mine/place/craft/eat/reset (khóa `withSurvivalLock`, cooldown) |
| 3942–5101 | **Socket.IO**: rooms, chess/caro/go/othello/monopoly, game tìm trận, đấu toán PVP, bộ máy đấu giải, disconnect |
| 5102–5141 | job nhiệm vụ (quest) quá hạn V14, 404 API, error handler cuối |

**Nhận xét:** tách lớp Controller/Service/Repository **không tồn tại** — route kiêm query Mongo, business logic, format response. Đây là "God file" điển hình (mục 74 của yêu cầu).

### 3.1 Middleware & bảo mật hiện có (điểm mạnh cần GIỮ)

- Session cookie: `httpOnly`, `sameSite=lax`, `secure` khi production, `rolling`, TTL 24 h, **session regenerate khi login** (chống fixation).
- bcrypt cost 10; không lưu plaintext.
- Origin/`Sec-Fetch-Site` check cho mọi request POST `/api` (CSRF nhẹ).
- Rate limiter nội tuyến cho `/api/register`, `/api/login` (`authRateLimit`), AI, tournament, mining.
- `app.use('/api/admin', requireAdmin)` — mọi route `/api/admin/*` đăng ký sau dòng 938 đều bị chặn.
- Admin password đồng bộ từ `ADMIN_PASSWORD` env (`syncAdminFromEnvironment`).
- Lesson API **cắt `answer`/`explanation` khỏi response** trước khi gửi client (đáp án không lộ).
- `/api` 404 JSON cuối cùng; error handler bọc async (chống treo request khi Mongo lỗi).

### 3.2 Lỗ hổng / thiếu sót bảo mật (cần phase 17)

1. **Đăng ký chỉ có username/password** — không email/SDT/DOB/Game ID/OTP (mục 7–8 của yêu cầu chưa có gì).
2. `role` là String free-form trong schema, không enum; **frontend lưu `localStorage.role`** (`login.html`, `index.html`) — có trang đọc nó (`ngoi-nha-cua-be.html`). May mắn trang admin được bảo vệ bằng session ở middleware, nhưng đây là bẫy sẵn có.
3. Response error dùng `{ message }` **không đúng chuẩn** `{ success:false, code, details }` (mục 42).
4. Không có audit log admin (mục 38).
5. `escapeRegExp` + `$regex` để tra username không chuẩn hóa unicode NFC; username so khớp không phân biệt hoa thường ở check trùng nhưng `unique` index theo đúng chữ hoa-thường → có thể tạo `Minh` và `minh` cùng tồn tại (cần test xác nhận).
6. `express.static(__dirname)` phục vụ **toàn bộ** thư mục gốc (kể cả `question-data.js` — 366 KB chứa **đáp án** cho người dùng tải về nếu biết URL). Cần xác minh: `.js` gốc có bị chặn không (không — static thứ cấp ở dòng 767 phục vụ mọi tệp).
7. Không có security headers (helmet/CSP), không có giới hạn kích thước upload file (chưa có upload), không có bảo vệ brute-force theo IP ngoài rate limiter in-memory (reset khi restart, nhiều instance thì vô dụng).
8. Không log OTP/password (vì chưa có OTP) — duy trì nguyên tắc này khi thêm xác thực.
9. `console.log` có thể in dữ liệu nhạy cảm ở chế độ lỗi (chưa rà toàn bộ).

---

## 4. API — DANH MỤC ĐẦY ĐỦ (105 route trong `server.js`)

Trích xuất tự động (`app.get/post/put/delete` với path string). Không có Express Router — toàn bộ đăng ký inline. **Không có route trùng lặp** (đã kiểm tra).

### 4.1 Health (3)
`GET /healthz`, `GET /api/health`, `GET /api/ready`

### 4.2 Auth & người dùng (7)
`POST /api/register`, `POST /api/login`, `POST /api/logout`,
`GET /api/user/progress`, `POST /api/user/heartbeat`, `GET /api/leaderboard`, `GET /api/parent/dashboard`

### 4.3 Thông báo (4)
`GET /api/notifications`, `POST /api/admin/post-notification`, `POST /api/admin/send-notification`, `POST /api/admin/broadcast`

### 4.4 Admin (26) — đều sau `app.use('/api/admin', requireAdmin)`
- Tournament: `create-tournament`, `start-tournament`, `tournament-result`, `advance-to-knockout`, `finish-tournament`, `cancel-tournament`, `community-tournament/:id/cancel`
- User: `all-users`, `create-user`, `update-user`, `delete-user`, `toggle-suspend`, `reset-password`, `create-random-batch`, `transfer-child`
- Khác: `assign-quest`, `maintenance-status`, `maintenance-toggle`, `learning-overview`, `learning-calendar`, `reset-all-levels`, `robux-redemptions`, `robux-redemptions/:requestId/action`

### 4.5 Learning (25) — CẦN GIỮ NGUYÊN URL (mục 85)
```
GET  /api/learning/catalog                 GET /api/learning/roadmap
GET  /api/learning/progress                GET|POST /api/learning/profile
GET  /api/learning/adaptive-dashboard      GET /api/learning/education-dashboard
POST /api/learning/self-assessment         GET /api/learning/weekly-assignments
GET  /api/learning/calendar                GET /api/learning/today
GET  /api/learning/week-plan               GET /api/learning/review
GET  /api/learning/review-quiz  + POST /api/learning/review-quiz/submit
GET|POST /api/learning/note/:grade/:subjectId/:lessonId
GET|POST /api/learning/preferences         GET /api/learning/preflight/:grade/:subjectId/:lessonId
GET  /api/learning/lesson/:grade/:subjectId/:lessonId
POST /api/learning/lesson/:grade/:subjectId/:lessonId/submit
POST /api/learning/practical/submit        POST /api/learning/english/speaking
POST /api/learning/literature/essay
```

### 4.6 Thi & kiểm tra (3)
`GET /api/test/catalog`, `GET /api/test`, `POST /api/submit-test`

### 4.7 Tournament / giải đấu (10)
`GET /api/tournament/status`, `POST /api/tournament/join`, `GET|POST /api/tournaments`, `GET /api/tournaments/:id`, `POST /api/tournaments/join-code`, `:id/join`, `:id/leave`, `:id/start`, `:id/cancel`

### 4.8 Game win — cộng điểm/level (13)
POST `/api/game/`: `chess-win-level`, `go-win`, `othello-win`, `caro-win`, `story-win`, `english-speech-win`, `viet-speech-win`, `music-win`, `detective-win`, `shape-win`, `build-win`, `memory-win`, `crossword-win`

### 4.9 Robux (4 user + 2 admin)
`GET /api/robux/config`, `GET /api/robux/my-requests`, `POST /api/robux/redeem`, `POST /api/robux/cancel/:requestId`

### 4.10 Nhà của bé (6)
`GET /api/house/info`, `GET /api/house/visit/:friendUsername`, `POST /api/house/buy|mine|save|save-drawing`

### 4.11 Sinh tồn (7)
`GET /api/survival/state`, `POST /api/survival/sync|mine|place|craft|eat|reset`

**Kiểm chứng:** quét toàn bộ HTML cho thấy **mọi route đều được frontend gọi** (trừ `/healthz` cho giám sát). Không có route chết ở backend; "chức năng chết" nằm ở level file/tài nguyên (mục 10).

**Chuẩn response hiện tại (chưa đạt yêu cầu):** thành công → JSON trực tiếp; lỗi → `{ message }` + HTTP status. Cần chuyển `{ success, data }` / `{ success:false, code, message, details }` mà vẫn tương thích: trả song song `message` cũ trong giai đoạn chuyển đổi.

---

## 5. DATABASE — COLLECTIONS & SCHEMAS

11 model Mongoose (tất cả định nghĩa trong `server.js`):

| Model | Collection | Trường chính | Index |
|---|---|---|---|
| `User` | users | username(unique), password(bcrypt), role, parentCode, score, arenaPoints, isSuspended, children[], history[], quests[], playtime*, loginStreak, inventory[], miningStats, houseData, chestsData, worldSettings, survivalState{health,hunger,xp,level…}, colors, 14 trường `*Level` (music/painting/memory/shape/build/crossword/detective/story/vietSpeech/englishSpeech/chess/caro/go/monopoly/othello) | username unique |
| `Tournament` | tournaments | organizerType, creator, joinCode, pointMode, gameType, format, phase, status, participants[], brackets, prizes… | (status,organizerType,createdAt), (creator,status,createdAt) |
| `LearningRecord` | learningrecords | username, grade(1–12), subjectId, lessonId, attempts, bestScore, lastScore, passed, skillStats, masteryLevel(new/practicing/passed/mastered), reviewAttempts, nextReviewAt, reviewIntervalDays, reviewStreak, submissionIds[] | unique(username,grade,subjectId,lessonId); nextReviewAt |
| `LearningSetting` | learningsettings | key(unique), value(Mixed) — ví dụ `school-calendar` | key unique |
| `LearningProfile` | learningprofiles | username(unique), goalMinutes, xp, studyDays[], lastGrade, preferredSubjects, weeklyGoalDays, totalStudyMinutes, bookSelections, accessibility{}, focusMinutes | username unique |
| `LearningNote` | learningnotes | username, grade, subjectId, lessonId, content(≤4000) | unique(username,grade,subjectId,lessonId) |
| `LearningSelfAssessment` | learningselfassessments | username, grade, schoolYear, semester, qualities{}, competencies{}, reflection, nextGoal | unique(username,grade,schoolYear,semester) |
| `LearningPractical` | learningpracticals | username, grade, subjectId, lessonId, type(singing/drawing), score, metrics, feedback, evidenceId | (username,grade,subjectId,lessonId,createdAt) |
| `LearningActivity` | learningactivities | username, grade, type(lesson/review/note/self-assessment/speaking/essay/practical), subjectId, lessonId, score, minutes, metadata | (username,grade,createdAt), (username,createdAt) |
| `Notification` | notifications | title, content, type(info/event/warning), targetUsername(null = broadcast), date | targetUsername, date |
| `RobuxRedemption` | robuxredemptions | requestCode(unique), gameUsername, robloxUsername, pointsSpent, robuxAmount, status(pending/approved/paid/rejected/cancelled), adminNote, processedBy | + (gameUsername,createdAt), (status,createdAt) |

**Quan sát:**
- Toàn bộ curriculum/câu hỏi **không nằm trong DB** → không thể Admin CMS-edit nội dung (yêu cầu 18 chưa có gì).
- `User` là "God model": game + economy + sinh tồn + học tập trong một document.
- Chưa có các collection mục tiêu: email/phone/DOB/verification, profiles tách, institutions/faculties/majors/trainingPrograms/courses, curricula/units/lessons, questions, assessments/submissions, surveys, placementTests, learningPlans (versioned), achievements, rewards, auditLogs.
- Index hiện có tốt cho learning; cần bổ sung khi tạo collection mới: email, phone, gameId, status, userId, createdAt/updatedAt (mục 61).

---

## 6. FRONTEND — 40 TRANG HTML + ASSETS

### 6.1 Trang lõi
| Trang | Vai trò | Ghi chú |
|---|---|---|
| `index.html` | Trang chủ, điều hướng toàn site (11 nhóm), login state, tournament status | lưu `currentUser`, `role` vào localStorage |
| `login.html` | Đăng nhập/đăng ký (username+password) | lưu `currentUser`, `role` → localStorage |
| `status.html` | Trang trạng thái hệ thống | |
| `admin-panel.html` (51 KB) | Bảng điều khiển admin | chặn theo session role ở middleware |
| `phu-huynh.html` | Dashboard phụ huynh | chặn theo session role |
| `lo-trinh-hoc-tap.html` (68 KB) | **Trung tâm học tập lớp 1–12** | inline JS chính (dòng 94–146) + 4 CSS (v10/v11/v13/v14) + 2 JS learning (v11+v13) cùng tải |
| `bai-kiem-tra.html` | Thi trắc nghiệm tổng hợp (6 môn × 12 lớp × 3 mức) | |
| `thong-bao.html` | Trang thông báo | |

### 6.2 Nhóm game / giải trí (giữ nguyên — mục 59)
- **Cờ & board:** `choi-co.html` (hub), `co-vua.html` (+stockfish), `caro.html`, `co-vay.html`, `othello.html`, `co-ty-phu.html`
- **Giải đấu:** `giai-dau.html`
- **Đấu trường thử thách:** `dau-truong-thu-thach.html` (gồm `toan-hoc`, `o-chu`, `tim-diem-khac-biet`, `luyen-noi`, `luyen-noi-tieng-anh`, `sang-tac-truyen-vui`, `caro`)
- **Thành phố sáng tạo:** `thanh-pho-sang-tao.html` + `xuong-ve`, `giai-dieu-vui`, `xay-dung-uoc-mo`, `tao-hinh-vui-nhon`, `sang-tac-truyen-vui`, `ghep-hinh-ghi-nho`
- **Thư viện tri thức:** `thu-vien-tri-thuc.html` + `doc-truyen`, `cay-tre-tram-dot`, `con-cao-va-chum-nho`, `rua-va-tho`, `bai-viet-1`, `bai-viet-2`, `vong-tuan-hoan-nuoc`
- **Nhà & phòng:** `trang-tri-phong.html` (survival v14 + room v10), `ngoi-nha-cua-be.html`, `nhiem-vu.html` (quest)
- **Khác:** `luyen-noi.html`, `luyen-noi-tieng-anh.html` (SpeechRecognition), `phong-trung-bay.html`

### 6.3 Assets JS/CSS dùng chung
`modern-ui.*` + `assets/ui/ui-v11.*` + `connection-v13.js` + `ux-v13.*` được nạp ở **gần như mọi trang HTML**. `global-client.js` + `heartbeat.js` cho trạng thái phiên/heartbeat.

### 6.4 Phân tích chồng version (mục 43 — phải xử lý)
- `lo-trinh-hoc-tap.html` nạp **cùng lúc**: `learning-v10.css`, `learning-v11.css`, `learning-v13.css`, `learning-v14.css`, `learning-v11.js`, `learning-v13.js` — về bản chất là "layer patch" hơn là duplicate; JS v11 = panel kế hoạch/tập trung/accessibility, JS v13 = hàng đợi nộp bài offline (outbox). **Không phải file chết**, nhưng cần hợp nhất thành 1 module có tên ổn định.
- `board-ui-v8.*` **và** `board-ui-v14.*` cùng được 5 trang cờ nạp (v14 là lớp sửa cuối theo `docs/ARCHITECTURE_V14.md`). `board-ui-v8` cũng nằm trong whitelist public của server.
- **Không có `learning-v14.js`** — logic V14 nằm ở server modules + CSS.

---

## 7. ADMIN MODULES (hiện tại)

`admin-panel.html` chỉ có các module sau (trích xuất từ heading + API call):

1. Đăng thông báo chính thức (post-notification)
2. Tạo tài khoản đơn / tạo bot (parent+child) / theo dõi đăng ký
3. Quản lý giải đấu (create/start/result/knockout/finish/cancel, community cancel)
4. Công cụ chung: Broadcast, Reset toàn bộ cấp độ, maintenance toggle/status
5. Duyệt yêu cầu đổi Robux
6. Giao nhiệm vụ (quest) cho user
7. User CRUD: list/update/delete/toggle-suspend/reset-password/transfer-child/assign-quest

**KHÔNG CÓ (cần xây ở Phase 11 — Admin Education CMS):** education systems/levels/grades/subjects/curriculum/units/lessons, question bank, exams, TOEIC, IELTS, universities (institution→major→program→course), surveys, placement tests, learning path rules, achievements/rewards, notification templates, system settings, **audit log**, analytics dashboard học tập (`/api/admin/learning-overview` tồn tại nhưng **chưa trang nào gọi**).

---

## 8. AUTHENTICATION FLOW (hiện tại)

```
Đăng ký: POST /api/register {username, password}
  → validate username (/^[A-Za-z0-9_À-ỹ]{3,24}$/u), không bằng 'admin'
  → password 6–72 ký tự → bcrypt.hash(10)
  → User.create({ role:'child' }) → 201
Đăng nhập: POST /api/login → syncAdminFromEnvironment (nếu là 'admin')
  → findOne case-insensitive → bcrypt.compare → check isSuspended/maintenanceMode
  → update loginStreak/lastActiveAt → req.session.regenerate → session.user={username,role}
  → cookie hanhtrinh.sid (httpOnly, 24h, rolling)
Bảo vệ: requireAuth / requireAdmin (role==='admin' từ session) / requireParent
  + middleware chặn trang /admin-panel.html, /phu-huynh.html theo session
Đăng xuất: POST /api/logout → session.destroy + clearCookie
```

**Roles thực tế:** `child` (mặc định), `parent`, `admin` (và `system`/`user` ở đoạn gán code phụ). Schema **không enum**. Không có `teacher`, `content_editor`, `exam_manager`, `super_admin` → RBAC (mục 36) chưa có; **phải thiết kế RBAC nhưng giữ các role hiện tại vẫn hợp lệ**.

**Thiếu hoàn toàn (Phase 2 — mục 7, 8, 9):** họ tên, email + OTP, số điện thoại + OTP, DOB (ngày/tháng/năm) + tuổi tính ở backend, Game ID (unique, không dùng làm password), trạng thái xác thực (EMAIL_UNVERIFIED → VERIFIED…), chống giả mạo `verified` từ client, guardian/consent.

---

## 9. LEARNING FLOW (hiện tại — phải GIỮ khi refactor)

```
Chọn lớp (1–12, localStorage.learningGrade)
 → GET /api/learning/catalog        → curriculum-data.getCatalog(grade): 144 lộ trình môn/12 lớp
 → GET /api/learning/roadmap        → tiến độ 35 tuần, checkpoint
 → GET /api/learning/preflight/...  → mở khóa: bài trước phải > PASS_SCORE(=8); practical (hát/vẽ) phải đạt
 → GET /api/learning/lesson/...     → getLesson(): lý thuyết + 12 câu MCQ (cắt answer/explanation)
 → POST .../submit {answers, submissionId}
     → scoreLesson() phía SERVER (server là nguồn sự thật)
     → ghi LearningRecord (attempts/best/passed/mastery), LearningActivity
     → review schedule (spaced repetition: <6→1 ngày, ≤8→2 ngày, >8→3–60 ngày)
 → GET /api/learning/review|review-quiz(+submit)   → ôn tập đến hạn
 → GET adaptive-dashboard | education-dashboard | today | week-plan | weekly-assignments
 → POST /api/learning/self-assessment              → tự đánh giá phẩm chất/năng lực
 → POST /api/learning/english/speaking (SpeechRecognition → server chấm, OpenAI fallback)
 → POST /api/learning/literature/essay             → chấm cục bộ hoặc OpenAI (có ghi rõ nguồn)
 → POST /api/learning/practical/submit             → bài thực hành hát/vẽ
```

**Điểm mạnh phải giữ:** unlock rule, mastery levels (new/practicing/passed/mastered), spaced-repetition review, streak, activity log, practical gate, self-assessment, báo cáo CTGDPT 2018 có disclaimer + trích dẫn văn bản (32/2018/TT-BGDĐT, 27/2020/TT-BGDĐT, 22/2021/TT-BGDĐT, 13/2022/TT-BGDĐT).

**Thiếu (Phase 5–7):** question types ngoài MCQ trong lesson (essay/speaking chỉ là route riêng), ngưỡng đạt do Admin cấu hình (mục 14), prerequisite thực chất (mục 13 — hiện unlock chỉ là "bài trước đạt", không có map kiến thức thiếu), Learning Plan versioned (mục 58), input survey/placement, hệ số thời gian/tốc độ trong recommendation.

**Lưu ý nguồn chuẩn (mục 2):** `curriculum-data.js` khai `PROGRAM_VERSION='CTGDPT-2018-2026-V14'` + trích dẫn văn bản, nhưng **chưa có `curriculumSource {sourceType, organization, documentName, documentNumber, effectiveDate, verifiedAt}`** đúng format; nội dung bài **sinh procedural theo template** (không phải nội dung chuyên môn xác minh) → bắt buộc đánh dấu `unverified` và cho Admin nhập/sửa thật.

---

## 10. GAME / REWARD / NOTIFICATION / PROFILE FLOW

### 10.1 Game flow (GIỮ — mục 32, 59)
- 13 API `/api/game/*-win` → cộng `score`, tăng `*Level`, cập nhật quest progress, ghi `history`.
- Socket.IO: chess, caro, go, othello, monopoly (2–8 người), game tìm trận, đấu toán PVP, bộ máy đấu giải; server xác thực luật phòng cờ.
- Trang game dùng `global-client.js` (phiên), một số đọc `localStorage.currentUser`.
- State in-memory: `gameRooms`, `waitingPlayers`, `monopolyQueue`, `onlineUsers`, `maintenanceMode` → mất khi restart (đã chấp nhận, cần ghi rõ).

### 10.2 Reward flow (GIỮ)
- **`score`** (điểm chính), **`arenaPoints`** (điểm đấu trường non-cash, welcome 300, credit idempotent theo `referenceId`).
- **Quest daily** (4 quest/ngày, reward/penalty/timeLimit, job quá hạn V14).
- **Vật phẩm:** inventory + houseData + souvenir catalog (theo sự kiện) + mining.
- **Robux redemption** (env-gated, admin duyệt, rate limit, không lưu mật khẩu Roblox).
- **KHÔNG có collection Achievements/Rewards tách rời** — "achievement" hiện = level + quest + history. Khi thêm AchievementService (mục 32) phải nhận event, không sửa trực tiếp 10 collection như hiện nay.

### 10.3 Notification flow (GIỮ + mở rộng — mục 33)
- `Notification` model (title/content/type/targetUsername/date), `GET /api/notifications` (broadcast + riêng mình), admin post/send/broadcast, trang `thong-bao.html`.
- **Thiếu:** priority, expiresAt, read/unread theo user, event-driven (`LESSON_AVAILABLE`, `REVIEW_DUE`, `PATH_UPDATED`…), NotificationService trung tâm.

### 10.4 Profile flow (tách theo mục 34)
Hiện tất cả nằm trong `User` + `LearningProfile`:
- **Account:** username/password/role (không email/phone)
- **Profile:** CHƯA CÓ họ tên/DOB/avatar (username dùng làm tên hiển thị)
- **EducationProfile:** CHỈ CÓ `LearningProfile.lastGrade` (1–12)
- **LearningProfile:** goalMinutes, xp, studyDays, preferredSubjects, accessibility
- **GameProfile:** score, arenaPoints, inventory, 14 `*Level`, survivalState, houseData

---

## 11. PHÂN TÍCH FILE VERSION CŨ & REFERENCE (mục 2, 89)

Scan toàn bộ project (mọi tệp `.html/.js/.md` tham chiếu tên file):

### 11.1 LIVE — đang được dùng (không được xóa)
| File | Ai dùng |
|---|---|
| `server.js`, `curriculum-data.js`, `question-data.js`, `question-bank-complete.js` | runtime chính |
| `server/modules/lesson-theory-v14.js` | curriculum-data.js |
| `server/modules/quest-maintenance-v14.js` | server.js + test-v14 |
| `server/modules/survival-v14.js` | server.js + trang-tri-phong.html + test-v14 |
| `server/modules/learning-v11.js` | server.js dòng 60 (`BOOKS`, `practicalType`, `scorePractical`) — LƯU Ý: khác file với `assets/learning/learning-v11.js` |
| `assets/learning/learning-v11.js/css`, `learning-v13.js/css`, `learning-v14.css`, `learning-v10.css`, `book-catalog.js`, `practical-assessment.js` | lo-trinh-hoc-tap.html |
| `assets/room/survival-v14.*`, `room-v10.*` | trang-tri-phong.html |
| `assets/ui/connection-v13.js`, `ui-v11.*`, `ux-v13.*` | tất cả trang |
| `board-ui-v8.*` + `board-ui-v14.*` | 5 trang cờ (2 lớp cùng nạp) |
| `tournament-v9.*` | giai-dau.html |
| `monopoly-data/logic`, `stockfish.*` | server + co-ty-phu/co-vua |

### 11.2 LEGACY — không còn runtime reference (chỉ docs/test nhắc)
| File | Bằng chứng | Đề xuất (chưa thực hiện) |
|---|---|---|
| `assets/ui/connection-v12.js` | **0 reference** | ứng viên xóa/đầu tiên, an toàn sau khi confirm không trang nào nạp |
| `server/modules/survival-v11.js` | chỉ UPGRADE_V11/ARCHITECTURE_V11 | archive khi bỏ test liên quan |
| `assets/room/survival-v11.js/css` | chỉ UPGRADE/ARCHITECTURE V11 | archive |
| `server/modules/survival-v13.js` + `assets/room/survival-v13.*` | test-v13 + validate-project | **GIỮ đến khi thay test** (test-v13 là baseline) |

### 11.3 CHỨC NĂNG TRÙNG LẶP / SONG SONG
1. **2 lớp UI bàn cờ** (v8 + v14) — cùng nạp; hợp nhất sau khi xác nhận v14 cover v8.
2. **4 CSS learning** chồng nhau — hợp nhất thành `learning.css` theo component.
3. **Nhiều file survival** (v11/v13/v14 server + 3 cặp JS/CSS) — trùng chức năng địa hình/chế tạo.
4. **2 đường chấm bài nói/văn** (OpenAI + local) — đã có fallback, không phải trùng sai.
5. **Quest maintenance**: inline trong server (daily quest) + module V14 (job quá hạn) — 2 nơi làm việc với `user.quests`.
6. **Bài kiểm tra 2 hệ**: `/api/test*` (question-data, 6 môn × lớp × mức) và `/api/learning/lesson` (curriculum-data, 12 câu/bài) — hai nguồn câu hỏi rời nhau, cùng chức năng "làm bài → điểm".

### 11.4 FILE/TÀI NGUYÊN CHẾT hoặc SAI
- `README.md` — **mô tả dự án Java "Quản lý thư viện số"**, hoàn toàn không liên quan → phải viết lại (Phase 19).
- `assets/ui/connection-v12.js` — 0 reference.
- `/api/admin/learning-overview` — route sống nhưng chưa trang nào gọi (admin chưa có analytics).
- `stockfish.wasm` — được load runtime bởi `stockfish.js` (0 reference text, nhưng KHÔNG được coi là chết).

---

## 12. LỖI KIẾN TRÚC & CODE DUPLICATION

### 12.1 Lỗi kiến trúc chính
1. **God file `server.js` (5.141 dòng):** auth + schema + 105 route + scoring + socket + game logic (mục 41/74).
2. **Không có layer:** route kiêm repository/service/validator; query Mongo rải rác trong handler.
3. **Không có Express Router module:** mọi route inline → không tách được theo domain.
4. **Curriculum hard-code trong code, không trong DB:** không CMS, không versioning, không audit, không import Word (mục 18–20, 28 chưa có).
5. **Nội dung sinh procedural:** `curriculum-data.js` sinh câu hỏi/lý thuyết theo hash+template → "12 lớp × 144 lộ trình" là **khung**, không phải nội dung chuyên môn đã xác minh; cần đánh dấu `unverified`.
6. **`PASS_SCORE = 8` hard-code** (curriculum-data.js, dùng ở nhiều nơi) → không Admin-configurable (mục 14).
7. **Hai nguồn câu hỏi song song** (`question-data.js` tĩnh + `question-bank-complete.js` sinh) với format `{q,a,correct}` **khác** format lesson `{id,prompt,options,answer,skill}` → phải hợp nhất model Question (mục 15).
8. **`User` God model** — account + game + sinh tồn + kinh tế trong một document.
9. **Frontend "1 trang 1 thế giới":** business logic trong `<script>` nội tuyến (lo-trinh 156 dòng siêu dài, admin-panel 972 dòng, luyen-noi-tieng-anh 1.397 dòng) — không có api/state/service layer (mục 43).
10. **Chồng version CSS/JS** (mục 6.4) — mỗi nâng cấp thêm lớp thay vì hợp nhất.
11. **Response không chuẩn `{success,data}`** (mục 42); HTTP status phải audit lại route khi tách.
12. **State in-memory** (rooms, queue, rate-limit, maintenance) — không đa instance; chấp nhận được nhưng phải document.
13. **Test dựa trên `String.includes`** (`validate-project.js` soi chuỗi trong source) → vỡ khi refactor tên biến; phải bổ sung test hành vi (API) song song.

### 12.2 Code duplication (không phải trùng file)
- 13 route game-win lặp cấu trúc cộng điểm/level/quest (đã có hàm chung — cần xác minh mức độ khi tách).
- `if (!req.session.user) return 401` lặp lại ở nhiều route (`/api/house/*`…) thay vì dùng `requireAuth` thống nhất.
- Normalize chuỗi `String(...).trim().slice(...)` lặp ở mọi route.
- Helper `api()` được định lại trong từng trang/file → cần `assets/js/api.js` dùng chung.
- 2 bộ "làm bài → chấm điểm" (`/api/submit-test` vs `/api/learning/lesson/.../submit`) với 2 format câu hỏi khác nhau.

---

## 13. GAP ANALYSIS — yêu cầu 95 phần vs hiện trạng

| Yêu cầu | Trạng thái | Bằng chứng |
|---|---|---|
| Mục 7–9: Đăng ký họ tên/email/SDT/DOB/GameID + OTP + verification | **KHÔNG CÓ** | register chỉ `{username,password}` |
| Mục 6: Chương trình GDPT lớp 1–12 | **CÓ KHUNG** (thiếu curriculumSource + Admin CMS) | `curriculum-data.js`, `GRADE_SUBJECTS` 1–12, bắt buộc/lựa chọn THPT |
| Mục 3–4: Cấp học PRIMARY/SECONDARY/HIGHER_EDUCATION | **MỘT PHẦN** — chỉ 1–12, không khai báo `educationLevel` explicit, không đại học | GRADE_SUBJECTS |
| Mục 5, 44: Institution→Faculty→Field→Major→Program→Course | **KHÔNG CÓ** | không model nào |
| Mục 10: Survey CRUD + 6 loại câu hỏi | **KHÔNG CÓ** | — |
| Mục 11: Placement/diagnostic test | **KHÔNG CÓ** | — |
| Mục 12–13: LearningPathEngine + prerequisite | **MỘT PHẦN** — adaptive dashboard/week-plan/review có; **không có** PersonalLearningPlan, không prerequisite graph | server 1900–2400 |
| Mục 14: Mastery theo rule Admin cấu hình | **MỘT PHẦN** — mastery hard-code (≥9.5 mastered, >8 passed) | `getMasteryLevel` |
| Mục 15–16: Question engine 12 loại | **MỘT PHẦN** — MCQ + speaking + essay riêng lẻ | — |
| Mục 17: Lesson tách theory/practice/assessment | **MỘT PHẦN** — lesson pack có theory+questions nhưng sinh procedural | — |
| Mục 18–19: Admin Education CMS 29 module | **KHÔNG CÓ** (admin chỉ game/user/robux/quest) | admin-panel |
| Mục 20: Curriculum versioning | **KHÔNG CÓ** (1 `PROGRAM_VERSION` fixed) | — |
| Mục 21: TOEIC 4 kỹ năng | **KHÔNG CÓ** | — |
| Mục 22–23: IELTS AG/GT + band estimate | **KHÔNG CÓ** | — |
| Mục 24–25: English placement + mapping có nguồn | **KHÔNG CÓ** | — |
| Mục 26–27: National exam mode + sourceType | **KHÔNG CÓ** | — |
| Mục 28–29: Import Word + parser | **KHÔNG CÓ** | — |
| Mục 30–31: Dashboard HS + sinh viên | **MỘT PHẦN** — dashboard HS khá đầy đủ; **không có** view sinh viên | adaptive-dashboard |
| Mục 32: Learning → Gamification event | **CHƯA TÁCH** | — |
| Mục 33: Notification service chuẩn | **CƠ BẢN** (thiếu priority/read/expires/event) | — |
| Mục 35: Admin user management search/filter/pagination | **MỘT PHẦN** — list + CRUD, chưa filter/pagination/verification | `/api/admin/all-users` |
| Mục 36: RBAC permission | **KHÔNG CÓ** (3 role thô, không enum) | — |
| Mục 38: Audit log | **KHÔNG CÓ** | — |
| Mục 41–42: Tách route + chuẩn response | **CHƯA** | — |
| Mục 47: Exam Engine (sections, timer backend) | **MỘT PHẦN** — cần xác minh timer server-side ở `/api/test` | server 3139–3288 |
| Mục 50: Search/filter/pagination | **KHÔNG CÓ** | — |
| Mục 51: Analytics admin | **MỘT PHẦN** — API `learning-overview` có sẵn, chưa có trang | — |
| Mục 53: Learning Path Rules admin-config | **KHÔNG CÓ** | — |
| Mục 57: Onboarding flow | **KHÔNG CÓ** | — |
| Mục 58: Regenerate plan versioned | **KHÔNG CÓ** | — |
| Mục 60: Migration script | **CHƯA CẦN** (chưa đổi schema) → bắt buộc từ Phase 15 | — |
| Mục 63–68: Test auth/personalization/university/TOEIC/IELTS | **CHƯA** — hiện chỉ 3 test kỹ thuật | scripts/ |
| Mục 70: SOURCE_REGISTRY | **KHÔNG CÓ** (CURRICULUM_AUDIT.md + UPGRADE_V8 có nhắc thông tư — nền tốt) | — |
| Mục 84: Acceptance flow 17 bước | **CHƯA** | — |
| Mục 59: Giữ chức năng hiện có | **ĐANG GIỮ** — mục 6, 10, 11 là danh sách đầy đủ | — |
| Mục 61: DB index mới | Xem mục 5 | — |

---

## 14. BẢN ĐỒ PHỤ THUỘC GIỮA CÁC MODULE

```
[question-data.js] ──require──► server.js (/api/test*, /api/submit-test)
[question-bank-complete.js] ──gọi bởi── server.js (bổ sung câu hỏi)
[curriculum-data.js] ──require──► server/modules/lesson-theory-v14.js
[curriculum-data.js] ──require──► server.js (catalog/lesson/roadmap/scoring/report)
[server/modules/learning-v11.js] ──require──► server.js
[server/modules/quest-maintenance-v14.js] ──require──► server.js + scripts/test-v14
[server/modules/survival-v14.js] ──require──► server.js + scripts/test-v14
[server/modules/survival-v13.js] ──require──► scripts/test-v13 (baseline)
[monopoly-data] ──► monopoly-logic ──► server.js
[lo-trinh-hoc-tap.html] ──nạp──► learning-v10/v11/v13/v14.css, learning-v11+v13.js,
                                  book-catalog.js, practical-assessment.js, ui-v11, connection-v13, ux-v13
[mọi trang HTML] ──nạp──► modern-ui.*, assets/ui/ui-v11.*, connection-v13.js, ux-v13.*
[5 trang cờ] ──nạp──► board-ui-v8.* + board-ui-v14.*
[trang-tri-phong.html] ──nạp──► room-v10.* + survival-v14.*
scripts/validate-project.js ──soi chuỗi──► server.js + hầu hết asset (test cấu trúc)
```

**Hệ quả khi refactor:** đổi `curriculum-data.js` ảnh hưởng `server.js` + `test-v14`; đổi format câu hỏi sẽ vỡ `validate-project`; đổi tên file asset sẽ vỡ nhiều trang HTML.

---

## 15. NGUYÊN TẮC AN TOÀN KHI REFACTOR (rủi ro & compatibility)

1. **Giữ nguyên 105 URL API** ở mục 4 (đặc biệt 25 `/api/learning/*`) — đổi implementation, không đổi contract; nếu phải đổi → adapter.
2. **Không đổi tên collection** (`users`, `learningrecords`…) → migration chỉ *thêm* trường; mọi migration idempotent + đếm document trước/sau (mục 86).
3. **Không đụng `User.password`, `history`, `score`, `*Level`, `inventory`, `survivalState`, `quests`** khi tách model — đọc/ghi qua repository compatibility.
4. **Trang HTML đang chạy phải chạy sau mỗi phase** — tách router ra, giữ nguyên nội dung handler từng bước.
5. **Baseline 3 test phải PASS** sau mỗi phase.
6. **Không `git add .` / `reset --hard` / commit / push** (mục 87).
7. **`question-data.js` không được xóa** — `bai-kiem-tra.html` đang dùng; hợp nhất vào Question engine bằng migration.
8. Nội dung procedural **sai chuyên môn** → đánh dấu `unverified` cho Admin sửa, không bịa thế vào chỗ.

---

## 16. BẢO MẬT & QUYỀN RIÊNG TƯ — ghi nhận Phase 0

**Đã có (giữ):** session httpOnly + regenerate, bcrypt, origin-check, rate limit auth, cắt answer khỏi lesson API, admin route guard tập trung (`app.use('/api/admin', requireAdmin)`), không log mật khẩu.
**Cần làm (Phase 17):** security headers; chặn serve công khai `question-data.js`; RBAC permission server-side; bỏ niềm tin `localStorage.role`; audit log; validate/escape input; chuẩn error 4xx; giới hạn upload khi có Word import (MIME/size/path traversal); OTP rate limit + không log plaintext; kiểm tra prototype pollution; privacy: không gửi trường thừa xuống client (hiện `/api/user/progress` trả `-password` — tốt, cần rà thêm); kiến trúc guardian/consent cho user vị thành niên (chưa tự tuyên bố tuân thủ pháp luật).

---

## 17. KIỂM CHỨNG PHASE 0

- ✅ Đọc & phân loại toàn bộ cấu trúc project (40 HTML, 34 JS, 11 module server, docs).
- ✅ Trích xuất đủ 105 API + kiểm tra trùng lặp (không có route trùng).
- ✅ Liệt kê 11 model/schema + indexes.
- ✅ Reference scan cho mọi file version → kết luận LIVE / LEGACY / CHẾT có bằng chứng.
- ✅ Chạy baseline: `validate-project` + `test-v13` + `test-v14` → **PASS**.
- ✅ `git status` trước khi bắt đầu: working tree sạch (các `.txt` tạm do audit tạo sẽ bị xóa sau khi tài liệu này hoàn tất).
- ⬜ Chưa khởi động server thật (cần `MONGO_URI`) — thực hiện khi Phase 2 bắt đầu.

---

## 18. LỘ TRÌNH PHASE ĐỀ XUẤT (mục 88) & EXIT CRITERIA

| Phase | Nội dung | Exit criteria |
|---|---|---|
| 0 | **Audit (tài liệu này)** | `FULL_PROJECT_AUDIT.md` đầy đủ ✅ |
| 1 | Kiến trúc đích: `docs/ARCHITECTURE.md`, `SOURCE_REGISTRY.md`, khung response chuẩn, khung router `server/routes/*` | docs + quyết định model xong, chưa vội code |
| 2 | Auth/User/Profile: register mở rộng (họ tên/email/SDT/DOB/GameID), verification state, tách profile, RBAC skeleton | test register/validation PASS; API cũ chạy |
| 3 | Education/Curriculum: model CurriculumVersion/Subject/Unit/Lesson trong DB + seed framework + adapter API cũ | `/api/learning/*` trả kết quả như baseline |
| 4 | University: model institution→course + admin CRUD | test cách ly university A/B |
| 5 | Question/Assessment/Exam Engine: hợp nhất 2 nguồn câu hỏi, 12 loại câu, timer server-side | test question types PASS |
| 6 | Survey + Placement | khảo sát → kết quả lưu được |
| 7 | LearningPathEngine + rules versioned + mastery config | 6 user demo → 6 lộ trình khác nhau |
| 8 | TOEIC 4 skills | test 4 kỹ năng, report 4 skill |
| 9 | IELTS AG/GT + band estimate | test 4 band + overall đúng nguyên tắc |
| 10 | National Exam blueprint | Admin tạo blueprint theo cấu hình |
| 11 | Admin CMS 29 module + audit log | CRUD qua UI, có audit |
| 12 | Word import `.docx` (preview/validate/commit) | import mẫu có VALID/WARNING/ERROR |
| 13 | Gamification event bus (Learning→XP→Achievement→Reward) | game cũ vẫn chạy |
| 14 | Notification service mở rộng | event → notification |
| 15 | Migration `scripts/migrations/*` + backup + đếm trước/sau | idempotent, không mất progress |
| 16 | Frontend cleanup: api/state/components, hợp nhất CSS/JS version, responsive/a11y | 3 test + smoke từng trang |
| 17 | Security audit | checklist mục 16 PASS |
| 18 | Testing toàn bộ (mục 63–68) + acceptance flow (mục 84) | `TEST_REPORT.md` |
| 19 | Documentation (mục 80–81) + README đúng dự án | docs đầy đủ |

**QUY TẮC BẤT DI BẤT DỊCH:** Tổ chức lại → hợp nhất → chuẩn hóa → migrate → test → *sau đó* mới thêm tính năng thiếu. KHÔNG "thêm file để giải quyết vấn đề kiến trúc". KHÔNG xóa chức năng nào trừ khi đã trace reference (mục 11 của tài liệu này).

---

*END PHASE 0 — AUDIT. Mọi hành động ở phase sau phải đối chiếu tài liệu này; không được tuyên bố hoàn thành tính năng khi chưa có code/test chứng minh.*

# ARCHITECTURE — HÀNH TRÌNH MỚI (kiến trúc đích)

> Architecture baseline plus implementation foundation for Phases 2–17.
> Căn cứ: `docs/FULL_PROJECT_AUDIT.md`. Platform foundation đã được triển khai song song với runtime legacy; các phase frontend/deep integration tiếp tục hoàn thiện trước Phase 18.

## 1. Nguyên tắc

1. Monolith Express + MongoDB **vẫn giữ** (đúng hạ tầng hiện có: Render, Mongoose, session, Socket.IO) — chỉ tổ chức lại bên trong.
2. URL cũ không đổi (105 route) — thêm route mới theo namespace; route cũ chuyển sang gọi service.
3. Backend là nguồn sự thật: không tin `userId/role/verified/grade` từ client.
4. Thêm mới không ghi đè: migration idempotent, curriculum có version, plan có version.
5. Không file "v15" chồng version — dùng module có tên ổn định + adapter khi cần.
6. Platform routes/models are mounted alongside legacy routes; migration is explicit and never runs at server startup.

## 2. Cấu trúc thư mục đích

```
server.js                  # CHỈ: app init, middleware, db connect, mount routes, error handler
server/
  config/                  # env, constants, version
  models/                  # platform schemas; legacy schemas remain compatible in server.js during migration
  repositories/            # mọi query Mongo (UserRepository, QuestionRepository…)
  services/                # AuthService, RegistrationService, VerificationService,
                           # CurriculumService, LessonService, AssessmentService, ScoringService,
                           # PlacementService, LearningPathService, RecommendationService,
                           # ToeicService, IeltsService, UniversityService,
                           # NotificationService, GamificationService, AuditService
  validators/              # input schemas (builtin validator, không thêm lib mới nếu chưa cần)
  middleware/              # requireAuth, requirePermission, rateLimit, error, response envelope
  routes/                  # auth, users, profile, education, curriculum, learning, assessment,
                            # question-bank, english/toeic/ielts, university, admin/*, notifications,
                           # gamification, games, tournaments, house, survival, health
  modules/                 # GIỮ: survival-v14, quest-maintenance-v14, lesson-theory-v14,
                           # learning-v11 (BOOKS/practical) — không đổi tên khi chưa có adapter
  socket/                  # toàn bộ logic Socket.IO (tách khỏi routes)
assets/js/                 # api.js, state.js, components/ (dùng chung cho mọi trang)
scripts/migrations/        # 001-users-profile.js … (idempotent, có log đếm trước/sau)
docs/                      # tài liệu (mục 80)
```

Platform catalog lifecycle được tách ở `server/routes/platform-catalog-routes.js`.
Module này đăng ký CRUD có permission/audit cho achievement, reward và English test
config, cùng list/update cho Word Import staging. Survey, placement test và flow
preview/commit Word Import tiếp tục dùng route chuyên biệt trong `platform-routes.js`
để bảo toàn validation và compatibility.

## 3. Chuẩn API (mục 42)

- Thành công: `{ "success": true, "data": ... }`
- Lỗi: `{ "success": false, "code": "VALIDATION_ERROR", "message": "...", "details": [...] }`
- HTTP: 400 validate, 401 chưa đăng nhập, 403 sai quyền, 404 không thấy, 409 trùng, 429 rate limit, 500 server.
- **Tương thích:** mọi response giữ thêm field `message` cũ để frontend cũ (`data.message`) không vỡ.
- Mọi route API đi qua middleware `envelope` tự bọc kết quả.

## 4. RBAC (mục 36)

- Roles giữ hợp lệ: `child`, `parent`, `admin` (thêm khi cần: `teacher`, `content_editor`, `exam_manager`, `super_admin`).
- Permission dạng `learning.lesson.read|create|update|publish`, `question.create|import`, `exam.publish`, `curriculum.manage`, `path.manage`, `user.manage`, `system.manage`.
- `requirePermission('x.y.z')` kiểm ở **backend**; `requireAdmin` cũ được cài lại dựa trên permission map để URL cũ vẫn chạy.
- `localStorage.role` chỉ còn dùng để hiển thị, không bao giờ quyết định quyền.

## 5. Mô hình dữ liệu giáo dục (tách collection — mục 37)

**Giữ nguyên (không đổi tên):** users, tournaments, learningrecords, learningsettings, learningprofiles, learningnotes, learningselfassessments, learningpracticals, learningactivities, notifications, robuxredemptions.

**Thêm (Phase 2–7):**
- `users` +: `fullName, email, phone, dob{day,month,year}, age(computed backend), gameId, emailVerified, phoneVerified, verificationStatus, accountStatus, educationStatus`
- `profiles`, `educationProfiles` (level, grade, institution, major, cohort, semester)
- Catalog: `educationSystems, educationLevels, grades, subjects`
- `curriculumVersions` (kèm `curriculumSource`), `units`, `lessons` (objectives/theory/practice/assessment, `status: draft|published|archived`)
- `questions` (12 `type` theo mục 15, `sourceType` theo mục 27), `questionBanks`
- `assessments, assessmentAttempts, submissions` (essay → `PENDING_REVIEW`)
- Đại học: `universities, faculties, fields, disciplineGroups, majors, specializations, trainingPrograms, courses` (credits, prerequisite/coRequisite, category)
- `surveys, surveyAttempts`, `placementTests, placementAttempts`
- `learningPlans` + `learningPlanVersions` (ACTIVE/ARCHIVED), `learningPathRules` (versioned), `skillMastery`
- `achievements, rewards, auditLogs`

**Index (mục 61):** `email`(unique, lowercase), `phone`(unique), `gameId`(unique), `status`, `username`, `grade`, `subjectId`, `courseId`, `lessonId`, `createdAt` — kiểm tra duplicate index khi thêm.

## 6. Engines

- **Curriculum Engine (P3):** EducationSystem → Level → Grade (1–12, không 0/13) → Subject → CurriculumVersion → Unit → Lesson. THPT: bắt buộc/lựa chọn/chuyên đề/tổng hợp **do Admin cấu hình** (không hard-code tổ hợp). Nội dung procedural hiện tại → đánh dấu `unverified`, Admin chỉnh sửa.
- **Question/Assessment/Exam Engine (P5):** 12 loại câu hỏi; Exam có sections/parts/duration/attempts/scoring/passing/randomization/pool; **timer server-side** (hết hạn do server quyết định); essay → `PENDING_REVIEW`.
- **Survey + Placement (P6):** đăng ký → xác thực → hồ sơ → khảo sát → placement → phân tích → đề xuất → xác nhận → LearningPlan.
- **LearningPathEngine (P7):** input: userProfile, educationStatus, age, survey, placement, goals, weaknesses, deadline → output `PersonalLearningPlan` (subjects[], milestones, weeklyPlan, recommendations, version). Recommendation xét điểm đầu vào, prerequisite, lịch sử sai, tốc độ, retention; Admin cấu hình `learningPathRules` (mục 53).
- **English (P8–9):** TOEIC 4 skill (Listening/Reading/Speaking/Writing theo cấu trúc ETS; speaking có record + timer; writing có word count) và IELTS Academic/GT (task/ band theo rubric chính thức). Lưu `listeningBand/readingBand/writingBand/speakingBand/overallBand + scoreEvidence + rubricVersion`; UI ghi **"Estimated/Diagnostic Band"**; KHÔNG quy đổi IELTS↔TOEIC nếu không có bảng concordance có nguồn.
- **National Exam (P10):** `ExamBlueprint` versioned (name/year/subject/coverage/questionTypes/sections/duration/scoring); `sourceType`: OFFICIAL_PUBLIC_SAMPLE / OFFICIAL_REFERENCE / ORIGINAL_PRACTICE / SIMULATION / ADMIN_CREATED; UI: "Đề mô phỏng theo cấu trúc kỳ thi…".
- **Gamification (P13):** Learning phát event (`LESSON_COMPLETED`, `ASSESSMENT_COMPLETED`, `STREAK_UPDATED`, `SKILL_MASTERED`, `REVIEW_DUE`, `PATH_UPDATED`) → XP → Achievement → Reward; lesson KHÔNG ghi thẳng nhiều collection.

## 7. Frontend (mục 43)

- `assets/js/api.js` (fetch + envelope + lỗi chuẩn), `state.js`, `components/` (button, modal, table, toast, empty, loading, error); CSS gộp theo component thay vì theo version.
- Learning: `learning-api.js, learning-state.js, roadmap.js, lesson.js, question-renderer.js, assessment.js, result.js, review.js`.
- Admin: `admin-learning.js, admin-curriculum.js, admin-question-bank.js, admin-exam.js, admin-import.js, admin-survey.js, admin-university.js`.
- HTML chỉ dựng giao diện; mỗi trang đủ 4 trạng thái Loading/Empty/Error/Success; responsive Desktop→Mobile; a11y (keyboard, focus, aria); audio dùng MediaRecorder có MIME/size/duration limit + fallback rõ ràng.

## 8. Chiến lược chuyển đổi (không đụng dữ liệu cũ)

1. Tách route → service **giữ nguyên handler logic** từng bước (strangler fig), test lại bằng baseline.
2. Model mới thêm trường/collection song song; **không rename** collection cũ.
3. `curriculum-data.js` & `question-data.js` trở thành **nguồn seed + adapter**: API cũ vẫn trả từ adapter, dữ liệu mới nạp DB qua `scripts/migrations/*`.
4. Mỗi thay đổi phải được rà soát bằng source/diff trước khi commit; không chạy kiểm thử trong implementation pass này theo phạm vi công việc.

## 9. Implementation foundation status

Implemented in the current working tree: stable platform constants, versioned source/curriculum schemas, university hierarchy schemas, question/assessment/survey/placement schemas, learning-plan/mastery schemas, English assessment records, audit/notification records, repository abstraction, placement/learning-path/English services, compatibility-preserving platform routes, and idempotent migration definitions. Database execution and full testing are intentionally deferred to Phase 18 under the execution strategy.
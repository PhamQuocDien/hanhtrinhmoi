# API — HÀNH TRÌNH MỚI

Ngày cập nhật: **06/10/2026**.

Các route mới dùng session hiện có, không nhận `userId`/`role` từ client để quyết định quyền. Response mới dùng `{ success, data, message }`; lỗi dùng `{ success:false, code, message, details? }`. Các route legacy vẫn được giữ nguyên.

## Public/catalog

| Method | Path | Auth | Permission | Ghi chú |
|---|---|---|---|---|
| GET | `/api/education/curriculum-versions` | Không bắt buộc | — | Pagination `page`, `limit` |
| GET | `/api/education/legacy-catalog?grade=1..12` | Không bắt buộc | — | Adapter đọc `curriculum-data.js`, không duplicate nội dung |
| GET | `/api/education/curriculum-versions/:id` | Không bắt buộc | — | Curriculum version |
| GET | `/api/education/curriculum-content` | Không bắt buộc | — | Filter theo version/type/grade |
| GET | `/api/university/university` | Không bắt buộc | — | Catalog cơ sở đào tạo |
| GET | `/api/university/faculty` | Không bắt buộc | — | Có thể filter `universityId` |
| GET | `/api/university/training-program` | Không bắt buộc | — | Chương trình đào tạo |
| GET | `/api/university/course` | Không bắt buộc | — | Có thể filter `programId` |
| GET | `/api/question-bank/questions` | Không bắt buộc | — | Không trả answer/rubric |
| GET | `/api/assessment/assessments` | Không bắt buộc | — | Assessment đã công bố |
| GET | `/api/survey/surveys` | Không bắt buộc | — | Survey đã công bố |
| GET | `/api/placement/tests` | Không bắt buộc | — | Placement test đã công bố |

`/api/learning/catalog`, `/api/learning/courses`, `/api/learning/courses/:id`, `/api/learning/lessons/:id` và `/api/learning/assessments` là namespace tương thích mới, được adapter tới các route education/assessment hiện hữu. Các route legacy `/api/learning/*` khác vẫn giữ nguyên.

## Learner

| Method | Path | Auth | Permission |
|---|---|---|---|
| POST | `/api/assessment/:id/attempts` | Session | Learner |
| POST | `/api/assessment/attempts/:id/submit` | Session | Owner attempt |
| POST | `/api/survey/:id/attempts` | Session | Learner |
| POST | `/api/placement/:id/attempts` | Session | Learner |
| GET | `/api/learning-platform/plan` | Session | Owner |
| POST | `/api/learning-platform/plan/generate` | Session | Owner |
| POST | `/api/learning-platform/mastery` | Session | Owner |
| GET | `/api/learning-platform/mastery` | Session | Owner-scoped mastery records |
| POST | `/api/english/:exam/plan` | Session | Owner |
| POST | `/api/english/ielts/estimate` | Session | Owner |
| POST | `/api/english/assessments` | Session | Owner |
| GET | `/api/english/assessments` | Session | Owner-scoped English assessment history |

## Admin/content

| Method | Path | Permission |
|---|---|---|
| POST | `/api/education/curriculum-versions` | `learning.curriculum.manage` |
| POST | `/api/education/curriculum-content` | `learning.lesson.create` |
| POST | `/api/question-bank/questions` | `learning.question.create` |
| POST | `/api/assessment/assessments` | `learning.exam.create` |
| POST | `/api/university/*` | `university.manage` |
| POST | `/api/admin/platform/sources` | `system.manage` |
| GET | `/api/admin/platform/sources` | `system.audit.read` |
| PATCH/DELETE | `/api/admin/platform/{resource}/:id` | Domain permission | Update hoặc archive, không xóa vật lý |
| PATCH/DELETE | `/api/university/{resource}/:id` | `university.manage` | Update hoặc archive hierarchy đại học |
| PATCH | `/api/notifications/:id/read` | Session + owner | Đánh dấu notification đã đọc |
| PATCH | `/api/notifications/read-all` | Session | Đánh dấu notification cá nhân/broadcast đã đọc |
| POST | `/api/gamification/events` | Session | Event idempotent; unlock/reward và owner notification chỉ khi Achievement/Reward đã cấu hình |
| GET/POST/PATCH/DELETE | `/api/admin/platform/achievements` | `gamification.manage` | Quản lý achievement catalog, archive mềm |
| GET/POST/PATCH/DELETE | `/api/admin/platform/rewards` | `gamification.manage` | Quản lý reward catalog, archive mềm |
| GET/POST/PATCH/DELETE | `/api/admin/platform/surveys` | `learning.survey.manage` | Survey CMS lifecycle |
| GET/POST/PATCH/DELETE | `/api/admin/platform/placement-tests` | `learning.placement.manage` | Placement CMS lifecycle |
| GET/POST/PATCH/DELETE | `/api/admin/platform/english-configs` | `english.toeic.manage` | TOEIC/IELTS config lifecycle; sourceRef giữ trạng thái xác minh |
| GET/PATCH | `/api/admin/platform/word-imports` | `learning.question.import` | Staging metadata; upload/preview/commit dùng flow `/api/admin/platform/word-imports/preview` và `/:id/commit` |
| PATCH/POST/DELETE | `/api/admin/platform/sources/:id` | `system.manage` | Update, verify, archive source registry |
| GET | `/api/admin/platform/audit-logs` | `system.audit.read` | Audit có filter và pagination |

## Compatibility and safety

- `/api/learning/*`, `/api/register`, `/api/login`, game, tournament and parent routes are legacy-compatible and were not removed.
- Assessment expiration is checked by the backend using `expiresAt`.
- Question catalog responses omit answer/rubric fields.
- IELTS output is labelled Estimated/Diagnostic and does not claim an official certificate.
- Source entries remain versioned; unverified sources must not be displayed as official.
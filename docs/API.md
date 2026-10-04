# API

Mọi phản hồi dùng cùng một định dạng:

```json
{ "success": true, "data": ... }
```

hoặc khi lỗi:

```json
{ "success": false, "code": "...", "message": "...", "requestId": "..." }
```

> Trong môi trường production, phản hồi lỗi **không** chứa dấu vết ngăn xếp.

Tổng cộng **50** route của nền tảng học tập.

## Danh sách route

| Phương thức | Đường dẫn |
|---|---|
| `GET` | `/api/admin/audit-logs` |
| `GET` | `/api/admin/catalog` |
| `GET` | `/api/admin/curriculum/tree` |
| `GET` | `/api/admin/exams` |
| `POST` | `/api/admin/exams` |
| `GET` | `/api/admin/exams/:examId` |
| `PUT` | `/api/admin/exams/:examId` |
| `GET` | `/api/admin/exams/:examId/attempts` |
| `POST` | `/api/admin/exams/:examId/publish` |
| `POST` | `/api/admin/exams/:examId/status` |
| `GET` | `/api/admin/grading/attempts/:attemptId` |
| `POST` | `/api/admin/grading/attempts/:attemptId/grade` |
| `POST` | `/api/admin/grading/attempts/:attemptId/grade-bulk` |
| `GET` | `/api/admin/grading/pending` |
| `GET` | `/api/admin/grading/stats` |
| `GET` | `/api/admin/imports` |
| `GET` | `/api/admin/imports/:jobId` |
| `PUT` | `/api/admin/imports/:jobId` |
| `POST` | `/api/admin/imports/:jobId/publish` |
| `POST` | `/api/admin/imports/docx` |
| `GET` | `/api/admin/questions` |
| `POST` | `/api/admin/questions` |
| `DELETE` | `/api/admin/questions/:questionId` |
| `GET` | `/api/admin/questions/:questionId` |
| `PUT` | `/api/admin/questions/:questionId` |
| `GET` | `/api/admin/questions/stats` |
| `GET` | `/api/admin/students` |
| `POST` | `/api/auth/change-password` |
| `GET` | `/api/auth/check-username` |
| `POST` | `/api/auth/login` |
| `POST` | `/api/auth/logout` |
| `GET` | `/api/auth/me` |
| `POST` | `/api/auth/register` |
| `GET` | `/api/health` |
| `DELETE` | `/api/student/attempts/:attemptId` |
| `GET` | `/api/student/attempts/:attemptId` |
| `PUT` | `/api/student/attempts/:attemptId/answers` |
| `POST` | `/api/student/attempts/:attemptId/submit` |
| `GET` | `/api/student/attempts/history` |
| `GET` | `/api/student/curriculum/grades` |
| `GET` | `/api/student/curriculum/grades/:grade/subjects` |
| `GET` | `/api/student/curriculum/grades/:grade/subjects/:subjectId` |
| `GET` | `/api/student/curriculum/lessons/:lessonId` |
| `GET` | `/api/student/curriculum/overview` |
| `GET` | `/api/student/exams` |
| `GET` | `/api/student/exams/:examId` |
| `POST` | `/api/student/exams/:examId/attempts` |
| `GET` | `/api/student/progress/:grade` |
| `POST` | `/api/student/progress/lessons/complete` |
| `GET` | `/api/student/questions/practice` |

## Phân quyền

- `/api/auth/*` — đăng ký, đăng nhập, đăng xuất, đổi mật khẩu.
- `/api/student/*` — yêu cầu đã đăng nhập (`requireAuth`).
- `/api/admin/*` — yêu cầu đã đăng nhập **và** có vai trò `admin` (`requireAdmin`).

Quyền luôn lấy từ phiên ở máy chủ, không lấy từ body hay header do client gửi.

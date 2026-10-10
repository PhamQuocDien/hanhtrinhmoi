# Admin CMS Foundation

Platform API có permission-gated endpoints cho curriculum, university, question bank, assessment, source registry, English config, learning path rules, notifications và Word import preview/commit.

CMS mutation dùng `PATCH` và archive mềm qua `DELETE` trên namespace `/api/admin/platform/*`; dữ liệu không bị xóa vật lý. Assessment archive ghi vào `publicationStatus`, các domain còn lại dùng `status`. Catalog public mặc định chỉ trả curriculum/assessment đã công bố và university record `ACTIVE`.

Mọi content mutation mới ghi audit entry. Publish/unpublish và màn hình CMS hoàn chỉnh cần tiếp tục tích hợp ở frontend phase; source chưa verified không được hiển thị là official.

Gamification event xử lý server-side theo Achievement/Reward catalog đã cấu hình. Achievement/reward notification dùng idempotency key, nên retry event không gửi trùng thông báo; email/push delivery chưa được bật tự động.
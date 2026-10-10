# Personalization Engine

Catalog và personal path là hai lớp khác nhau. Catalog chứa program/course/lesson/practice/assessment đã publish; personal path chỉ tham chiếu các ID phù hợp với user.

`buildPersonalLearningPlan` nhận education stage, age, declared education status/current grade, survey, placement, strengths, weaknesses, goal, deadline và progress. Age chỉ là input suy luận, không tự ép grade. Kết quả là plan versioned gồm subjects, milestones, weekly plan, diagnostics và recommendations; mỗi subject plan có thể mở rộng tới course/lesson/assessment/mastery.

Mastery lưu server-side theo skill/topic/lesson/subject qua `SkillMastery`. Next lesson phải ưu tiên prerequisite, mastery, score/error history, reviewDueAt, goal/deadline và path rule; không dùng cứng `lesson index + 1` cho mọi user.

Learning path rules được lưu bằng `LearningPathRule` versioned để Admin điều chỉnh score threshold, mastery, prerequisite, review interval, workload và exam timeline.
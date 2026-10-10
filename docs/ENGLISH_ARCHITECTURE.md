# English Architecture

English là subsystem tách khỏi K12/University:

- `TOEIC → Placement → SkillProfile → Listening/Reading/Speaking/Writing → Practice/Mock → Result → PersonalizedPath`.
- `IELTS → Academic|General Training → Placement → Listening/Reading/Writing/Speaking → Practice/Mock → EstimatedResult → PersonalizedPath`.

`EnglishTestConfig` được version hóa cho cấu hình test; `EnglishAssessment` lưu skill profile, evidence, rubric/version và sourceRef. Nội dung tự tạo phải ghi `ORIGINAL_PRACTICE` hoặc `SIMULATION`. IELTS output là `Estimated/Diagnostic Band`; hệ thống không tuyên bố chứng chỉ chính thức và không quy đổi TOEIC↔IELTS nếu không có bảng concordance có nguồn.
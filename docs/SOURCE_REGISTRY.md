# SOURCE_REGISTRY — HÀNH TRÌNH MỚI

> Phase 1. Quản lý nguồn chuẩn giáo dục/kiểm thử (mục 2, 70).
> **Quy tắc:** mọi curriculum blueprint/đề thi trong hệ thống phải trỏ về một mục aquí. Mục nào chưa đọc toàn văn → `verification: unverified` → KHÔNG được hiển thị là "chính thức" trong UI; Admin chỉnh sửa được.
> **Ngày tra cứu:** 10/06/2026 (tra cứu tiêu đề + URL trên nguồn công khai; **cần đọc toàn văn văn bản trước khi đưa nội dung vào code**).

## 1. Phổ thông — Chương trình GDPT hiện hành (nguồn chuẩn Phase 3)

| sourceName | sourceType | documentName | documentNumber | status / ghi chú | verification |
|---|---|---|---|---|---|
| Bộ GDĐT | official | Chương trình giáo dục phổ thông (ban hành kèm TT) | 32/2018/TT-BGDĐT | Căn cứ gốc CTGDPT 2018 | verified-tiêu-đề (cần toàn văn) |
| Bộ GDĐT | official | Sửa đổi, bổ sung một số nội dung CTGDPT | 13/2022/TT-BGDĐT | Điều chỉnh CTGDPT 2018 | verified-tiêu-đề |
| Bộ GDĐT | official | Sửa đổi Thông tư 32/2018/TT-BGDĐT | 17/2025/TT-BGDĐT | Bản sửa đổi mới (2025) — **phải đối chiếu khi build curriculum** | **unverified** (chưa đọc toàn văn) |
| Cổng TT Chính phủ / Congbao | official | Văn bản hợp nhất CTGDPT | 02/VBHN-BGDĐT | Bản hợp nhất dùng tra cứu nhanh | verified-tiêu-đề |
| Bộ GDĐT | official | Quy định đánh giá HS tiểu học | 27/2020/TT-BGDĐT | Đang được code hiện tại trích dẫn | verified-tiêu-đề |
| Bộ GDĐT | official | Quy định đánh giá HS THCS, THPT | 22/2021/TT-BGDĐT | Đang được code hiện tại trích dẫn | verified-tiêu-đề |

**Lưu ý code hiện tại:** `server.js` (dòng ~2102) trích 32/2018, 27/2020, 22/2021, 13/2022 — đã khớp mục này; cần bổ sung **17/2025** khi xác minh.

## 2. Thi tốt nghiệp THPT (Phase 10 — National Exam Blueprint)

| sourceName | sourceType | documentName | documentNumber | ghi chú | verification |
|---|---|---|---|---|---|
| Bộ GDĐT | official | Quy chế thi tốt nghiệp THPT từ năm 2025 | 24/2024/TT-BGDĐT | Quy chế thi | verified-tiêu-đề |
| Bộ GDĐT (vqa.moet.gov.vn) | official | Cấu trúc, định dạng đề thi tốt nghiệp THPT từ 2025 | (thông báo — cần ghi số văn bản khi đọc toàn văn) | Nguồn cấu trúc đề | verified-tiêu-đề |
| Cổng TT Chính phủ (xaydungchinhsach) | official | Cấu trúc, định dạng và đề thi minh họa TN THPT từ 2025 | — | Đề minh họa = OFFICIAL_REFERENCE/PUBLIC_SAMPLE | verified-tiêu-đề |

`sourceType` áp dụng trong code (mục 27): `OFFICIAL_PUBLIC_SAMPLE`, `OFFICIAL_REFERENCE`, `ORIGINAL_PRACTICE`, `SIMULATION`, `ADMIN_CREATED`. **Không bao giờ** ghi "đề thi thật" cho nội dung tự tạo.

## 3. Giáo dục đại học (Phase 4–5)

| sourceName | sourceType | documentName | documentNumber | ghi chú | verification |
|---|---|---|---|---|---|
| Chính phủ (QĐ TTg) | official | Khung trình độ quốc gia Việt Nam (bản hiện hành) | **39/2026/QĐ-TTg** (hiệu lực 07/9/2026) | Thay/ cập nhật QĐ 1982/QĐ-TTg (2021) | **unverified** — phải đọc toàn văn trước khi map level 6/7 |
| Chính phủ (QĐ TTg) | official | Khung trình độ quốc gia Việt Nam (bản 2021) | 1982/QĐ-TTg | Bản trước | verified-tiêu-đề |
| Bộ GDĐT | official | Chuẩn chương trình đào tạo; xây dựng, thẩm định CTĐT các trình độ GDĐH | 17/2021/TT-BGDĐT | Căn cứ chuẩn đầu ra ĐH | verified-tiêu-đề |
| Bộ GDĐT | official | Chương trình đào tạo các trình độ của giáo dục đại học | 54/2026/TT-BGDĐT | Có thể thay thế 17/2021 — **phải đối chiếu** | **unverified** |

**KHÔNG** hard-code số tín chỉ/curriculum cho mọi trường; program do Admin/Institution cấu hình.

## 4. Tiếng Anh quốc tế (Phase 8–9)

| sourceName | sourceType | documentName | url | verification |
|---|---|---|---|---|
| ETS | official | TOEIC Listening & Reading — About the test | ets.org/toeic/about/listening-reading.html | verified-tiêu-đề |
| ETS | official | TOEIC Speaking & Writing — About the test | ets.org/toeic/about/speaking-writing.html | verified-têu-đề |
| ETS | official | TOEIC 4-Skills Test | ets.org (toeic 4-skills page) | verified-tiêu-đề |
| IELTS (IELTS.org / British Council / IDP) | official | IELTS test format (Academic & General Training) | ielts.org — **cần tra cứu & ghi URL cụ thể** | **unverified** |

Quy tắc UI (mục 23, 91): "TOEIC-style practice", "IELTS diagnostic/Estimated band"; chỉ gọi *Official* khi nguồn chính thức + quyền sử dụng cho phép. **Không** công thức quy đổi IELTS↔TOEIC nếu chưa có bảng concordance có nguồn.

## 5. Quy trình cập nhật registry

1. Khi quy định thay đổi → tạo dòng mới với `effectiveDate`, không sửa dòng cũ (giống CurriculumVersion).
2. Mỗi `curriculumVersion` / `examBlueprint` / `englishTestConfig` bắt buộc có `sourceRef` → id dòng trong file này.
3. Mục `unverified` không được hiển thị nhãn "chính thức" trên UI.
4. Admin được phép bổ sung/sửa registry qua CMS Phase 11 (có audit log).
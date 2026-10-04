# Danh mục môn học

Nguồn duy nhất: `data/subjects/subject-registry.js`.

## Cấu trúc môn học

- **Bắt buộc** — môn bắt buộc trong chương trình.
- **Lựa chọn** — môn tự chọn theo định hướng (chủ yếu THPT).
- **Mạch nội dung** — thành phần của một môn tích hợp.

> Nội dung **bổ trợ** cho lớp nhỏ (ví dụ ngoại ngữ lớp 1-2) được ghi rõ là
> bổ trợ, **không** trình bày như môn chính thức.

## Danh sách môn

| Mã | Tên chính thức | Tên hiển thị | Lớp | Loại |
|---|---|---|---|---|
| toan | Toán | Toán | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | Bắt buộc |
| tieng_viet | Tiếng Việt | Tiếng Việt | 1, 2, 3, 4, 5 | Bắt buộc |
| ngu_van | Ngữ văn | Ngữ văn | 6, 7, 8, 9, 10, 11, 12 | Bắt buộc |
| tieng_anh | Ngoại ngữ | Tiếng Anh | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | Bắt buộc |
| dao_duc | Đạo đức | Đạo đức | 1, 2, 3, 4, 5 | Bắt buộc |
| tnxh | Tự nhiên và Xã hội | Tự nhiên và Xã hội | 1, 2, 3 | Bắt buộc |
| khoa_hoc | Khoa học | Khoa học | 4, 5 | Bắt buộc |
| lich_su_dia_li | Lịch sử và Địa lí | Lịch sử và Địa lí | 4, 5, 6, 7, 8, 9 | Bắt buộc |
| tin_hoc_cong_nghe | Tin học và Công nghệ | Tin học và Công nghệ | 3, 4, 5 | Môn tích hợp |
| gdcd | Giáo dục công dân | Giáo dục công dân | 6, 7, 8, 9 | Bắt buộc |
| khtn | Khoa học tự nhiên | Khoa học tự nhiên | 6, 7, 8, 9 | Môn tích hợp |
| lich_su | Lịch sử | Lịch sử | 10, 11, 12 | Bắt buộc |
| dia_li | Địa lí | Địa lí | 10, 11, 12 | Lựa chọn |
| gdktepl | Giáo dục kinh tế và pháp luật | Giáo dục kinh tế và pháp luật | 10, 11, 12 | Lựa chọn |
| gdtc | Giáo dục thể chất | Giáo dục thể chất | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | Bắt buộc |
| gdqp | Giáo dục quốc phòng và an ninh | GDQP&AN | 10, 11, 12 | Bắt buộc |
| nghe_thuat | Nghệ thuật | Nghệ thuật | 1, 2, 3, 4, 5, 6, 7, 8, 9 | Môn tích hợp |
| tin_hoc | Tin học | Tin học | 6, 7, 8, 9, 10, 11, 12 | Bắt buộc |
| cong_nghe | Công nghệ | Công nghệ | 6, 7, 8, 9, 10, 11, 12 | Bắt buộc |
| am_nhac | Âm nhạc | Âm nhạc | 6, 7, 8, 9, 10, 11, 12 | Mạch nội dung |
| mi_thuat | Mĩ thuật | Mĩ thuật | 6, 7, 8, 9, 10, 11, 12 | Mạch nội dung |
| hdtn | Hoạt động trải nghiệm | Hoạt động trải nghiệm | 1, 2, 3, 4, 5 | Bắt buộc |
| hdtnhn | Hoạt động trải nghiệm, hướng nghiệp | Hoạt động trải nghiệm, hướng nghiệp | 6, 7, 8, 9, 10, 11, 12 | Bắt buộc |
| dia_phuong | Nội dung giáo dục địa phương | Nội dung giáo dục địa phương | 6, 7, 8, 9, 10, 11, 12 | Lựa chọn |
| thong_tin_truyen_thong | Thông tin và truyền thông | Thông tin và truyền thông | 1, 2 | Mạch nội dung |
| vat_ly | Vật lí | Vật lí | 10, 11, 12 | Mạch nội dung |
| hoa_hoc | Hoá học | Hoá học | 10, 11, 12 | Mạch nội dung |
| sinh_hoc | Sinh học | Sinh học | 10, 11, 12 | Mạch nội dung |

## Môn tích hợp và mạch nội dung

Ở cấp THCS, Khoa học tự nhiên là **môn tích hợp**. Vật lí, Hoá học và Sinh học
được lưu dưới dạng mạch nội dung (`learningTracks`) chứ không phải ba môn độc
lập — đúng với cấu trúc chương trình. Giao diện hiển thị mạch nội dung kèm
môn chủ để tránh hiểu nhầm.

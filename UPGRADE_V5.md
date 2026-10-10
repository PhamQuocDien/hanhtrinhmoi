# Hành Tinh Mơ Ước 5.0

## Nội dung nâng cấp

### 1. Giải đấu
- Một luồng tạo/chia bảng duy nhất, tránh trùng mã trận và trạng thái.
- Hỗ trợ tự chọn thể thức, vòng bảng, loại trực tiếp, đặc cách, tự sinh vòng kế tiếp và bảng vinh danh.
- Lịch cá nhân, điểm danh, giới hạn người được vào phòng và thời điểm vào trận.
- Giao diện mới cho điện thoại và máy tính.

### 2. Lộ trình học tập riêng
- Trang `lo-trinh-hoc-tap.html` tách biệt hoàn toàn với `bai-kiem-tra.html`.
- Khung lớp 1–12, môn học theo cấp, bài học tuần tự, lý thuyết, mục tiêu, ý chính và 12 câu kiểm tra đa dạng mỗi bài.
- Điểm mở khóa mặc định phải trên 8/10; máy chủ mới mở bài tiếp theo, không dựa vào localStorage.
- Có mốc giữa kỳ/cuối kỳ và API quản trị để trường cập nhật ngày thực tế.
- Tiếng Anh có đọc mẫu, nhận giọng nói và chấm độ khớp.
- Ngữ văn/Tiếng Việt có chấm bài viết bằng OpenAI nếu cấu hình `OPENAI_API_KEY`, kèm phương án chấm cục bộ khi AI tạm ngừng.
- AI tổng hợp tiến độ, kỹ năng yếu và bài cần ôn.

> Nội dung trong dự án là nội dung nguyên bản bám khung Chương trình GDPT 2018, không sao chép nguyên văn sách giáo khoa. Vì Việt Nam áp dụng nhiều bộ sách và lịch kiểm tra do địa phương/nhà trường cụ thể hóa, quản trị viên cần nhập kế hoạch đúng của trường.

### 3. Game
- Caro online xác thực bàn cờ, lượt đi, thắng/hòa ở máy chủ; sửa lỗi vào mã phòng sai và lỗi lượt đầu.
- Cờ Tỷ Phú cải thiện giao diện, xử lý đổi lượt, trạng thái nút, thông báo và người chơi mất kết nối.
- Trang trí phòng có chế độ voxel đào/đặt, thêm vật liệu và ba mức đồ họa; `Siêu nhẹ` là mặc định.

### 4. AdSense
- Đã gắn mã kết nối/Auto Ads `ca-pub-2735044868175045` trong `<head>` của các trang HTML.
- Đã thêm `ads.txt`. Quảng cáo chỉ xuất hiện sau khi tên miền được Google phê duyệt và Auto Ads được bật.
- Đây là web hướng đến trẻ em: chủ website phải cấu hình xử lý theo độ tuổi, quyền riêng tư, sự đồng ý và vùng/Trang loại trừ phù hợp trước khi bật quảng cáo.

## Biến môi trường mới
```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
SCHOOL_YEAR=2026-2027
```

Không đưa khóa thật vào `.env.example`, HTML, JavaScript phía trình duyệt hoặc GitHub. Khóa đã từng dán vào chat phải được thu hồi và tạo lại.

## Kiểm tra
```bash
npm install
npm test
npm start
```

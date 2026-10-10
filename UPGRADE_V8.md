# Hành Tinh Mơ Ước V8

## 1. Hệ thống học tập theo định hướng giáo dục phổ thông

Bản V8 tổ chức dữ liệu theo lớp, môn, bài, chặng, học kỳ và năm học. Mỗi bài học có:

- Yêu cầu cần đạt.
- Năng lực chung và năng lực đặc thù môn học.
- Phẩm chất được rèn luyện.
- Hoạt động học, luyện tập và bài kiểm tra.
- Minh chứng đánh giá và thang mô tả mức độ.

Trang Lộ trình học có thêm hồ sơ giáo dục gồm bảng kết quả từng môn, 5 phẩm chất chủ yếu, 3 năng lực chung, mốc kiểm tra và bản tự đánh giá học kỳ.

Cấu trúc được xây theo định hướng Chương trình GDPT 2018 và các quy định đánh giá hiện hành:

- Thông tư 32/2018/TT-BGDĐT.
- Thông tư 27/2020/TT-BGDĐT đối với tiểu học.
- Thông tư 22/2021/TT-BGDĐT đối với THCS và THPT.
- Thông tư 13/2022/TT-BGDĐT điều chỉnh một số nội dung chương trình.

Dữ liệu và phân loại trên web chỉ hỗ trợ học tập, không phải học bạ hoặc kết quả chính thức do nhà trường cấp. Quản trị viên cần cập nhật lịch năm học, lịch kiểm tra và bộ sách đang sử dụng theo địa phương, cơ sở giáo dục.

## 2. Bàn cờ

- Sửa bố cục trang Đấu trường cờ để tất cả trò chơi nằm đúng trong lưới.
- Thêm bộ giao diện bàn cờ dùng chung, responsive trên điện thoại và máy tính.
- Có nút toàn màn hình, lên đầu trang, cảnh báo mất kết nối và chống menu chuột phải trên bàn.
- Cờ Vua và Othello có thể nhận mã phòng trực tiếp từ đường dẫn giải đấu.
- Cờ Vây tự co giãn canvas và quy đổi tọa độ chạm theo kích thước thật.
- Cờ Tỷ Phú hiển thị kết quả bằng hộp thoại thay vì cảnh báo thô.
- Othello đã sửa lỗi hàm dựng bàn bị lồng sai khiến bàn không render.
- Othello online được máy chủ xác thực nước đi, quân bị lật, lượt, bỏ lượt, thắng, hòa và thưởng điểm.

## 3. Trung tâm Giải đấu

- Thiết kế mới tương phản cao, chữ tối trên nền sáng.
- Thẻ trạng thái, số người, thời lượng, giai đoạn và tổng số trận.
- Trận gần nhất của người dùng và nút vào phòng đúng thời gian.
- Lịch cá nhân, vòng bảng, bảng điểm, cây đấu loại trực tiếp, lịch sử vòng và bảng vinh danh.
- Cây đấu có thể cuộn ngang trên điện thoại và làm nổi bật trận của người dùng.

## 4. Kiểm thử

Chạy:

```bash
npm test
```

Bộ kiểm tra V8 kiểm tra JavaScript độc lập, JavaScript nội tuyến trong HTML, tệp tham chiếu, API, cấu trúc chương trình 12 lớp, ngân hàng câu hỏi, giao diện bàn cờ, giao diện giải đấu và sự kiện Othello phía máy chủ.

## 5. Khu vực phụ huynh

Bảng điều khiển phụ huynh hiển thị thêm lớp đang học, năm học, học kỳ, mức hỗ trợ tổng quát, số bài đã đạt/thành thạo, chuỗi học, gợi ý ôn tập và bảng kết quả theo môn của từng trẻ. Thông tin này chỉ giúp phụ huynh theo dõi tiến bộ trên nền tảng.

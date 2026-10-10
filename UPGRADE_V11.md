# Hành Tinh Mơ Ước V11

## 1. Thế giới sinh tồn khối vuông

V11 bổ sung một khu sinh tồn riêng để không phá hỏng khu làng và căn phòng cũ của người chơi.

- Nhấn `V` hoặc chọn **Sinh tồn** để vào đảo sinh tồn.
- Có thể đào cỏ, đất, đá, thân cây, lá và quặng theo từng khối.
- Có thể đào xuyên lớp nền/móng xuống sâu; chỉ lớp đá nền cuối cùng không thể phá để tránh rơi vô hạn.
- Khối đã đào được lưu trên máy chủ và vẫn mất sau khi tải lại trang hoặc đăng nhập thiết bị khác.
- Máy chủ tự tính lại địa hình theo tọa độ, kiểm tra loại khối, quyền sở hữu/cấp công cụ và chống nhận vật phẩm hai lần; không thể giả tọa độ kim cương từ trình duyệt.
- Có máu, đói, thể lực, cấp sinh tồn, kinh nghiệm và số lần hồi sinh.
- Công cụ có cấp: tay không, cuốc gỗ, cuốc đá và cuốc sắt.
- Có chế tạo cuốc, đuốc và bánh mì; có thể ăn để hồi đói/máu.
- Địa hình chỉ được dựng khi vào chế độ sinh tồn để giảm tải cho điện thoại.

### Điều khiển chính

- `V`: vào/rời khu sinh tồn.
- Chuột trái: đào khối đang ngắm (giống cách điều khiển game khối sinh tồn).
- `C`: mở bảng chế tạo.
- `F`: dùng thức ăn nhanh.
- Phím số: đổi ô vật phẩm/công cụ.

## 2. Hệ thống học tập V11

- Lựa chọn bộ sách được lưu theo từng khối lớp trên máy chủ.
- Có lộ trình 35 tuần, các mốc giữa kỳ/cuối kỳ và bài đến hạn ôn.
- Có bộ đếm tập trung và cài đặt hỗ trợ đọc: chữ lớn, tương phản cao, giảm chuyển động và thước đọc.
- Âm nhạc, Mĩ thuật và Nghệ thuật tích hợp có bài thực hành bắt buộc.
- Bài hát và bài vẽ được tính lại điểm trên máy chủ; dữ liệu phía trình duyệt không tự quyết định kết quả.
- Học sinh phải đạt điểm thực hành trên 8 trước khi làm bài kiểm tra kiến thức của bài có yêu cầu thực hành.
- Minh chứng thực hành, điểm và phản hồi được lưu để phụ huynh/học sinh xem lại.

Nội dung được tổ chức theo yêu cầu cần đạt của Chương trình GDPT 2018 và hồ sơ bộ sách đã cấu hình. Website không sao chép nguyên văn sách giáo khoa và không thay thế kết quả chính thức của nhà trường.

## 3. Sửa giao diện toàn hệ thống

- Thêm lớp giao diện V11 cho toàn bộ 39 trang.
- Chặn tràn ngang do tab, bảng, hộp thoại và nút quá rộng.
- Tab dài có thể cuộn ngang trên điện thoại và điều khiển bằng phím mũi tên.
- Bảng rộng tự có vùng cuộn riêng thay vì làm vỡ cả trang.
- Thay các hộp `alert` đột ngột bằng thông báo không che toàn trang và hiển thị cảnh báo lỗi giao diện thân thiện thay vì để trang trắng.
- Kiểm tra ID HTML trùng, liên kết tài nguyên thiếu và lỗi JavaScript nội tuyến.
- Cải thiện HUD thế giới khối ở màn hình laptop có chiều cao thấp.

## 4. Kiến trúc và bảo trì

Mã mới được chia thành các mô-đun nhỏ:

```text
assets/
├── learning/
│   ├── learning-v11.js
│   ├── learning-v11.css
│   └── practical-assessment.js
├── room/
│   ├── survival-v11.js
│   └── survival-v11.css
└── ui/
    ├── ui-v11.js
    └── ui-v11.css

server/modules/
├── learning-v11.js
└── survival-v11.js
```

Xem `docs/ARCHITECTURE_V11.md` để biết ranh giới mô-đun và hướng tách tiếp máy chủ.

## 5. API mới

```text
GET  /api/survival/state
POST /api/survival/sync
POST /api/survival/mine
POST /api/survival/craft
POST /api/survival/eat
POST /api/survival/reset

GET  /api/learning/preferences
POST /api/learning/preferences
GET  /api/learning/roadmap
POST /api/learning/practical/submit
```

## 6. Kiểm tra trước khi triển khai

```bash
npm ci
npm test
npm start
```

Sau khi triển khai Render, nên thử bằng hai tài khoản và MongoDB thật:

1. Đào một khối, tải lại trang và xác nhận khối vẫn mất.
2. Chế tạo công cụ cùng lúc trên hai tab để xác nhận không nhân đôi vật phẩm.
3. Làm bài hát/vẽ, tải lại bài và xác nhận điểm thực hành được lưu.
4. Mở các trang nhiều tab trên điện thoại để kiểm tra cuộn và hộp thoại.

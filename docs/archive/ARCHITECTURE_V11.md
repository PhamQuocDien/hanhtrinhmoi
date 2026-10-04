# Kiến trúc V11

## Mục tiêu

Giảm phụ thuộc giữa thế giới 3D, học tập, giao diện chung và tệp `server.js` lớn. Tính năng mới phải có mô-đun dữ liệu thuần, API xác thực trên máy chủ và mô-đun giao diện riêng.

## Ranh giới hiện tại

### `server/modules/survival-v11.js`

- Danh mục khối sinh tồn.
- Độ cứng và cấp công cụ yêu cầu.
- Công thức chế tạo.
- Chuẩn hóa trạng thái sinh tồn.
- Công thức cấp độ theo XP.

Mô-đun không phụ thuộc Express/Mongoose nên có thể kiểm thử độc lập.

### `server/modules/learning-v11.js`

- Hồ sơ bộ sách được hỗ trợ.
- Xác định loại thực hành theo môn và số bài.
- Công thức chấm chỉ số hát/vẽ phía máy chủ.

### `assets/room/survival-v11.js`

- Dựng/huỷ địa hình sinh tồn theo nhu cầu.
- Raycast, tiến độ đào, HUD, chế tạo và điều khiển.
- Gửi hành động tới API; không tự cấp vật phẩm.

### `assets/learning/learning-v11.js`

- Trung tâm lộ trình, bộ sách, kế hoạch 35 tuần.
- Bộ đếm tập trung và cài đặt hỗ trợ đọc.
- Kết nối giao diện thực hành với API.

### `assets/ui/ui-v11.js`

- Sửa bố cục tab/bảng/hộp thoại dùng chung.
- Kiểm tra lỗi giao diện và ID trùng trong thời gian chạy.
- Không chứa logic nghiệp vụ học tập hoặc game.

## Quy tắc an toàn dữ liệu

1. Trình duyệt chỉ gửi ý định; máy chủ quyết định phần thưởng, điểm và trạng thái cuối.
2. Hành động có giá trị phải chống gửi trùng và có giới hạn tốc độ.
3. Dữ liệu cũ phải có giá trị mặc định để không cần xoá người dùng MongoDB.
4. Không lưu khóa API trong HTML/JavaScript hoặc repository.
5. Tệp nội dung học chỉ lưu cấu trúc/nguyên tắc; không sao chép nguyên văn sách giáo khoa.

## Hướng tách tiếp

Tệp `server.js` vẫn chứa nhiều route cũ. Nên di chuyển từng miền theo thứ tự, mỗi bước giữ nguyên URL và chạy `npm test`:

```text
server/
├── routes/
│   ├── survival.js
│   ├── learning.js
│   ├── tournaments.js
│   ├── boards.js
│   └── house.js
├── services/
│   ├── survival-service.js
│   ├── learning-service.js
│   └── tournament-service.js
├── models/
│   ├── user.js
│   ├── learning-progress.js
│   └── tournament.js
└── modules/
```

Không nên tách toàn bộ trong một lần vì có thể làm thay đổi middleware phiên đăng nhập, Socket.IO và thứ tự route. Mỗi miền cần kiểm thử API và migration dữ liệu trước khi chuyển miền tiếp theo.

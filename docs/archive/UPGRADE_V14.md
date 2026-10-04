# Hành Tinh Mơ Ước V14

## 1. Vá lỗi tiến trình Node.js bị sập

Bộ quét nhiệm vụ cũ chỉ chọn `username score quests` nhưng lại ghi vào `history`. V14 thay đoạn chạy nền bằng `server/modules/quest-maintenance-v14.js`:

- Truy vấn `username score quests history`.
- Chuẩn hóa `quests`, `history` và `score` trước khi xử lý.
- Không cho hai lần quét chạy chồng nhau.
- Lỗi của một tài khoản không dừng các tài khoản còn lại.
- Lỗi truy vấn toàn phiên được bắt và ghi log, không tạo unhandled rejection.
- Lịch chạy được dừng khi Render gửi SIGTERM/SIGINT.

## 2. Lý thuyết thật theo từng môn

`server/modules/lesson-theory-v14.js` tạo nội dung nguyên bản theo nhóm môn:

- Toán.
- Tiếng Việt/Ngữ văn.
- Tiếng Anh.
- Khoa học tự nhiên.
- Lịch sử, Địa lí, Công dân.
- Tin học/Công nghệ.
- Âm nhạc/Mĩ thuật.
- Giáo dục thể chất/Quốc phòng.
- Hoạt động trải nghiệm.

Mỗi bài có phần giải thích, quy trình, ví dụ hoặc cách thực hành, từ khóa, lỗi thường gặp và câu tự kiểm tra. Nội dung vẫn bám hồ sơ lớp–môn–chủ đề hiện có và không sao chép nguyên văn sách giáo khoa.

## 3. Chế tạo giống Minecraft nhưng dễ dùng

- 1 Gỗ thô → 4 Ván gỗ.
- 2 Ván gỗ → 4 Gậy.
- Cuốc gỗ: 3 Ván + 2 Gậy.
- Cuốc đá: 3 Đá + 2 Gậy.
- Cuốc sắt: 3 Sắt + 2 Gậy.
- Đuốc: 1 Than + 1 Gậy.

Chế độ **Tự chế tạo nguyên liệu trung gian** bật mặc định. Ví dụ, khi người chơi có đủ Gỗ nhưng chưa có Ván/Gậy, máy chủ tự thực hiện các bước trung gian và giữ đúng phần nguyên liệu còn dư.

## 4. Sửa giao diện bàn cờ

`board-ui-v14.css/js` được nạp sau lớp giao diện chung để:

- Bỏ `min-height: 40px` khỏi các ô Caro.
- Khôi phục đúng 8 hàng × 8 cột của chessboard.js.
- Không lazy-load ảnh quân cờ.
- Giữ bàn cờ trong viewport và tách bảng điều khiển hợp lý.
- Cờ Vây vẽ bàn 13×13 ngay khi mở trang.
- Cờ Tỷ Phú cân bằng kích thước bàn và bảng người chơi.

## 5. Kiểm tra

Chạy:

```bash
npm test
```

Bộ kiểm tra gồm cú pháp, liên kết tệp, API, 2.980 bài học, 35.760 câu hỏi, chống sập nhiệm vụ, chế tạo tự động và CSS bàn cờ.

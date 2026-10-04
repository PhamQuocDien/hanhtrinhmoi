# XÁC MINH DỮ LIỆU CHƯƠNG TRÌNH (CURRICULUM VERIFICATION)

## 1. Vị trí quan trọng nhất của tài liệu này

Dự án **không bịa** tên chương, tên bài, tên sách hay môn học. Mọi dữ liệu chưa
được đối chiếu với nguồn chính thức đều mang nhãn `NEEDS_VERIFICATION` và được
liệt kê ở đây.

Nguyên tắc áp dụng:

> Nếu chưa xác minh được thì ghi `NEEDS_VERIFICATION` — **không** được tự đặt tên
> bài, không được gắn nhãn "chuẩn Bộ", không được coi là nội dung chính thức.

---

## 2. Trạng thái hiện tại của dữ liệu

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Phiên bản chương trình | `CTGDPT-2018` | Chưa đối chiếu với văn bản hiện hành |
| 12 lớp (1–12) | Có đủ cấu trúc | Dữ liệu lớp được sinh từ `curriculum-data.js` cũ |
| Danh mục môn học | Có | Phân biệt bắt buộc / lựa chọn / mạch nội dung |
| Bộ sách | Có nhiều bộ | Chưa đối chiếu danh mục sách được phê duyệt |
| Đầu sách | Có | Tên sách lấy từ dữ liệu dự án, **chưa xác minh** |
| Chương | Có | Tên chương suy ra từ tên bài, **chưa xác minh** |
| Bài học | Có tên, **chưa có nội dung** | `contentStatus = "EMPTY"` |
| Nội dung dạy học | **Chưa có** | Trang bài học nói rõ điều này |

---

## 3. Danh sách dữ liệu CHƯA XÁC MINH

### 3.1. Tên đầu sách giáo khoa

- **Trạng thái:** `NEEDS_VERIFICATION`
- **Lý do:** tên sách được đưa vào từ dữ liệu dự án, chưa đối chiếu với danh mục
  sách giáo khoa được phê duyệt của Bộ Giáo dục và Đào tạo.
- **Nguồn đã tìm:** danh mục sách giáo khoa công bố của Bộ GDĐT; các văn bản
  phê duyệt sách giáo khoa gần đây.
- **Cách kiểm lại:** so từng `textbookId` trong `data/textbooks/textbook-registry.js`
  với danh mục chính thức; khi khớp, đặt `verificationStatus = "VERIFIED"` và
  điền `verifiedAt`.

### 3.2. Tên bộ sách

- **Trạng thái:** `NEEDS_VERIFICATION`
- **Lý do:** hệ thống ghi nhận nhiều bộ sách để phản ánh thực tế "một chương
  trình, nhiều bộ sách được phê duyệt". Danh sách bộ sách trong dữ liệu **chưa**
  được kiểm chứng đầy đủ với danh mục chính thức.
- **Lưu ý phát biểu:** dự án **không** tuyên bố có "một bộ sách duy nhất của Bộ".
  Xem [TEXTBOOKS.md](TEXTBOOKS.md).

### 3.3. Tên chương và tên bài học

- **Trạng thái:** toàn bộ `NEEDS_VERIFICATION`
- **Lý do:** tên chương và tên bài được migrate từ `curriculum-data.js` (dữ liệu
  dự án cũ), **không** lấy từ bản in sách giáo khoa.
- **Nguồn đã tìm:** chương trình giáo dục phổ thông hiện hành; bản in sách giáo
  khoa của các bộ sách đang được phê duyệt.
- **Cách kiểm lại:** đối chiếu thứ tự và tên từng chương/bài với bản in; mục nào
  khớp thì đặt `VERIFIED`, mục nào lệch thì sửa hoặc đánh dấu lại.

### 3.4. Cấu trúc môn học theo cấp

- **Tiểu học (lớp 1–5):** các môn bổ trợ (ngoại ngữ lớp 1–2, kỹ năng số) được
  gắn nhãn **nội dung bổ trợ**, không phải môn chính thức của chương trình.
- **THCS (lớp 6–9):** Vật lí / Hoá học / Sinh học được ghi nhận là **mạch nội
  dung** (`learningTrack`) của môn Khoa học tự nhiên, đúng với cấu trúc tích hợp.
- **THPT (lớp 10–12):** phân biệt `required` (bắt buộc) và `elective` (lựa chọn).
  Lịch sử ở cấp THPT cần đối chiếu lại với chương trình hiện hành.
- **Trạng thái:** cấu trúc cấp đã được mô hình hoá đúng, nhưng **tên và danh sách
  bài học** chưa xác minh.

---

## 4. Quy tắc cho người đóng góp

1. **Không** tự tạo tên bài học để lấp chỗ trống. Ô thiếu dữ liệu phải được đánh
   dấu `contentStatus = "EMPTY"` và `needsLessonImport = true`.
2. **Không** nâng trạng thái lên `VERIFIED` nếu chưa đối chiếu với nguồn.
3. Khi xác minh xong, cập nhật đồng thời:
   - `verificationStatus: "VERIFIED"`
   - `verifiedAt: <ngày đối chiếu>`
   - `sourceDocument: <tên văn bản/bản in đã dùng>`
4. Chạy kiểm tra sau mỗi lần sửa dữ liệu:
   ```sh
   npm run validate:curriculum
   ```

---

## 5. Kiểm tra tự động

`scripts/validate-curriculum.js` phát hiện:

- trùng `lessonId`, `chapterId`, `textbookId`;
- thiếu lớp, thiếu môn, thiếu sách, thiếu chương, thiếu bài;
- môn không thuộc lớp (sai cấu trúc cấp học);
- thiếu trường `source`;
- tiêu đề đáng ngờ (chứa "test", "demo", "sample", "TODO", "placeholder");
- môn bị đánh dấu `VERIFIED` nhưng `verifiedAt` rỗng.

Chạy kiểm tra:
```sh
npm run validate:curriculum
```

---

## 6. Bảng theo dõi công việc còn lại

| Việc | Trạng thái |
|---|---|
| Đối chiếu tên đầu sách với danh mục chính thức | Chưa làm |
| Đối chiếu tên bộ sách | Chưa làm |
| Đối chiếu tên chương / bài học | Chưa làm |
| Xác nhận chương trình hiện hành cho từng cấp | Chưa làm |
| Biên soạn nội dung dạy học cho từng bài | Chưa làm |

Tất cả đều được ghi nhận trung thực là **chưa xác minh**, không giả định là đã
đúng chuẩn Bộ.
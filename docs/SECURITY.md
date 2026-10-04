# Bảo mật

## 1. Xác thực

| Yêu cầu | Cách thực hiện |
|---|---|
| Mật khẩu không lưu dạng rõ | Băm bằng **bcrypt** (`server/utils/hash.js`) |
| Salt ngẫu nhiên | Do bcrypt tự sinh — hai lần băm cùng mật khẩu cho hai kết quả khác nhau |
| Không rò rỉ hash | `passwordHash` và `password` có `select: false` |
| Thông báo không lộ tài khoản | Sai tên và sai mật khẩu trả về **cùng một** thông báo |
| Chống chiếm phiên | `regenerateSession()` sau khi đăng nhập thành công |
| Không có mật khẩu mặc định | Tài khoản admin chỉ tạo khi có `ADMIN_PASSWORD` ≥ 8 ký tự |
| Tên đệm | `admin`, `root`, `system`, `mod`… không cho đăng ký |

## 2. Phân quyền

Quyền **luôn** lấy từ phiên ở máy chủ:

```js
if (!req.session?.user?.username) return response.unauthorized(res);   // 401
if (req.session.user.role !== 'admin')  return response.forbidden(res);   // 403
```

- `req.body.role` bị bỏ qua hoàn toàn.
- `localStorage.role` không có tác dụng quyết định quyền.
- Nhóm `/api/admin` được bảo vệ **hai lần**: `router.use(requireAdmin)` trong
  `admin.routes.js` và `app.use('/api/admin', requireAdmin)` ở tầng ứng dụng —
  route thêm sau cũng không lọt.
- Học sinh xem bài của người khác không được: mọi truy vấn lấy `username` từ
  `req.session.user`, không lấy từ URL hay body.

## 3. Không lộ đáp án

| Nguyên tắc | Cách thực hiện |
|---|---|
| API học sinh không trả đáp án | `Question.toStudentView()` cắt `correctAnswer`, `rubric`, `acceptedAnswers` |
| Trước khi nộp | `exam.service.startAttempt()` nạp câu hỏi kèm đáp án **ở máy chủ**, rồi mới cắt |
| Trình duyệt không tự chấm | Client chỉ gửi `answers`; server bỏ qua mọi trường điểm gửi lên |
| Câu lạ bị bỏ qua | Chỉ chấm câu có trong đề |

## 4. Chống chèn mã (XSS)

- Mọi nội dung do người dùng nhập được chèn bằng **`textContent`**, không dùng
  `innerHTML` (hàm `createElement` trong `public/assets/js/core/dom.js`).
- Frontend **không** dùng `eval()`.
- Header `Content-Security-Policy` chặn tải tài nguyên từ nguồn lạ:
  `default-src 'self'; script-src 'self'`.
- Header `X-Content-Type-Options: nosniff` chặn đoán kiểu nội dung.
- Header `X-Frame-Options: SAMEORIGIN` chặn nhúng trong khung ngoài.
- `Referrer-Policy: strict-origin-when-cross-origin`.

## 5. Chống chèn truy vấn NoSQL

- Tên đăng nhập dùng `$regex` luôn đi qua `escapeRegExp()`.
- Từ khoá tìm kiếm học sinh cũng được escape trước khi đưa vào `$regex`.
- `username` lấy từ phiên chứ không lấy từ request → không thể truy vấn bằng
  đối tượng `{ "$ne": null }`.

## 6. Tệp tải lên

Xem [DOCX_IMPORT.md](DOCX_IMPORT.md) §6. Tóm tắt: chỉ `.docx`, kiểm tra chữ ký
nhị phân, giới hạn kích thước, chặn path traversal trong tên tệp, không lưu tệp
trên đĩa, không cho tệp trở thành mã thực thi.

## 7. Phiên và cookie

| Thuộc tính | Giá trị |
|---|---|
| `httpOnly` | `true` — JavaScript không đọc được cookie |
| `sameSite` | `lax` |
| `secure` | `true` khi `NODE_ENV=production` |
| `maxAge` | 24 giờ (mặc định) |
| `rolling` | `true` — gia hạn mỗi lần truy cập |

## 8. Giới hạn tải

- `express.json({ limit: '1mb' })` và `urlencoded({ limit: '256kb' })`.
- Có rate limit cho đăng nhập / đăng ký (số lần trong 15 phút).

## 9. Rò rỉ thông tin

- Phản hồi lỗi trả `code` + `message` + `requestId`.
- Dấu vết ngăn xếp chỉ kèm khi **không** phải production.
- Sai định dạng JSON, lỗi Mongoose và trùng khoá duy nhất đều được ánh xạ thành
  thông báo thân thiện.
- `AuditLog` lọc bỏ `password`, `passwordHash`, `correctAnswer`, `value` trước
  khi ghi.

## 10. Kiểm thử bảo mật

`tests/security.test.js` kiểm tra: không lộ đáp án cho học sinh, 401 khi chưa đăng
nhập, 403 khi học sinh gọi API quản trị, quyền lấy từ session, chặn tệp không
phải `.docx`, chặn path traversal, kiểm tra chữ ký nhị phân, làm sạch văn bản,
băm mật khẩu.

Ngoài ra `tests/frontend.test.js` chặn `eval()`, `innerHTML=` và mọi tham chiếu
`correctAnswer` ngoài các trang được phép.

```sh
npm test
```
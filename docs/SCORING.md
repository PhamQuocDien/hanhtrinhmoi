# Chấm điểm

## 1. Nguyên tắc bất di bất dịch

> **Điểm luôn do máy chủ tính.**
>
> Trình duyệt chỉ gửi câu trả lời. Máy chủ tự nạp đáp án đúng, so khớp, tính điểm
> và trả kết quả. Mọi trường `score`, `isCorrect`, `awardedPoints` do client gửi lên
> đều bị **bỏ qua**.

Cấu trúc mã:

```
server/services/scoring.service.js            # facade, hàm công khai
server/services/scoring/question-graders.js   # MỘT hàm chấm cho TỪNG loại câu hỏi
server/services/scoring/exam-grader.js        # gom kết quả cả đề + chấm tay
```

Mỗi loại câu hỏi có hàm riêng — không dùng một chuỗi `if/else` khổng lồ:

| Hàm | Loại câu hỏi |
|---|---|
| `gradeSingleChoice()` | `single_choice` |
| `gradeMultipleChoice()` | `multiple_choice` |
| `gradeTrueFalse()` | `true_false` |
| `gradeFillBlank()` | `fill_blank` |
| `gradeShortAnswer()` | `short_answer` |
| `gradeNumeric()` | `numeric` |
| `gradeEssay()` | `essay` |

---

## 2. Loại nào được chấm tự động

| Loại | Chấm tự động | Ghi chú |
|---|---|---|
| `single_choice` | Có | So khớp ký hiệu |
| `multiple_choice` | Có | Tuỳ chế độ `all_or_nothing` / `partial_credit` |
| `true_false` | Có | Đơn hoặc nhiều mệnh đề |
| `fill_blank` | Có | Chuẩn hoá có kiểm soát |
| `numeric` | Có | Hỗ trợ sai số cho phép |
| `short_answer` | **Tùy chọn** | `auto` / `manual` / `hybrid` |
| `essay` | **Không** | Luôn chuyển người chấm |

---

## 3. Quy tắc chi tiết

### Trắc nghiệm nhiều đáp án

- `all_or_nothing`: đúng và đủ mới được điểm. Chọn thừa hoặc thiếu đều 0 điểm.
- `partial_credit`: cho điểm từng đáp án đúng, **trừ** điểm đáp án chọn sai.
  Điểm không bao giờ xuống dưới 0.
- Thứ tự chọn không ảnh hưởng kết quả.

### Điền khuyết

Chấm từng ô rồi cộng dồn. Chuẩn hoá mặc định:

| Tuỳ chọn | Mặc định | Ý nghĩa |
|---|---|---|
| `trimWhitespace` | Có | Bỏ khoảng trắng thừa |
| `caseInsensitive` | Không | Không phân biệt hoa thường |
| `stripDiacritics` | **Không** | Không bỏ dấu |

Ví dụ với `caseInsensitive: true`: `Hà Nội`, `ha noi`, `HA NOI` đều được chấp nhận.
Mặc định (không bật) thì `Hà noi` **không** khớp `Hà Nội` — bỏ dấu quá mức sẽ
chấp nhầm hai đáp án khác nghĩa.

### Trả lời ngắn

| `gradingMode` | Hành vi |
|---|---|
| `auto` | Khớp một trong `acceptedAnswers` thì đủ điểm |
| `manual` | Không bao giờ tự chấm |
| `hybrid` | Khớp → đủ điểm; không khớp → chuyển người chấm |

### Câu số

- Chấp nhận dấu phẩy thập phân kiểu Việt Nam: `1.234,5` = 1234.5.
- `tolerance = 0` → phải chính xác tuyệt đối.
- Nhập chữ vào ô số được coi là **sai**, không phải lỗi hệ thống.

### Tự luận

- **Không bao giờ** tự cho điểm.
- Máy chỉ đếm số từ và cảnh báo nếu ngắn hơn `minWords` hoặc dài hơn `maxWords`.
- Bỏ trống vẫn chuyển người chấm — bỏ trống và "chấm 0 điểm" là hai điều khác nhau.

---

## 4. Chuẩn hoá câu trả lời

`server/utils/answer-normalizer.js` là nơi duy nhất chuẩn hoá. Hàm
`normalizeList()` loại trùng sau khi chuẩn hoá, để hai đáp án khác nghĩa không bị
gộp làm một.

---

## 5. Điểm tổng

```
autoScore     = tổng điểm máy chấm
manualScore   = tổng điểm người chấm
totalPoints   = tổng điểm của đề
totalScore    = autoScore + manualScore   (không bao giờ vượt totalPoints)
scorePercent  = totalScore / totalPoints * 100
gradingStatus = 'graded' nếu đã chấm đủ câu chờ chấm
                'pending_manual_grading' nếu còn câu chờ chấm
```

Ví dụ: máy chấm 7/7, người chấm 2.5/3 → điểm cuối 9.5/10.

---

## 6. Nhận xét theo điểm

`scoring.feedbackFor(scorePercent)` trả về nhận xét tiếng Việt theo dải điểm,
hiển thị ở trang kết quả. Đây chỉ là gợi ý; không ảnh hưởng điểm số.

---

## 7. Kiểm thử

`tests/scoring.test.js` kiểm thử từng quy tắc trên, gồm cả đề hỗn hợp 7 dạng
(xem [QUESTION_TYPES.md](QUESTION_TYPES.md)). Chạy:

```sh
npm test
```
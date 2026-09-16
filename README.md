# Kế hoạch Kiểm thử Cá nhân (Test Strategy)

## 1. Cấu trúc thư mục đề xuất

```text
261DASA230179_06_Nhom20/
│
├── ca-nhan/
│
├── data/
│   └── library.json
│
├── docs/
│
├── src/
│   ├── main.cpp
│   ├── dsa_core/
│   └── persistence/
│
├── tests/
│   ├── unit/
│   │   ├── BookTest.cpp
│   │   ├── BookRepositoryTest.cpp
│   │   ├── BookServiceTest.cpp
│   │   └── LoanSlipServiceTest.cpp
│   │
│   ├── integration/
│   │   ├── BookCrudTest.cpp
│   │   └── PersistenceTest.cpp
│   │
│   ├── fixtures/
│   │   └── test_library.json
│   │
│   ├── results/
│   │   └── test_results.md
│   │
│   ├── debug/
│   │   └── debug_log.md
│   │
│   └── benchmark/
│       └── benchmark_results.md
│
├── README.md
└── .gitignore
```

## 2. Vai trò từng phần

### `tests/unit/`

Test từng thành phần riêng biệt, bao gồm:

- `Book`
- `BookRepository`
- `BookService`
- `LoanSlipService`

**Ví dụ với `BookTest`:**

- [x] Tạo `Book`
- [x] Thêm `BookCopy`
- [x] Tính số bản
- [x] Kiểm tra trạng thái

### `tests/integration/`

Test toàn bộ luồng kết nối giữa các module:
`BookService` → `BookRepository` → `Persistence` → `library.json`

**Ví dụ kịch bản test:**
`Create` → `Save` → Tắt chương trình chạy lại → `Load` → `Read`

*(Đây là nơi rất quan trọng để minh chứng cho phần BOOK CRUD + Persistence của cá nhân)*

### `tests/fixtures/`

Chứa dữ liệu JSON dành riêng cho test (Ví dụ: `test_library.json`).

*Lưu ý:* Không nên dùng duy nhất `data/library.json` để test vì dữ liệu thật của project có thể thay đổi liên tục.

### `tests/debug/debug_log.md`

Nơi ghi nhận minh chứng debug cho gói D5. Form mẫu ví dụ:

- **Bug #001**
- **Hiện tượng:**
- **Nguyên nhân:**
- **File:**
- **Cách trace:**
- **Cách sửa:**
- **Kết quả sau khi sửa:**

*(Tài liệu chính thức yêu cầu có nhật ký debug và kiểm thử/debug có hệ thống).*

### `tests/benchmark/`

Dành cho bằng chứng hiệu năng. Đề yêu cầu bằng chứng thực nghiệm cho MC1/MC2 ở quy mô đủ lớn (gợi ý ít nhất 10.000 bản ghi nếu chưa có cơ sở tốt hơn).

## 3. Vai trò của `src/main.cpp` hiện tại

Giữ lại nguyên bản. Nó đóng vai trò:
`src/main.cpp` → Điểm bắt đầu khởi chạy hệ thống / Demo / Smoke test.

**Tuyệt đối phân biệt ranh giới:**

- `main.cpp`: Chỉ chạy thử hệ thống / demo.
- `tests/`: Chứa bộ test chính thức.
- `docs/` hoặc `tests/debug/`: Chứa bằng chứng debug.
- `tests/benchmark/`: Chứa bằng chứng hiệu năng.

*(Điều này phù hợp với kiến trúc đề bài: Presentation chỉ nhận input/hiển thị, DSA Core xử lý thao tác, Persistence đảm nhiệm load/save).*

## 4. Mục tiêu phần cá nhân

Yêu cầu tối thiểu cần hoàn thiện cho minh chứng cá nhân:

```text
tests/
├── unit/
│   ├── BookTest.cpp
│   ├── BookRepositoryTest.cpp
│   ├── BookServiceTest.cpp
│   └── LoanSlipServiceTest.cpp
│
├── integration/
│   ├── BookCrudTest.cpp
│   └── PersistenceTest.cpp
│
├── fixtures/
│   └── test_library.json
│
├── debug/
│   └── debug_log.md
│
└── benchmark/
    └── benchmark_results.md
```

**Chiến lược:**

- Xây dựng bộ test song song với project (Test-Driven) chứ không đợi đến Buổi 35 mới làm test.
- Xây từng phần test cùng lúc với `Book`, `Persistence`, `CRUD` và `LoanSlipService` để dứt điểm gọn gàng từng giai đoạn.
- Đề yêu cầu nhóm có ít nhất 2 cấu trúc tự cài đặt từ đầu kèm unit test (thuộc cấp độ nhóm). Cá nhân chỉ cần đảm bảo sở hữu minh chứng Git rõ ràng cho phần việc của mình.

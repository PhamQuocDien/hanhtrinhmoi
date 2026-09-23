# Quản lý thư viện số — Bài tập OOP giữa kỳ

Project Java 17, Maven, chạy console trên IntelliJ IDEA. Không dùng cơ sở dữ liệu hoặc thư viện Java bên ngoài.

## Mở và chạy trong IntelliJ

1. Giải nén ZIP ra một thư mục trên máy.
2. Trong IntelliJ chọn **File → Open**, chọn `pom.xml` trong thư mục `digital-library-midterm`, mở dưới dạng project.
3. Chọn **Project SDK: JDK 17** trong **File → Project Structure → Project**. Cần JDK, không chỉ JRE.
4. Đợi IntelliJ tải project Maven. Lần đầu Maven có thể cần mạng để tải plugin build.
5. Mở `src/main/java/vn/ute/oop/library/App.java`.
6. Nhấn biểu tượng tam giác cạnh `main()` → **Run App.main()**.
7. Đối chiếu console với `EXPECTED_OUTPUT.txt`. Tổng phí các phiếu đã trả: **15000 VND**.

Nếu không thấy nút Run: kiểm tra SDK và bảo đảm `src/main/java` là Sources Root; tải lại Maven project.

## Cấu trúc

Mỗi lớp/interface/enum/record nằm trong một file riêng, cùng package `vn.ute.oop.library` để sinh viên dễ theo dõi:

- `App.java`: dữ liệu mẫu và demo.
- `Borrowable.java`, `Renewable.java`, `AccessControlled.java`: ba interface được sử dụng trong nghiệp vụ.
- `UserType.java`, `LoanStatus.java`: enum.
- `LoanPolicy.java`: record bất biến, cần Java 17.
- `LibraryUser.java`, `StudentUser.java`, `LecturerUser.java`: nhóm người dùng.
- `LibraryItem.java`, `PrintedBook.java`, `EBook.java`, `Magazine.java`, `Thesis.java`: nhóm tài liệu.
- `Loan.java`: phiếu mượn và tính phí.
- `LibraryService.java`: mượn, trả, gia hạn và báo cáo.

## Quy tắc

| Người dùng | Tối đa đang mượn | Ngày mượn | Lượt gia hạn | Phí/ngày |
|---|---:|---:|---:|---:|
| Sinh viên | 3 | 7 | 1 | 2000 |
| Giảng viên | 5 | 14 | 2 | 1000 |

| Tài liệu | Phí/ngày | Gia hạn | Giới hạn |
|---|---:|---|---|
| Sách giấy | 3000 | Có | Số bản |
| Ebook | 1000 | Không | Slot đọc đồng thời |
| Tạp chí | 2000 | Không | Số bản |
| Luận văn | 5000 | Không | Một lượt; chỉ giảng viên |

Mỗi lần gia hạn cộng 3 ngày vào hạn cũ. Chỉ gia hạn khi chưa quá hạn và còn lượt.
Phí = max(0, số ngày sau hạn trả) × max(phí người dùng, phí tài liệu).
Báo cáo tổng phí chỉ cộng các phiếu đã trả; chưa cộng phí tạm tính của phiếu đang mượn.
Dữ liệu chỉ tồn tại trong bộ nhớ và được tạo lại mỗi lần chạy.

## Trình tự demo

Ngày mượn cố định: 01/12/2025.

1. S01 mượn B001 → L0001, hạn 08/12.
2. S01 mượn E002 → L0002, hạn 08/12.
3. S01 mượn T001 → bị từ chối quyền.
4. L01 mượn T001 → L0003, hạn 15/12.
5. S02 mượn B002 → L0004, hạn 08/12.
6. S01 mượn B002 → hết bản.
7. S01 mượn M001 → L0005, hạn 08/12.
8. S01 mượn E001 → đã đạt 3 phiếu đang mượn.
9. Ngày 03/12, gia hạn L0001 → hạn mới 11/12.
10. Gia hạn L0002 → ebook không gia hạn.
11. Gia hạn L0001 lần nữa → hết lượt.
12. Trả L0002 ngày 04/12 → phí 0.
13. Trả L0001 ngày 16/12 → trễ 5 ngày, phí 15000.
14. Báo cáo còn L0005 của S01, L0004 của S02, L0003 của L01.

## Chạy bằng Maven (tùy chọn)

```sh
mvn clean package
java -jar target/digital-library-midterm-1.0.0.jar
```

Hoặc biên dịch bằng JDK từ thư mục project, không cần Maven:

```sh
javac -encoding UTF-8 -d out src/main/java/vn/ute/oop/library/*.java
java -cp out vn.ute.oop.library.App
```

## Kiểm tra đóng gói

Mã đã được biên dịch và chạy trên Java 17 sau khi tách file. `EXPECTED_OUTPUT.txt` là đầu ra thực tế. Maven/IntelliJ không được chạy trực tiếp trong môi trường kiểm tra; project cung cấp cấu hình Maven chuẩn để mở trong IntelliJ.

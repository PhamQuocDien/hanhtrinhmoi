'use strict';

// Bộ mô-đun Nhóm 1 được giữ tương thích trong catalog CNTT V6.1.1; nội dung cần giảng viên thẩm định.
// Đây là học liệu khung cần giảng viên rà soát trước khi dùng làm chương trình chính thức.
function lesson(id, title, minutes, objective, material, practice, deliverable) {
  return { id, title, minutes, objective, material, practice, deliverable };
}
function moduleOf(id, title, summary, definitions) {
  return { id, title, summary, lessons: definitions.map((item, index) => lesson(`${id}-l${index + 1}`, ...item)) };
}
const L = (title, objective, material, practice, deliverable, minutes = 45) => [title, minutes, objective, material, practice, deliverable];

module.exports = {
  'sd-foundations': [
    moduleOf('v51-sdf-m4', 'Phân tích yêu cầu và thiết kế', 'Từ nhu cầu người dùng đến đặc tả có thể kiểm chứng.', [
      L('User story và vai trò người dùng', 'Viết user story có vai trò, nhu cầu và giá trị.', 'User story nên diễn đạt ai cần gì và vì sao; tránh biến giải pháp giao diện thành yêu cầu cứng khi chưa hiểu vấn đề.', 'Viết 5 user story cho ứng dụng quản lý công việc và nêu vai trò người dùng.', 'Danh sách user story có tiêu chí chấp nhận.'),
      L('Tiêu chí chấp nhận và trường hợp biên', 'Chuyển yêu cầu thành điều kiện kiểm tra được.', 'Một tiêu chí tốt mô tả điều kiện đầu vào, hành động và kết quả quan sát được; trường hợp biên gồm dữ liệu rỗng, trùng và giới hạn.', 'Tạo Given/When/Then cho đăng nhập, tìm kiếm và hoàn thành công việc.', 'Bộ tiêu chí và trường hợp biên.', 50),
      L('Mô hình dữ liệu sơ bộ', 'Xác định thực thể, thuộc tính và quan hệ.', 'Mô hình dữ liệu sơ bộ giúp phát hiện dữ liệu trùng lặp, quan hệ thiếu và quy tắc toàn vẹn trước khi lập trình.', 'Vẽ mô hình cho Người dùng, Công việc, Nhãn và Nhật ký.', 'Sơ đồ dữ liệu có giải thích.', 50),
      L('Luồng người dùng và trạng thái lỗi', 'Mô tả luồng chính cùng các trạng thái loading/empty/error/success.', 'Trải nghiệm hoàn chỉnh bao gồm cả phản hồi khi chờ, không có dữ liệu, thất bại và thao tác thành công.', 'Vẽ luồng thêm công việc với lỗi validation và mất mạng.', 'Sơ đồ trạng thái giao diện.', 40)
    ]),
    moduleOf('v51-sdf-m5', 'Quy trình phát triển và chất lượng', 'Tổ chức công việc, review và kiểm soát chất lượng.', [
      L('Issue, milestone và backlog', 'Chia công việc theo giá trị và khả năng hoàn thành.', 'Issue nên có bối cảnh, tiêu chí chấp nhận và mức ưu tiên; milestone gom những đầu ra có thể demo.', 'Tạo backlog cho phiên bản đầu của ứng dụng quản lý công việc.', 'Backlog có ưu tiên và 3 milestone.', 40),
      L('Pull request và code review', 'Review thay đổi theo mục tiêu và rủi ro.', 'Review tập trung tính đúng, khả năng bảo trì, bảo mật, test và tính dễ hiểu; nhận xét nên đề xuất hành động cụ thể.', 'Tạo checklist review và đánh giá một thay đổi mẫu.', 'Checklist code review.'),
      L('Chiến lược kiểm thử', 'Phân biệt kiểm thử đơn vị, tích hợp và đầu-cuối.', 'Các tầng test có chi phí và phạm vi khác nhau; test tự động cần ổn định và không phụ thuộc dữ liệu thật.', 'Lập test plan cho thêm/sửa/xóa công việc và quyền truy cập.', 'Ma trận test theo rủi ro.', 50),
      L('Quản lý lỗi và tái hiện bug', 'Viết báo cáo lỗi có thể tái hiện.', 'Bug report tốt có môi trường, bước tái hiện, kết quả thực tế, kết quả mong đợi và bằng chứng.', 'Viết 3 bug report cho các lỗi nhập liệu giả lập.', 'Ba bug report theo mẫu.')
    ]),
    moduleOf('v51-sdf-m6', 'Từ MVP đến portfolio', 'Hoàn thiện sản phẩm nhỏ có demo và tài liệu.', [
      L('Chốt phạm vi MVP', 'Ưu tiên phần lõi có thể hoàn thành và đánh giá.', 'MVP không có nghĩa là làm sơ sài; phạm vi nhỏ nhưng cần một luồng chính trọn vẹn và tiêu chí chất lượng tối thiểu.', 'Rút gọn backlog để hoàn thành luồng tạo và hoàn tất công việc.', 'Phạm vi MVP và danh sách chưa làm.'),
      L('Tài liệu README có thể chạy lại', 'Viết hướng dẫn setup, chạy, test và cấu hình.', 'README tái lập được cần điều kiện tiên quyết, lệnh chính xác, cấu hình mẫu và hướng xử lý lỗi phổ biến.', 'Viết README cho repository mẫu, không đưa secret thật vào.', 'README có hướng dẫn từ đầu đến cuối.', 40),
      L('Demo theo kịch bản', 'Trình bày sản phẩm theo vấn đề, luồng chính và giới hạn.', 'Một demo thuyết phục thể hiện kết quả, không chỉ đọc danh sách công nghệ; cần dữ liệu mẫu và phương án dự phòng.', 'Chuẩn bị kịch bản demo 5 phút và video dự phòng.', 'Kịch bản demo và checklist.'),
      L('Portfolio và retrospective', 'Mô tả đóng góp, quyết định, kết quả và việc cần cải thiện.', 'Portfolio nên phân biệt việc tự làm với phần dùng thư viện, nêu khó khăn thật và bằng chứng; retrospective chuyển trải nghiệm thành hành động.', 'Viết case study cho dự án và 3 việc cải thiện ở phiên bản sau.', 'Case study portfolio và retrospective.', 50)
    ])
  ],
  'INPR140285': [
    moduleOf('v51-inpr-m4', 'Mảng, chuỗi và dữ liệu nhiều phần tử', 'Xử lý tập dữ liệu có chỉ số và độ dài.', [
      L('Mảng một chiều và duyệt dữ liệu', 'Duyệt mảng an toàn và tính các thống kê cơ bản.', 'Chỉ số mảng thường bắt đầu từ 0; cần phân biệt số phần tử với chỉ số cuối và kiểm tra mảng rỗng.', 'Tìm min/max, tổng và số phần tử thỏa điều kiện.', 'Hàm thống kê mảng và test biên.'),
      L('Mảng hai chiều và bảng dữ liệu', 'Biểu diễn dữ liệu dạng hàng/cột.', 'Mảng hai chiều phù hợp bảng điểm hoặc ma trận; vòng lặp hàng/cột cần thống nhất chỉ số.', 'Tính tổng theo hàng, cột và tìm giá trị lớn nhất trong bảng.', 'Chương trình xử lý ma trận.'),
      L('Chuỗi và xử lý văn bản', 'Đọc, chuẩn hóa và phân tích chuỗi.', 'Chuỗi có thể chứa khoảng trắng, ký tự Unicode và đầu vào rỗng; thao tác tách/ghép cần xác định quy tắc rõ.', 'Chuẩn hóa tên, đếm từ và kiểm tra mã sinh viên.', 'Bộ hàm xử lý chuỗi có test.'),
      L('Tìm kiếm tuyến tính và đếm tần suất', 'Chọn cách duyệt phù hợp để tìm và đếm dữ liệu.', 'Tìm kiếm tuyến tính kiểm tra từng phần tử; đếm tần suất là nền tảng cho thống kê và phát hiện dữ liệu lặp.', 'Tìm lần xuất hiện đầu/cuối và đếm số lần xuất hiện của một giá trị.', 'Bộ chương trình tìm kiếm/đếm.', 50)
    ]),
    moduleOf('v51-inpr-m5', 'Kiểu dữ liệu cấu trúc và tệp', 'Tổ chức dữ liệu thành bản ghi và lưu kết quả.', [
      L('struct và bản ghi nghiệp vụ', 'Nhóm thuộc tính liên quan thành kiểu dữ liệu có cấu trúc.', 'Một bản ghi nên gom những thuộc tính cùng mô tả một đối tượng; không đặt mọi dữ liệu vào các mảng song song nếu có thể tránh.', 'Tạo struct Student và tính điểm trung bình từng sinh viên.', 'Mô hình Student và danh sách mẫu.'),
      L('Vector và bộ sưu tập động', 'Sử dụng bộ sưu tập có kích thước thay đổi.', 'Vector giúp quản lý kích thước linh hoạt nhưng vẫn cần kiểm tra chỉ số và hiểu khác biệt giữa size/capacity.', 'Thêm, sửa, xóa và lọc danh sách sinh viên.', 'Menu CRUD chạy được.'),
      L('Đọc/ghi tệp văn bản', 'Lưu dữ liệu và xử lý lỗi tệp.', 'Mở tệp có thể thất bại; cần phân biệt đường dẫn, quyền, định dạng dòng và dữ liệu không đầy đủ.', 'Lưu danh sách điểm rồi tải lại khi chương trình chạy.', 'Chức năng lưu/tải cùng dữ liệu mẫu.'),
      L('Kiểm tra dữ liệu và ngoại lệ', 'Từ chối dữ liệu không hợp lệ một cách có hướng dẫn.', 'Validation nên thực hiện gần ranh giới nhập liệu; thông báo lỗi cần nêu cách sửa chứ không chỉ báo sai.', 'Xử lý điểm ngoài thang, mã rỗng và tệp không tồn tại.', 'Bảng kiểm thử dữ liệu lỗi.', 50)
    ]),
    moduleOf('v51-inpr-m6', 'Giải bài toán và project nhập môn', 'Kết hợp thuật toán, hàm và kiểm thử.', [
      L('Phân tích đầu vào/đầu ra', 'Xác định ràng buộc trước khi viết mã.', 'Bài toán tốt cần miền đầu vào, giới hạn và định nghĩa đầu ra; ví dụ nhỏ giúp xác minh cách hiểu.', 'Viết đặc tả cho bài toán xếp loại điểm và tính phí.', 'Đặc tả kèm ví dụ hợp lệ/không hợp lệ.'),
      L('Thiết kế hàm và tách trách nhiệm', 'Tách chương trình thành các hàm có mục đích rõ.', 'Hàm nhỏ giúp cô lập lỗi và tái sử dụng; tham số và giá trị trả về nên thể hiện dữ liệu cần thiết.', 'Tách nhập liệu, tính toán và in báo cáo thành các hàm.', 'Chương trình phân tầng chức năng.'),
      L('Kiểm thử bàn và test case', 'Dự đoán kết quả trước khi chạy chương trình.', 'Test case cần dữ liệu đại diện, biên và bất thường; kiểm thử thủ công nên ghi rõ đầu vào và kết quả mong đợi.', 'Viết tối thiểu 10 test case cho chương trình quản lý điểm.', 'Bảng test case có kết quả.'),
      L('Mini project: quản lý điểm mở rộng', 'Tạo ứng dụng console có dữ liệu, báo cáo và xử lý lỗi.', 'Project phải có cấu trúc thư mục, hướng dẫn chạy, lưu dữ liệu và kiểm thử các luồng chính.', 'Thêm lọc theo điểm, tìm theo mã và xuất báo cáo.', 'Mã nguồn, README, test case và dữ liệu demo.', 75)
    ])
  ],
  'PRTE230385': [
    moduleOf('v51-prte-m4', 'Con trỏ và quản lý bộ nhớ', 'Hiểu địa chỉ, tham chiếu và vòng đời dữ liệu.', [
      L('Địa chỉ bộ nhớ và con trỏ', 'Giải thích con trỏ và sử dụng dereference đúng cách.', 'Con trỏ lưu địa chỉ; phải kiểm tra null, vòng đời đối tượng và tránh dùng con trỏ tới vùng nhớ hết hiệu lực.', 'Viết ví dụ đọc/ghi qua con trỏ và nhận diện lỗi.', 'Bộ ví dụ an toàn kèm giải thích.'),
      L('Cấp phát động và giải phóng', 'Quản lý tài nguyên đúng vòng đời.', 'Tài nguyên cấp phát cần được giải phóng đúng cách; ưu tiên container và smart pointer khi phù hợp với chuẩn C++.', 'So sánh mảng động thủ công với vector.', 'Bảng so sánh và bản demo.'),
      L('Tham chiếu, const và truyền tham số', 'Chọn phương thức truyền dữ liệu theo trách nhiệm.', 'Const giúp thể hiện dữ liệu không bị sửa; tham chiếu tránh sao chép và cần chú ý thời gian sống của đối tượng.', 'Refactor API hàm xử lý danh sách với const reference.', 'Các hàm được refactor.'),
      L('RAII và quản lý tài nguyên', 'Giải thích nguyên lý tài nguyên gắn với vòng đời đối tượng.', 'RAII giảm rò rỉ bằng cách dùng constructor/destructor hoặc kiểu quản lý tự động để thu hồi tài nguyên.', 'Thiết kế lớp wrapper quản lý một tài nguyên mẫu.', 'Wrapper nhỏ và test vòng đời.', 50)
    ]),
    moduleOf('v51-prte-m5', 'Độ phức tạp và đo hiệu năng', 'Phân tích chi phí thuật toán và đo thử có kiểm soát.', [
      L('Big O và kích thước đầu vào', 'So sánh độ tăng trưởng thời gian/bộ nhớ.', 'Big O diễn tả xu hướng khi đầu vào tăng, không thay thế việc đo trên dữ liệu thực và không phản ánh mọi hằng số.', 'Phân tích hai vòng lặp lồng nhau và thuật toán tìm kiếm.', 'Bảng phân tích độ phức tạp.'),
      L('Benchmark có kiểm soát', 'Thiết kế phép đo có thể lặp lại.', 'Benchmark cần dữ liệu đại diện, nhiều lần chạy, điều kiện môi trường ghi nhận và tránh so sánh một lần đo nhiễu.', 'Đo tìm kiếm tuyến tính với nhiều kích thước dữ liệu.', 'Bảng đo và kết luận có giới hạn.'),
      L('Profiler và tìm nút thắt', 'Định vị phần tốn tài nguyên trước khi tối ưu.', 'Profiler hỗ trợ tìm thời gian và cấp phát; tối ưu nên bắt đầu từ số liệu chứ không dựa vào cảm giác.', 'Phân tích hàm chậm mẫu và đề xuất thay đổi.', 'Báo cáo nút thắt.'),
      L('Trường hợp biên và fuzzing cơ bản', 'Tăng độ tin cậy bằng dữ liệu bất thường.', 'Test ngẫu nhiên có giới hạn có thể tìm lỗi trạng thái, tràn và điều kiện dừng sai; kết quả cần tái hiện bằng seed.', 'Sinh dữ liệu đầu vào cho hàm parser nhỏ.', 'Test biên và seed tái hiện lỗi.', 50)
    ]),
    moduleOf('v51-prte-m6', 'Refactoring và chất lượng mã', 'Cải thiện cấu trúc mà không thay đổi hành vi mong đợi.', [
      L('Nguyên tắc đặt tên và hàm ngắn', 'Tổ chức mã sao cho ý định dễ đọc.', 'Tên phản ánh vai trò; hàm nên có một trách nhiệm chính và hạn chế trạng thái phụ thuộc khó nhận biết.', 'Refactor hàm dài thành các bước có tên rõ.', 'Bản diff trước/sau và test.'),
      L('Unit test cho hàm thuần', 'Viết test nhanh cho logic cô lập.', 'Hàm thuần có cùng đầu vào thì cho cùng đầu ra và dễ kiểm thử; test nên kiểm tra cả lỗi lẫn trường hợp bình thường.', 'Viết unit test cho tính điểm và bộ lọc.', 'Bộ test tự chạy.'),
      L('Debug bằng breakpoint và watch', 'Lần theo trạng thái khi chương trình chạy.', 'Breakpoint, watch và call stack giúp truy nguyên nhân; nên xác minh giả thuyết từng bước.', 'Tái hiện lỗi chỉ số và sửa bằng kiểm thử.', 'Bug report và commit sửa lỗi.'),
      L('Review và quy ước nhóm', 'Áp dụng checklist code review thống nhất.', 'Review nên chú ý tính đúng, độ rõ, an toàn tài nguyên và test; định dạng tự động giảm tranh luận không cần thiết.', 'Review một pull request giả lập theo checklist.', 'Checklist review và biên bản nhận xét.', 40)
    ])
  ],
  'DASA230179': [
    moduleOf('v51-dasa-m4', 'Danh sách liên kết, stack và queue', 'Chọn cấu trúc dữ liệu phù hợp thao tác.', [
      L('Danh sách liên kết đơn', 'Mô tả node, liên kết và các thao tác chính.', 'Danh sách liên kết thêm/xóa tại vị trí đã biết có thể hiệu quả nhưng tìm kiếm tuyến tính; cần xử lý đầu danh sách.', 'Triển khai thêm đầu/cuối, tìm và xóa node.', 'Linked list và bộ test.'),
      L('Stack và ứng dụng LIFO', 'Dùng stack cho xử lý theo thứ tự vào sau ra trước.', 'Stack phù hợp undo, kiểm tra dấu ngoặc và call stack; thao tác chính là push, pop và peek.', 'Kiểm tra cặp ngoặc và mô phỏng undo.', 'Stack và hai bài ứng dụng.'),
      L('Queue và hàng đợi FIFO', 'Dùng queue cho công việc theo thứ tự đến.', 'Queue biểu diễn hàng chờ; cần chọn cách cài đặt tránh dịch cả mảng sau mỗi lần lấy phần tử.', 'Mô phỏng hàng đợi hỗ trợ và vòng đợi.', 'Queue kèm đánh giá thao tác.'),
      L('Deque và hàng đợi ưu tiên', 'Phân biệt hai đầu và thứ tự ưu tiên.', 'Deque hỗ trợ thao tác hai đầu; priority queue lấy phần tử theo độ ưu tiên thay vì thời điểm đến.', 'Mô phỏng bộ xử lý tác vụ có mức ưu tiên.', 'So sánh cấu trúc và minh họa.', 50)
    ]),
    moduleOf('v51-dasa-m5', 'Cây, heap và bảng băm', 'Tổ chức dữ liệu cho truy vấn và ưu tiên.', [
      L('Cây nhị phân tìm kiếm', 'Thực hiện tìm, chèn và duyệt cây.', 'Hiệu năng BST phụ thuộc hình dạng cây; cây lệch có thể suy giảm về gần tuyến tính.', 'Cài đặt insert/search và ba kiểu duyệt.', 'BST và bộ test thứ tự.'),
      L('Heap và chọn phần tử top-k', 'Dùng heap để lấy phần tử lớn/nhỏ hiệu quả.', 'Heap duy trì quan hệ cha-con theo ưu tiên; heap không đồng nghĩa với mảng đã sắp xếp hoàn toàn.', 'Tìm top 5 điểm cao nhất trong tập dữ liệu.', 'Giải pháp top-k và phân tích.'),
      L('Hash table và xử lý va chạm', 'Giải thích hàm băm và xử lý collision.', 'Hàm băm phân phối khóa; va chạm cần chiến lược chaining hoặc probing và chính sách tải phù hợp.', 'Xây bảng băm đơn giản và kiểm tra va chạm.', 'Bảng băm có test collision.'),
      L('Cây cân bằng và trade-off', 'Giải thích lý do cân bằng cây khi dữ liệu thay đổi.', 'Cây cân bằng duy trì chiều cao bị chặn để ổn định chi phí thao tác, đổi lại việc chèn/xóa phức tạp hơn.', 'So sánh BST lệch và cây cân bằng trên cùng dữ liệu.', 'Báo cáo cấu trúc và trade-off.', 50)
    ]),
    moduleOf('v51-dasa-m6', 'Đồ thị và thuật toán ứng dụng', 'Mô hình hóa quan hệ và tìm đường đi.', [
      L('Biểu diễn đồ thị', 'Chọn danh sách kề hoặc ma trận kề theo bài toán.', 'Danh sách kề tiết kiệm bộ nhớ cho đồ thị thưa; ma trận kề giúp kiểm tra cạnh nhanh ở đồ thị dày.', 'Biểu diễn mạng bạn bè bằng hai phương pháp.', 'Hai cách biểu diễn cùng dữ liệu.'),
      L('BFS và DFS', 'Duyệt đồ thị và phát hiện thành phần liên thông.', 'BFS duyệt theo lớp khoảng cách trong đồ thị không trọng số; DFS đi sâu và hữu ích cho cấu trúc/đường đi.', 'Tìm đường đi và các thành phần liên thông.', 'BFS/DFS cùng test.'),
      L('Đường đi ngắn nhất', 'Chọn thuật toán theo trọng số và ràng buộc.', 'BFS phù hợp cạnh cùng trọng số; Dijkstra dùng trọng số không âm; thuật toán khác cần điều kiện áp dụng rõ.', 'Mô phỏng tìm đường trên đồ thị có trọng số không âm.', 'Bài toán đường đi và chứng minh lựa chọn.'),
      L('Tổng hợp thuật toán và phân tích', 'Đánh giá độ đúng, chi phí và khả năng mở rộng.', 'Lựa chọn thuật toán phải dựa vào giới hạn dữ liệu, điều kiện đầu vào và tính chất cần tối ưu.', 'Thiết kế giải pháp lập lịch phụ thuộc bằng đồ thị.', 'Báo cáo thuật toán, test và độ phức tạp.', 60)
    ])
  ],
  'OOPR230279': [
    moduleOf('v51-oop-m4', 'Vòng đời đối tượng và đóng gói', 'Thiết kế đối tượng an toàn và bảo vệ bất biến.', [
      L('Constructor và bất biến lớp', 'Khởi tạo đối tượng ở trạng thái hợp lệ.', 'Bất biến lớp là điều kiện cần luôn đúng; constructor và phương thức công khai phải bảo vệ điều kiện đó.', 'Thiết kế lớp Account với số dư không âm.', 'Lớp có validation và test bất biến.'),
      L('Composition thay vì kế thừa', 'Chọn quan hệ has-a khi phù hợp.', 'Composition giúp kết hợp hành vi mà không khóa chặt hệ phân cấp; kế thừa nên biểu diễn quan hệ is-a có thể thay thế.', 'Thiết kế Order chứa các OrderLine và PaymentMethod.', 'Sơ đồ lớp và giải thích.'),
      L('Interface và hợp đồng', 'Tách hợp đồng khỏi cách triển khai cụ thể.', 'Interface định nghĩa hành vi; người gọi phụ thuộc vào hợp đồng, không phụ thuộc vào một lớp triển khai duy nhất.', 'Tạo interface NotificationSender cho email và thông báo mẫu.', 'Interface và hai triển khai.'),
      L('Quản lý ngoại lệ trong thiết kế lớp', 'Giữ trạng thái đối tượng nhất quán khi có lỗi.', 'Ngoại lệ nên được dùng cho tình huống lỗi; lỗi dữ liệu người dùng thường cần validation và thông báo có thể xử lý.', 'Thiết kế API thêm sản phẩm và xử lý tồn kho không đủ.', 'Hợp đồng lỗi và bộ test.', 50)
    ]),
    moduleOf('v51-oop-m5', 'Đa hình, generic và nguyên tắc SOLID', 'Mở rộng hành vi mà giảm phụ thuộc.', [
      L('Đa hình và thay thế Liskov', 'Thiết kế lớp con không phá vỡ hợp đồng lớp cha.', 'Lớp con phải giữ các kỳ vọng của người gọi; không nên tăng điều kiện tiền đề hoặc làm yếu bảo đảm đầu ra.', 'Đánh giá một hệ phân cấp hình học có hành vi diện tích.', 'Phân tích vi phạm và phương án sửa.'),
      L('Generic và lập trình theo kiểu', 'Tái sử dụng thuật toán với ràng buộc kiểu.', 'Generic giảm lặp nhưng cần ràng buộc rõ; không nên tạo trừu tượng chung khi chưa có nhu cầu thật.', 'Viết hàm tìm phần tử lớn nhất cho nhiều kiểu so sánh.', 'Hàm generic và ca kiểm thử.'),
      L('SRP, OCP và DIP', 'Nhận biết ba nguyên tắc thiết kế cốt lõi.', 'Một module nên có lý do thay đổi tập trung; mở rộng tránh sửa lõi không cần thiết; phụ thuộc nên hướng vào abstraction.', 'Refactor service báo cáo đang truy cập trực tiếp database và email.', 'Sơ đồ phụ thuộc trước/sau.'),
      L('Design pattern theo vấn đề', 'Chọn pattern để giải quyết nhu cầu cụ thể, không dùng máy móc.', 'Strategy thay đổi thuật toán, Factory tập trung tạo đối tượng, Observer phát sự kiện; mỗi pattern thêm cấu trúc nên cần lý do rõ.', 'Thiết kế nhiều chính sách tính phí bằng Strategy.', 'Mã mẫu và giải thích trade-off.', 55)
    ]),
    moduleOf('v51-oop-m6', 'Kiểm thử, refactoring và thiết kế', 'Đánh giá chất lượng lớp và thay đổi an toàn.', [
      L('Dependency injection', 'Đưa phụ thuộc từ bên ngoài vào đối tượng.', 'Injection giúp thay thế implementation trong test và giảm việc lớp tự tạo mọi phụ thuộc.', 'Inject clock và repository vào service tính hạn.', 'Service có test dùng dependency giả.'),
      L('Unit test cho đối tượng có trạng thái', 'Kiểm thử chuỗi hành động và bất biến.', 'Test trạng thái nên kiểm tra cả chuyển trạng thái hợp lệ và hành vi bị từ chối.', 'Test tài khoản khóa/mở và các giao dịch số dư.', 'Test suite có đường đi hợp lệ và lỗi.'),
      L('Refactoring dựa trên test', 'Cải thiện thiết kế mà giữ hành vi.', 'Trước khi refactor cần test bảo vệ hành vi; thực hiện thay đổi nhỏ, chạy test và review diff sau mỗi bước.', 'Tách class dài thành service và value object.', 'Refactor kèm test xanh.'),
      L('Project OOP: quản lý thư viện nhỏ', 'Thiết kế lớp cộng tác với quy tắc nghiệp vụ.', 'Mô hình cần phân định trách nhiệm entity, service và repository, đồng thời bảo vệ điều kiện mượn/trả.', 'Xây chức năng mượn/trả sách với lỗi và nhật ký.', 'Mã nguồn, sơ đồ lớp và test tích hợp.', 70)
    ])
  ],
  'SOEN330679': [
    moduleOf('v51-soen-m4', 'Khai thác yêu cầu và Agile', 'Quản lý thay đổi từ stakeholder đến backlog.', [
      L('Stakeholder và phỏng vấn yêu cầu', 'Thu thập nhu cầu và xác minh giả định.', 'Yêu cầu có thể mâu thuẫn giữa nhóm người dùng; cần ghi nguồn, mức ưu tiên và cách xác minh.', 'Lập kế hoạch phỏng vấn cho hệ thống đặt lịch.', 'Bản ghi yêu cầu và câu hỏi mở.'),
      L('Use case và acceptance criteria', 'Mô tả tương tác chính, ngoại lệ và điều kiện hoàn tất.', 'Use case diễn đạt tác nhân, tiền điều kiện, luồng chính và luồng ngoại lệ; tiêu chí chấp nhận làm rõ kết quả.', 'Viết use case tạo, đổi và hủy lịch.', 'Use case và tiêu chí chấp nhận.'),
      L('Backlog, sprint và refinement', 'Chia việc theo giá trị và rủi ro.', 'Backlog cần được tinh chỉnh thường xuyên; story point là ước lượng tương đối, không phải giờ làm tuyệt đối.', 'Chia một epic thành user story và sprint goal.', 'Product backlog và sprint plan.'),
      L('Quản lý thay đổi và truy vết', 'Liên kết yêu cầu với thiết kế, mã và kiểm thử.', 'Traceability giúp đánh giá ảnh hưởng khi yêu cầu thay đổi và xác minh không bỏ sót phần cần kiểm tra.', 'Tạo ma trận requirement–test cho chức năng thanh toán mẫu.', 'Ma trận truy vết.', 50)
    ]),
    moduleOf('v51-soen-m5', 'Kiến trúc và mô hình hóa', 'Tạo thiết kế phù hợp yêu cầu chất lượng.', [
      L('UML dùng đúng mục đích', 'Chọn sơ đồ UML để trả lời câu hỏi thiết kế.', 'Use-case cho phạm vi, class cho cấu trúc, sequence cho tương tác theo thời gian; sơ đồ phải phục vụ trao đổi chứ không chỉ để trang trí.', 'Vẽ sequence cho đăng nhập và class cho phân quyền.', 'Hai sơ đồ có chú thích.'),
      L('Layered architecture và module boundary', 'Phân chia giao diện, nghiệp vụ, domain và persistence.', 'Ranh giới module nên làm rõ trách nhiệm và hướng phụ thuộc; tránh để giao diện trực tiếp thao tác collection dữ liệu.', 'Tách luồng đặt lịch thành API, application service và repository.', 'Sơ đồ kiến trúc và đường đi request.'),
      L('Thiết kế API và hợp đồng dữ liệu', 'Định nghĩa request, response, lỗi và tính tương thích.', 'API nên có validation, mã lỗi nhất quán, phân trang và chính sách thay đổi schema.', 'Thiết kế REST API cho lịch hẹn và tài liệu API.', 'OpenAPI hoặc bảng endpoint.'),
      L('Database design và migration', 'Mô hình hóa quan hệ, chỉ mục và thay đổi schema.', 'Chỉ mục phải bám truy vấn; migration cần có kế hoạch rollback và giữ tương thích khi deploy nhiều bước.', 'Thiết kế bảng lịch hẹn, chỉ mục và migration thêm trạng thái.', 'ERD và kế hoạch migration.', 55)
    ]),
    moduleOf('v51-soen-m6', 'Kiểm thử và phát hành phần mềm', 'Đưa sản phẩm đến trạng thái có thể vận hành.', [
      L('Test pyramid và integration tests', 'Phân bổ test theo phạm vi, độ tin cậy và chi phí.', 'Unit test nhiều và nhanh; integration test xác minh tương tác; E2E tập trung luồng giá trị cao.', 'Lập test pyramid cho API đặt lịch.', 'Chiến lược kiểm thử.'),
      L('CI pipeline và quality gate', 'Tự động hóa lint, test và build.', 'Pipeline nên dừng phát hành khi check quan trọng thất bại; secret cần lưu trong secret store, không nằm trong log.', 'Thiết kế pipeline chạy test, kiểm tra dependency và build.', 'Pipeline YAML minh họa.'),
      L('Observability và xử lý sự cố', 'Dùng log, metric và trace để điều tra.', 'Log có cấu trúc và correlation ID giúp kết nối request; cần tránh ghi mật khẩu/token hoặc dữ liệu cá nhân quá mức.', 'Thiết kế dashboard cho lỗi API và độ trễ.', 'Bảng metric và runbook.'),
      L('Bảo trì, versioning và release notes', 'Lập kế hoạch phát hành có kiểm soát.', 'Release nên có ghi chú rõ, thay đổi phá vỡ tương thích và phương án rollback; version cần phản ánh mức ảnh hưởng.', 'Tạo checklist phát hành phiên bản 1.1 của dự án.', 'Release checklist và release notes.', 45)
    ])
  ],
  'WIPR230579': [
    moduleOf('v51-wipr-m4', 'UI desktop và mô hình sự kiện', 'Tạo giao diện desktop có trạng thái rõ ràng.', [
      L('Bố cục cửa sổ và control', 'Tổ chức control theo nhiệm vụ và thứ bậc thông tin.', 'Giao diện desktop cần co giãn hợp lý, phím tắt và phản hồi thao tác; không nhồi quá nhiều control lên một form.', 'Dựng màn hình danh sách sản phẩm có tìm kiếm và bộ lọc.', 'Wireframe và form chạy được.'),
      L('Event handler và tách logic', 'Không để xử lý nghiệp vụ phình trong event handler.', 'Event handler nhận sự kiện và gọi lớp nghiệp vụ; tách logic giúp dễ kiểm thử và bảo trì.', 'Tách xử lý thêm/sửa sản phẩm ra khỏi code-behind.', 'Form có service riêng.'),
      L('Validation và trải nghiệm lỗi', 'Hiển thị lỗi gần trường nhập và bảo vệ thao tác nguy hiểm.', 'Validation phía giao diện giúp trải nghiệm, nhưng quy tắc dữ liệu vẫn phải kiểm tra ở tầng nghiệp vụ/persistence.', 'Xử lý mã trùng, dữ liệu rỗng và xác nhận xóa.', 'Form có trạng thái lỗi và thành công.'),
      L('Accessibility và phím tắt', 'Hỗ trợ bàn phím, focus và nhãn control.', 'Tab order hợp lý, nhãn rõ và trạng thái không chỉ biểu thị bằng màu giúp tăng khả năng sử dụng.', 'Kiểm thử toàn bộ luồng bằng bàn phím.', 'Checklist accessibility.', 40)
    ]),
    moduleOf('v51-wipr-m5', 'Dữ liệu và tác vụ nền', 'Lưu trữ, phản hồi giao diện và xử lý công việc dài.', [
      L('Repository và persistence', 'Tách truy cập dữ liệu khỏi giao diện.', 'Repository đóng gói truy vấn; UI không nên chứa câu SQL hoặc quy tắc dữ liệu.', 'Thiết kế repository cho danh sách công việc.', 'Interface repository và bản cài đặt.'),
      L('Binding và validation trạng thái', 'Đồng bộ model với view mà không mất trạng thái.', 'Binding thuận tiện nhưng cần quy tắc rõ khi dữ liệu thay đổi, validation thất bại và danh sách rỗng.', 'Tạo form chỉnh sửa với thông báo validation.', 'Màn hình binding có test.'),
      L('Async operation và hủy tác vụ', 'Không chặn UI khi gọi mạng hoặc đọc tệp lớn.', 'Tác vụ dài cần async, trạng thái loading và khả năng hủy khi người dùng rời màn hình.', 'Mô phỏng tải dữ liệu có timeout và nút hủy.', 'Luồng async có error handling.'),
      L('Cache cục bộ và đồng bộ dữ liệu', 'Phân biệt dữ liệu nguồn, cache và dữ liệu chưa đồng bộ.', 'Cache có thể cũ; nên định nghĩa thời gian sống, quy tắc cập nhật và xử lý xung đột.', 'Thêm cache nhỏ cho danh mục và nút làm mới.', 'Sơ đồ đồng bộ và test.', 55)
    ]),
    moduleOf('v51-wipr-m6', 'Đóng gói và vận hành ứng dụng', 'Kiểm thử, bảo mật và phát hành desktop app.', [
      L('Logging và crash report', 'Ghi log đủ để chẩn đoán mà không lộ dữ liệu nhạy cảm.', 'Log nên có thời gian, mức độ, thành phần và correlation; không ghi mật khẩu hoặc access token.', 'Tạo log cho thao tác lưu thất bại.', 'Log mẫu và chính sách lưu.'),
      L('Kiểm thử UI và nghiệp vụ', 'Tách test nghiệp vụ khỏi test UI phụ thuộc thời gian.', 'Phần nghiệp vụ nên có unit test; UI automation dành cho các luồng chính vì dễ chậm và dễ vỡ.', 'Tạo test cho form nhập và thao tác CRUD.', 'Bộ test theo tầng.'),
      L('Bảo vệ cấu hình và cập nhật', 'Quản lý cấu hình, quyền file và bản cập nhật an toàn.', 'Không đóng secret vào binary; cấu hình môi trường và gói phát hành cần xác định nguồn tải đáng tin cậy.', 'Viết checklist phát hành ứng dụng desktop.', 'Checklist phát hành.'),
      L('Project: ứng dụng quản lý dữ liệu desktop', 'Hoàn thiện CRUD, tìm kiếm, lưu trữ và đóng gói.', 'Một project đủ tốt cần dữ liệu mẫu, xử lý ngoại lệ, test thủ công/tự động và hướng dẫn cài đặt.', 'Hoàn thiện ứng dụng quản lý sản phẩm hoặc sinh viên.', 'Bản cài thử, mã nguồn và README.', 75)
    ])
  ],
  'MOPR331279': [
    moduleOf('v51-mopr-m4', 'Kiến trúc mobile và quản lý trạng thái', 'Thiết kế màn hình, navigation và dữ liệu UI.', [
      L('Navigation stack và deep link', 'Thiết kế luồng điều hướng nhất quán.', 'Điều hướng cần xử lý nút back, deep link và trạng thái khi ứng dụng bị khôi phục.', 'Xây luồng danh sách–chi tiết–chỉnh sửa–quay lại.', 'Sơ đồ navigation và demo.'),
      L('State management', 'Tách trạng thái màn hình khỏi logic nghiệp vụ.', 'Loading, success, empty, error và refreshing cần được mô hình hóa để tránh giao diện mơ hồ.', 'Xây màn hình danh sách có loading và retry.', 'State diagram và UI demo.'),
      L('Vòng đời ứng dụng', 'Lưu trạng thái quan trọng khi app bị tạm dừng hoặc đóng.', 'Không giả định màn hình luôn tồn tại; trạng thái cần thiết phải được lưu và khôi phục theo phạm vi phù hợp.', 'Tái hiện xoay màn hình hoặc khởi động lại app.', 'Checklist vòng đời.'),
      L('Thiết kế mobile-first và accessibility', 'Tối ưu thao tác chạm và hỗ trợ người dùng đa dạng.', 'Vùng chạm, cỡ chữ, độ tương phản và thông báo hỗ trợ cần được kiểm tra trên thiết bị thực.', 'Rà soát form trên màn hình nhỏ.', 'Báo cáo usability.', 40)
    ]),
    moduleOf('v51-mopr-m5', 'API, offline và đồng bộ', 'Kết nối server và xử lý mạng không ổn định.', [
      L('REST API và trạng thái request', 'Gọi API với timeout, loading và lỗi có thể phục hồi.', 'UI cần phân biệt lỗi xác thực, lỗi server và lỗi mạng; không lặp request vô hạn.', 'Tải danh sách từ API giả lập và hiển thị retry.', 'API client có xử lý lỗi.'),
      L('Lưu dữ liệu cục bộ', 'Lưu dữ liệu phù hợp với mức nhạy cảm.', 'Cache, preference và database cục bộ có mục đích khác nhau; dữ liệu nhạy cảm không nên lưu không mã hóa.', 'Lưu bản nháp ghi chú và khôi phục sau khi mở app.', 'Demo local persistence.'),
      L('Offline-first và xung đột', 'Xác định hành vi khi mất mạng và đồng bộ lại.', 'Mỗi thao tác offline cần trạng thái pending/failed/synced; xung đột phải có quy tắc giải quyết rõ.', 'Mô phỏng chỉnh sửa cùng một mục trên hai thiết bị.', 'Sơ đồ đồng bộ và ca xung đột.'),
      L('Upload, download và quản lý tài nguyên', 'Theo dõi tiến độ và lỗi truyền file.', 'Upload/download có thể bị gián đoạn; cần giới hạn kích thước, kiểm tra kiểu và phản hồi tiến độ.', 'Thiết kế luồng upload ảnh hồ sơ.', 'Upload flow có validation.', 50)
    ]),
    moduleOf('v51-mopr-m6', 'Kiểm thử, bảo mật và phát hành', 'Chuẩn bị ứng dụng để phân phối và bảo trì.', [
      L('Unit, integration và UI tests', 'Chọn tầng test phù hợp rủi ro mobile.', 'Logic thuần dễ test nhanh; tích hợp kiểm tra API/storage; UI tests bao phủ các luồng quan trọng.', 'Tạo ma trận test đăng nhập, offline và form.', 'Test plan mobile.'),
      L('Bảo mật phiên và dữ liệu', 'Bảo vệ token, thông tin cá nhân và quyền thiết bị.', 'Không hardcode secret; token cần lưu trong kho an toàn của nền tảng và xin quyền đúng lúc.', 'Rà soát storage và permission của app mẫu.', 'Checklist bảo mật mobile.'),
      L('Hiệu năng và pin', 'Phát hiện tác vụ nền gây chậm hoặc tiêu hao.', 'Tránh polling quá mức, công việc nền không cần thiết và tải lại dữ liệu dư thừa.', 'Đo số request và thời gian tải của màn hình chính.', 'Báo cáo hiệu năng.'),
      L('Release, crash tracking và phản hồi', 'Lập kế hoạch phát hành phiên bản có thể theo dõi.', 'Build phát hành cần version, changelog, kiểm tra crash và cơ chế rollback hoặc hotfix.', 'Chuẩn bị release checklist cho phiên bản 1.0.', 'Release notes và kế hoạch giám sát.', 50)
    ])
  ],
  'SDCAPSTONE': [
    moduleOf('v51-cap-m4', 'Quản lý dự án và phối hợp nhóm', 'Tổ chức dự án đủ khả năng hoàn thành đúng phạm vi.', [
      L('Chọn đề tài và xác minh nhu cầu', 'Định nghĩa vấn đề, người dùng và bằng chứng nhu cầu.', 'Đề tài tốt có phạm vi vừa sức, người dùng mục tiêu và tiêu chí thành công có thể đánh giá.', 'So sánh ba ý tưởng theo giá trị, rủi ro và khả thi.', 'Project charter và quyết định đề tài.'),
      L('Phân vai, ownership và working agreement', 'Phân công công việc với người chịu trách nhiệm rõ.', 'Vai trò không thay thế trách nhiệm; nhóm cần thống nhất quy tắc nhánh, review, họp và xử lý xung đột.', 'Lập ma trận trách nhiệm và working agreement.', 'RACI/ownership matrix.'),
      L('Milestone và quản lý rủi ro', 'Theo dõi tiến độ bằng đầu ra và rủi ro.', 'Risk register cần xác suất, tác động, dấu hiệu và phương án giảm thiểu; tiến độ cần phản ánh sản phẩm chạy được.', 'Lập milestone, risk register và kế hoạch dự phòng.', 'Roadmap và risk register.'),
      L('Thiết kế demo increment', 'Tạo bản chạy được ở từng mốc.', 'Increment nhỏ giúp nhận phản hồi sớm và phát hiện sớm các giả định sai.', 'Chọn luồng end-to-end tối thiểu cho milestone đầu.', 'Definition of Done và demo plan.', 40)
    ]),
    moduleOf('v51-cap-m5', 'Tích hợp, kiểm thử và bảo đảm chất lượng', 'Giữ sản phẩm tích hợp được khi nhiều người cùng phát triển.', [
      L('Branching strategy và integration', 'Quản lý merge và giảm xung đột tích hợp.', 'Nhánh ngắn hạn, pull request nhỏ và test tự động giảm rủi ro tích hợp muộn.', 'Đề xuất workflow nhánh cho nhóm 4 người.', 'Workflow Git và checklist merge.'),
      L('Test strategy theo rủi ro', 'Ưu tiên test luồng quan trọng và điểm lỗi nghiêm trọng.', 'Coverage không đảm bảo test tốt; cần kiểm tra hành vi quan trọng, quyền, biên dữ liệu và lỗi mạng.', 'Lập risk-based test matrix cho sản phẩm.', 'Test matrix và tiêu chí vào/ra.'),
      L('Kiểm thử chấp nhận và usability', 'Xác minh sản phẩm đáp ứng tiêu chí người dùng.', 'Acceptance test dùng kịch bản và kết quả mong đợi; usability test quan sát nhiệm vụ thay vì chỉ hỏi người dùng thích hay không.', 'Chuẩn bị 5 kịch bản test và biểu mẫu phản hồi.', 'Báo cáo UAT.'),
      L('Quản lý lỗi phát hành', 'Đánh giá mức độ lỗi và quyết định release/block.', 'Severity phản ánh tác động; priority phản ánh thứ tự xử lý. Lỗi bảo mật hoặc mất dữ liệu thường chặn phát hành.', 'Phân loại danh sách bug giả lập và lập kế hoạch sửa.', 'Bug triage log.', 50)
    ]),
    moduleOf('v51-cap-m6', 'Triển khai, bàn giao và portfolio', 'Đưa sản phẩm đến trạng thái có thể demo và bảo trì.', [
      L('Môi trường và cấu hình triển khai', 'Tách cấu hình khỏi mã và tái lập môi trường.', 'Biến môi trường và secret store tránh để khóa trong repository; môi trường staging giúp kiểm tra trước production.', 'Viết deployment checklist có rollback.', 'Kế hoạch deploy và rollback.'),
      L('Tài liệu kiến trúc và vận hành', 'Bàn giao cách hệ thống hoạt động và xử lý lỗi.', 'Tài liệu hữu ích nêu các quyết định, sơ đồ luồng, cấu hình, backup/restore và giới hạn đã biết.', 'Viết sơ đồ thành phần và runbook cho lỗi phổ biến.', 'Architecture note và runbook.'),
      L('Portfolio trung thực và minh chứng', 'Trình bày đóng góp, công nghệ và hạn chế bằng bằng chứng.', 'Portfolio cần phân biệt phần tự xây và phụ thuộc bên ngoài; không phóng đại kết quả chưa đo được.', 'Tạo case study với ảnh, link demo và phần đóng góp cá nhân.', 'Case study kỹ thuật.'),
      L('Demo cuối kỳ và retrospective', 'Báo cáo kết quả dựa trên tiêu chí đã chốt.', 'Demo cần thể hiện luồng chính, dữ liệu thực nghiệm, giới hạn và kế hoạch cải tiến; retrospective tập trung vào hành động cụ thể.', 'Thực hiện buổi demo thử và thu phản hồi nhóm.', 'Slide demo, video và retrospective.', 60)
    ])
  ]
};

'use strict';

// The bank is deliberately stored separately from the lesson/curriculum catalogue.
// All generated items are tagged by grade, subject, topic and lesson. Exam selection must
// only draw from this exact-topic pool (or selected lessons inside the requested chapter/term).
const crypto = require('node:crypto');
const { buildExtendedQuestionTypes } = require('../extended-types');

const MATH_FAMILY = {
  'natural-numbers': 'natural', 'natural-powers': 'powers', divisibility: 'divisibility', integers: 'integers',
  'integer-compare': 'integer-compare', 'integer-operations': 'integers', fractions: 'fractions', 'fraction-operations': 'fraction-operations',
  decimals: 'decimals', geometry: 'geometry-basics', 'area-perimeter': 'geometry', 'rational-numbers': 'rational-numbers',
  'rational-operations': 'fraction-operations', 'rational-powers': 'powers', ratios: 'ratio', proportions: 'proportions',
  'ratio-problems': 'ratio-problems', algebra: 'algebra', 'angles-triangles': 'triangle', triangle: 'triangle',
  statistics: 'statistics', 'statistics-centre': 'statistics-centre', probability: 'probability', polynomials: 'polynomials',
  identities: 'identities', factorization: 'factorization', 'rational-expressions': 'rational-expressions', 'linear-equations': 'linear',
  'word-equations': 'word-equations', functions: 'functions', quadrilaterals: 'quadrilateral', pythagorean: 'pythagorean', similarity: 'similarity',
  'square-roots': 'roots', radicals: 'radicals', 'quadratic-equations': 'quadratic', 'quadratic-functions': 'quadratic-functions',
  systems: 'systems', viete: 'viete', trigonometry: 'trigonometry', circles: 'circle', 'circle-angles': 'circle-angles',
  'triangle-circles': 'triangle-circles', sets: 'sets', derivative: 'derivative', integral: 'integral', 'exponential-logarithm': 'exponential-logarithm', sequences: 'sequences', limits: 'limits', vectors: 'vectors'
};

const MATH_TERMS = {
  sets: { term: 'mệnh đề và tập hợp', definition: 'Mệnh đề là câu khẳng định có thể xác định đúng hoặc sai; tập hợp là tập các đối tượng được xác định rõ.', example: 'Nếu A={1,2,3} và B={3,4}, thì A∩B={3} và A∪B={1,2,3,4}.', method: 'Xác định miền đối tượng, kiểm tra điều kiện thành viên rồi thực hiện đúng phép hợp/giao.', distractors: ['Mọi câu hỏi đều là mệnh đề.', 'Phần tử khác tập hợp chứa nó.', 'Giao hai tập hợp chứa cả phần tử chỉ xuất hiện ở một tập.'] },
  derivative: { term: 'đạo hàm và sự biến thiên', definition: 'Đạo hàm mô tả tốc độ thay đổi tức thời; dấu đạo hàm hỗ trợ xét chiều biến thiên trên khoảng phù hợp.', example: 'Nếu f(x)=x² thì f′(x)=2x.', method: 'Xác định hàm số và miền xét, tính đạo hàm, giải điều kiện f′(x)=0 rồi lập bảng dấu.', distractors: ['Đạo hàm luôn bằng chính hàm số.', 'f′(x)=0 có nghĩa hàm luôn bằng 0.', 'Có thể lập bảng biến thiên mà không xét miền xác định.'] },
  integral: { term: 'nguyên hàm và tích phân', definition: 'Nguyên hàm F của f thỏa F′=f; tích phân xác định có thể biểu diễn diện tích có hướng theo các điều kiện thích hợp.', example: 'Một nguyên hàm của 2x là x²+C.', method: 'Nhận dạng hàm dưới dấu tích phân, dùng quy tắc phù hợp và kiểm tra nguyên hàm bằng cách lấy đạo hàm.', distractors: ['Đạo hàm của mọi nguyên hàm là 0.', 'Hằng số C làm thay đổi đạo hàm.', 'Đổi cận tích phân không ảnh hưởng dấu kết quả.'] },
  'exponential-logarithm': { term: 'lũy thừa, hàm số mũ và logarit', definition: 'Logarit log_a(b)=c tương đương a^c=b với a>0, a khác 1 và b>0.', example: 'log_2(8)=3 vì 2³=8.', method: 'Kiểm tra điều kiện cơ số và biểu thức logarit, chuyển giữa dạng logarit và lũy thừa rồi kiểm tra kết quả.', distractors: ['Cơ số logarit có thể bằng 1.', 'log_a(x+y) luôn bằng log_a(x)+log_a(y).', 'Biểu thức logarit có thể có số bị logarit không dương.'] },
  sequences: { term: 'dãy số và cấp số', definition: 'Dãy số là hàm xác định trên tập chỉ số; cấp số cộng có hiệu hai số hạng liên tiếp không đổi.', example: 'Dãy 3,7,11,15 là cấp số cộng có công sai 4.', method: 'Xác định quy luật, chỉ số số hạng và công sai/công bội trước khi tính số hạng tổng quát.', distractors: ['Cấp số cộng có tỉ số liên tiếp không đổi.', 'Số hạng thứ n luôn bằng công sai.', 'Chỉ cần nhìn hai số đầu để kết luận mọi dãy đều là cấp số.'] },
  limits: { term: 'giới hạn', definition: 'Giới hạn mô tả giá trị mà hàm hoặc dãy tiến gần tới khi biến tiến tới một điểm hoặc vô cực.', example: 'lim(x→2)(x+3)=5.', method: 'Xác định điểm tiến tới, xét điều kiện thay trực tiếp; nếu chưa xác định thì biến đổi hoặc dùng quy tắc giới hạn phù hợp.', distractors: ['Giới hạn luôn bằng giá trị hàm tại điểm.', 'Vô cực là một số thực cụ thể.', 'Có thể bỏ qua điều kiện khi biến đổi biểu thức.'] },
  vectors: { term: 'vectơ và tọa độ', definition: 'Vectơ có hướng và độ dài; tọa độ vectơ cho phép thực hiện phép cộng, nhân vô hướng và tính độ dài.', example: 'Vectơ (3,4) có độ dài 5.', method: 'Xác định đúng tọa độ thành phần, áp dụng phép toán theo từng thành phần và kiểm tra đơn vị/độ dài.', distractors: ['Vectơ chỉ có độ dài mà không có hướng.', 'Cộng tọa độ chéo thành phần.', 'Độ dài vectơ có thể âm.'] },
  'integer-compare': { term: 'so sánh số nguyên và giá trị tuyệt đối', definition: 'Trên trục số, số nằm bên phải lớn hơn số bên trái; giá trị tuyệt đối là khoảng cách tới 0.', example: '|−5|=5 và −2 > −6.', method: 'Đánh dấu vị trí trên trục số, so sánh vị trí trước rồi mới xét giá trị tuyệt đối.', distractors: ['Số âm có giá trị tuyệt đối luôn âm.', 'Số nằm bên trái trên trục số luôn lớn hơn.', 'Khoảng cách đến 0 có thể là số âm.'] },
  'rational-numbers': { term: 'số hữu tỉ', definition: 'Số hữu tỉ viết được dưới dạng a/b với a,b là số nguyên và b khác 0.', example: '−3/4 là số hữu tỉ và nằm giữa −1 và 0.', method: 'Đưa các số về biểu diễn phù hợp rồi so sánh trên trục số hoặc dùng quy đồng.', distractors: ['Mẫu số được phép bằng 0.', 'Số hữu tỉ không thể là số nguyên.', 'Mọi số hữu tỉ đều lớn hơn 1.'] },
  proportions: { term: 'đại lượng tỉ lệ thuận và tỉ lệ nghịch', definition: 'Hai đại lượng tỉ lệ thuận có tỉ số tương ứng không đổi; hai đại lượng tỉ lệ nghịch có tích tương ứng không đổi.', example: 'Cùng vận tốc, thời gian tăng gấp đôi thì quãng đường tăng gấp đôi.', method: 'Xác định đại lượng nào tăng/giảm và kiểm tra tỉ số hoặc tích theo giả thiết.', distractors: ['Tỉ lệ thuận luôn có một đại lượng tăng và đại lượng kia giảm.', 'Tỉ lệ nghịch có tích hai đại lượng thay đổi tùy ý.', 'Bỏ qua điều kiện không đổi của bài toán.'] },
  'ratio-problems': { term: 'bài toán thực tế về tỉ lệ', definition: 'Bài toán tỉ lệ sử dụng quan hệ giữa hai đại lượng để tìm giá trị còn thiếu.', example: 'Nếu 3 quyển vở giá 18 nghìn đồng thì 5 quyển cùng loại giá 30 nghìn đồng.', method: 'Xác định đơn vị, tính giá trị cho một đơn vị rồi nhân theo số lượng cần tìm.', distractors: ['Đơn giá thay đổi dù cùng sản phẩm và điều kiện.', 'Cộng số lượng với đơn giá thay vì dùng quan hệ tỉ lệ.', 'Không kiểm tra đơn vị tiền tệ.'] },
  'statistics-centre': { term: 'số trung bình, trung vị và mốt', definition: 'Trung bình là tổng chia số lượng; trung vị là giá trị giữa sau khi sắp xếp; mốt xuất hiện nhiều nhất.', example: 'Với dãy 1,2,2,9, mốt là 2 và trung vị là (2+2)/2=2.', method: 'Sắp xếp dữ liệu trước khi tìm trung vị và đếm tần số trước khi tìm mốt.', distractors: ['Trung vị luôn là số lớn nhất.', 'Mốt là tổng các số chia số lượng.', 'Không cần sắp xếp dữ liệu để tìm trung vị.'] },
  radicals: { term: 'biến đổi biểu thức chứa căn', definition: 'Biến đổi biểu thức chứa căn cần dùng tính chất căn thức với điều kiện xác định phù hợp.', example: '√(4x²)=2|x| với x là số thực.', method: 'Kiểm tra điều kiện dưới dấu căn, dùng đúng quy tắc nhân chia căn và giữ giá trị tuyệt đối khi cần.', distractors: ['√(a+b) luôn bằng √a+√b.', 'Bỏ qua điều kiện dưới dấu căn.', '√(x²) luôn bằng x với mọi số thực.'] },
  'fraction-operations': { term: 'phép tính phân số', definition: 'Khi cộng hoặc trừ phân số khác mẫu, quy đồng mẫu số rồi cộng hoặc trừ tử số; khi nhân/chia cần áp dụng đúng quy tắc.', example: '1/2 + 1/3 = 3/6 + 2/6 = 5/6.', method: 'Xác định phép tính, quy đồng khi cần, rút gọn kết quả và kiểm tra bằng ước lượng.', distractors: ['Cộng tử số với tử số và mẫu số với mẫu số.', 'Không cần quy đồng phân số khác mẫu.', 'Chia phân số bằng cách nhân cả hai phân số.'] },
  'geometry-basics': { term: 'điểm, đường thẳng và góc', definition: 'Điểm xác định vị trí; đường thẳng kéo dài vô hạn về hai phía; góc được tạo bởi hai tia chung gốc.', example: 'Hai tia chung gốc O tạo thành góc AOB.', method: 'Gọi đúng tên điểm, tia và đỉnh góc; dùng kí hiệu hình học nhất quán.', distractors: ['Đường thẳng có hai đầu mút cố định.', 'Đỉnh góc nằm ngoài hai tia tạo góc.', 'Một điểm luôn có kích thước diện tích.'] },
  'identities': { term: 'hằng đẳng thức đáng nhớ', definition: 'Hằng đẳng thức là đẳng thức đúng với mọi giá trị biến thuộc miền xác định.', example: '(a+b)² = a² + 2ab + b².', method: 'Nhận dạng dạng thức, giữ đúng dấu và hệ số của hạng tử giữa.', distractors: ['(a+b)² = a²+b² trong mọi trường hợp.', '(a-b)² luôn bằng a²-b².', 'Có thể đổi dấu hạng tử tùy ý.'] },
  'factorization': { term: 'phân tích đa thức thành nhân tử', definition: 'Phân tích đa thức thành nhân tử viết đa thức thành tích của các biểu thức đơn giản hơn.', example: 'x² − 9 = (x − 3)(x + 3).', method: 'Tìm nhân tử chung, nhận dạng hằng đẳng thức hoặc nhóm hạng tử phù hợp.', distractors: ['Phân tích thành nhân tử là cộng thêm hạng tử mới.', 'Có thể bỏ một hạng tử khi biến đổi.', 'Tích hai biểu thức luôn bằng tổng của chúng.'] },
  'rational-expressions': { term: 'phân thức đại số', definition: 'Phân thức đại số là thương của hai đa thức, trong đó mẫu thức không được bằng 0.', example: '(x²−1)/(x−1) xác định khi x ≠ 1 và rút gọn thành x+1 trong điều kiện đó.', method: 'Nêu điều kiện xác định trước, phân tích nhân tử rồi rút gọn nhân tử chung hợp lệ.', distractors: ['Mẫu thức có thể bằng 0.', 'Rút gọn được thì điều kiện xác định không còn ý nghĩa.', 'Được phép cộng trực tiếp tử và mẫu.'] },
  'word-equations': { term: 'lập phương trình từ bài toán', definition: 'Lập phương trình chuyển các dữ kiện quan hệ trong tình huống thành biểu thức và phương trình có ẩn.', example: 'Gọi số cần tìm là x, “gấp đôi số đó rồi thêm 3 được 11” cho 2x+3=11.', method: 'Chọn ẩn kèm điều kiện, biểu diễn đại lượng, lập phương trình và đối chiếu nghiệm với đề.', distractors: ['Không cần đặt ẩn.', 'Lập phương trình không dùng dữ kiện của đề.', 'Chấp nhận nghiệm không thỏa điều kiện thực tế.'] },
  quadrilateral: { term: 'tứ giác', definition: 'Tứ giác là đa giác có bốn cạnh; tổng các góc trong của tứ giác bằng 360°.', example: 'Hình chữ nhật là tứ giác có bốn góc vuông.', method: 'Nhận diện dấu hiệu cạnh song song, độ dài cạnh và góc để phân loại hình.', distractors: ['Tứ giác có ba cạnh.', 'Tổng góc trong tứ giác bằng 180°.', 'Mọi tứ giác đều có bốn góc vuông.'] },
  pythagorean: { term: 'định lí Pythagore', definition: 'Trong tam giác vuông, bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.', example: 'Tam giác vuông có hai cạnh góc vuông 3 và 4 thì cạnh huyền bằng 5.', method: 'Xác định cạnh huyền đối diện góc vuông rồi áp dụng c²=a²+b².', distractors: ['Áp dụng công thức cho mọi tam giác bất kì.', 'Cạnh huyền luôn ngắn hơn cạnh góc vuông.', 'Cộng độ dài hai cạnh thay cho bình phương.'] },
  similarity: { term: 'tam giác đồng dạng', definition: 'Hai tam giác đồng dạng khi các góc tương ứng bằng nhau và các cạnh tương ứng tỉ lệ.', example: 'Tỉ số hai cạnh tương ứng của hai tam giác đồng dạng bằng 2 thì các cạnh tương ứng đều có cùng tỉ số 2.', method: 'Xác định cặp đỉnh tương ứng, lập đúng tỉ số cạnh và kiểm tra điều kiện đồng dạng.', distractors: ['Tam giác đồng dạng bắt buộc phải bằng nhau về kích thước.', 'Chỉ cần một cạnh bằng nhau là đủ.', 'Tỉ số cạnh tương ứng phải khác nhau.'] },
  'quadratic-functions': { term: 'hàm số bậc hai', definition: 'Hàm số dạng y=ax² (a khác 0) có đồ thị là một parabol đối xứng qua trục tung.', example: 'Với y=2x², khi x=−2 thì y=8.', method: 'Thay giá trị x để tính y và dùng các điểm đối xứng để phác đồ thị.', distractors: ['Đồ thị hàm số bậc hai luôn là đường thẳng.', 'Khi x thay đổi thì y luôn giữ nguyên.', 'Parabol không có trục đối xứng.'] },
  viete: { term: 'hệ thức Viète', definition: 'Với ax²+bx+c=0 có hai nghiệm x₁,x₂, ta có x₁+x₂=−b/a và x₁x₂=c/a.', example: 'x²−5x+6=0 có hai nghiệm 2 và 3, tổng bằng 5 và tích bằng 6.', method: 'Xác định đúng hệ số a,b,c, sau đó tính tổng và tích nghiệm theo công thức.', distractors: ['Tổng hai nghiệm bằng c/a.', 'Tích hai nghiệm bằng −b/a.', 'Hệ thức không phụ thuộc hệ số phương trình.'] },
  trigonometry: { term: 'tỉ số lượng giác', definition: 'Trong tam giác vuông, sin, cos và tan liên hệ cạnh đối, cạnh kề với cạnh huyền hoặc nhau.', example: 'sin góc nhọn = cạnh đối/cạnh huyền.', method: 'Chọn góc đang xét, đánh dấu cạnh đối, cạnh kề, cạnh huyền rồi dùng đúng tỉ số.', distractors: ['sin luôn bằng cạnh kề/cạnh huyền.', 'Cạnh huyền không liên quan tỉ số lượng giác.', 'Tỉ số lượng giác không phụ thuộc góc.'] },
  'circle-angles': { term: 'góc nội tiếp', definition: 'Góc nội tiếp có đỉnh nằm trên đường tròn và hai cạnh chứa hai dây cung; số đo bằng nửa số đo cung bị chắn.', example: 'Góc nội tiếp chắn nửa đường tròn là góc vuông.', method: 'Xác định cung bị chắn, góc ở tâm liên quan và dùng quan hệ bằng một nửa.', distractors: ['Góc nội tiếp luôn bằng góc ở tâm chắn cùng cung.', 'Đỉnh góc nội tiếp phải nằm tại tâm.', 'Góc nội tiếp không liên quan cung bị chắn.'] },
  'triangle-circles': { term: 'đường tròn nội tiếp và ngoại tiếp tam giác', definition: 'Tâm đường tròn ngoại tiếp cách đều ba đỉnh; tâm đường tròn nội tiếp cách đều ba cạnh của tam giác.', example: 'Tâm ngoại tiếp là giao điểm các đường trung trực của tam giác.', method: 'Nhận diện đường trung trực và phân giác, không nhầm hai loại tâm.', distractors: ['Tâm nội tiếp là giao điểm ba đường trung trực.', 'Tâm ngoại tiếp cách đều ba cạnh.', 'Hai tâm luôn trùng nhau với mọi tam giác.'] },
  powers: { term: 'lũy thừa', definition: 'Lũy thừa biểu diễn phép nhân lặp lại cùng một thừa số; số mũ cho biết số lần nhân.', example: '2³ = 2 × 2 × 2 = 8.', method: 'Xác định cơ số và số mũ, sau đó thực hiện phép nhân lặp lại.', distractors: ['Cơ số luôn bằng số mũ.', 'Lũy thừa là phép cộng lặp lại.', 'Số mũ không ảnh hưởng kết quả.'] },
  natural: { term: 'số tự nhiên', definition: 'Số tự nhiên dùng để đếm, sắp thứ tự và biểu diễn số lượng.', example: '7 là số tự nhiên; 7 × 3 = 21.', method: 'Xác định phép toán, thực hiện đúng thứ tự và kiểm tra bằng phép tính ngược.', distractors: ['Số tự nhiên luôn nhỏ hơn 0.', 'Mọi phân số đều là số tự nhiên.', 'Số tự nhiên không thể dùng để đếm.'] },
  divisibility: { term: 'ước và bội', definition: 'a là ước của b khi b chia hết cho a; b đồng thời là bội của a.', example: '3 là ước của 12 vì 12 chia hết cho 3.', method: 'Thử phép chia và kiểm tra số dư bằng 0.', distractors: ['Ước luôn lớn hơn số bị chia.', 'Bội của một số không thể là số chẵn.', 'Số dư khác 0 vẫn chứng minh chia hết.'] },
  integers: { term: 'số nguyên', definition: 'Số nguyên gồm số nguyên âm, số 0 và số nguyên dương.', example: '−4 nằm bên trái 0 trên trục số.', method: 'Dùng trục số và quy tắc dấu để so sánh hoặc tính toán.', distractors: ['Số nguyên chỉ gồm số dương.', 'Số 0 là số nguyên âm.', 'Số nguyên không thể biểu diễn trên trục số.'] },
  fractions: { term: 'phân số', definition: 'Phân số a/b với b khác 0 biểu thị thương của a và b.', example: '1/2 = 2/4 vì nhân cả tử và mẫu với 2.', method: 'Quy đồng mẫu khi so sánh/cộng trừ và rút gọn kết quả nếu có thể.', distractors: ['Mẫu số có thể bằng 0.', 'Muốn cộng phân số luôn cộng riêng tử và mẫu.', 'Hai phân số bằng nhau phải có tử số giống nhau.'] },
  decimals: { term: 'số thập phân', definition: 'Số thập phân biểu diễn phần nguyên và phần thập phân theo hàng.', example: '0,4 + 0,35 = 0,75.', method: 'Đặt các chữ số cùng hàng thẳng cột rồi kiểm tra dấu phẩy.', distractors: ['Khi cộng số thập phân phải đặt dấu phẩy lệch cột.', '0,7 nhỏ hơn 0,65 vì 7 nhỏ hơn 65.', 'Số thập phân không thể biểu diễn phần nhỏ hơn một đơn vị.'] },
  ratio: { term: 'tỉ lệ', definition: 'Tỉ số so sánh hai đại lượng cùng loại hoặc mô tả quan hệ giữa các đại lượng.', example: 'Nếu 2 quyển vở giá 20 000 đồng thì 4 quyển cùng loại giá 40 000 đồng.', method: 'Xác định đại lượng thay đổi, lập tỉ số và kiểm tra đơn vị.', distractors: ['Tỉ số không phụ thuộc vào hai đại lượng.', 'Đại lượng tỉ lệ thuận tăng một thì đại lượng kia luôn giảm.', 'Không cần xét đơn vị khi giải bài toán tỉ lệ.'] },
  algebra: { term: 'biểu thức đại số', definition: 'Biểu thức đại số kết hợp số, biến và các phép toán.', example: 'Với x = 3, biểu thức 2x + 1 có giá trị 7.', method: 'Thay giá trị biến vào biểu thức, giữ đúng thứ tự phép tính.', distractors: ['Biến chỉ được nhận giá trị 0.', 'Không thể cộng các hạng tử đồng dạng.', 'Khi thay biến phải bỏ mọi dấu ngoặc.'] },
  linear: { term: 'phương trình bậc nhất', definition: 'Phương trình bậc nhất một ẩn có thể đưa về dạng ax + b = 0 với a khác 0.', example: '2x + 4 = 10 có nghiệm x = 3.', method: 'Chuyển vế hợp lí, thực hiện phép toán hai vế và thử lại nghiệm.', distractors: ['Nghiệm phải làm hai vế khác nhau.', 'Có thể chia hai vế cho 0.', 'Mọi phương trình bậc nhất đều vô nghiệm.'] },
  geometry: { term: 'chu vi và diện tích', definition: 'Chu vi đo độ dài đường bao; diện tích đo phần mặt phẳng được bao phủ.', example: 'Hình chữ nhật dài 5 cm, rộng 3 cm có chu vi 16 cm và diện tích 15 cm².', method: 'Chọn đúng công thức, ghi đơn vị và kiểm tra độ hợp lí của kết quả.', distractors: ['Chu vi luôn có đơn vị vuông.', 'Diện tích chỉ là tổng các góc.', 'Hình có chu vi lớn hơn luôn có diện tích lớn hơn.'] },
  triangle: { term: 'tam giác', definition: 'Tổng ba góc trong của một tam giác bằng 180 độ.', example: 'Tam giác có hai góc 50° và 60° thì góc còn lại là 70°.', method: 'Vẽ hình, ghi giả thiết và vận dụng tổng góc hoặc định lí phù hợp.', distractors: ['Tổng ba góc tam giác bằng 90°.', 'Mọi tam giác đều có ba cạnh bằng nhau.', 'Một tam giác có thể có hai góc tù.'] },
  polynomials: { term: 'đa thức', definition: 'Đa thức là tổng các đơn thức; chỉ cộng hoặc trừ trực tiếp các hạng tử đồng dạng.', example: '3x + 2x − x = 4x.', method: 'Thu gọn từng hạng tử đồng dạng rồi kiểm tra hệ số và số mũ.', distractors: ['3x + 2y luôn bằng 5xy.', 'Hai hạng tử khác biến luôn đồng dạng.', 'Khi thu gọn có thể bỏ tùy ý số mũ.'] },
  functions: { term: 'hàm số', definition: 'Hàm số gán cho mỗi giá trị đầu vào trong tập xác định đúng một giá trị đầu ra.', example: 'Với y = 2x + 1, khi x = 3 thì y = 7.', method: 'Thay giá trị đầu vào vào biểu thức và kiểm tra điểm trên đồ thị.', distractors: ['Một đầu vào luôn phải có nhiều đầu ra.', 'Đồ thị hàm số không thể biểu diễn trên mặt phẳng tọa độ.', 'Giá trị hàm số không phụ thuộc biến đầu vào.'] },
  roots: { term: 'căn bậc hai', definition: 'Căn bậc hai số học của a không âm là số không âm có bình phương bằng a.', example: '√49 = 7 vì 7² = 49.', method: 'Tìm số không âm có bình phương bằng số dưới dấu căn và kiểm tra lại.', distractors: ['√49 = −7 theo định nghĩa căn bậc hai số học.', 'Căn bậc hai của số âm luôn là số thực.', '√(a+b) luôn bằng √a + √b.'] },
  quadratic: { term: 'phương trình bậc hai', definition: 'Phương trình bậc hai một ẩn có dạng ax² + bx + c = 0 với a khác 0.', example: 'x² − 9 = 0 có hai nghiệm x = 3 và x = −3.', method: 'Đưa về dạng chuẩn, chọn cách phân tích nhân tử hoặc dùng biệt thức phù hợp.', distractors: ['Phương trình bậc hai không có số hạng x².', 'Mọi phương trình bậc hai có đúng một nghiệm thực phân biệt.', 'Có thể bỏ hệ số trước x² khi giải.'] },
  systems: { term: 'hệ phương trình', definition: 'Nghiệm của hệ là bộ giá trị thỏa mãn đồng thời mọi phương trình trong hệ.', example: 'x + y = 7 và x − y = 1 có nghiệm x = 4, y = 3.', method: 'Dùng phép thế hoặc cộng đại số rồi thay nghiệm vào cả hai phương trình.', distractors: ['Nghiệm chỉ cần thỏa một phương trình bất kì.', 'Không cần thử lại cặp nghiệm.', 'Hệ hai ẩn không thể có nghiệm duy nhất.'] },
  circle: { term: 'đường tròn', definition: 'Đường tròn gồm các điểm cách tâm một khoảng không đổi gọi là bán kính.', example: 'Đường kính bằng hai lần bán kính.', method: 'Nhận diện tâm, bán kính, đường kính và dùng quan hệ góc phù hợp.', distractors: ['Đường kính nhỏ hơn bán kính.', 'Mọi dây cung đều là đường kính.', 'Tiếp tuyến cắt đường tròn tại hai điểm phân biệt.'] },
  statistics: { term: 'thống kê', definition: 'Thống kê giúp thu thập, tổ chức, mô tả và phân tích dữ liệu.', example: 'Trung bình của 2, 4, 6 là (2+4+6)/3 = 4.', method: 'Sắp xếp dữ liệu, chọn đại lượng phù hợp và tính lại bằng dữ liệu gốc.', distractors: ['Trung bình luôn bằng giá trị lớn nhất.', 'Biểu đồ không cần nhãn hoặc đơn vị.', 'Có thể kết luận chắc chắn từ dữ liệu thiếu.'] },
  probability: { term: 'xác suất', definition: 'Với các kết quả đồng khả năng, xác suất bằng số kết quả thuận lợi chia tổng số kết quả.', example: 'Gieo xúc xắc cân đối, xác suất ra số chẵn là 3/6 = 1/2.', method: 'Liệt kê không trùng các kết quả có thể và đếm kết quả thuận lợi.', distractors: ['Xác suất nhỏ hơn 0.', 'Xác suất của biến cố chắc chắn bằng 0.', 'Không cần xác định không gian mẫu.'] }
};

const CONCEPT_FAMILY = {
  vietnamese: {
    narrative: 'reading', 'narrative-writing': 'writing', poetry: 'poetry', 'poetry-writing': 'writing', 'reading-comprehension': 'reading',
    'word-meaning': 'language', 'word-formation': 'language', 'sentence-structure': 'grammar', summary: 'summary', speaking: 'speaking',
    argument: 'argument', discussion: 'discussion', 'rhetorical-devices': 'rhetoric', 'expressive-writing': 'writing', 'argument-writing': 'argument',
    'paragraph-writing': 'writing', implication: 'language', 'literary-analysis': 'literary-analysis', 'expository-writing': 'expository',
    'reported-speech': 'grammar', 'source-evaluation': 'source-evaluation'
  },
  english: {
    'basic-communication': 'communication', 'present-simple': 'present-simple', 'question-forms': 'question-forms', 'there-be': 'there-be',
    prepositions: 'prepositions', 'countable-nouns': 'countable-nouns', 'present-continuous': 'present-continuous', 'modal-verbs': 'modal-verbs',
    reading: 'reading', 'paragraph-writing': 'writing', connectors: 'connectors', comparatives: 'comparatives', superlatives: 'superlatives',
    'vocabulary-context': 'vocabulary', 'past-simple': 'past-simple', 'future-forms': 'future-forms', 'email-writing': 'writing',
    'present-perfect': 'present-perfect', 'past-continuous': 'past-continuous', conditionals: 'conditionals', 'relative-clauses': 'relative-clauses',
    'gerunds-infinitives': 'gerunds-infinitives', 'passive-voice': 'passive-voice', 'reported-speech': 'reported-speech', 'opinion-writing': 'writing',
    'grammar-review': 'grammar-review'
  },
  science: {
    'science-safety': 'science-safety', measurement: 'measurement', cells: 'cells', 'states-of-matter': 'matter', 'air-oxygen': 'air-oxygen',
    mixtures: 'mixtures', biodiversity: 'biodiversity', classification: 'classification', forces: 'forces', energy: 'energy', 'solar-system': 'solar-system',
    atoms: 'atoms', molecules: 'molecules', speed: 'speed', sound: 'sound', light: 'light', photosynthesis: 'photosynthesis',
    'cellular-respiration': 'cellular-respiration', metabolism: 'metabolism', magnetism: 'magnetism', 'chemical-change': 'chemical-change',
    'chemical-reaction': 'chemical-reaction', 'acids-bases': 'acids-bases', 'human-body': 'human-body', electricity: 'electricity', heat: 'heat',
    ecosystem: 'ecosystem', 'food-web': 'food-web', environment: 'environment', 'periodic-table': 'periodic-table', 'chemical-bond': 'chemical-bond',
    'reaction-rate': 'reaction-rate', metals: 'metals', 'organic-chemistry': 'organic-chemistry', 'work-energy': 'work-energy', optics: 'optics', genetics: 'genetics'
  },
  history_geo: {
    'historical-sources': 'historical-sources', prehistory: 'prehistory', 'ancient-civilizations': 'ancient-civilizations', 'classical-civilizations': 'classical-civilizations',
    'historical-culture': 'historical-culture', 'early-vietnam': 'early-vietnam', 'map-skills': 'map-skills', earth: 'earth', 'physical-geography': 'physical-geography',
    'medieval-world': 'medieval-world', 'world-exploration': 'world-exploration', 'medieval-vietnam': 'medieval-vietnam', 'asia-geography': 'asia-geography',
    population: 'population', 'economic-geography': 'economic-geography', climate: 'climate', 'water-resources': 'water-resources', environment: 'environment',
    'early-modern-world': 'early-modern-world', 'industrial-revolution': 'industrial-revolution', colonialism: 'colonialism', 'early-modern-vietnam': 'early-modern-vietnam',
    'tay-son': 'tay-son', 'nguyen-dynasty': 'nguyen-dynasty', 'africa-geography': 'world-geography', resources: 'resources', 'americas-geography': 'world-geography',
    globalization: 'globalization', 'world-wars': 'world-wars', 'modern-world': 'modern-world', 'modern-vietnam': 'modern-vietnam', 'vietnam-geography': 'vietnam-geography',
    'economic-regions': 'economic-regions', 'sustainable-development': 'sustainable-development'
  },
  civic: {
    'family-traditions': 'family', empathy: 'empathy', perseverance: 'perseverance', honesty: 'honesty', independence: 'independence', respect: 'respect',
    'self-awareness': 'self-awareness', safety: 'safety', saving: 'saving', community: 'community', environment: 'environment', 'rights-responsibilities': 'rights-responsibilities',
    'local-traditions': 'culture', 'self-study': 'self-study', trustworthiness: 'honesty', 'cultural-heritage': 'culture', 'stress-management': 'wellbeing',
    'school-safety': 'safety', 'financial-literacy': 'financial-literacy', 'social-safety': 'safety', diversity: 'diversity', 'work-ethic': 'perseverance', justice: 'justice',
    'family-safety': 'safety', 'goal-setting': 'self-awareness', 'property-rights': 'rights-responsibilities', 'career-planning': 'career-planning', 'digital-citizenship': 'digital-safety',
    'life-purpose': 'career-planning', 'responsible-consumption': 'saving', entrepreneurship: 'financial-literacy', 'legal-responsibility': 'rights-responsibilities',
    'family-rights': 'rights-responsibilities', 'law-in-life': 'rights-responsibilities', peace: 'community'
  },
  ict: {
    'data-information': 'data-information', 'computer-basics': 'computer-basics', 'network-basics': 'network-basics', 'web-search': 'web-search', 'source-evaluation': 'source-evaluation',
    'digital-safety': 'digital-safety', 'mind-map': 'mind-map', 'word-processing': 'word-processing', 'file-management': 'file-management', algorithms: 'algorithms',
    flowcharts: 'algorithms', 'digital-product': 'digital-product', 'digital-citizenship': 'digital-safety', spreadsheets: 'spreadsheets', 'spreadsheet-formulas': 'spreadsheet-formulas',
    'data-organization': 'data-organization', programming: 'programming', 'loops-testing': 'loops-testing', 'data-representation': 'data-representation', 'data-visualization': 'data-visualization',
    conditionals: 'conditionals', 'computational-thinking': 'computational-thinking', presentations: 'presentations'
  },
  technology: {
    'home-design': 'home-design', 'energy-saving': 'energy-saving', 'home-safety': 'safety', nutrition: 'nutrition', 'food-safety': 'food-safety', 'consumer-choice': 'consumer-choice',
    materials: 'materials', 'tools-safety': 'safety', 'technical-drawing': 'technical-drawing', 'engineering-design': 'engineering-design', 'product-evaluation': 'product-evaluation',
    sustainability: 'environment', agriculture: 'agriculture', 'plant-growing': 'agriculture', 'animal-care': 'animal-care', 'electricity-safety': 'electricity-safety',
    'electrical-circuits': 'electricity', 'technical-specifications': 'technical-drawing', mechanisms: 'mechanisms', 'career-awareness': 'career-planning', 'career-planning': 'career-planning',
    automation: 'engineering-design', 'technical-documentation': 'technical-drawing'
  },
  arts: { 'visual-elements': 'arts', composition: 'arts', 'music-elements': 'arts', 'creative-process': 'creative-process', materials: 'arts', 'art-reflection': 'arts', 'art-ethics': 'arts', 'cultural-heritage': 'arts', 'public-art': 'arts' },
  pe: { 'warm-up': 'physical-safety', 'movement-skills': 'physical-safety', fitness: 'fitness', recovery: 'fitness', sportsmanship: 'sportsmanship', teamwork: 'teamwork', 'fitness-plan': 'fitness', 'injury-prevention': 'physical-safety' },
  experience: { 'self-awareness': 'self-awareness', 'time-management': 'time-management', 'stress-management': 'wellbeing', communication: 'communication', teamwork: 'teamwork', 'community-service': 'community', 'career-awareness': 'career-planning', 'career-planning': 'career-planning', 'career-research': 'source-evaluation', 'responsible-consumption': 'saving', environment: 'environment', reflection: 'reflection' },
  local_education: { 'local-history': 'local-history', 'cultural-heritage': 'culture', 'local-geography': 'local-geography', 'local-environment': 'environment', 'disaster-safety': 'safety', 'local-economy': 'economic-geography', 'local-culture': 'culture', 'community-project': 'community', 'source-evaluation': 'source-evaluation' }
};

const CONCEPTS = {
  reading: { term: 'ý chính', definition: 'Ý chính thể hiện nội dung trọng tâm mà văn bản muốn truyền đạt.', example: 'Tóm tắt các chi tiết quan trọng để nêu điều văn bản chủ yếu nói tới.', action: 'Tìm các chi tiết lặp lại hoặc có quan hệ trực tiếp với chủ đề.', check: 'Đối chiếu ý trả lời với chi tiết có thật trong văn bản.', distractors: ['Chọn ngẫu nhiên một câu bất kì.', 'Chỉ đọc nhan đề rồi tự đoán toàn bộ nội dung.', 'Thêm sự kiện không có trong văn bản.'] },
  narrative: { term: 'nhân vật', definition: 'Văn bản tự sự kể lại sự việc, thường có nhân vật, diễn biến và kết quả.', example: 'Dựa vào hành động và lời nói để nhận xét tính cách nhân vật.', action: 'Theo dõi trình tự sự việc và tìm chi tiết làm căn cứ nhận xét.', check: 'Sắp xếp sự việc theo trình tự và kiểm tra với văn bản.', distractors: ['Bỏ qua mọi sự kiện trong truyện.', 'Nhận xét nhân vật mà không cần chi tiết.', 'Thay đổi kết thúc truyện khi tóm tắt.'] },
  poetry: { term: 'hình ảnh thơ', definition: 'Hình ảnh thơ gợi ra sự vật, cảm xúc hoặc liên tưởng thông qua ngôn từ cô đọng.', example: 'Dựa vào từ ngữ gợi hình, nhịp điệu và cảm xúc để nêu tác dụng của hình ảnh.', action: 'Trích từ ngữ tiêu biểu rồi giải thích cảm xúc hoặc ý nghĩa gợi ra.', check: 'Dẫn chứng từ bài thơ và giải thích mối liên hệ với nhận xét.', distractors: ['Chỉ đếm số chữ mà không đọc nghĩa.', 'Tách từ ngữ khỏi ngữ cảnh.', 'Khẳng định tác giả có ý gì mà không đưa căn cứ.'] },
  language: { term: 'ngữ cảnh', definition: 'Ngữ cảnh giúp xác định nghĩa của từ và sắc thái phù hợp trong câu hoặc đoạn.', example: 'So sánh nghĩa của một từ với các từ xung quanh để chọn nghĩa phù hợp.', action: 'Đọc cả câu, xem quan hệ giữa các từ và thử thay bằng từ gần nghĩa.', check: 'Đọc lại câu sau khi chọn nghĩa để xem có phù hợp không.', distractors: ['Chọn nghĩa đầu tiên trong từ điển ở mọi trường hợp.', 'Bỏ qua các từ đứng cạnh.', 'Cho rằng một từ chỉ có duy nhất một nghĩa.'] },
  grammar: { term: 'quan hệ cú pháp', definition: 'Phân tích câu cần xác định thành phần và quan hệ ngữ pháp giữa các bộ phận.', example: 'Xác định chủ ngữ, vị ngữ hoặc quan hệ giữa các vế trong câu.', action: 'Tìm cụm từ trung tâm và thử đặt câu hỏi để xác định chức năng.', check: 'Đọc cả câu và kiểm tra xem việc phân tích có phù hợp cấu trúc không.', distractors: ['Chỉ đếm số từ trong câu.', 'Xếp từ theo độ dài.', 'Tự ý bỏ dấu câu rồi mới phân tích.'] },
  rhetoric: { term: 'biện pháp tu từ', definition: 'Biện pháp tu từ tạo hiệu quả biểu đạt bằng cách sử dụng ngôn từ có dụng ý.', example: 'So sánh đối chiếu hai sự vật có nét tương đồng để làm nổi bật đặc điểm.', action: 'Gọi tên biện pháp, chỉ ra dấu hiệu và nêu tác dụng trong ngữ cảnh.', check: 'Liên hệ tác dụng với hình ảnh, cảm xúc hoặc ý nghĩa của đoạn.', distractors: ['Chỉ tìm từ dài nhất.', 'Nêu tên biện pháp mà không chỉ ra dấu hiệu.', 'Khẳng định mọi câu đều dùng cùng một biện pháp.'] },
  writing: { term: 'dàn ý', definition: 'Dàn ý sắp xếp các ý theo trình tự hợp lí trước khi viết văn bản.', example: 'Một đoạn có câu chủ đề, các câu triển khai và câu kết phù hợp.', action: 'Xác định người đọc, mục đích, ý chính rồi sắp xếp ý trước khi viết.', check: 'Rà soát tính mạch lạc, dẫn chứng, chính tả và yêu cầu đề bài.', distractors: ['Viết ngay mà không cần đọc đề.', 'Lặp một ý ở mọi câu.', 'Bỏ qua mục đích của văn bản.'] },
  argument: { term: 'luận điểm', definition: 'Bài nghị luận cần luận điểm rõ ràng được hỗ trợ bằng lí lẽ và bằng chứng phù hợp.', example: 'Nêu quan điểm rồi dùng dữ kiện hoặc tình huống đáng tin cậy để giải thích.', action: 'Phân biệt ý kiến, lí lẽ và bằng chứng trước khi kết luận.', check: 'Kiểm tra bằng chứng có liên quan và đủ hỗ trợ cho luận điểm không.', distractors: ['Chỉ dùng cảm xúc thay cho mọi lí lẽ.', 'Đưa dẫn chứng không liên quan.', 'Công kích người có ý kiến khác thay vì tranh luận về vấn đề.'] },
  summary: { term: 'tóm tắt', definition: 'Tóm tắt giữ lại các ý và sự kiện chính, loại bỏ chi tiết phụ không cần thiết.', example: 'Dùng lời của mình trình bày ngắn gọn ý chính theo trật tự hợp lí.', action: 'Chọn thông tin chính rồi viết lại bằng câu ngắn và đúng nghĩa.', check: 'So sánh với văn bản gốc để bảo đảm không sai lệch nội dung.', distractors: ['Chép nguyên toàn bộ văn bản.', 'Thêm ý kiến cá nhân vào mọi sự kiện.', 'Đảo lộn các sự kiện có quan hệ trước sau.'] },
  expository: { term: 'thông tin có căn cứ', definition: 'Văn bản thuyết minh cung cấp thông tin chính xác, được tổ chức rõ ràng theo chủ đề.', example: 'Giải thích đặc điểm của đối tượng bằng dữ kiện, định nghĩa hoặc ví dụ phù hợp.', action: 'Xác định đối tượng, chia ý theo khía cạnh và kiểm tra độ tin cậy của dữ kiện.', check: 'Đối chiếu thuật ngữ, con số và nguồn thông tin trước khi hoàn thiện.', distractors: ['Bịa số liệu để bài viết sinh động.', 'Trộn ý kiến với dữ kiện mà không phân biệt.', 'Bỏ qua việc tổ chức nội dung.'] },
  'literary-analysis': { term: 'dẫn chứng', definition: 'Phân tích tác phẩm cần gắn nhận xét với chi tiết, hình ảnh hoặc ngôn từ cụ thể.', example: 'Nêu chi tiết trong tác phẩm rồi giải thích chi tiết ấy làm rõ chủ đề ra sao.', action: 'Nêu nhận xét, dẫn chứng ngắn gọn và phân tích tác dụng.', check: 'Đảm bảo dẫn chứng thực sự hỗ trợ nhận xét và không bị diễn giải sai.', distractors: ['Chỉ kể lại cốt truyện mà không phân tích.', 'Dùng dẫn chứng không có trong tác phẩm.', 'Nêu kết luận mà không có căn cứ.'] },
  speaking: { term: 'trình tự kể', definition: 'Bài kể rõ ràng cần trình tự sự việc dễ theo dõi và chi tiết chính xác.', example: 'Dùng các từ chỉ thời gian để chuyển từ mở đầu đến diễn biến và kết quả.', action: 'Chọn sự việc chính, sắp xếp theo thời gian và nói đủ rõ.', check: 'Tự nghe lại hoặc nhờ người nghe nhắc lại ý chính.', distractors: ['Kể các sự việc ngẫu nhiên.', 'Nói quá nhanh để không ai hỏi lại.', 'Thêm sự kiện không có thật.'] },
  discussion: { term: 'lắng nghe tích cực', definition: 'Thảo luận có ích cần lắng nghe, phản hồi tôn trọng và tập trung vào vấn đề.', example: 'Tóm tắt ý của bạn trước khi bổ sung hoặc nêu quan điểm khác.', action: 'Chờ người khác nói xong, hỏi rõ điều chưa hiểu và phản hồi có lí do.', check: 'Xem phản hồi có đúng điều người nói muốn truyền đạt không.', distractors: ['Ngắt lời liên tục.', 'Chê bai người nói thay vì bàn về ý kiến.', 'Cho rằng ý kiến khác mình luôn sai.'] },
  'source-evaluation': { term: 'nguồn tin đáng tin cậy', definition: 'Nguồn tin đáng tin cậy có tác giả hoặc tổ chức rõ ràng, bằng chứng và thông tin có thể kiểm tra.', example: 'Đối chiếu thông tin với nguồn chính thức hoặc nhiều nguồn độc lập.', action: 'Kiểm tra tác giả, thời điểm, bằng chứng và mục đích của nguồn.', check: 'Tìm nguồn độc lập xác nhận trước khi chia sẻ thông tin.', distractors: ['Tin ngay mọi nội dung nhiều lượt thích.', 'Chỉ đọc tiêu đề mà không mở bài.', 'Chia sẻ vì người gửi là bạn bè mà không kiểm chứng.'] },
  communication: { term: 'giao tiếp phù hợp', definition: 'Giao tiếp phù hợp điều chỉnh ngôn từ và cách thể hiện theo người nghe, mục đích và hoàn cảnh.', example: 'Dùng lời lịch sự để hỏi thông tin hoặc xin trợ giúp.', action: 'Nói rõ mục đích, dùng từ tôn trọng và lắng nghe phản hồi.', check: 'Xác nhận người nghe hiểu đúng thông tin cần truyền đạt.', distractors: ['Dùng cùng một cách nói trong mọi tình huống.', 'Ngắt lời để giành quyền nói.', 'Dùng lời xúc phạm khi không đồng ý.'] },
  connectors: { term: 'từ nối', definition: 'Từ nối thể hiện quan hệ giữa các ý như bổ sung, tương phản hoặc nguyên nhân.', example: 'Dùng “because” để nêu lí do và “but” để biểu thị tương phản.', action: 'Xác định quan hệ ý nghĩa giữa hai mệnh đề trước khi chọn từ nối.', check: 'Đọc lại câu để xem quan hệ logic đã đúng chưa.', distractors: ['Chọn từ nối chỉ vì câu dài.', 'Dùng từ nối ngược nghĩa với quan hệ cần thể hiện.', 'Bỏ qua quan hệ giữa hai ý.'] },
  'present-simple': { term: 'present simple', definition: 'Thì hiện tại đơn thường diễn tả thói quen, sự thật hoặc lịch trình.', example: 'She walks to school every day.', action: 'Dùng động từ nguyên mẫu; thêm -s/-es với he, she, it ở câu khẳng định.', check: 'Kiểm tra chủ ngữ, dấu hiệu thời gian và dạng động từ.', distractors: ['Luôn dùng động từ thêm -ing.', 'Dùng will trước mọi động từ.', 'Thêm -s với mọi chủ ngữ số nhiều.'] },
  'present-continuous': { term: 'present continuous', definition: 'Thì hiện tại tiếp diễn dùng am/is/are + V-ing cho hành động đang diễn ra.', example: 'They are studying English now.', action: 'Chọn am/is/are theo chủ ngữ rồi thêm dạng V-ing.', check: 'Kiểm tra trợ động từ và dấu hiệu như now hoặc at the moment.', distractors: ['Bỏ động từ be.', 'Dùng V2 sau am/is/are.', 'Dùng do/does + V-ing.'] },
  'past-simple': { term: 'past simple', definition: 'Thì quá khứ đơn diễn tả hành động đã xảy ra và kết thúc trong quá khứ.', example: 'We visited the museum yesterday.', action: 'Dùng V2/V-ed ở khẳng định; dùng did not + động từ nguyên mẫu ở phủ định.', check: 'Kiểm tra mốc thời gian và dạng động từ.', distractors: ['Luôn dùng am/is/are.', 'Dùng did + V2 trong câu phủ định.', 'Dùng V-ing cho mọi sự kiện đã kết thúc.'] },
  comparatives: { term: 'comparative adjective', definition: 'So sánh hơn dùng để so sánh đặc điểm giữa hai người hoặc vật.', example: 'A is taller than B.', action: 'Dùng dạng -er hoặc more + tính từ tùy đặc điểm từ.', check: 'Kiểm tra tính từ, từ than và đối tượng được so sánh.', distractors: ['Dùng most với mọi so sánh hai đối tượng.', 'Bỏ từ nối than khi cần thiết.', 'Dùng dạng so sánh hơn mà không có đối tượng so sánh.'] },
  'modal-verbs': { term: 'modal verb', definition: 'Động từ khuyết thiếu diễn tả khả năng, lời khuyên, nghĩa vụ hoặc sự cho phép.', example: 'You should wear a helmet.', action: 'Dùng động từ nguyên mẫu không “to” sau can, should, must trong cấu trúc thông thường.', check: 'Xem ý nghĩa cần diễn đạt và kiểm tra dạng động từ theo sau.', distractors: ['Luôn thêm -s vào động từ sau can.', 'Dùng to + V sau mọi modal verb.', 'Dùng must để diễn đạt lời xin phép nhẹ nhàng trong mọi tình huống.'] },
  'conditionals': { term: 'conditional sentence', definition: 'Câu điều kiện diễn tả quan hệ giữa điều kiện và kết quả.', example: 'If it rains tomorrow, we will stay at home.', action: 'Xác định điều kiện có thật, giả định hay không có thật rồi chọn cấu trúc phù hợp.', check: 'Đối chiếu thì trong mệnh đề if và mệnh đề kết quả.', distractors: ['Luôn dùng will ngay sau if trong câu điều kiện loại 1.', 'Không cần xác định ý nghĩa thời gian.', 'Hai mệnh đề không cần thể hiện quan hệ.'] },
  'passive-voice': { term: 'passive voice', definition: 'Câu bị động nhấn mạnh đối tượng chịu tác động; dùng dạng be + past participle.', example: 'The room is cleaned every day.', action: 'Xác định tân ngữ câu chủ động và chọn dạng be đúng thì.', check: 'Kiểm tra thì của be và phân từ hai của động từ.', distractors: ['Dùng be + V-ing trong mọi câu bị động.', 'Giữ nguyên chủ ngữ của câu chủ động trong mọi trường hợp.', 'Bỏ dạng phân từ quá khứ.'] },
  'reported-speech': { term: 'reported speech', definition: 'Câu tường thuật thuật lại nội dung lời nói mà không trích dẫn nguyên văn.', example: '“I am tired,” he said. → He said that he was tired.', action: 'Xác định động từ tường thuật, đại từ, trạng từ thời gian và thay đổi thì khi cần.', check: 'Kiểm tra người nói, thời điểm và ý nghĩa của câu gốc.', distractors: ['Luôn giữ dấu ngoặc kép.', 'Không bao giờ điều chỉnh đại từ.', 'Thay đổi ý nghĩa câu gốc để câu nghe tự nhiên hơn.'] },
  relative: { term: 'relative clause', definition: 'Mệnh đề quan hệ bổ sung thông tin cho danh từ đứng trước.', example: 'The girl who won the race is my friend.', action: 'Chọn who cho người, which cho vật và where cho địa điểm trong trường hợp cơ bản.', check: 'Xác định danh từ được bổ nghĩa và vai trò của đại từ quan hệ.', distractors: ['Dùng who cho mọi đồ vật.', 'Đặt mệnh đề quan hệ không liên quan với danh từ.', 'Bỏ mất thông tin cần thiết khiến câu khó hiểu.'] },
  'science-safety': { term: 'an toàn thực hành', definition: 'An toàn thực hành đòi hỏi tuân thủ hướng dẫn, dùng bảo hộ phù hợp và báo giáo viên khi có sự cố.', example: 'Đọc nhãn hóa chất và chỉ thực hiện thí nghiệm theo hướng dẫn.', action: 'Kiểm tra dụng cụ, đọc quy trình và không tự ý nếm hoặc ngửi hóa chất.', check: 'Đối chiếu thao tác với nội quy và yêu cầu bảo hộ.', distractors: ['Tự trộn các hóa chất chưa biết.', 'Chạm tay trực tiếp vào mẫu không rõ tính chất.', 'Bỏ qua kính bảo hộ khi quy trình yêu cầu.'] },
  measurement: { term: 'đo lường', definition: 'Kết quả đo cần có giá trị số và đơn vị đo phù hợp.', example: 'Chiều dài 2 mét được viết là 2 m.', action: 'Chọn dụng cụ có giới hạn đo, độ chia phù hợp và đọc đúng vạch.', check: 'Kiểm tra đơn vị và sai số dụng cụ.', distractors: ['Ghi số đo mà không có đơn vị.', 'Đọc vạch từ góc nhìn lệch lớn.', 'Dùng mọi dụng cụ cho mọi đại lượng.'] },
  cells: { term: 'tế bào', definition: 'Tế bào là đơn vị cấu trúc và chức năng cơ bản của cơ thể sống.', example: 'Kính hiển vi giúp quan sát nhiều cấu trúc tế bào mà mắt thường khó thấy.', action: 'Quan sát tiêu bản, nhận biết cấu trúc chính và ghi kết quả trung thực.', check: 'Đối chiếu hình quan sát với chú thích và mức phóng đại.', distractors: ['Tế bào chỉ tồn tại ở động vật.', 'Mọi tế bào đều có hình dạng và kích thước giống nhau.', 'Có thể xác định mọi cấu trúc tế bào bằng mắt thường.'] },
  matter: { term: 'trạng thái của chất', definition: 'Chất có thể tồn tại ở trạng thái rắn, lỏng hoặc khí và chuyển trạng thái khi điều kiện thay đổi.', example: 'Nước đá nóng lên có thể tan thành nước lỏng.', action: 'Quan sát điều kiện nhiệt độ và mô tả sự thay đổi trạng thái.', check: 'Phân biệt chuyển trạng thái với tạo ra chất mới.', distractors: ['Mọi chất đều chỉ tồn tại ở trạng thái rắn.', 'Tan chảy luôn tạo chất hoàn toàn mới.', 'Trạng thái không liên quan đến điều kiện.'] },
  electricity: { term: 'mạch điện kín', definition: 'Dòng điện chạy trong mạch kín khi các bộ phận tạo thành đường dẫn liên tục và có nguồn phù hợp.', example: 'Công tắc đóng hoàn thiện đường dẫn nên bóng đèn có thể sáng.', action: 'Kiểm tra nguồn, dây dẫn, công tắc và tải theo sơ đồ; không chạm phần điện nguy hiểm.', check: 'Đối chiếu sơ đồ và quan sát hoạt động trong điều kiện an toàn.', distractors: ['Mạch hở luôn cho dòng điện chạy liên tục.', 'Có thể nối dây trần vào nguồn điện lưới để thử.', 'Nguồn điện không cần nối thành mạch.'] },
  ecosystem: { term: 'hệ sinh thái', definition: 'Hệ sinh thái gồm quần xã sinh vật và môi trường sống có quan hệ tương tác.', example: 'Thực vật, động vật, vi sinh vật, nước và đất tương tác trong một ao.', action: 'Nhận diện sinh vật, yếu tố môi trường và mối quan hệ giữa chúng.', check: 'Theo dõi tác động dây chuyền khi một thành phần thay đổi.', distractors: ['Hệ sinh thái chỉ gồm động vật.', 'Sinh vật không phụ thuộc môi trường.', 'Mọi chuỗi thức ăn đều bắt đầu từ động vật ăn thịt.'] },
  'chemical-reaction': { term: 'phản ứng hóa học', definition: 'Phản ứng hóa học tạo ra chất mới từ các chất ban đầu.', example: 'Sắt phản ứng với oxygen và nước trong điều kiện phù hợp tạo gỉ sắt.', action: 'Quan sát dấu hiệu, so sánh chất trước và sau, tuân thủ an toàn.', check: 'Dựa vào bằng chứng về chất mới chứ không chỉ đổi hình dạng.', distractors: ['Mọi sự thay đổi trạng thái đều là phản ứng hóa học.', 'Khối lượng nguyên tử biến mất hoàn toàn trong phản ứng.', 'Có thể ngửi trực tiếp mọi sản phẩm phản ứng.'] },
  'historical-sources': { term: 'tư liệu lịch sử', definition: 'Tư liệu lịch sử cung cấp bằng chứng để tìm hiểu và giải thích sự kiện trong quá khứ.', example: 'Văn bản, hiện vật, hình ảnh hoặc lời kể được kiểm chứng có thể là tư liệu.', action: 'Xác định nguồn, thời điểm, tác giả và bối cảnh của tư liệu.', check: 'Đối chiếu nhiều nguồn và phân biệt bằng chứng với suy luận.', distractors: ['Mọi lời đồn đều là tư liệu xác thực.', 'Không cần xét thời điểm tạo ra tư liệu.', 'Một nguồn bất kì luôn đủ để kết luận mọi vấn đề.'] },
  'map-skills': { term: 'chú giải bản đồ', definition: 'Chú giải giải thích ý nghĩa các kí hiệu, màu sắc hoặc đường biểu diễn trên bản đồ.', example: 'Đọc chú giải trước khi diễn giải một kí hiệu sông hoặc đường giao thông.', action: 'Xem tên bản đồ, tỉ lệ, phương hướng và chú giải trước khi xác định vị trí.', check: 'Đối chiếu kí hiệu với chú giải và đơn vị tỉ lệ.', distractors: ['Bỏ qua chú giải khi đọc kí hiệu lạ.', 'Dùng tỉ lệ bản đồ như nhiệt độ.', 'Suy ra phương hướng chỉ từ màu sắc.'] },
  'medieval-vietnam': { term: 'nhà nước Đại Việt thời trung đại', definition: 'Tìm hiểu lịch sử Đại Việt cần đặt triều đại, sự kiện và tư liệu trong đúng bối cảnh thời gian.', example: 'Khi học một cuộc kháng chiến, xác định thời gian, lực lượng và kết quả từ tư liệu.', action: 'Sắp xếp sự kiện theo thời gian và liên hệ nguyên nhân với kết quả.', check: 'Đối chiếu niên đại và nguồn tư liệu lịch sử.', distractors: ['Đảo lộn niên đại các triều đại.', 'Giải thích mọi sự kiện bằng một nguyên nhân duy nhất.', 'Không cần phân biệt sự kiện với truyền thuyết.'] },
  'world-wars': { term: 'nguyên nhân và hệ quả lịch sử', definition: 'Phân tích chiến tranh lịch sử cần xem xét nhiều nguyên nhân, diễn biến và hệ quả đối với các bên.', example: 'Dùng mốc thời gian và dữ kiện để phân biệt nguyên nhân lâu dài với sự kiện trực tiếp.', action: 'Lập dòng thời gian và so sánh các yếu tố chính trị, kinh tế, xã hội.', check: 'Đối chiếu số liệu và kết luận với nguồn sử liệu tin cậy.', distractors: ['Coi một sự kiện đơn lẻ là nguyên nhân duy nhất.', 'Bỏ qua bối cảnh quốc tế.', 'Dùng quan điểm hiện tại thay hoàn toàn tư liệu.'] },
  'vietnam-geography': { term: 'đặc điểm địa lí', definition: 'Mô tả địa lí cần dựa vào vị trí, bản đồ, số liệu và mối quan hệ tự nhiên – dân cư – kinh tế.', example: 'Liên hệ địa hình và khí hậu với phân bố dân cư hoặc hoạt động sản xuất.', action: 'Đọc bản đồ và số liệu trước khi giải thích đặc điểm vùng.', check: 'Kiểm tra đơn vị, thời điểm số liệu và phạm vi địa lí.', distractors: ['Khái quát cả nước chỉ từ một địa điểm.', 'Bỏ qua đơn vị và thời gian của số liệu.', 'Coi mọi vùng có điều kiện tự nhiên giống nhau.'] },
  respect: { term: 'tôn trọng', definition: 'Tôn trọng thể hiện qua lắng nghe, thừa nhận phẩm giá và không xâm phạm quyền lợi hợp pháp của người khác.', example: 'Tranh luận về ý kiến mà không chế giễu người nêu ý kiến.', action: 'Lắng nghe, trao đổi bình tĩnh và tìm cách giải quyết công bằng.', check: 'Xem hành động có gây tổn hại hoặc phân biệt đối xử không.', distractors: ['Ép người khác phải đồng ý.', 'Chia sẻ thông tin riêng tư để trêu đùa.', 'Dùng định kiến thay bằng chứng.'] },
  rights: { term: 'quyền và nghĩa vụ', definition: 'Quyền và nghĩa vụ gắn với quy định pháp luật và trách nhiệm tôn trọng quyền của người khác.', example: 'Thực hiện nghĩa vụ của mình đồng thời không cản trở quyền hợp pháp của người khác.', action: 'Xác định quy định liên quan và hỏi người có chuyên môn khi tình huống phức tạp.', check: 'Đối chiếu với quy định chính thức, không chỉ theo lời truyền miệng.', distractors: ['Quyền cá nhân cho phép gây hại cho người khác.', 'Nghĩa vụ chỉ áp dụng khi có người giám sát.', 'Tin mọi lời khuyên pháp luật trên mạng.'] },
  'digital-safety': { term: 'bảo vệ dữ liệu cá nhân', definition: 'Bảo vệ dữ liệu cá nhân gồm giữ bí mật thông tin xác thực, hạn chế chia sẻ và xác minh liên kết.', example: 'Không chia sẻ mật khẩu hoặc mã OTP, kể cả khi người lạ tự nhận là nhân viên hỗ trợ.', action: 'Dùng mật khẩu riêng, bật xác thực nhiều yếu tố khi có thể và hỏi người lớn/nhà trường khi nghi ngờ.', check: 'Kiểm tra địa chỉ website, quyền truy cập và nguồn gửi trước khi thao tác.', distractors: ['Gửi mật khẩu cho người yêu cầu qua tin nhắn.', 'Mở mọi tệp đính kèm bất kể người gửi.', 'Công khai địa chỉ nhà và lịch sinh hoạt.'] },
  algorithms: { term: 'thuật toán', definition: 'Thuật toán là một dãy bước hữu hạn, rõ ràng để giải quyết một bài toán.', example: 'Mô tả từng bước để tính trung bình của các số đã nhập.', action: 'Xác định đầu vào, đầu ra, thứ tự xử lí và điều kiện dừng.', check: 'Thử thuật toán với dữ liệu thường, dữ liệu biên và trường hợp đặc biệt.', distractors: ['Các bước có thể mâu thuẫn nhau.', 'Không cần điều kiện kết thúc.', 'Kết quả không cần liên hệ đầu vào.'] },
  programming: { term: 'kiểm thử chương trình', definition: 'Kiểm thử dùng dữ liệu mẫu để phát hiện sai lệch giữa kết quả mong muốn và kết quả thực tế.', example: 'Thử trường hợp đầu vào bằng 0, số âm và giá trị lớn khi phù hợp bài toán.', action: 'Dự đoán kết quả, chạy chương trình, so sánh và sửa nguyên nhân lỗi.', check: 'Lặp lại các ca kiểm thử sau khi sửa mã.', distractors: ['Chỉ thử một đầu vào dễ nhất.', 'Sửa nhiều chỗ ngẫu nhiên mà không đọc lỗi.', 'Xóa kiểm thử sau khi chương trình chạy một lần.'] },
  spreadsheets: { term: 'địa chỉ ô', definition: 'Địa chỉ ô bảng tính xác định vị trí bằng chữ cột và số hàng.', example: 'B3 là ô giao giữa cột B và hàng 3.', action: 'Chọn ô đúng, nhập công thức bắt đầu bằng dấu = và kiểm tra tham chiếu.', check: 'Thử thay dữ liệu đầu vào và quan sát kết quả công thức.', distractors: ['Địa chỉ ô chỉ gồm tên trang tính.', 'B3 luôn là ô ở cột thứ ba.', 'Công thức không phụ thuộc dữ liệu trong ô.'] },
  'engineering-design': { term: 'quy trình thiết kế kĩ thuật', definition: 'Thiết kế kĩ thuật bắt đầu từ nhu cầu, đặt tiêu chí, đề xuất giải pháp, thử nghiệm và cải tiến.', example: 'Làm mô hình, kiểm tra độ bền theo tiêu chí rồi điều chỉnh cấu trúc.', action: 'Xác định vấn đề và giới hạn trước khi chọn vật liệu.', check: 'Đánh giá bằng tiêu chí đo được và ghi lại kết quả thử nghiệm.', distractors: ['Làm sản phẩm ngay mà không xác định nhu cầu.', 'Chỉ đánh giá bằng cảm tính.', 'Bỏ qua an toàn khi thử nghiệm.'] },
  'electricity-safety': { term: 'an toàn điện', definition: 'An toàn điện yêu cầu tránh chạm phần mang điện, ngắt nguồn trước thao tác và dùng thiết bị đúng hướng dẫn.', example: 'Báo người lớn khi dây điện hở và không tự sửa nguồn điện lưới.', action: 'Ngắt nguồn khi có thể thực hiện an toàn và nhờ người có chuyên môn.', check: 'Quan sát dấu hiệu hư hỏng từ khoảng cách an toàn, không thử bằng tay.', distractors: ['Chạm dây điện để xác định dây nóng.', 'Sửa ổ cắm khi nguồn vẫn bật.', 'Dùng thiết bị điện khi tay ướt.'] },
  'food-safety': { term: 'an toàn thực phẩm', definition: 'An toàn thực phẩm đòi hỏi vệ sinh, bảo quản đúng nhiệt độ và tránh nhiễm chéo giữa thực phẩm sống và chín.', example: 'Dùng dụng cụ riêng cho thực phẩm sống và thực phẩm đã nấu chín.', action: 'Rửa tay, kiểm tra hạn dùng và bảo quản theo hướng dẫn.', check: 'Không sử dụng thực phẩm có dấu hiệu hư hỏng hoặc nguồn gốc không rõ.', distractors: ['Để thức ăn chín cạnh thực phẩm sống chưa che đậy.', 'Bỏ qua hạn sử dụng.', 'Nếm thử thực phẩm nghi hỏng để kiểm tra.'] },
  fitness: { term: 'rèn luyện thể lực', definition: 'Rèn luyện thể lực cần phù hợp tình trạng cá nhân, tăng dần cường độ và có thời gian phục hồi.', example: 'Khởi động trước vận động và giảm cường độ khi có dấu hiệu bất thường.', action: 'Thực hiện đúng kĩ thuật, uống nước hợp lí và tuân thủ hướng dẫn.', check: 'Theo dõi cảm giác cơ thể và dừng lại khi có dấu hiệu nguy hiểm.', distractors: ['Tăng cường độ tối đa ngay buổi đầu.', 'Bỏ qua đau bất thường.', 'Cho rằng phục hồi là không cần thiết.'] },
  'career-planning': { term: 'định hướng nghề nghiệp', definition: 'Định hướng nghề nghiệp cân nhắc sở thích, năng lực, giá trị cá nhân và thông tin nghề đáng tin cậy.', example: 'Tìm hiểu nhiệm vụ nghề, điều kiện học tập và thử một hoạt động liên quan.', action: 'Thu thập thông tin từ nhiều nguồn, trao đổi với người có kinh nghiệm và đặt bước thử nhỏ.', check: 'Rà soát mục tiêu theo trải nghiệm mới thay vì quyết định từ một lời quảng cáo.', distractors: ['Chọn nghề chỉ vì đang nổi tiếng.', 'Tin mọi mức lương quảng cáo mà không kiểm tra.', 'Bỏ qua sở thích và năng lực cá nhân.'] },
  environment: { term: 'phát triển bền vững', definition: 'Phát triển bền vững đáp ứng nhu cầu hiện tại mà không làm suy giảm khả năng đáp ứng nhu cầu của thế hệ sau.', example: 'Tiết kiệm tài nguyên và giảm chất thải đồng thời cân nhắc tác động xã hội.', action: 'Giảm sử dụng lãng phí, tái sử dụng khi phù hợp và dựa trên dữ liệu khi lựa chọn giải pháp.', check: 'Xem xét cả tác động môi trường, xã hội và hiệu quả lâu dài.', distractors: ['Dùng hết tài nguyên vì lợi ích ngắn hạn.', 'Chuyển rác sang nơi khác và coi như đã giải quyết.', 'Chỉ xét chi phí trước mắt, bỏ qua hậu quả dài hạn.'] },
  energy: { term: 'lực và năng lượng', definition: 'Lực có thể làm thay đổi chuyển động hoặc làm biến dạng vật; năng lượng là đại lượng gắn với khả năng thực hiện công hoặc gây biến đổi.', example: 'Khi đẩy xe, lực tác dụng làm xe thay đổi chuyển động; năng lượng được truyền giữa các hệ.', action: 'Xác định vật chịu lực, hướng tác dụng và dạng năng lượng trước/sau hiện tượng.', check: 'Đối chiếu lời giải thích với quan sát, dữ kiện và quy luật vật lí phù hợp.', distractors: ['Lực chỉ có thể làm vật nóng lên.', 'Năng lượng tự sinh ra mà không cần nguồn.', 'Hướng và độ lớn của lực không ảnh hưởng chuyển động.'] },
  'solar-system': { term: 'hệ Mặt Trời', definition: 'Hệ Mặt Trời gồm Mặt Trời và các thiên thể chuyển động quanh nó do lực hấp dẫn.', example: 'Trái Đất là một hành tinh chuyển động quanh Mặt Trời.', action: 'Phân biệt sao, hành tinh và vệ tinh; mô tả chuyển động theo mô hình khoa học.', check: 'Kiểm tra mô hình với thứ tự thiên thể và đặc điểm quỹ đạo đã học.', distractors: ['Mặt Trời quay quanh Trái Đất mỗi ngày.', 'Mặt Trăng là một ngôi sao tự phát sáng.', 'Mọi hành tinh có cùng thời gian quay quanh Mặt Trời.'] },
  vocabulary: { term: 'nghĩa từ trong ngữ cảnh', definition: 'Từ vựng được hiểu dựa trên nghĩa, từ loại và các từ xung quanh trong ngữ cảnh giao tiếp.', example: 'Chọn từ mô tả phù hợp với người, địa điểm hoặc hoạt động đang được nói đến.', action: 'Đọc cả câu, xác định vai trò ngữ pháp và dùng ngữ cảnh để loại các nghĩa không phù hợp.', check: 'Đọc lại câu sau khi điền từ để kiểm tra ngữ pháp và ý nghĩa.', distractors: ['Dịch mọi từ theo nghĩa đầu tiên mà không xét câu.', 'Chọn từ chỉ vì có cách viết gần giống.', 'Bỏ qua từ loại và ngữ cảnh.'] },
  'medieval-world': { term: 'xã hội phong kiến thời trung đại', definition: 'Nghiên cứu lịch sử trung đại cần xác định thời gian, không gian, thiết chế xã hội và bằng chứng từ nguồn lịch sử.', example: 'So sánh hai khu vực bằng đặc điểm tổ chức chính quyền, kinh tế và văn hóa dựa trên dữ kiện cụ thể.', action: 'Đặt sự kiện vào đúng mốc thời gian, khu vực và phân biệt sự kiện với cách giải thích.', check: 'Đối chiếu nhiều nguồn và kiểm tra tính phù hợp của niên đại, địa danh.', distractors: ['Gộp mọi khu vực thành một nền văn hóa đồng nhất.', 'Đổi niên đại để phù hợp với nhận định cá nhân.', 'Chỉ dùng một truyền miệng không kiểm chứng làm bằng chứng duy nhất.'] },
  electricity: { term: 'mạch điện và dòng điện', definition: 'Dòng điện xuất hiện trong mạch kín; linh kiện và cách nối quyết định đường đi và tác dụng của dòng điện.', example: 'Mạch có nguồn, dây dẫn và bóng đèn được nối thành vòng kín thì bóng đèn có thể sáng.', action: 'Kiểm tra nguồn điện, tính liên tục của mạch, cực nối và quy tắc an toàn trước khi thử.', check: 'Đối chiếu sơ đồ mạch, kết nối thật và hiện tượng quan sát được.', distractors: ['Mạch hở luôn làm bóng đèn sáng bình thường.', 'Có thể chạm tay vào nguồn điện để xác định cực.', 'Sơ đồ và cách nối linh kiện không ảnh hưởng kết quả.'] },
  justice: { term: 'bảo vệ lẽ phải', definition: 'Bảo vệ lẽ phải là tôn trọng sự thật, đánh giá sự việc dựa trên bằng chứng và ủng hộ điều đúng bằng cách phù hợp, an toàn.', example: 'Khi thấy bạn bị đổ lỗi nhầm, em trình bày điều mình trực tiếp chứng kiến và đề nghị thầy cô xác minh.', action: 'Phân biệt sự thật với tin đồn, kiểm tra nguồn thông tin và lựa chọn cách lên tiếng tôn trọng, không bạo lực.', check: 'Xem nhận định có bằng chứng hay không và cách xử lí có công bằng, phù hợp quy định không.', distractors: ['Bênh người thân dù biết người đó làm sai.', 'Chia sẻ tin chưa kiểm chứng để gây áp lực.', 'Dùng bạo lực hoặc xúc phạm người có ý kiến khác.'] },
  light: { term: 'ánh sáng và sự truyền ánh sáng', definition: 'Ánh sáng truyền theo những quy luật nhất định; sự phản xạ và khúc xạ làm thay đổi hướng truyền trong các điều kiện khác nhau.', example: 'Gương phẳng phản xạ ánh sáng, còn tia sáng đi từ không khí vào nước có thể đổi hướng.', action: 'Vẽ tia tới, pháp tuyến và tia phản xạ/khúc xạ; phân biệt góc đo theo pháp tuyến.', check: 'Đối chiếu hình vẽ tia sáng với quy luật phản xạ hoặc khúc xạ.', distractors: ['Góc tới luôn được đo từ mặt gương.', 'Ánh sáng luôn truyền qua mọi vật như nhau.', 'Gương tạo ảnh bằng cách phát ra ánh sáng mới.'] },
  optics: { term: 'thấu kính và sự tạo ảnh', definition: 'Thấu kính làm khúc xạ ánh sáng và có thể tạo ảnh với đặc điểm phụ thuộc loại thấu kính, vị trí vật và tiêu cự.', example: 'Thấu kính hội tụ có thể tạo ảnh thật của vật đặt ngoài tiêu điểm trong một số điều kiện.', action: 'Xác định loại thấu kính, quang tâm, trục chính, tiêu điểm và dựng các tia đặc biệt.', check: 'Đối chiếu vị trí, chiều và tính chất ảnh với sơ đồ tia và điều kiện đặt vật.', distractors: ['Mọi thấu kính luôn tạo ảnh thật.', 'Vị trí vật không ảnh hưởng ảnh tạo thành.', 'Tiêu điểm và quang tâm là cùng một điểm.'] }
};

const ALIASES = {
  english: { 'question-forms': 'grammar', 'there-be': 'grammar', prepositions: 'grammar', 'countable-nouns': 'grammar', superlatives: 'comparatives', 'vocabulary-context': 'vocabulary', 'future-forms': 'present-simple', 'present-perfect': 'grammar', 'past-continuous': 'grammar', 'relative-clauses': 'relative', 'gerunds-infinitives': 'grammar', 'grammar-review': 'grammar' },
  science: { 'states-of-matter': 'matter', 'air-oxygen': 'matter', mixtures: 'matter', biodiversity: 'ecosystem', classification: 'cells', forces: 'energy', energy: 'energy', 'solar-system': 'solar-system', atoms: 'matter', molecules: 'matter', speed: 'energy', sound: 'energy', light: 'energy', photosynthesis: 'ecosystem', 'cellular-respiration': 'cells', metabolism: 'cells', magnetism: 'energy', 'chemical-change': 'chemical-reaction', 'acids-bases': 'chemical-reaction', 'human-body': 'cells', heat: 'energy', 'food-web': 'ecosystem', 'periodic-table': 'matter', 'chemical-bond': 'matter', 'reaction-rate': 'chemical-reaction', metals: 'matter', 'organic-chemistry': 'chemical-reaction', 'work-energy': 'energy', optics: 'optics', genetics: 'cells' },
  history_geo: { prehistory: 'historical-sources', 'ancient-civilizations': 'historical-sources', 'classical-civilizations': 'historical-sources', 'historical-culture': 'historical-sources', 'early-vietnam': 'medieval-vietnam', earth: 'map-skills', 'physical-geography': 'map-skills', 'world-exploration': 'map-skills', 'asia-geography': 'vietnam-geography', population: 'vietnam-geography', 'economic-geography': 'vietnam-geography', climate: 'vietnam-geography', 'water-resources': 'vietnam-geography', environment: 'vietnam-geography', 'early-modern-world': 'world-wars', 'industrial-revolution': 'world-wars', colonialism: 'world-wars', 'early-modern-vietnam': 'medieval-vietnam', 'tay-son': 'medieval-vietnam', 'nguyen-dynasty': 'medieval-vietnam', 'africa-geography': 'vietnam-geography', resources: 'vietnam-geography', 'americas-geography': 'vietnam-geography', globalization: 'vietnam-geography', 'modern-world': 'world-wars', 'modern-vietnam': 'medieval-vietnam', 'economic-regions': 'vietnam-geography', 'sustainable-development': 'vietnam-geography' },
  civic: { 'family-traditions': 'respect', empathy: 'respect', perseverance: 'respect', honesty: 'respect', independence: 'respect', 'self-awareness': 'respect', safety: 'digital-safety', saving: 'environment', community: 'respect', 'rights-responsibilities': 'rights', 'local-traditions': 'respect', 'self-study': 'respect', trustworthiness: 'respect', 'cultural-heritage': 'respect', 'stress-management': 'respect', 'school-safety': 'digital-safety', 'financial-literacy': 'respect', 'social-safety': 'digital-safety', diversity: 'respect', 'work-ethic': 'respect', 'family-safety': 'digital-safety', 'goal-setting': 'respect', 'property-rights': 'rights', 'career-planning': 'career-planning', 'digital-citizenship': 'digital-safety', 'life-purpose': 'career-planning', 'responsible-consumption': 'environment', entrepreneurship: 'career-planning', 'legal-responsibility': 'rights', 'family-rights': 'rights', 'law-in-life': 'rights', peace: 'respect' },
  ict: { 'data-information': 'spreadsheets', 'computer-basics': 'digital-safety', 'network-basics': 'digital-safety', 'web-search': 'source-evaluation', 'source-evaluation': 'source-evaluation', 'mind-map': 'algorithms', 'word-processing': 'spreadsheets', 'file-management': 'digital-safety', flowcharts: 'algorithms', 'digital-product': 'programming', 'digital-citizenship': 'digital-safety', spreadsheets: 'spreadsheets', 'spreadsheet-formulas': 'spreadsheets', 'data-organization': 'spreadsheets', programming: 'programming', 'loops-testing': 'programming', 'data-representation': 'spreadsheets', 'data-visualization': 'spreadsheets', conditionals: 'algorithms', 'computational-thinking': 'algorithms', presentations: 'spreadsheets' },
  technology: { 'home-design': 'engineering-design', 'energy-saving': 'environment', 'home-safety': 'electricity-safety', nutrition: 'food-safety', 'consumer-choice': 'environment', materials: 'engineering-design', 'tools-safety': 'electricity-safety', 'technical-drawing': 'engineering-design', 'product-evaluation': 'engineering-design', sustainability: 'environment', agriculture: 'environment', 'plant-growing': 'environment', 'animal-care': 'environment', mechanisms: 'engineering-design', 'electrical-circuits': 'electricity-safety', 'technical-specifications': 'engineering-design', 'career-awareness': 'career-planning', 'career-planning': 'career-planning', automation: 'engineering-design', 'technical-documentation': 'engineering-design' },
  arts: { 'visual-elements': 'reading', composition: 'reading', 'music-elements': 'reading', 'creative-process': 'writing', materials: 'writing', 'art-reflection': 'reading', 'art-ethics': 'respect', 'cultural-heritage': 'reading', 'public-art': 'reading' },
  pe: { 'warm-up': 'fitness', 'movement-skills': 'fitness', recovery: 'fitness', sportsmanship: 'respect', teamwork: 'respect', 'fitness-plan': 'fitness', 'injury-prevention': 'fitness' },
  experience: { 'self-awareness': 'career-planning', 'time-management': 'career-planning', 'stress-management': 'career-planning', communication: 'respect', teamwork: 'respect', 'community-service': 'respect', 'career-awareness': 'career-planning', 'career-planning': 'career-planning', 'career-research': 'source-evaluation', 'responsible-consumption': 'environment', environment: 'environment', reflection: 'reading' },
  local_education: { 'local-history': 'historical-sources', 'cultural-heritage': 'historical-sources', 'local-geography': 'vietnam-geography', 'local-environment': 'environment', 'disaster-safety': 'digital-safety', 'local-economy': 'vietnam-geography', 'local-culture': 'historical-sources', 'community-project': 'source-evaluation', 'source-evaluation': 'source-evaluation' }
};

function shuffle(values, seed) {
  const output = [...values];
  let state = crypto.createHash('sha256').update(String(seed)).digest().readUInt32BE(0);
  for (let index = output.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}
function idPart(value) { return String(value).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36); }
function mc(questionId, prompt, answer, distractors, explanation, seed) {
  const choices = shuffle([answer, ...distractors.slice(0, 3)], `${questionId}:${seed}`).map((label) => ({ value: label, label }));
  return { questionId, id: questionId, type: 'multiple_choice', prompt, options: choices, correctAnswer: answer, acceptedAnswers: [answer], points: 1, explanation };
}
function numOptions(answer, wrongs, seed) { return shuffle([String(answer), ...wrongs.map(String).filter((x) => String(x) !== String(answer))].slice(0, 4), seed); }
function mathSeeds(family, grade, offset = 0) {
  const items = [];
  const add = (prompt, answer, wrongs, explanation, fillPrompt = prompt) => items.push({ prompt, answer: String(answer), wrongs: wrongs.map(String), explanation, fillPrompt });
  for (let index = 0; index < 48; index += 1) {
    const i = index + offset;
    const n = i + 2;
    if (family === 'integers') {
      const a = -(i + 3), b = i + 8, op = i % 3;
      const prompt = op === 0 ? `${a} + ${b}` : op === 1 ? `${b} − ${i + 2}` : `${a} × ${((i % 4) + 2)}`;
      const answer = op === 0 ? a + b : op === 1 ? b - (i + 2) : a * ((i % 4) + 2);
      add(`Tính: ${prompt} = ?`, answer, [answer + 1, answer - 2, -answer], 'Thực hiện phép tính theo quy tắc dấu và kiểm tra lại kết quả.');
    } else if (family === 'integer-compare') {
      const a = -(i + 2), b = -(i % 4 + 1), answer = Math.abs(a) > Math.abs(b) ? `${a} < ${b}` : `${a} > ${b}`;
      const actual = a > b ? `${a} > ${b}` : `${a} < ${b}`;
      add(`Chọn dấu so sánh đúng: ${a} □ ${b}`, actual, [actual === `${a} > ${b}` ? `${a} < ${b}` : `${a} > ${b}`, `${a} = ${b}`, `${Math.abs(a)} < ${Math.abs(b)}`], 'Với các số âm, số có giá trị tuyệt đối lớn hơn nằm xa 0 hơn về phía bên trái.');
    } else if (family === 'rational-numbers') {
      const a = i + 1, b = i + 3, left = `${a}/${b}`, right = `${a+1}/${b+1}`;
      const leftValue = a / b, rightValue = (a + 1) / (b + 1), answer = leftValue < rightValue ? '<' : leftValue > rightValue ? '>' : '=';
      add(`So sánh ${left} □ ${right}.`, answer, ['<', '>', '='].filter((value) => value !== answer), 'Có thể quy đồng hoặc so sánh chéo vì các mẫu đều dương.');
    } else if (family === 'fractions') {
      const top = i + 1, denominator = top + 2, factor = 2;
      const numerator = top * factor, denominatorExpanded = denominator * factor;
      const answer = `${top}/${denominator}`;
      add(`Rút gọn phân số ${numerator}/${denominatorExpanded} về dạng tối giản.`, answer, [`${top + 1}/${denominator}`, `${top}/${denominator + 1}`, `${numerator}/${denominatorExpanded}`], 'Chia cả tử và mẫu cho cùng một ước chung khác 0; không thay đổi giá trị phân số.');
    } else if (family === 'fraction-operations') {
      const denominator = i + 10, a = (i % 3) + 1, b = (i % 2) + 1;
      const numA = a, numB = b, answer = `${numA + numB}/${denominator}`;
      add(`Tính ${numA}/${denominator} + ${numB}/${denominator} = ?`, answer, [`${numA + numB}/${denominator * 2}`, `${numA * numB}/${denominator}`, `${numA + numB + 1}/${denominator}`], 'Hai phân số cùng mẫu được cộng bằng cách cộng các tử số và giữ nguyên mẫu số.');
    } else if (family === 'decimals') {
      const a = (i + 2) / 10, b = (i + 3) / 100;
      const answer = Number((a + b).toFixed(2));
      add(`Tính ${a.toFixed(1).replace('.', ',')} + ${b.toFixed(2).replace('.', ',')} = ?`, answer.toFixed(2).replace('.', ','), [(a + b + 0.1).toFixed(2).replace('.', ','), (a + b - 0.2).toFixed(2).replace('.', ','), (a + b + 1).toFixed(2).replace('.', ',')], 'Đặt dấu phẩy thẳng cột theo hàng thập phân và tính từ phải sang trái.');
    } else if (family === 'ratio') {
      const units = i + 2, price = (i + 3) * 5, count = units * 2;
      add(`${units} sản phẩm cùng loại giá ${price} nghìn đồng. Giá của ${count} sản phẩm là bao nhiêu nghìn đồng?`, price * 2, [price + units, price * 3, price / 2], 'Với đơn giá không đổi, tổng giá tiền tỉ lệ thuận với số sản phẩm.');
    } else if (family === 'proportions') {
      const x = i + 2, y = x * 3, answer = y * 2;
      add(`Hai đại lượng tỉ lệ thuận. Khi đại lượng thứ nhất bằng ${x}, đại lượng thứ hai bằng ${y}. Khi đại lượng thứ nhất gấp đôi, đại lượng thứ hai bằng bao nhiêu?`, answer, [y, x*2, answer+3], 'Với hai đại lượng tỉ lệ thuận, khi một đại lượng nhân 2 thì đại lượng kia cũng nhân 2.');
    } else if (family === 'ratio-problems') {
      const units = i + 2, unitPrice = (i + 3) * 4, count = units + 3, answer = count * unitPrice;
      add(`${units} quyển vở cùng loại giá ${units * unitPrice} nghìn đồng. Giá ${count} quyển vở là bao nhiêu nghìn đồng?`, answer, [answer + unitPrice, count + unitPrice, units * unitPrice], 'Tính đơn giá một quyển rồi nhân với số quyển cần mua; giữ đúng đơn vị.');
    } else if (family === 'algebra') {
      const x = i + 2, a = (i % 4) + 2, b = i + 3, answer = a * x + b;
      add(`Với x = ${x}, giá trị của ${a}x + ${b} bằng bao nhiêu?`, answer, [answer + a, answer - b, a + x + b], 'Thay x bằng giá trị đã cho rồi thực hiện phép nhân trước phép cộng.');
    } else if (family === 'linear') {
      const x = i + 2, a = (i % 3) + 2, b = i + 1, c = a * x + b;
      add(`Nghiệm của phương trình ${a}x + ${b} = ${c} là x = ?`, x, [x + 1, x - 1, c - b], 'Chuyển hằng số sang vế phải rồi chia hai vế cho hệ số khác 0 của x.');
    } else if (family === 'geometry') {
      const length = i + 4, width = i + 2;
      add(`Hình chữ nhật dài ${length} cm, rộng ${width} cm. Diện tích bằng bao nhiêu cm²?`, length * width, [2 * (length + width), length + width, length * width + 2], 'Diện tích hình chữ nhật bằng chiều dài nhân chiều rộng.');
    } else if (family === 'geometry-basics') {
      const angle = 15 + ((i * 3) % 165);
      add(`Một góc có số đo ${angle}°. Đây là góc ${angle < 90 ? 'nhọn' : angle === 90 ? 'vuông' : 'tù'}?`, angle < 90 ? 'nhọn' : angle === 90 ? 'vuông' : 'tù', ['nhọn', 'vuông', 'tù'].filter((value) => value !== (angle < 90 ? 'nhọn' : angle === 90 ? 'vuông' : 'tù')), 'Góc nhọn nhỏ hơn 90°, góc vuông bằng 90°, góc tù lớn hơn 90° và nhỏ hơn 180°.');
    } else if (family === 'triangle') {
      const a = 35 + i, b = 65 - (i % 10), answer = 180 - a - b;
      add(`Một tam giác có hai góc ${a}° và ${b}°. Góc còn lại bằng bao nhiêu độ?`, answer, [180 - a, 180 - b, a + b], 'Tổng ba góc trong của tam giác bằng 180°.');
    } else if (family === 'quadrilateral') {
      const a = 55 + i, b = 80 + ((i * 7) % 31), c = 90 + ((i * 11) % 41), answer = 360 - a - b - c;
      add(`Tứ giác có ba góc ${a}°, ${b}° và ${c}°. Góc còn lại bằng bao nhiêu độ?`, answer, [180-a-b-c, 360-a-b, a+b+c], 'Tổng các góc trong một tứ giác bằng 360°.');
    } else if (family === 'pythagorean') {
      const n = i + 2, a = 3 * n, b = 4 * n, c = 5 * n;
      add(`Tam giác vuông có hai cạnh góc vuông ${a} cm và ${b} cm. Cạnh huyền bằng bao nhiêu cm?`, c, [a+b, c+1, b-a], 'Áp dụng c²=a²+b² rồi lấy căn bậc hai số không âm.');
    } else if (family === 'similarity') {
      const small = i + 2, ratio = 2, answer = small * ratio;
      add(`Hai tam giác đồng dạng có tỉ số cạnh tương ứng là ${ratio}. Cạnh ở tam giác nhỏ dài ${small} cm; cạnh tương ứng ở tam giác lớn dài bao nhiêu cm?`, answer, [small + ratio, small / ratio, answer + 1], 'Các cạnh tương ứng của hai tam giác đồng dạng tỉ lệ cùng một hệ số.');
    } else if (family === 'trigonometry') {
      const scale = i + 1, ratios = [{ p: 'sin', ans: '3/5', wrong: ['4/5','3/4','5/3'] }, { p: 'cos', ans: '4/5', wrong: ['3/5','3/4','5/4'] }, { p: 'tan', ans: '3/4', wrong: ['4/5','3/5','4/3'] }];
      const item = ratios[i % ratios.length];
      add(`Tam giác vuông có cạnh đối ${3 * scale} cm, cạnh kề ${4 * scale} cm và cạnh huyền ${5 * scale} cm. Tỉ số ${item.p} của góc đang xét là bao nhiêu?`, item.ans, item.wrong, 'Dùng bộ ba 3–4–5 theo cùng hệ số; sin=cạnh đối/cạnh huyền, cos=cạnh kề/cạnh huyền, tan=cạnh đối/cạnh kề.');
    } else if (family === 'polynomials') {
      const a = i + 2, b = i + 3;
      add(`Thu gọn: ${a}x + ${b}x − x = ?`, `${a + b - 1}x`, [`${a + b}x`, `${a * b}x`, `${a + b - 1}x²`], 'Chỉ cộng trừ hệ số của các hạng tử đồng dạng, giữ nguyên phần biến và số mũ.');
    } else if (family === 'identities') {
      const a = i + 2, b = i + 1, answer = `${a*a}x² + ${2*a*b}x + ${b*b}`;
      add(`Khai triển (${a}x + ${b})² = ?`, answer, [`${a*a}x² + ${b*b}`, `${a*a}x² + ${a*b}x + ${b*b}`, `${a*a}x² − ${2*a*b}x + ${b*b}`], 'Dùng (A+B)²=A²+2AB+B² và giữ đúng hệ số hạng tử giữa.');
    } else if (family === 'factorization') {
      const a = i + 2, b = i + 1, answer = `(x-${a})(x+${a})`;
      add(`Phân tích x² − ${a*a} thành nhân tử.`, answer, [`(x-${a})²`, `(x+${a})²`, `(x-${b})(x+${a})`], 'Áp dụng hiệu hai bình phương: x²−a²=(x−a)(x+a).');
    } else if (family === 'rational-expressions') {
      const a = i + 2, answer = String(a);
      add(`Với x ≠ 1, rút gọn (x²−1)/(x−1) tại x = ${a}.`, String(a + 1), [String(a - 1), String(a*a - 1), String(a + 2)], 'Phân tích x²−1=(x−1)(x+1), rút gọn với điều kiện x≠1 rồi thay x.');
    } else if (family === 'word-equations') {
      const target = 2 * (i + 3) + 4, answer = i + 3;
      add(`Gấp đôi một số rồi cộng 4 được ${target}. Số đó bằng bao nhiêu?`, answer, [answer + 2, target - 4, answer - 1], 'Đặt ẩn x, lập 2x+4=${target}, giải phương trình và thử lại vào tình huống.');
    } else if (family === 'roots') {
      const root = i + 2, square = root * root;
      add(`Giá trị của căn bậc hai số học √${square} là bao nhiêu?`, root, [-root, square, root + 1], 'Căn bậc hai số học là số không âm có bình phương bằng số đã cho.');
    } else if (family === 'radicals') {
      const a = i + 2;
      add(`Với x ≥ 0, rút gọn √(${a*a}x²) = ?`, `${a}x`, [`${a*a}x`, `${a}x²`, `x+${a}`], 'Vì x không âm nên √(a²x²)=a·x với a không âm; điều kiện là quan trọng.');
    } else if (family === 'quadratic') {
      const root = i + 1, square = root * root;
      add(`Nghiệm nào sau đây là nghiệm của phương trình x² − ${square} = 0?`, root, [square, root + 1, -square], 'Từ x² = a² suy ra x = a hoặc x = −a khi a dương.');
    } else if (family === 'functions') {
      const x = i + 1, a = (i % 3) + 2, b = i % 5, answer = a * x + b;
      add(`Cho y = ${a}x + ${b}. Khi x = ${x}, y bằng bao nhiêu?`, answer, [answer + 1, answer - a, a + b], 'Thay giá trị x vào biểu thức hàm số rồi tính.');
    } else if (family === 'systems') {
      const x = i + 2, y = i + 1;
      add(`Hệ x + y = ${x + y}, x − y = ${x - y} có nghiệm x bằng bao nhiêu?`, x, [y, x + y, x + 1], 'Cộng hai phương trình để khử y, tìm x rồi kiểm tra lại cả hệ.');
    } else if (family === 'circle') {
      const radius = i + 2;
      add(`Đường tròn bán kính ${radius} cm có đường kính bao nhiêu cm?`, 2 * radius, [radius, radius * 3, radius + 2], 'Đường kính bằng hai lần bán kính.');
    } else if (family === 'circle-angles') {
      const central = 40 + i * 2, inscribed = central / 2;
      add(`Góc ở tâm chắn một cung có số đo ${central}°. Góc nội tiếp cùng chắn cung đó bằng bao nhiêu độ?`, inscribed, [central, 180-central, central+inscribed], 'Góc nội tiếp chắn cùng cung bằng một nửa góc ở tâm.');
    } else if (family === 'triangle-circles') {
      const answer = 'Giao điểm ba đường trung trực', radius = i + 3;
      add(`Tam giác PQR có tâm ngoại tiếp O và bán kính đường tròn ngoại tiếp ${radius} cm. O được xác định là giao điểm của những đường nào?`, answer, ['Giao điểm ba đường phân giác', 'Giao điểm ba đường cao', 'Giao điểm ba đường trung tuyến'], 'Mỗi điểm trên đường trung trực của một cạnh cách đều hai đầu mút; giao điểm các đường trung trực cách đều ba đỉnh.');
    } else if (family === 'quadratic-functions') {
      const a = (i % 3) + 1, x = i + 1, answer = a * x * x;
      add(`Cho y=${a}x². Khi x=${x}, giá trị y bằng bao nhiêu?`, answer, [a*x, a*x*x+1, x*x], 'Thay giá trị x vào hàm số, bình phương x trước rồi nhân với hệ số a.');
    } else if (family === 'viete') {
      const r1 = i + 1, r2 = i + 3, sum = r1 + r2, product = r1 * r2;
      add(`Phương trình x² − ${sum}x + ${product}=0 có hai nghiệm x₁, x₂. Giá trị x₁+x₂ bằng bao nhiêu?`, sum, [product, -sum, sum+1], 'Theo hệ thức Viète, tổng hai nghiệm bằng −b/a.');
    } else if (family === 'statistics') {
      const a = i + 1, b = i + 3, c = i + 5, answer = a + 3;
      add(`Tính số trung bình cộng của ba số ${a}, ${b}, ${c}.`, answer, [b, c, a + b + c], 'Cộng tất cả các giá trị rồi chia cho số lượng giá trị.');
    } else if (family === 'statistics-centre') {
      const middle = i + 4, answer = middle;
      add(`Dãy số đã sắp xếp: ${middle-2}, ${middle-1}, ${middle}, ${middle+1}, ${middle+4}. Trung vị là bao nhiêu?`, answer, [middle-1, middle+1, middle+4], 'Với 5 giá trị đã sắp xếp, trung vị là giá trị đứng ở giữa.');
    } else if (family === 'probability') {
      const favorable = i + 1, total = favorable + 3 + (i % 5), answer = `${favorable}/${total}`;
      add(`Một phép thử có ${total} kết quả đồng khả năng, trong đó ${favorable} kết quả thuận lợi. Xác suất là bao nhiêu?`, answer, [`${total}/${favorable}`, `${favorable}/${total + 1}`, `${total - favorable}/${total}`], 'Xác suất bằng số kết quả thuận lợi chia cho tổng số kết quả đồng khả năng.');
    } else if (family === 'powers') {
      const base = 2 + (i % 6), exponent = 2 + (Math.floor(i % 48 / 6)), answer = base ** exponent;
      add(`Tính ${base}^${exponent} = ?`, answer, [base * exponent, answer + base, base ** (exponent - 1)], 'Lũy thừa là phép nhân lặp lại cơ số theo số lần bằng số mũ.');
    } else if (family === 'natural') {
      const a = i + 4, b = i + 2, answer = a * b;
      add(`Tính ${a} × ${b} = ?`, answer, [answer + a, a + b, answer - b], 'Thực hiện phép nhân và kiểm tra kết quả bằng phép chia ngược.');
    } else if (family === 'divisibility') {
      const divisor = [2, 3, 5, 9][i % 4], n = 30 + i * 7, divisible = n % divisor === 0, answer = divisible ? `Chia hết cho ${divisor}` : `Không chia hết cho ${divisor}`;
      add(`Số ${n} có chia hết cho ${divisor} không?`, answer, [divisible ? `Không chia hết cho ${divisor}` : `Chia hết cho ${divisor}`, 'Không thể xác định', `Chia hết cho ${divisor + 1}`], divisor === 2 ? 'Số chia hết cho 2 có chữ số tận cùng là số chẵn.' : divisor === 3 || divisor === 9 ? `Số chia hết cho ${divisor} khi tổng chữ số chia hết cho ${divisor}.` : 'Số chia hết cho 5 có chữ số tận cùng là 0 hoặc 5.');
    } else if (family === 'sets') {
      const a = i + 1, b = a + 2, c = b + 2;
      const prompt = i % 2 ? `Cho A={${a},${b},${c}} và B={${b},${c},${c+2}}. A∩B bằng tập nào?` : `Cho A={${a},${b},${c}} và B={${b},${c},${c+2}}. A∪B bằng tập nào?`;
      const answer = i % 2 ? `{${b},${c}}` : `{${a},${b},${c},${c+2}}`;
      add(prompt, answer, [`{${a}}`, `{${b},${c},${c+2}}`, `{${a},${c+2}}`], 'Phép giao lấy các phần tử chung; phép hợp lấy tất cả phần tử không lặp của hai tập.');
    } else if (family === 'derivative') {
      const a = i + 1, b = i % 7 + 1;
      const expression = `${a}x² + ${b}x`, answer = `${2*a}x + ${b}`;
      add(`Cho f(x)=${expression}. Đạo hàm f′(x) là gì?`, answer, [`${a}x + ${b}`, `${2*a}x² + ${b}`, `${a}x² + ${b}`], 'Dùng quy tắc (xⁿ)′=n·xⁿ⁻¹ và tính đạo hàm từng hạng tử.');
    } else if (family === 'integral') {
      const a = i + 1, b = i % 7 + 1;
      add(`Một nguyên hàm của f(x)=${2*a}x + ${b} là gì?`, `${a}x² + ${b}x + C`, [`${2*a}x² + ${b} + C`, `${a}x + ${b}x² + C`, `${a}x² - ${b}x + C`], 'Lấy nguyên hàm từng hạng tử và thêm hằng số C.');
    } else if (family === 'exponential-logarithm') {
      const base = 2 + (i % 6), exponent = 2 + (Math.floor(i % 48 / 6));
      add(`Tính log_${base}(${base}^${exponent}).`, exponent, [base, exponent + 1, base * exponent], 'Dùng tính chất log_a(a^x)=x với cơ số a>0, a khác 1.');
    } else if (family === 'sequences') {
      const first = i % 9 + 1, difference = i % 5 + 2, nTerm = i % 8 + 3, answer = first + (nTerm - 1) * difference;
      add(`Cấp số cộng có u₁=${first}, công sai d=${difference}. Tính u_${nTerm}.`, answer, [first + nTerm * difference, first * difference + nTerm, answer + difference], 'Dùng công thức u_n=u₁+(n−1)d.');
    } else if (family === 'limits') {
      const a = i + 1;
      add(`Tính lim(x→${a}) (x²−${a*a})/(x−${a}).`, 2*a, [a, a*a, 2*a+1], 'Phân tích x²−a²=(x−a)(x+a), rút gọn khi x khác a rồi lấy giới hạn.');
    } else if (family === 'vectors') {
      const k = i + 1, x = 3*k, y = 4*k;
      add(`Vectơ v=(${x};${y}) có độ dài bằng bao nhiêu?`, 5*k, [x+y, 7*k, 4*k], 'Độ dài vectơ trong mặt phẳng là căn bậc hai của tổng bình phương các tọa độ.');
    } else {
      add(`Trong chủ đề “${family}”, lựa chọn nào thể hiện đúng cách giải toán?`, 'Nêu dữ kiện, chọn quy tắc phù hợp và kiểm tra kết quả', ['Bỏ qua dữ kiện', 'Chọn phép tính ngẫu nhiên', 'Không kiểm tra kết quả'], 'Luôn dùng dữ kiện của bài và kiểm tra kết quả sau khi giải.');
    }
  }
  return items.map((item, index) => ({ ...item, index }));
}

const HIGH_SCHOOL_CONCEPTS = {
  'atomic-structure': { term: 'cấu tạo nguyên tử và liên kết hóa học', definition: 'Nguyên tử gồm hạt nhân và electron; tính chất liên kết phụ thuộc cấu hình electron và tương tác giữa các nguyên tử.', example: 'Mô hình electron hóa trị giúp giải thích xu hướng tạo liên kết trong nhiều hợp chất.', action: 'Xác định thành phần, electron hóa trị và loại liên kết theo mô hình đã học.', check: 'Đối chiếu công thức/kí hiệu với quy tắc hóa học và dữ kiện đề bài.', distractors: ['Số proton thay đổi trong mọi phản ứng hóa học thông thường.', 'Electron hóa trị không ảnh hưởng liên kết.', 'Công thức chất có thể viết mà không tuân theo hóa trị/điện tích.'] },
  'reaction-rate': { term: 'tốc độ phản ứng', definition: 'Tốc độ phản ứng mô tả mức độ thay đổi lượng/chất theo thời gian; nhiệt độ, nồng độ, diện tích tiếp xúc và chất xúc tác có thể ảnh hưởng.', example: 'Trong điều kiện phù hợp, tăng diện tích tiếp xúc của chất rắn có thể làm phản ứng nhanh hơn.', action: 'Giữ các biến khác như nhau, thay đổi một yếu tố và so sánh dữ liệu thực nghiệm.', check: 'Nêu biến độc lập, biến phụ thuộc, điều kiện kiểm soát và bằng chứng đo được.', distractors: ['Thay tất cả biến cùng lúc vẫn xác định được nguyên nhân riêng.', 'Chất xúc tác luôn làm thay đổi sản phẩm cuối cùng.', 'Không cần đo thời gian khi so sánh tốc độ phản ứng.'] },
  genetics: { term: 'di truyền và biến dị', definition: 'Di truyền truyền đạt thông tin di truyền qua thế hệ; biến dị tạo ra khác biệt giữa cá thể do nhiều cơ chế sinh học.', example: 'Sơ đồ lai cho phép dự đoán xác suất kiểu gen/kiểu hình khi các giả định di truyền phù hợp.', action: 'Xác định tính trạng, kí hiệu alen, kiểu gen bố mẹ và giả định trước khi lập sơ đồ lai.', check: 'Kiểm tra tỉ lệ xác suất, tính nhất quán của kí hiệu và điều kiện bài toán.', distractors: ['Xác suất kiểu hình luôn là 100% bất kể kiểu gen.', 'Kiểu gen và kiểu hình luôn là một khái niệm.', 'Có thể kết luận quan hệ nhân quả từ một quan sát đơn lẻ.'] },
  'biology-systems': { term: 'tổ chức và chức năng của hệ sống', definition: 'Các cấp tổ chức sống có cấu trúc và chức năng liên hệ; hệ sống trao đổi vật chất/năng lượng và tương tác với môi trường.', example: 'Có thể giải thích chức năng một cơ quan bằng mối quan hệ giữa cấu trúc và nhiệm vụ của nó.', action: 'Mô tả cấp tổ chức, chức năng, đầu vào/đầu ra và quan hệ với hệ thống lớn hơn.', check: 'Đối chiếu mô hình với dữ liệu/sơ đồ và tránh khái quát vượt quá bằng chứng.', distractors: ['Một cơ quan hoạt động độc lập hoàn toàn với các cơ quan khác.', 'Cấu trúc không liên quan chức năng.', 'Mọi sinh vật có cấu tạo cơ quan giống hệt nhau.'] },
  'financial-literacy': { term: 'lựa chọn kinh tế và quản lí tài chính', definition: 'Quyết định kinh tế cân nhắc nguồn lực hữu hạn, chi phí cơ hội, lợi ích, rủi ro và tác động tới các bên liên quan.', example: 'So sánh tổng chi phí và lợi ích dài hạn có thể cho kết quả khác với chỉ nhìn giá ban đầu.', action: 'Nêu mục tiêu, giới hạn ngân sách, phương án, chi phí-lợi ích và giả định trước khi chọn.', check: 'Kiểm tra đơn vị, nguồn số liệu và tác động ngắn hạn/lâu dài.', distractors: ['Nguồn lực là vô hạn.', 'Giá thấp nhất luôn là lựa chọn tốt nhất.', 'Có thể bỏ qua rủi ro khi lợi ích được quảng cáo cao.'] },
  'music-analysis': { term: 'phân tích và biểu đạt âm nhạc', definition: 'Phân tích âm nhạc quan sát các yếu tố như giai điệu, tiết tấu, sắc thái, cấu trúc và bối cảnh biểu diễn.', example: 'Nêu một thay đổi về tiết tấu rồi giải thích tác động của nó đến sắc thái đoạn nhạc.', action: 'Nghe có mục đích, ghi nhận chi tiết âm nhạc và kết nối nhận xét với bằng chứng nghe được.', check: 'Dùng chi tiết cụ thể, phân biệt cảm nhận cá nhân với đặc điểm có thể quan sát.', distractors: ['Mọi người nghe đều phải có cùng cảm nhận.', 'Nhận xét âm nhạc không cần liên hệ âm thanh.', 'Bối cảnh biểu diễn không bao giờ ảnh hưởng cách hiểu.'] },
  'visual-art': { term: 'ngôn ngữ thị giác và thiết kế tạo hình', definition: 'Bố cục, đường nét, màu sắc, hình khối, chất liệu và tương phản tạo nên cách tổ chức thông tin thị giác.', example: 'Tăng tương phản ở điểm nhấn có thể giúp người xem nhận ra trọng tâm của tác phẩm.', action: 'Xác định mục đích, chọn yếu tố thị giác có chủ đích, thử nghiệm và nhận phản hồi.', check: 'Đánh giá sản phẩm theo mục tiêu, tính rõ ràng, kỹ thuật và phản hồi người xem.', distractors: ['Dùng càng nhiều màu luôn làm bố cục tốt hơn.', 'Không cần cân nhắc người xem/mục đích.', 'Đánh giá tác phẩm chỉ bằng giá vật liệu.'] }
};
function conceptInfo(subjectCode, topicTag) {
  if (subjectCode === 'math') {
    const family = MATH_FAMILY[topicTag] || topicTag;
    return { family, ...(MATH_TERMS[family] || MATH_TERMS.algebra) };
  }
  const aliasesBySubject = {
    physics: { measurement: 'measurement', electricity: 'electricity', energy: 'energy', optics: 'optics' },
    chemistry: { 'atomic-structure': 'atomic-structure', 'reaction-rate': 'reaction-rate', 'chemical-reaction': 'reaction-rate', matter: 'matter' },
    biology: { genetics: 'genetics', cells: 'biology-systems', 'biology-systems': 'biology-systems', ecosystem: 'environment' },
    economics_law: { 'financial-literacy': 'financial-literacy', rights: 'rights', environment: 'environment' },
    music: { 'music-analysis': 'music-analysis' }, art: { 'visual-art': 'visual-art' },
    literature: { poetry: 'poetry', argument: 'argument', writing: 'writing', speaking: 'speaking', language: 'language', narrative: 'narrative', 'literary-analysis': 'literary-analysis' },
    history: { 'historical-sources': 'historical-sources', 'world-wars': 'world-wars', 'medieval-vietnam': 'medieval-vietnam', 'medieval-world': 'world-wars' },
    geography: { 'map-skills': 'map-skills', 'vietnam-geography': 'vietnam-geography', environment: 'environment' }
  };
  const candidates = [CONCEPT_FAMILY[subjectCode]?.[topicTag], ALIASES[subjectCode]?.[topicTag], aliasesBySubject[subjectCode]?.[topicTag], topicTag];
  const defaults = { vietnamese: 'reading', english: 'grammar', science: 'matter', physics: 'energy', chemistry: 'chemical-reaction', biology: 'biology-systems', literature: 'literary-analysis', history: 'historical-sources', geography: 'map-skills', economics_law: 'financial-literacy', music: 'music-analysis', art: 'visual-art', history_geo: 'historical-sources', civic: 'respect', ict: 'digital-safety', technology: 'engineering-design', arts: 'writing', pe: 'fitness', experience: 'discussion', local_education: 'historical-sources' };
  const family = candidates.find((candidate) => candidate && (CONCEPTS[candidate] || HIGH_SCHOOL_CONCEPTS[candidate])) || defaults[subjectCode] || 'reading';
  return { family, ...(HIGH_SCHOOL_CONCEPTS[family] || CONCEPTS[family] || CONCEPTS.reading) };
}
function buildQuestionPool({ programCode, grade, subjectCode, lesson }) {
  const topicTag = lesson.topicTag || 'general';
  const info = conceptInfo(subjectCode, topicTag);
  const prefix = `${programCode}-g${grade}-${subjectCode}-${idPart(lesson.id)}-${idPart(topicTag)}`;
  const results = [];
  const math = subjectCode === 'math' ? mathSeeds(info.family, grade, 0) : null;
  const falseOptions = info.distractors || ['Không cần xem dữ kiện.', 'Chọn đáp án theo cảm tính.', 'Bỏ qua việc kiểm tra kết quả.'];
  const contexts = ['khi làm việc cá nhân', 'khi trao đổi với một bạn', 'khi giải thích trước lớp', 'khi kiểm tra sản phẩm cuối bài'];
  const misconception = (info.distractors || falseOptions)[0];
  const facts = [
    { prompt: `Phát biểu nào định nghĩa đúng “${info.term}” trong bài “${lesson.title}”?`, answer: info.definition, wrong: falseOptions, explanation: info.definition },
    { prompt: `Ví dụ nào minh họa trực tiếp cho nội dung “${lesson.title}”?`, answer: info.example, wrong: falseOptions, explanation: info.example },
    { prompt: `Khi vận dụng “${lesson.title}”, cách làm nào phù hợp?`, answer: info.method || info.action, wrong: falseOptions, explanation: info.method || info.action },
    { prompt: `Cần đối chiếu điều gì để tự kiểm tra kết quả của “${lesson.title}”?`, answer: info.check || info.definition, wrong: falseOptions, explanation: info.check || info.definition },
    { prompt: `Ý chính cần ghi nhớ trong bài “${lesson.title}” là gì?`, answer: `${info.term}: ${info.definition}`, wrong: falseOptions, explanation: info.definition },
    { prompt: `Nhận định nào có căn cứ khi giải thích “${lesson.title}”?`, answer: info.definition, wrong: falseOptions, explanation: info.definition },
    { prompt: `Phương pháp nào giúp áp dụng đúng kiến thức “${lesson.title}”?`, answer: info.method || info.action, wrong: falseOptions, explanation: info.method || info.action },
    { prompt: `Dấu hiệu nào cho thấy em đã vận dụng đúng bài “${lesson.title}”?`, answer: info.check || info.example, wrong: falseOptions, explanation: info.check || info.example },
    { prompt: `Quan niệm sai nào cần sửa khi học “${lesson.title}”?`, answer: misconception, wrong: [info.definition, info.example, info.method || info.action], explanation: `Cần loại bỏ nhận định sai: ${misconception}` },
    { prompt: `Trong bối cảnh {context}, bước khởi đầu nào phù hợp với bài “${lesson.title}”?`, answer: info.action || info.method, wrong: falseOptions, explanation: info.action || info.method },
    { prompt: `Bằng chứng nào nên được dùng để xác minh kết luận về “${lesson.title}”?`, answer: info.check || info.example, wrong: falseOptions, explanation: info.check || info.example },
    { prompt: `Khi phải giải thích “${info.term}” bằng lời của mình, nội dung nào cần giữ chính xác?`, answer: info.definition, wrong: falseOptions, explanation: info.definition }
  ];
  let mcItems;
  if (math) {
    const mathFrames = ['Tính toán và chọn đáp án:', 'Áp dụng công thức của chủ đề:', 'Bài luyện tập mới:', 'Xác định kết quả theo dữ kiện:', 'Kiểm tra dữ kiện rồi tính:', 'Chọn kết quả đúng theo quy tắc:', 'Vận dụng kiến thức vào tình huống:', 'Tự kiểm tra kiến thức:'];
    mcItems = math.slice(0, 32).map((item, index) => mc(`${prefix}-mc-${String(index + 1).padStart(2, '0')}`, `${mathFrames[index % mathFrames.length]} ${item.prompt}`, item.answer, item.wrongs, item.explanation, `${lesson.id}:${index}`));
  } else {
    mcItems = [];
    for (let index = 0; index < 32; index += 1) {
      const archetype = index % facts.length;
      const context = contexts[Math.floor(index / facts.length) % contexts.length];
      const fact = facts[archetype];
      const prompt = `${fact.prompt.replace('{context}', context)} Bối cảnh luyện tập: ${context}.`;
      const distractors = [...new Set([...(fact.wrong || []), info.term, info.example, info.method || info.action, info.check || info.definition].map(String).filter((value) => value && value !== String(fact.answer)))].slice(0, 3);
      while (distractors.length < 3) distractors.push(`Phương án không phù hợp ${distractors.length + 1}`);
      mcItems.push(mc(`${prefix}-mc-${String(index + 1).padStart(2, '0')}`, prompt, fact.answer, distractors, fact.explanation, `${lesson.id}:${index}`));
    }
  }
  mcItems.forEach((item) => results.push({ ...item, purpose: 'assessment', programCode, grade, subjectCode, lessonId: lesson.id, unitId: lesson.id.replace(/-l\d+$/, ''), topicTag, topicTitle: lesson.title, contentStatus: 'draft-teacher-review-required' }));

  const fillItems = [];
  if (math) {
    mathSeeds(info.family, grade, 80).slice(0, 16).forEach((item) => fillItems.push({ prompt: `Điền kết quả: ${item.fillPrompt}`, answer: item.answer, explanation: item.explanation }));
  } else {
    const clozes = [
      [ `Từ khóa cốt lõi của bài “${lesson.title}” là _____.`, info.term ],
      [ `Định nghĩa quan trọng của “${lesson.title}” cần nêu rõ _____.`, info.definition ],
      [ `Một ví dụ phù hợp với “${lesson.title}” là _____.`, info.example ],
      [ `Khi vận dụng “${lesson.title}”, em cần _____.`, info.method || info.action ],
      [ `Trước khi kết luận, cần đối chiếu với _____.`, info.check || info.definition ],
      [ `Điều cần ghi nhớ về “${lesson.title}” là _____.`, info.term ],
      [ `Căn cứ để giải thích nội dung “${lesson.title}” là _____.`, info.definition ],
      [ `Một bước thực hiện phù hợp với bài là _____.`, info.method || info.action ],
      [ `Khi gặp ví dụ mới, hãy liên hệ với _____.`, info.term ],
      [ `Câu trả lời đúng cần bám sát _____.`, lesson.title ],
      [ `Sau khi thực hiện nhiệm vụ, cần kiểm tra _____.`, info.check || 'kết quả' ],
      [ `Để tránh hiểu sai nội dung, hãy đối chiếu _____.`, info.definition ],
      [ `Một cách vận dụng kiến thức của bài là _____.`, info.action || info.method ],
      [ `Khi nhận xét, cần nêu ý chính và _____.`, info.example ],
      [ `Trước khi kết luận, cần có _____.`, 'căn cứ phù hợp' ],
      [ `Sau khi làm xong, em cần tự _____.`, 'kiểm tra lại kết quả' ]
    ];
    clozes.forEach(([prompt, answer]) => fillItems.push({ prompt, answer: String(answer), explanation: `Từ khóa gắn với chủ đề ${lesson.title}.` }));
  }
  fillItems.forEach((item, index) => results.push({ id: `${prefix}-fill-${index + 1}`, questionId: `${prefix}-fill-${index + 1}`, type: 'fill_blank', prompt: item.prompt, options: [], correctAnswer: String(item.answer), acceptedAnswers: [String(item.answer)], points: 1, explanation: item.explanation, purpose: 'assessment', programCode, grade, subjectCode, lessonId: lesson.id, unitId: lesson.id.replace(/-l\d+$/, ''), topicTag, topicTitle: lesson.title, contentStatus: 'draft-teacher-review-required' }));

  const shortPrompts = [
    `Nêu định nghĩa hoặc quy tắc cốt lõi của “${info.term}” trong bài “${lesson.title}”.`,
    `Tự tạo một ví dụ mới thuộc “${lesson.title}” và giải thích vì sao phù hợp.`,
    `Trình bày từng bước áp dụng kiến thức của bài để giải quyết một câu hỏi.`,
    `Chỉ ra một lỗi dễ gặp khi học “${lesson.title}” và cách phát hiện lỗi.`,
    `Giải thích mối liên hệ giữa “${info.term}” và mục tiêu bài học.`,
    `Nêu kết luận về “${lesson.title}” cùng dữ kiện hoặc lí do hỗ trợ.`,
    `Phân biệt khái niệm “${info.term}” với một cách hiểu sai thường gặp.`,
    `Tóm tắt cách tự kiểm tra câu trả lời cho một bài tập thuộc chủ đề này.`,
    `Nêu điều kiện hoặc giả định cần kiểm tra trước khi áp dụng “${info.term}”.`,
    `Hãy chọn một bước trong cách làm và giải thích hậu quả nếu bỏ qua bước đó.`,
    `Tạo một câu hỏi để kiểm tra bạn đã hiểu “${info.term}” hay chưa, kèm đáp án mẫu.`,
    `Diễn giải nội dung bài cho người mới học trong 3–4 câu, dùng một ví dụ chính xác.`,
    `So sánh hai trường hợp gần giống nhau và nêu chi tiết giúp phân biệt chúng.`,
    `Nêu một trường hợp kiến thức bài học không nên áp dụng máy móc và giải thích vì sao.`,
    `Ghi lại minh chứng cần thu thập để chứng minh một kết quả thuộc bài là đúng.`,
    `Tự đánh giá phần còn chưa chắc và mô tả một cách kiểm tra hoặc ôn tập cụ thể.`
  ];
  shortPrompts.forEach((prompt, index) => results.push({ id: `${prefix}-short-${index + 1}`, questionId: `${prefix}-short-${index + 1}`, type: 'short_answer', prompt: subjectCode === 'math' ? `Ghi rõ kí hiệu và cách thử lại. ${prompt}` : prompt, options: [], correctAnswer: '', acceptedAnswers: [], points: 1, rubric: ['Đúng trọng tâm chủ đề', 'Kiến thức và ví dụ phù hợp', 'Lí giải rõ ràng', 'Trình bày dễ hiểu'], keyConcepts: [info.term, lesson.title, info.definition], explanation: 'Câu trả lời được đánh giá theo rubric; điểm dự phòng chỉ là sơ bộ khi AI không sẵn sàng.', purpose: 'assessment', programCode, grade, subjectCode, lessonId: lesson.id, unitId: lesson.id.replace(/-l\d+$/, ''), topicTag, topicTitle: lesson.title, contentStatus: 'draft-teacher-review-required' }));
  const essayPrompts = [
    `Phân tích một tình huống thực tế liên quan trực tiếp đến “${lesson.title}” và kết nối với “${info.term}”.`,
    `So sánh một cách giải thích đúng và một cách giải thích sai về nội dung bài; nêu căn cứ.`,
    `Thiết kế một ví dụ hoặc nhiệm vụ nhỏ để minh họa kiến thức; nêu cách thực hiện.`,
    `Viết lời giải thích có mở ý, lập luận và kết luận cho một câu hỏi thuộc bài.`,
    `Phân tích một lỗi thường gặp, giải thích nguyên nhân và đề xuất cách sửa.`,
    `Tạo một câu hỏi vận dụng cho “${lesson.title}” và trình bày hướng giải.`,
    `Liên hệ kiến thức bài học với một tình huống gần gũi, nêu lựa chọn và kết quả.`,
    `Viết hướng dẫn ngắn giúp một bạn khác hiểu và vận dụng đúng kiến thức bài.`,
    `Xây dựng sơ đồ hoặc bảng so sánh các ý chính của “${lesson.title}”, giải thích cách sắp xếp.`,
    `Đề xuất một quy trình kiểm tra lời giải/sản phẩm và giải thích vì sao mỗi bước cần thiết.`,
    `Phân tích dữ kiện của một tình huống mới, nêu giả định, giới hạn và kết luận có căn cứ.`,
    `Đánh giá một nhận định liên quan đến “${info.term}”, chỉ ra bằng chứng ủng hộ hoặc bác bỏ.`,
    `Tạo một nhiệm vụ mở rộng ở mức vận dụng cao nhưng vẫn bám mục tiêu bài học; nêu rubric chấm.`,
    `Viết phản hồi cho một bạn có hiểu lầm về nội dung bài, có giải thích và ví dụ sửa sai.`,
    `Nêu cách kiến thức bài học kết nối với chủ đề đã học trước; đưa ra ví dụ cho mối liên hệ.`,
    `Tổng kết bài bằng checklist tự học, gồm kiến thức, thao tác thực hành và minh chứng hoàn thành.`
  ];
  essayPrompts.forEach((prompt, index) => results.push({ id: `${prefix}-essay-${index + 1}`, questionId: `${prefix}-essay-${index + 1}`, type: 'essay', prompt: subjectCode === 'math' ? `Trình bày từng bước, đơn vị và phép thử. ${prompt}` : prompt, options: [], correctAnswer: '', acceptedAnswers: [], points: 1, rubric: ['Bám đúng nội dung và yêu cầu', 'Kiến thức chính xác theo lứa tuổi', 'Có ví dụ/dữ kiện hoặc các bước giải', 'Lập luận mạch lạc và kiểm tra kết quả'], keyConcepts: [info.term, lesson.title, info.definition, info.example], explanation: 'Bài tự luận cần được đọc cùng rubric; điểm AI/dự phòng không thay thế đánh giá chuyên môn của giáo viên.', purpose: 'assessment', programCode, grade, subjectCode, lessonId: lesson.id, unitId: lesson.id.replace(/-l\d+$/, ''), topicTag, topicTitle: lesson.title, contentStatus: 'draft-teacher-review-required' }));

  const extendedMetadata = { programCode, grade, subjectCode, lessonId: lesson.id, unitId: lesson.id.replace(/-l\d+$/, ''), topicTag, topicTitle: lesson.title, contentStatus: 'draft-teacher-review-required' };
  results.push(...buildExtendedQuestionTypes({ prefix, lesson, sourceQuestions: mcItems, metadata: extendedMetadata }));

  const checkpointPool = [];
  const checkpointFacts = [
    { prompt: 'Khái niệm trung tâm của phần vừa học là gì?', answer: info.term },
    { prompt: `Mô tả nào giải thích đúng “${lesson.title}”?`, answer: info.definition },
    { prompt: 'Ví dụ nào minh họa trực tiếp cho kiến thức vừa học?', answer: info.example },
    { prompt: 'Cách làm nào phù hợp khi vận dụng nội dung phần này?', answer: info.method || info.action },
    { prompt: 'Điều gì cần được đối chiếu trước khi kết luận?', answer: info.check || info.definition },
    { prompt: 'Từ khóa nào cần dùng để giải thích bài này?', answer: info.term },
    { prompt: 'Hành động nào giúp tránh hiểu sai kiến thức?', answer: info.action || info.method },
    { prompt: 'Điều nào cho thấy em đã tự kiểm tra câu trả lời?', answer: info.check || info.example }
  ];
  for (const [partIndex, part] of (lesson.parts || []).entries()) {
    let partQuestions;
    if (subjectCode === 'math') {
      const partFrames = ['Tính toán và chọn đáp án:', 'Áp dụng công thức:', 'Bài thực hành mới:', 'Xác định giá trị cần tìm:', 'Kiểm tra dữ kiện rồi tính:', 'Chọn kết quả phù hợp:', 'Vận dụng quy tắc:', 'Tự kiểm tra cuối phần:'];
      partQuestions = mathSeeds(info.family, grade, 120 + partIndex * 40).slice(0, 8).map((item, index) => mc(`${prefix}-checkpoint-${part.id}-${index + 1}`, `Phần “${part.title}” — ${partFrames[index]} ${item.prompt}`, item.answer, item.wrongs, item.explanation, `${lesson.id}:${part.id}:${index}`));
    } else {
      partQuestions = checkpointFacts.map((fact, index) => {
        const wrongs = [...new Set([...(info.distractors || []), info.term, info.example, info.method || info.action, info.check || info.definition].map(String).filter((value) => value && value !== String(fact.answer)))].slice(0, 3);
        while (wrongs.length < 3) wrongs.push(`Phương án không phù hợp ${wrongs.length + 1}`);
        return mc(`${prefix}-checkpoint-${part.id}-${index + 1}`, `Phần “${part.title}” — ${fact.prompt}`, fact.answer, wrongs, String(fact.answer), `${lesson.id}:${part.id}:${index}`);
      });
    }
    partQuestions.forEach((item) => checkpointPool.push({ ...item, purpose: 'checkpoint', partId: part.id, points: 1, grade, programCode, subjectCode, lessonId: lesson.id, unitId: lesson.id.replace(/-l\d+$/, ''), topicTag, topicTitle: lesson.title, contentStatus: 'draft-teacher-review-required' }));
  }
  const alignmentMeta = { curriculumAlignmentId: lesson.alignment?.alignmentId || '', mappedStrand: lesson.alignment?.mappedStrand || '', competencyFocus: lesson.alignment?.competencyFocus || [], intendedOutcomes: lesson.alignment?.intendedOutcomes || [], assessmentBlueprint: lesson.alignment?.assessmentBlueprint || { remember: 25, understand: 35, apply: 25, analyzeCreate: 15 }, alignmentStatus: lesson.alignment?.status || 'draft-teacher-review-required' };
  const classify = (item) => {
    const suffix = String(item.questionId || item.id || '').match(/-(\d+)$/);
    const index = suffix ? Number(suffix[1]) : 1;
    let taxonomy = item.taxonomy || 'understand';
    if (item.purpose === 'checkpoint') taxonomy = index <= 2 ? 'remember' : index <= 5 ? 'understand' : 'apply';
    else if (item.type === 'multiple_choice') taxonomy = index <= 12 ? 'remember' : index <= 30 ? 'understand' : index <= 41 ? 'apply' : 'analyze';
    else if (item.type === 'fill_blank') taxonomy = index <= 4 ? 'remember' : index <= 10 ? 'understand' : 'apply';
    else if (item.type === 'short_answer') taxonomy = index <= 4 ? 'understand' : index <= 12 ? 'apply' : 'analyze';
    else if (item.type === 'essay') taxonomy = index <= 4 ? 'apply' : index <= 12 ? 'analyze' : 'create';
    const difficulty = item.difficulty || (taxonomy === 'remember' ? 'easy' : ['analyze', 'create'].includes(taxonomy) ? 'hard' : 'medium');
    return { ...item, taxonomy, difficulty, source: 'curriculum-aligned-generated-draft', ...alignmentMeta };
  };
  return [...checkpointPool, ...results].map(classify);
}

function buildBankRecords(course) {
  const records = [];
  for (const unit of course.units) for (const lesson of unit.lessons) {
    const pool = buildQuestionPool({ programCode: course.programCode, grade: course.grade, subjectCode: course.subjectCode, lesson });
    for (const question of pool.filter((item) => ['assessment', 'checkpoint'].includes(item.purpose))) {
      const { purpose, topicTitle, contentStatus, ...record } = question;
      records.push({ ...record, purpose, partId: question.partId || '', courseId: course.id, unitId: unit.id, topicTitle, contentStatus, active: false, bankVersion: 'V6.1.1' });
    }
  }
  return records;
}
function pickRandom(pool, count, excludedIds = new Set(), random = Math.random) {
  const fresh = pool.filter((item) => !excludedIds.has(item.questionId || item.id));
  const source = fresh.length >= count ? fresh : pool;
  const output = [...source];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output.slice(0, Math.min(count, output.length));
}

module.exports = { buildQuestionPool, buildBankRecords, pickRandom, CONCEPTS, MATH_TERMS, CONCEPT_FAMILY, ALIASES, MATH_FAMILY, conceptInfo };

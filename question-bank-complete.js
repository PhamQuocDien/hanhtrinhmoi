'use strict';

/**
 * Bổ sung và chuẩn hóa ngân hàng câu hỏi để mọi môn, mọi lớp 1-12 và
 * cả ba mức độ đều luôn có đủ dữ liệu. Dữ liệu được tạo cố định,
 * không phụ thuộc mạng và không gửi đáp án xuống trình duyệt.
 */

const SUBJECTS = ['toan', 'tieng-viet', 'tieng-anh', 'khoa-hoc', 'lich-su', 'dia-ly'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const DIFFICULTY_LABELS = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };

function asText(value) {
    return String(value ?? '').trim();
}

function unique(values) {
    return [...new Set(values.map(asText).filter(Boolean))];
}

function numberChoices(correct, offsets = [-2, -1, 1, 2], formatter = value => String(value)) {
    const values = [correct, ...offsets.map(offset => correct + offset)];
    return unique(values.map(formatter)).slice(0, 4);
}

function decimalChoices(correct, step = 0.5) {
    const values = [correct, correct + step, Math.max(0, correct - step), correct + (step * 2)];
    return unique(values.map(value => Number(value.toFixed(2)).toString())).slice(0, 4);
}

function makeQuestion(text, correct, distractors, explanation = '') {
    const correctText = asText(correct);
    const options = unique([correctText, ...distractors]);
    const fallbackOptions = ['Không đổi', 'Không xác định', 'Không có đáp án phù hợp', 'Tất cả đều sai'];
    let filler = 0;
    while (options.length < 4) options.push(fallbackOptions[filler++]);
    return {
        q: asText(text),
        a: options.slice(0, 4),
        correct: correctText,
        explanation: asText(explanation)
    };
}

function rotateOptions(question, seed) {
    const options = [...question.a];
    const turns = seed % options.length;
    question.a = [...options.slice(turns), ...options.slice(0, turns)];
    return question;
}

function mathQuestion(grade, difficulty, index) {
    const level = DIFFICULTIES.indexOf(difficulty);
    const n = index + 1;
    const scale = Math.max(2, grade * (level + 2));
    const kind = index % 12;

    if (grade <= 2) {
        const a = 1 + ((n * 3 + grade) % (10 + grade * 10));
        const b = 1 + ((n * 5 + level) % Math.max(3, 5 + grade * 4));
        if (kind % 4 === 0) {
            const correct = a + b;
            return makeQuestion(`${a} + ${b} = ?`, correct, numberChoices(correct).filter(v => v !== String(correct)), `Cộng ${a} với ${b} được ${correct}.`);
        }
        if (kind % 4 === 1) {
            const big = a + b;
            return makeQuestion(`${big} - ${b} = ?`, a, numberChoices(a).filter(v => v !== String(a)), `Lấy ${big} trừ ${b} còn ${a}.`);
        }
        if (kind % 4 === 2) {
            const values = unique([a, b, a + 2, b + 3]).map(Number);
            const correct = Math.max(...values);
            return makeQuestion(`Số nào lớn nhất trong các số ${values.join(', ')}?`, correct, values.filter(v => v !== correct), `So sánh các số theo giá trị hàng chục và hàng đơn vị.`);
        }
        const correct = a + 1;
        return makeQuestion(`Số liền sau của ${a} là số nào?`, correct, [a - 1, a, a + 2], `Số liền sau lớn hơn ${a} đúng 1 đơn vị.`);
    }

    if (grade <= 5) {
        const a = 2 + ((n * 3) % (8 + grade));
        const b = 2 + ((n * 5) % (7 + grade));
        if (kind === 0 || kind === 6) {
            const correct = a * b;
            return makeQuestion(`${a} × ${b} = ?`, correct, [correct + a, correct - b, a + b], `Nhân ${a} với ${b} được ${correct}.`);
        }
        if (kind === 1 || kind === 7) {
            const product = a * b;
            return makeQuestion(`${product} : ${a} = ?`, b, [a, b + 1, Math.max(1, b - 1)], `Vì ${a} × ${b} = ${product} nên ${product} : ${a} = ${b}.`);
        }
        if (kind === 2) {
            const correct = (a + b) * 2;
            return makeQuestion(`Hình chữ nhật dài ${a} cm, rộng ${b} cm có chu vi bằng bao nhiêu?`, `${correct} cm`, [`${a * b} cm`, `${a + b} cm`, `${correct + 2} cm`], `Chu vi hình chữ nhật là (${a} + ${b}) × 2 = ${correct} cm.`);
        }
        if (kind === 3) {
            const correct = a * b;
            return makeQuestion(`Hình chữ nhật dài ${a} cm, rộng ${b} cm có diện tích bằng bao nhiêu?`, `${correct} cm²`, [`${(a + b) * 2} cm²`, `${a + b} cm²`, `${correct + a} cm²`], `Diện tích bằng chiều dài nhân chiều rộng: ${a} × ${b} = ${correct} cm².`);
        }
        if (kind === 4 || kind === 10) {
            const denominator = [2, 3, 4, 5][n % 4];
            const numerator = 1 + (n % (denominator - 1));
            const correct = `${numerator}/${denominator}`;
            return makeQuestion(`Phân số nào biểu thị ${numerator} phần trong ${denominator} phần bằng nhau?`, correct, [`${denominator}/${numerator}`, `${numerator + 1}/${denominator}`, `${numerator}/${denominator + 1}`], `Tử số cho biết số phần được chọn, mẫu số cho biết tổng số phần bằng nhau.`);
        }
        if (kind === 5 || kind === 11) {
            const total = a * b;
            const taken = a;
            const correct = total - taken;
            return makeQuestion(`Có ${total} quyển vở, đã dùng ${taken} quyển. Còn lại bao nhiêu quyển?`, correct, [total + taken, taken, correct + 1], `Số còn lại là ${total} - ${taken} = ${correct}.`);
        }
        const numbers = [a * 2, b * 2, (a + b) * 2];
        const correct = Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
        return makeQuestion(`Trung bình cộng của ${numbers.join(', ')} là bao nhiêu?`, correct, [correct + 1, correct - 1, numbers[0]], `Cộng các số rồi chia cho ${numbers.length}.`);
    }

    if (grade <= 8) {
        const a = 2 + ((n * 7) % (12 + scale));
        const b = 1 + ((n * 5) % Math.max(4, grade + level * 2));
        if (kind === 0) {
            const correct = a - (b * 2);
            return makeQuestion(`${a} - 2 × ${b} = ?`, correct, [a - b, (a - 2) * b, a + b], `Thực hiện phép nhân trước: 2 × ${b} = ${b * 2}, rồi trừ.`);
        }
        if (kind === 1) {
            const correct = a + b;
            return makeQuestion(`Tìm x biết x - ${b} = ${a}.`, correct, [a - b, a, correct + 1], `Cộng ${b} vào hai vế, ta được x = ${correct}.`);
        }
        if (kind === 2) {
            const percent = [10, 20, 25, 50][n % 4];
            const base = 20 + ((n * 10) % 180);
            const correct = base * percent / 100;
            return makeQuestion(`${percent}% của ${base} bằng bao nhiêu?`, correct, [base - correct, correct + 10, percent], `${percent}% × ${base} = ${correct}.`);
        }
        if (kind === 3) {
            const correct = a * a;
            return makeQuestion(`Diện tích hình vuông cạnh ${a} cm là bao nhiêu?`, `${correct} cm²`, [`${a * 4} cm²`, `${a * 2} cm²`, `${correct + a} cm²`], `Diện tích hình vuông bằng cạnh nhân cạnh.`);
        }
        if (kind === 4) {
            const correct = a * 2 + b * 2;
            return makeQuestion(`Chu vi hình chữ nhật có chiều dài ${a} cm và chiều rộng ${b} cm là?`, `${correct} cm`, [`${a * b} cm`, `${a + b} cm`, `${correct + 2} cm`], `Chu vi = (${a} + ${b}) × 2.`);
        }
        if (kind === 5) {
            const correct = Math.pow(b + 1, 2);
            return makeQuestion(`(${b + 1})² bằng bao nhiêu?`, correct, [b * 2 + 1, (b + 1) * 2, correct + 1], `Bình phương một số là nhân số đó với chính nó.`);
        }
        if (kind === 6) {
            const numerator = 1 + (n % 4);
            const denominator = numerator + 2 + (n % 3);
            const correct = Number((numerator / denominator).toFixed(2));
            return makeQuestion(`Giá trị gần đúng của ${numerator}/${denominator} (làm tròn đến hai chữ số thập phân) là?`, correct, decimalChoices(correct, 0.1).filter(v => v !== String(correct)), `Thực hiện phép chia ${numerator} : ${denominator}.`);
        }
        if (kind === 7) {
            const correct = -a + b;
            return makeQuestion(`(-${a}) + ${b} = ?`, correct, [-(a + b), a + b, a - b], `Cộng hai số nguyên khác dấu bằng cách lấy hiệu độ lớn và giữ dấu của số có độ lớn lớn hơn.`);
        }
        if (kind === 8) {
            const values = [a, a + b, a - b, a + 2 * b];
            const correct = values.reduce((sum, value) => sum + value, 0) / values.length;
            return makeQuestion(`Trung bình cộng của ${values.join(', ')} là?`, correct, [correct + b, correct - b, values[1]], `Tổng bốn số chia cho 4.`);
        }
        if (kind === 9) {
            const correct = a / Math.max(1, b);
            const rounded = Number(correct.toFixed(2));
            return makeQuestion(`Tỉ số của ${a} và ${b} (làm tròn hai chữ số) là?`, rounded, decimalChoices(rounded, 0.25).filter(v => v !== String(rounded)), `Tỉ số bằng ${a} : ${b}.`);
        }
        if (kind === 10) {
            const base = b + 2;
            const correct = base * base * base;
            return makeQuestion(`Thể tích hình lập phương cạnh ${base} cm là?`, `${correct} cm³`, [`${base * base} cm³`, `${base * 6} cm³`, `${correct + base} cm³`], `Thể tích hình lập phương bằng cạnh³.`);
        }
        const correct = a * 3;
        return makeQuestion(`Một đại lượng tăng theo tỉ lệ 3 lần. Khi giá trị ban đầu là ${a}, giá trị mới là?`, correct, [a + 3, a * 2, correct + 1], `Nhân giá trị ban đầu với 3.`);
    }

    const a = 2 + ((n * 3) % (8 + grade));
    const b = 1 + ((n * 5) % 7);
    if (kind === 0) {
        const root1 = b;
        const root2 = a;
        const sum = root1 + root2;
        const product = root1 * root2;
        return makeQuestion(`Phương trình x² - ${sum}x + ${product} = 0 có một nghiệm là?`, root1, [root2 + 1, -root1, 0], `Ta có x² - ${sum}x + ${product} = (x-${root1})(x-${root2}).`);
    }
    if (kind === 1) {
        const correct = a * b + 1;
        return makeQuestion(`Với f(x) = ${a}x + 1, f(${b}) bằng?`, correct, [a + b + 1, a * b, correct + a], `Thay x = ${b}: f(${b}) = ${a}×${b}+1.`);
    }
    if (kind === 2) {
        const correct = a * 2;
        return makeQuestion(`Đạo hàm của hàm số y = ${a}x² là?`, `${correct}x`, [`${a}x`, `${correct}x²`, `${a}²x`], `Dùng quy tắc (x²)' = 2x.`);
    }
    if (kind === 3) {
        const correct = a + b;
        return makeQuestion(`Nếu log₂(${Math.pow(2, b)}) = ${b}, giá trị ${a} + log₂(${Math.pow(2, b)}) bằng?`, correct, [a * b, a - b, correct + 1], `log₂(2^${b}) = ${b}.`);
    }
    if (kind === 4) {
        const angle = [0, 30, 45, 60, 90][n % 5];
        const values = { 0: '0', 30: '1/2', 45: '√2/2', 60: '√3/2', 90: '1' };
        const correct = values[angle];
        return makeQuestion(`sin ${angle}° bằng?`, correct, Object.values(values).filter(v => v !== correct).slice(0, 3), `Đây là giá trị lượng giác của góc đặc biệt ${angle}°.`);
    }
    if (kind === 5) {
        const correct = a * a;
        return makeQuestion(`Giới hạn lim(x→${a}) x² bằng?`, correct, [a * 2, a, correct + 1], `Hàm x² liên tục nên thay trực tiếp x = ${a}.`);
    }
    if (kind === 6) {
        const correct = 3 * b;
        return makeQuestion(`Cấp số cộng có u₁=${a}, công sai d=${b}. Hiệu u₄-u₁ bằng?`, correct, [a + b, b * 4, correct + b], `u₄-u₁ = 3d = ${correct}.`);
    }
    if (kind === 7) {
        const correct = a / 2;
        return makeQuestion(`Trung điểm của đoạn nối A(0;0) và B(${a};${a}) có hoành độ bằng?`, Number(correct.toFixed(1)), decimalChoices(correct, 0.5).filter(v => v !== String(Number(correct.toFixed(1)))), `Hoành độ trung điểm là (0+${a})/2.`);
    }
    if (kind === 8) {
        const correct = a * a * Math.PI;
        const rounded = Number(correct.toFixed(2));
        return makeQuestion(`Diện tích hình tròn bán kính ${a} (lấy π≈3,14) gần bằng?`, Number((a * a * 3.14).toFixed(2)), [Number((a * 2 * 3.14).toFixed(2)), a * a, rounded + a], `Diện tích hình tròn S = πr².`);
    }
    if (kind === 9) {
        const total = a + b;
        const correct = Number((a / total).toFixed(2));
        return makeQuestion(`Một hộp có ${a} bi đỏ và ${b} bi xanh. Xác suất lấy ngẫu nhiên một bi đỏ là?`, correct, decimalChoices(correct, 0.1).filter(v => v !== String(correct)), `Xác suất = số bi đỏ / tổng số bi.`);
    }
    if (kind === 10) {
        const correct = a * (a + 1) / 2;
        return makeQuestion(`Tổng 1 + 2 + ... + ${a} bằng?`, correct, [a * a, correct + a, correct - 1], `Dùng công thức n(n+1)/2.`);
    }
    const correct = a + b;
    return makeQuestion(`Hệ phương trình x + y = ${a + b}, x = ${a}. Giá trị y là?`, b, [a, correct, Math.abs(a - b)], `Thay x=${a} vào x+y=${correct}.`);
}

const VI_WORDS = [
    ['chăm chỉ', 'siêng năng', 'lười biếng'], ['dũng cảm', 'gan dạ', 'nhút nhát'],
    ['vui vẻ', 'hân hoan', 'buồn bã'], ['rộng lớn', 'bao la', 'chật hẹp'],
    ['nhanh nhẹn', 'lanh lợi', 'chậm chạp'], ['trung thực', 'thật thà', 'gian dối'],
    ['đoàn kết', 'gắn bó', 'chia rẽ'], ['yên tĩnh', 'im ắng', 'ồn ào'],
    ['sạch sẽ', 'ngăn nắp', 'bẩn thỉu'], ['hiền hậu', 'nhân từ', 'độc ác']
];
const VI_SPELLING = [
    ['xinh xắn', 'sinh sắn', 'xinh sắn', 'sinh xắn'],
    ['chăm chỉ', 'trăm chỉ', 'chăm trỉ', 'trăm trỉ'],
    ['rực rỡ', 'dực dỡ', 'rực dỡ', 'dực rỡ'],
    ['nghỉ ngơi', 'ngỉ ngơi', 'nghĩ ngơi', 'ngỉ nghơi'],
    ['truyền thống', 'chuyền thống', 'truyền thốn', 'chuyền thốn'],
    ['kỷ niệm', 'kỉ niệm', 'kỹ niệm', 'kỉ nhiệm'],
    ['sáng tạo', 'xáng tạo', 'sáng tảo', 'xáng tảo'],
    ['trách nhiệm', 'chách nhiệm', 'trách nhiện', 'chách nhiện']
];
const VI_PROVERBS = [
    ['Có công mài sắt, có ngày nên kim', 'Kiên trì sẽ dẫn đến thành công'],
    ['Uống nước nhớ nguồn', 'Biết ơn người đi trước'],
    ['Lá lành đùm lá rách', 'Người có điều kiện giúp người khó khăn'],
    ['Đi một ngày đàng, học một sàng khôn', 'Đi nhiều giúp mở rộng hiểu biết'],
    ['Đoàn kết là sức mạnh', 'Hợp tác giúp tập thể mạnh hơn'],
    ['Thương người như thể thương thân', 'Biết yêu thương và giúp đỡ người khác']
];

function vietnameseQuestion(grade, difficulty, index) {
    const kind = index % 10;
    const word = VI_WORDS[index % VI_WORDS.length];
    if (kind === 0) return makeQuestion(`Từ nào đồng nghĩa với “${word[0]}”?`, word[1], [word[2], 'xa lạ', 'mơ hồ'], `“${word[1]}” có nghĩa gần giống “${word[0]}”.`);
    if (kind === 1) return makeQuestion(`Từ nào trái nghĩa với “${word[0]}”?`, word[2], [word[1], word[0], 'bình thường'], `“${word[2]}” biểu thị ý nghĩa đối lập với “${word[0]}”.`);
    if (kind === 2) {
        const spelling = VI_SPELLING[index % VI_SPELLING.length];
        return makeQuestion('Từ nào được viết đúng chính tả?', spelling[0], spelling.slice(1), `Cách viết đúng là “${spelling[0]}”.`);
    }
    if (kind === 3) {
        const sentence = grade <= 3 ? 'Bé Lan đang đọc sách.' : 'Những hàng cây xanh mát đang nghiêng mình trong gió.';
        const correct = grade <= 3 ? 'Bé Lan' : 'Những hàng cây xanh mát';
        return makeQuestion(`Chủ ngữ trong câu “${sentence}” là bộ phận nào?`, correct, ['đang đọc sách', 'đang nghiêng mình', 'trong gió'], 'Chủ ngữ trả lời câu hỏi ai, con gì hoặc cái gì thực hiện hoạt động.' );
    }
    if (kind === 4) {
        const correct = grade <= 5 ? 'Dấu chấm' : 'Dấu chấm hỏi';
        const sentence = grade <= 5 ? 'Em rất yêu mái trường của mình…' : 'Bạn đã hoàn thành bài tập chưa…';
        return makeQuestion(`Cuối câu “${sentence}” cần dùng dấu nào?`, correct, ['Dấu phẩy', 'Dấu hai chấm', 'Dấu chấm than'], 'Chọn dấu câu phù hợp với mục đích của câu.' );
    }
    if (kind === 5) {
        const item = VI_PROVERBS[index % VI_PROVERBS.length];
        return makeQuestion(`Câu “${item[0]}” khuyên chúng ta điều gì?`, item[1], ['Không cần cố gắng', 'Chỉ nên làm việc một mình', 'Tránh học hỏi người khác'], item[1]);
    }
    if (kind === 6) {
        const sentence = 'Mặt trời đỏ rực như một quả cầu lửa.';
        return makeQuestion(`Câu “${sentence}” sử dụng biện pháp tu từ nào?`, 'So sánh', ['Nhân hóa', 'Điệp ngữ', 'Nói giảm nói tránh'], 'Từ “như” nối hai sự vật có nét tương đồng.' );
    }
    if (kind === 7) {
        const sentence = grade <= 5 ? 'Em học bài.' : 'Mặc dù trời mưa, chúng em vẫn đến trường đúng giờ.';
        const correct = grade <= 5 ? 'Câu kể' : 'Câu ghép';
        return makeQuestion(`Câu “${sentence}” thuộc kiểu câu nào?`, correct, ['Câu hỏi', 'Câu khiến', 'Câu cảm'], `Dựa vào cấu tạo và mục đích nói để xác định kiểu câu.`);
    }
    if (kind === 8) {
        const passage = 'Minh nhặt được một chiếc ví trên sân trường. Em mang chiếc ví đến phòng giám thị để tìm người đánh rơi.';
        return makeQuestion(`Qua đoạn văn: “${passage}”, phẩm chất nổi bật của Minh là gì?`, 'Trung thực', ['Ích kỷ', 'Lười biếng', 'Nóng nảy'], 'Minh không giữ chiếc ví mà tìm cách trả lại cho người mất.' );
    }
    const correct = difficulty === 'hard' && grade >= 6 ? 'Luận điểm' : 'Từ láy';
    if (correct === 'Luận điểm') {
        return makeQuestion('Trong văn nghị luận, ý kiến chính mà người viết cần làm sáng tỏ được gọi là gì?', correct, ['Dẫn chứng', 'Nhân vật', 'Cốt truyện'], 'Luận điểm là ý kiến trung tâm của bài văn nghị luận.' );
    }
    return makeQuestion('Từ nào dưới đây là từ láy?', 'lấp lánh', ['học tập', 'bàn ghế', 'cha mẹ'], '“Lấp lánh” có sự lặp lại âm thanh giữa các tiếng.' );
}

const EN_VOCAB = [
    ['apple', 'quả táo'], ['school', 'trường học'], ['teacher', 'giáo viên'], ['family', 'gia đình'],
    ['beautiful', 'xinh đẹp'], ['important', 'quan trọng'], ['environment', 'môi trường'], ['future', 'tương lai'],
    ['improve', 'cải thiện'], ['responsibility', 'trách nhiệm'], ['achievement', 'thành tựu'], ['community', 'cộng đồng']
];
const EN_VERBS = [
    ['go', 'went', 'gone'], ['see', 'saw', 'seen'], ['write', 'wrote', 'written'],
    ['take', 'took', 'taken'], ['eat', 'ate', 'eaten'], ['do', 'did', 'done']
];

function englishQuestion(grade, difficulty, index) {
    const kind = index % 10;
    const vocabStart = grade >= 9 ? 8 : (grade >= 6 ? 4 : 0);
    const vocabRange = grade >= 9 ? 4 : (grade >= 6 ? 8 : 4);
    const vocab = EN_VOCAB[vocabStart + (index % vocabRange)];
    if (kind === 0) return makeQuestion(`“${vocab[0]}” có nghĩa là gì?`, vocab[1], ['nhanh chóng', 'khó khăn', 'yên tĩnh'], `“${vocab[0]}” nghĩa là “${vocab[1]}”.`);
    if (kind === 1) return makeQuestion(`Từ tiếng Anh nào có nghĩa là “${vocab[1]}”?`, vocab[0], ['always', 'between', 'because'], `Từ cần chọn là “${vocab[0]}”.`);
    if (kind === 2) {
        const noun = ['book', 'cat', 'class', 'baby'][index % 4];
        const plural = { book: 'books', cat: 'cats', class: 'classes', baby: 'babies' }[noun];
        return makeQuestion(`Dạng số nhiều đúng của “${noun}” là?`, plural, [`${noun}s`, `${noun}es`, `${noun}ies`], `Quy tắc số nhiều phù hợp cho “${noun}” tạo thành “${plural}”.`);
    }
    if (kind === 3) return makeQuestion('Choose the correct word: She ___ to school every day.', 'goes', ['go', 'going', 'went'], 'Chủ ngữ ngôi thứ ba số ít ở hiện tại đơn dùng “goes”.');
    if (kind === 4) return makeQuestion('Choose the correct article: I saw ___ elephant at the zoo.', 'an', ['a', 'the', 'no article'], 'Dùng “an” trước âm nguyên âm.' );
    if (kind === 5) {
        const verb = EN_VERBS[index % EN_VERBS.length];
        return makeQuestion(`Quá khứ đơn của “${verb[0]}” là?`, verb[1], [verb[0], verb[2], `${verb[0]}ed`], `Động từ bất quy tắc “${verb[0]}” có dạng quá khứ là “${verb[1]}”.`);
    }
    if (kind === 6) return makeQuestion('Choose the correct preposition: The book is ___ the table.', 'on', ['at', 'from', 'during'], '“On” diễn tả vật nằm trên bề mặt.' );
    if (kind === 7) {
        const correct = grade <= 5 ? 'How are you?' : 'If I had more time, I would learn another language.';
        return grade <= 5
            ? makeQuestion('Câu nào dùng để hỏi thăm sức khỏe?', correct, ['What is your name?', 'Where are you from?', 'How old are you?'], '“How are you?” dùng để hỏi thăm sức khỏe hoặc tình trạng.' )
            : makeQuestion('Which sentence is a correct second conditional sentence?', correct, ['If I have time, I will learn.', 'If I had time, I will learn.', 'If I would have time, I learned.'], 'Câu điều kiện loại 2: If + past simple, would + verb.' );
    }
    if (kind === 8) return makeQuestion('Choose the word with the opposite meaning of “difficult”.', 'easy', ['hard', 'complex', 'challenging'], '“Easy” trái nghĩa với “difficult”.');
    return difficulty === 'hard' && grade >= 8
        ? makeQuestion('Choose the correct passive sentence for: “People speak English worldwide.”', 'English is spoken worldwide.', ['English speaks worldwide.', 'English was speaking worldwide.', 'People are spoken English worldwide.'], 'Câu bị động hiện tại đơn: am/is/are + past participle.' )
        : makeQuestion('Choose the correct sentence.', 'They are playing football.', ['They is playing football.', 'They playing football.', 'They are play football.'], 'Hiện tại tiếp diễn: subject + am/is/are + V-ing.' );
}

const SCIENCE_FACTS = [
    ['Bộ phận nào của cây thường hấp thụ nước và muối khoáng?', 'Rễ', ['Hoa', 'Quả', 'Hạt'], 'Rễ hút nước và muối khoáng từ đất.'],
    ['Con người hít vào khí nào cần cho hô hấp?', 'Oxi', ['Nitơ', 'Cacbon đioxit', 'Hiđro'], 'Oxi được cơ thể sử dụng trong hô hấp tế bào.'],
    ['Nước sôi ở khoảng bao nhiêu độ C trong điều kiện thường?', '100°C', ['0°C', '50°C', '200°C'], 'Ở áp suất khí quyển tiêu chuẩn, nước sôi ở 100°C.'],
    ['Hành tinh nào gần Mặt Trời nhất?', 'Sao Thủy', ['Trái Đất', 'Sao Hỏa', 'Sao Mộc'], 'Sao Thủy là hành tinh gần Mặt Trời nhất.'],
    ['Đơn vị đo cường độ dòng điện là gì?', 'Ampe', ['Vôn', 'Oát', 'Jun'], 'Cường độ dòng điện được đo bằng ampe (A).'],
    ['Chất nào có công thức hóa học H₂O?', 'Nước', ['Oxi', 'Muối ăn', 'Cacbon đioxit'], 'H₂O là công thức của nước.'],
    ['Cơ quan nào bơm máu đi khắp cơ thể?', 'Tim', ['Phổi', 'Dạ dày', 'Gan'], 'Tim co bóp để đưa máu qua hệ tuần hoàn.'],
    ['Quá trình cây xanh tạo chất hữu cơ nhờ ánh sáng gọi là gì?', 'Quang hợp', ['Hô hấp', 'Tiêu hóa', 'Bay hơi'], 'Quang hợp sử dụng ánh sáng để tổng hợp chất hữu cơ.'],
    ['Lực hút các vật về phía Trái Đất gọi là gì?', 'Trọng lực', ['Lực ma sát', 'Lực đàn hồi', 'Lực đẩy'], 'Trọng lực là lực hút của Trái Đất lên vật.'],
    ['Hạt mang điện tích âm trong nguyên tử là gì?', 'Electron', ['Proton', 'Neutron', 'Hạt nhân'], 'Electron mang điện tích âm.'],
    ['Đơn vị SI của năng lượng là gì?', 'Jun', ['Oát', 'Pascal', 'Mét'], 'Năng lượng được đo bằng jun (J).'],
    ['ADN chủ yếu nằm ở đâu trong tế bào nhân thực?', 'Trong nhân tế bào', ['Trong thành tế bào', 'Ngoài cơ thể', 'Trong không bào'], 'Phần lớn ADN của tế bào nhân thực nằm trong nhân.']
];

function scienceQuestion(grade, difficulty, index) {
    const base = SCIENCE_FACTS[(index + Math.floor(grade / 2)) % SCIENCE_FACTS.length];
    if (index % 5 !== 4 || grade < 6) return makeQuestion(base[0], base[1], base[2], base[3]);
    const level = DIFFICULTIES.indexOf(difficulty);
    const voltage = 6 + ((index + grade) % 7) * 3;
    const resistance = 2 + ((index + level) % 5);
    const current = Number((voltage / resistance).toFixed(2));
    return makeQuestion(`Theo định luật Ôm, mạch có U=${voltage}V và R=${resistance}Ω thì cường độ dòng điện gần bằng?`, `${current}A`, [`${voltage * resistance}A`, `${resistance / voltage}A`, `${current + 1}A`], 'Áp dụng I = U/R.' );
}

const HISTORY_FACTS = [
    ['Ai là người đọc Tuyên ngôn Độc lập ngày 2/9/1945?', 'Chủ tịch Hồ Chí Minh', ['Trần Hưng Đạo', 'Quang Trung', 'Lý Thường Kiệt'], 'Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập tại Quảng trường Ba Đình.'],
    ['Chiến thắng Bạch Đằng năm 938 gắn với vị anh hùng nào?', 'Ngô Quyền', ['Đinh Bộ Lĩnh', 'Lê Lợi', 'Trần Quốc Tuấn'], 'Ngô Quyền chỉ huy trận Bạch Đằng năm 938.'],
    ['Nhà nước đầu tiên trong lịch sử Việt Nam thường được nhắc đến là?', 'Văn Lang', ['Đại Việt', 'Đại Nam', 'Âu Lạc'], 'Văn Lang là nhà nước sớm của người Việt cổ.'],
    ['Ai lãnh đạo cuộc khởi nghĩa Lam Sơn?', 'Lê Lợi', ['Nguyễn Huệ', 'Phan Bội Châu', 'Nguyễn Trãi'], 'Lê Lợi là lãnh tụ khởi nghĩa Lam Sơn.'],
    ['Chiến thắng Điện Biên Phủ diễn ra năm nào?', '1954', ['1945', '1968', '1975'], 'Chiến thắng Điện Biên Phủ diễn ra ngày 7/5/1954.'],
    ['Đại thắng mùa Xuân, giải phóng miền Nam diễn ra năm nào?', '1975', ['1954', '1960', '1986'], 'Ngày 30/4/1975 đánh dấu miền Nam hoàn toàn giải phóng.'],
    ['Vị vua nào gắn với chiến thắng Ngọc Hồi - Đống Đa?', 'Quang Trung', ['Gia Long', 'Minh Mạng', 'Tự Đức'], 'Quang Trung chỉ huy chiến thắng quân Thanh mùa xuân Kỷ Dậu 1789.'],
    ['Nền văn minh cổ đại nào xây dựng các kim tự tháp nổi tiếng?', 'Ai Cập cổ đại', ['La Mã cổ đại', 'Hy Lạp cổ đại', 'Ấn Độ cổ đại'], 'Các kim tự tháp nổi tiếng được xây dựng ở Ai Cập cổ đại.'],
    ['Cách mạng công nghiệp đầu tiên khởi đầu ở quốc gia nào?', 'Anh', ['Pháp', 'Đức', 'Nhật Bản'], 'Cách mạng công nghiệp lần thứ nhất bắt đầu ở Anh.'],
    ['Liên Hợp Quốc được thành lập vào năm nào?', '1945', ['1919', '1954', '1991'], 'Liên Hợp Quốc chính thức thành lập năm 1945.'],
    ['Công cuộc Đổi mới ở Việt Nam được khởi xướng từ năm nào?', '1986', ['1975', '1995', '2000'], 'Đại hội VI năm 1986 khởi xướng đường lối Đổi mới.'],
    ['Ai là tác giả “Bình Ngô đại cáo”?', 'Nguyễn Trãi', ['Nguyễn Du', 'Hồ Xuân Hương', 'Ngô Sĩ Liên'], 'Nguyễn Trãi thay Lê Lợi viết Bình Ngô đại cáo.']
];

function historyQuestion(grade, difficulty, index) {
    const base = HISTORY_FACTS[(index + grade) % HISTORY_FACTS.length];
    if (index % 6 !== 5) return makeQuestion(base[0], base[1], base[2], base[3]);
    const events = [
        ['Chiến thắng Bạch Đằng', 938], ['Nhà Lý dời đô ra Thăng Long', 1010],
        ['Khởi nghĩa Lam Sơn thắng lợi', 1428], ['Tuyên ngôn Độc lập', 1945],
        ['Chiến thắng Điện Biên Phủ', 1954], ['Giải phóng miền Nam', 1975]
    ];
    const pair = events[(index + grade) % events.length];
    return makeQuestion(`Sự kiện “${pair[0]}” gắn với mốc thời gian nào?`, pair[1], events.filter(item => item[1] !== pair[1]).slice(0, 3).map(item => item[1]), `${pair[0]} gắn với năm ${pair[1]}.`);
}

const GEOGRAPHY_FACTS = [
    ['Thủ đô của Việt Nam là thành phố nào?', 'Hà Nội', ['Huế', 'Đà Nẵng', 'TP. Hồ Chí Minh'], 'Hà Nội là thủ đô của Việt Nam.'],
    ['Đỉnh núi cao nhất Việt Nam là?', 'Fansipan', ['Bà Đen', 'Ngọc Linh', 'Langbiang'], 'Fansipan là đỉnh cao nhất Việt Nam.'],
    ['Đồng bằng lớn nhất Việt Nam là?', 'Đồng bằng sông Cửu Long', ['Đồng bằng sông Hồng', 'Đồng bằng Thanh Hóa', 'Đồng bằng ven biển miền Trung'], 'Đồng bằng sông Cửu Long có diện tích lớn nhất nước ta.'],
    ['Châu lục có diện tích lớn nhất thế giới là?', 'Châu Á', ['Châu Âu', 'Châu Phi', 'Châu Đại Dương'], 'Châu Á là châu lục lớn nhất.'],
    ['Đại dương lớn nhất thế giới là?', 'Thái Bình Dương', ['Đại Tây Dương', 'Ấn Độ Dương', 'Bắc Băng Dương'], 'Thái Bình Dương có diện tích lớn nhất.'],
    ['Đường vĩ tuyến 0° được gọi là gì?', 'Xích đạo', ['Chí tuyến Bắc', 'Kinh tuyến gốc', 'Vòng cực Bắc'], 'Xích đạo chia Trái Đất thành bán cầu Bắc và bán cầu Nam.'],
    ['Kinh tuyến gốc đi qua đài thiên văn nào?', 'Greenwich', ['Paris', 'Tokyo', 'New York'], 'Kinh tuyến 0° đi qua Greenwich, Vương quốc Anh.'],
    ['Khí hậu Việt Nam chủ yếu mang tính chất nào?', 'Nhiệt đới gió mùa', ['Ôn đới hải dương', 'Hàn đới', 'Hoang mạc'], 'Việt Nam nằm trong vùng nhiệt đới và chịu ảnh hưởng gió mùa.'],
    ['Dân cư tập trung đông thường ở khu vực nào?', 'Đồng bằng và đô thị', ['Núi cao', 'Hoang mạc', 'Vùng băng giá'], 'Đồng bằng và đô thị thuận lợi cho cư trú, sản xuất và giao thông.'],
    ['Loại bản đồ nào thể hiện độ cao địa hình rõ nhất?', 'Bản đồ địa hình', ['Bản đồ hành chính', 'Bản đồ dân số', 'Bản đồ giao thông'], 'Bản đồ địa hình dùng đường đồng mức hoặc màu độ cao.'],
    ['Quốc gia có diện tích lớn nhất thế giới là?', 'Liên bang Nga', ['Canada', 'Trung Quốc', 'Hoa Kỳ'], 'Liên bang Nga có diện tích lớn nhất thế giới.'],
    ['Sông dài nhất chảy hoàn toàn trong lãnh thổ Việt Nam thường được nhắc đến là?', 'Sông Đồng Nai', ['Sông Hồng', 'Sông Mê Công', 'Sông Mã'], 'Sông Đồng Nai là sông dài nhất nằm hoàn toàn trong lãnh thổ Việt Nam.']
];

function geographyQuestion(grade, difficulty, index) {
    const base = GEOGRAPHY_FACTS[(index + grade) % GEOGRAPHY_FACTS.length];
    if (index % 5 !== 4 || grade < 6) return makeQuestion(base[0], base[1], base[2], base[3]);
    const distance = 10 + ((index + grade) % 10) * 5;
    const scale = [100000, 500000, 1000000][index % 3];
    const mapCm = Number((distance * 100000 / scale).toFixed(1));
    return makeQuestion(`Bản đồ tỉ lệ 1:${scale.toLocaleString('vi-VN')}. Quãng đường thực tế ${distance} km dài khoảng bao nhiêu cm trên bản đồ?`, `${mapCm} cm`, [`${mapCm + 1} cm`, `${distance} cm`, `${Number((mapCm / 10).toFixed(1))} cm`], 'Đổi km ra cm rồi chia cho mẫu số tỉ lệ bản đồ.' );
}

const GENERATORS = {
    toan: mathQuestion,
    'tieng-viet': vietnameseQuestion,
    'tieng-anh': englishQuestion,
    'khoa-hoc': scienceQuestion,
    'lich-su': historyQuestion,
    'dia-ly': geographyQuestion
};

function isValidQuestion(question) {
    return question && asText(question.q) && Array.isArray(question.a) && question.a.length >= 2 && asText(question.correct);
}

function normalizeQuestion(question, id, seed) {
    const correct = asText(question.correct);
    const options = unique([...(Array.isArray(question.a) ? question.a : []), correct]);
    let filler = 1;
    while (options.length < 4) options.push(`Phương án ${filler++}`);
    const normalized = {
        id,
        q: asText(question.q),
        a: options.slice(0, 4),
        correct,
        explanation: asText(question.explanation || `Đáp án đúng là “${correct}”.`)
    };
    if (!normalized.a.includes(correct)) normalized.a[0] = correct;
    return rotateOptions(normalized, seed);
}

function ensureCompleteQuestionBank(tests, options = {}) {
    const minQuestions = Math.max(20, Number.parseInt(options.minQuestions, 10) || 100);
    const stats = {};

    for (const subject of SUBJECTS) {
        if (!tests[subject] || typeof tests[subject] !== 'object') tests[subject] = {};
        stats[subject] = {};

        for (let grade = 1; grade <= 12; grade += 1) {
            const gradeKey = `grade${grade}`;
            if (!tests[subject][gradeKey] || typeof tests[subject][gradeKey] !== 'object') tests[subject][gradeKey] = {};
            stats[subject][gradeKey] = {};

            for (const difficulty of DIFFICULTIES) {
                const existing = Array.isArray(tests[subject][gradeKey][difficulty])
                    ? tests[subject][gradeKey][difficulty].filter(isValidQuestion)
                    : [];
                const combined = [...existing];
                let generatedIndex = 0;
                while (combined.length < minQuestions) {
                    const generated = GENERATORS[subject](grade, difficulty, generatedIndex);
                    combined.push(generated);
                    generatedIndex += 1;
                }

                const prefix = `${subject.replace(/[^a-z0-9]/gi, '')}-g${grade}-${difficulty}`;
                tests[subject][gradeKey][difficulty] = combined.map((question, index) =>
                    normalizeQuestion(question, `${prefix}-${String(index + 1).padStart(3, '0')}`, index + grade)
                );
                stats[subject][gradeKey][difficulty] = tests[subject][gradeKey][difficulty].length;
            }
        }
    }

    return {
        subjects: SUBJECTS.length,
        gradesPerSubject: 12,
        difficulties: DIFFICULTIES.length,
        minimumPerCombination: minQuestions,
        totalQuestions: SUBJECTS.reduce((sum, subject) =>
            sum + Object.values(stats[subject]).reduce((gradeSum, difficultyCounts) =>
                gradeSum + Object.values(difficultyCounts).reduce((a, b) => a + b, 0), 0), 0),
        stats,
        difficultyLabels: DIFFICULTY_LABELS
    };
}

module.exports = {
    SUBJECTS,
    DIFFICULTIES,
    ensureCompleteQuestionBank
};

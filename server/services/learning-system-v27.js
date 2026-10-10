'use strict';

const VALID_BLOCK_TYPES = new Set(['OVERVIEW', 'THEORY', 'LECTURE', 'EXAMPLE', 'ACTIVITY', 'PRACTICE', 'CODE_CHALLENGE', 'QUIZ', 'SUMMARY', 'MEDIA', 'REFERENCE']);
const VALID_LANGUAGES = new Set(['javascript', 'python', 'c', 'cpp', 'java']);
const VALID_QUESTION_TYPES = new Set(['single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'numerical', 'ordering', 'matching', 'essay', 'reading_comprehension', 'listening', 'speaking', 'image_based', 'coding', 'practical', 'timed_simulation']);
const cleanText = (value, max = 200000) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const normalizeCode = value => cleanText(value, 120).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toUpperCase().replace(/[^A-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
const normalizeOutput = value => String(value ?? '').replace(/\r/g, '').trim().split('\n').map(line => line.trimEnd()).join('\n').trim();

function optionText(value, depth = 0) {
    if (depth > 6 || value === null || value === undefined) return '';
    if (['string', 'number', 'boolean'].includes(typeof value)) return cleanText(value, 1000);
    if (Array.isArray(value)) return value.map(item => optionText(item, depth + 1)).filter(Boolean).join(' / ').slice(0, 1000);
    if (typeof value === 'object') {
        for (const key of ['label', 'text', 'title', 'name', 'value', 'id', 'content', 'description']) {
            if (value[key] !== undefined && value[key] !== null) {
                const result = optionText(value[key], depth + 1);
                if (result) return result;
            }
        }
    }
    return '';
}
function optionLabel(option) { return optionText(option && typeof option === 'object' ? option.label ?? option.text ?? option.title ?? option.value ?? option.id ?? '' : option); }
function optionValue(option, fallback = '') { return optionText(option && typeof option === 'object' ? option.value ?? option.id ?? option.label ?? option.text ?? fallback : option ?? fallback); }
function normalizeOptions(options) {
    const source = Array.isArray(options) ? options : [];
    const seen = new Set();
    return source.map((option, index) => {
        const label = optionLabel(option);
        const value = optionValue(option, label);
        const key = value.toLowerCase();
        if (!label || !value || seen.has(key)) return null;
        seen.add(key);
        return { label, value, order: index + 1 };
    }).filter(Boolean).slice(0, 100);
}
function normalizeQuestionForm(input = {}) {
    const type = cleanText(input.type || 'single_choice', 50).toLowerCase();
    const errors = [];
    const prompt = cleanText(input.prompt || input.title, 12000);
    const options = normalizeOptions(input.options);
    if (!VALID_QUESTION_TYPES.has(type)) errors.push('Loại câu hỏi không được hỗ trợ.');
    if (!prompt) errors.push('Cần nhập nội dung câu hỏi.');
    if (['single_choice', 'multiple_choice'].includes(type) && options.length < 2) errors.push('Câu trắc nghiệm cần ít nhất hai lựa chọn khác nhau.');
    if (type === 'true_false' && options.length !== 2) errors.push('Câu đúng/sai cần đúng hai lựa chọn.');
    if (type === 'ordering' && options.length < 2) errors.push('Câu sắp xếp cần ít nhất hai mục.');
    if (type === 'matching' && (!Array.isArray(input.matchingPairs) || input.matchingPairs.length < 2)) errors.push('Câu ghép đôi cần ít nhất hai cặp.');
    if (['essay', 'speaking'].includes(type) && !cleanText(input.rubric, 8000) && !(input.rubric && typeof input.rubric === 'object' && Object.keys(input.rubric).length)) errors.push('Cần nhập tiêu chí chấm/rubric cho câu trả lời mở.');
    if (type === 'coding' && !cleanText(input.practice?.statement || input.statement, 50)) errors.push('Bài lập trình phải có đề bài cụ thể.');
    const answer = input.answer;
    const points = Number(input.points ?? 1);
    if (!Number.isFinite(points) || points <= 0 || points > 1000) errors.push('Điểm phải lớn hơn 0 và không quá 1000.');
    return { valid: errors.length === 0, errors, question: { code: normalizeCode(input.code || prompt.slice(0, 64)), type, prompt, options, answer, acceptedAnswers: Array.isArray(input.acceptedAnswers) ? input.acceptedAnswers.map(value => cleanText(value, 1000)).filter(Boolean).slice(0, 100) : [], explanation: cleanText(input.explanation, 12000), points: Number.isFinite(points) ? points : 1, difficulty: ['EASY', 'BEGINNER', 'MEDIUM', 'HARD', 'EXPERT'].includes(String(input.difficulty || '').toUpperCase()) ? String(input.difficulty).toUpperCase() : 'MEDIUM', cognitiveLevel: cleanText(input.cognitiveLevel, 80), skill: cleanText(input.skill, 180), tags: Array.isArray(input.tags) ? input.tags.map(value => cleanText(value, 80)).filter(Boolean).slice(0, 30) : [], rubric: input.rubric && typeof input.rubric === 'object' ? input.rubric : cleanText(input.rubric, 8000), media: input.media && typeof input.media === 'object' ? input.media : {} } };
}
function normalizeContentBlock(input = {}) {
    const type = cleanText(input.type || 'THEORY', 40).toUpperCase();
    const result = {
        code: normalizeCode(input.code || `${type}-${input.title || 'BLOCK'}`), title: cleanText(input.title, 240), type,
        body: cleanText(input.body ?? input.content, 200000), bodyFormat: ['PLAIN_TEXT', 'MARKDOWN', 'SANITIZED_HTML'].includes(input.bodyFormat) ? input.bodyFormat : 'MARKDOWN',
        order: Math.max(0, Math.min(10000, Number.parseInt(input.order, 10) || 0)), estimatedMinutes: Math.max(0, Math.min(600, Number(input.estimatedMinutes) || 5)),
        skillCodes: Array.isArray(input.skillCodes) ? input.skillCodes.map(normalizeCode).filter(Boolean).slice(0, 50) : [],
        prerequisiteSkillCodes: Array.isArray(input.prerequisiteSkillCodes) ? input.prerequisiteSkillCodes.map(normalizeCode).filter(Boolean).slice(0, 50) : [],
        sourceType: ['OFFICIAL', 'ADMIN_CREATED', 'AI_GENERATED', 'ORIGINAL_PRACTICE', 'SIMULATION', 'USER_IMPORTED'].includes(input.sourceType) ? input.sourceType : 'ADMIN_CREATED',
        sourceVerified: input.sourceType === 'OFFICIAL' ? Boolean(input.sourceVerified) : false,
        status: ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'].includes(input.status) ? input.status : 'DRAFT', version: Math.max(1, Number(input.version) || 1)
    };
    const errors = [];
    if (!result.title) errors.push('Thiếu tiêu đề phần nội dung.');
    if (!VALID_BLOCK_TYPES.has(result.type)) errors.push('Loại phần nội dung không hợp lệ.');
    if (!result.body && !['MEDIA', 'REFERENCE'].includes(result.type)) errors.push('Nội dung không được để trống.');
    if (result.sourceType === 'OFFICIAL' && !result.sourceVerified && result.status === 'PUBLISHED') errors.push('Chưa thể công bố là OFFICIAL khi chưa xác minh nguồn.');
    return { valid: errors.length === 0, errors, block: result };
}
function normalizeTestCase(test = {}) { return { input: cleanText(test.input, 20000), expectedOutput: cleanText(test.expectedOutput ?? test.output, 20000), weight: Math.max(0, Math.min(100, Number(test.weight) || 1)) }; }
function validatePracticeTask(input = {}) {
    const errors = [];
    const task = {
        code: normalizeCode(input.code || input.title), title: cleanText(input.title, 220), description: cleanText(input.description, 4000), catalogTrack: normalizeCode(input.catalogTrack || input.track || 'UNIVERSITY_IT'),
        language: VALID_LANGUAGES.has(input.language) ? input.language : 'javascript', supportedLanguages: Array.isArray(input.supportedLanguages) ? [...new Set(input.supportedLanguages.filter(item => VALID_LANGUAGES.has(item)))].slice(0, 5) : [VALID_LANGUAGES.has(input.language) ? input.language : 'javascript'],
        difficulty: ['BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'EXPERT'].includes(String(input.difficulty || '').toUpperCase()) ? String(input.difficulty).toUpperCase() : 'BEGINNER', topic: cleanText(input.topic, 180), skillCode: normalizeCode(input.skillCode || input.skill || 'FOUNDATION'), statement: cleanText(input.statement, 50000), inputFormat: cleanText(input.inputFormat, 10000), outputFormat: cleanText(input.outputFormat, 10000), constraints: (Array.isArray(input.constraints) ? input.constraints : String(input.constraints || '').split(/\r?\n/)).map(item => cleanText(item, 500)).filter(Boolean).slice(0, 30), samples: (Array.isArray(input.samples) ? input.samples : []).map(normalizeTestCase).filter(sample => sample.expectedOutput !== '').slice(0, 20), starterCode: cleanText(input.starterCode, 100000), starterCodeTemplates: (Array.isArray(input.starterCodeTemplates) ? input.starterCodeTemplates : []).filter(template => VALID_LANGUAGES.has(template.language) && cleanText(template.code, 100000)).map(template => ({ language: template.language, code: cleanText(template.code, 100000) })).slice(0, 5), functionSignature: cleanText(input.functionSignature, 1000), executionMode: input.executionMode === 'FUNCTION' ? 'FUNCTION' : 'STDIN_STDOUT', visibleTestCases: (Array.isArray(input.visibleTestCases) ? input.visibleTestCases : []).map(normalizeTestCase).filter(test => test.expectedOutput !== '').slice(0, 50), hiddenTestCases: (Array.isArray(input.hiddenTestCases) ? input.hiddenTestCases : []).map(normalizeTestCase).filter(test => test.expectedOutput !== '').slice(0, 100), hints: (Array.isArray(input.hints) ? input.hints : String(input.hints || '').split(/\r?\n/)).map(item => cleanText(item, 1000)).filter(Boolean).slice(0, 20), solution: cleanText(input.solution, 100000), scoringCriteria: (Array.isArray(input.scoringCriteria) ? input.scoringCriteria : String(input.scoringCriteria || '').split(/\r?\n/)).map(item => cleanText(item, 500)).filter(Boolean).slice(0, 30), estimatedMinutes: Math.max(1, Math.min(600, Number(input.estimatedMinutes) || 20)), sourceType: ['ADMIN_CREATED', 'AI_GENERATED', 'ORIGINAL_PRACTICE', 'SIMULATION', 'USER_IMPORTED'].includes(input.sourceType) ? input.sourceType : 'ORIGINAL_PRACTICE', sourceVerified: Boolean(input.sourceVerified), ownerUsername: cleanText(input.ownerUsername, 80), status: ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'].includes(input.status) ? input.status : 'DRAFT', version: Math.max(1, Number(input.version) || 1)
    };
    if (!task.code) errors.push('Cần mã bài thực hành.');
    if (!task.title) errors.push('Cần tiêu đề bài thực hành.');
    if (!task.statement) errors.push('Cần đề bài mô tả rõ yêu cầu đầu vào và kết quả mong đợi.');
    if (!task.skillCode) errors.push('Cần gắn bài với một kỹ năng.');
    if (!task.samples.length) errors.push('Cần ít nhất một ví dụ vào/ra có đáp án.');
    if (task.status === 'PUBLISHED' && task.visibleTestCases.length < 1) errors.push('Muốn công bố bài lập trình cần ít nhất một bộ test công khai.');
    if (task.status === 'PUBLISHED' && task.hiddenTestCases.length < 2) errors.push('Muốn công bố bài lập trình cần ít nhất hai bộ test ẩn.');
    if (task.visibleTestCases.length > 50 || task.hiddenTestCases.length > 100) errors.push('Số lượng test vượt giới hạn.');
    if (!task.supportedLanguages.includes(task.language)) task.supportedLanguages.unshift(task.language);
    return { valid: errors.length === 0, errors, task };
}

const templates = {
    javascript: 'const fs = require("fs");\nconst input = fs.readFileSync(0, "utf8").trim();\nconst tokens = input ? input.split(/\\s+/) : [];\n// TODO: đọc input, xử lý thuật toán và in kết quả bằng console.log().\n',
    python: 'import sys\ndata = sys.stdin.read().strip()\ntokens = data.split() if data else []\n# TODO: đọc input, xử lý thuật toán và in kết quả bằng print().\n',
    cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    ios::sync_with_stdio(false); cin.tie(nullptr);\n    // TODO: đọc input, xử lý thuật toán và in kết quả.\n    return 0;\n}\n'
};
function codeTask({ code, title, skillCode, difficulty = 'BEGINNER', statement, inputFormat, outputFormat, constraints = [], samples, hidden, hints = [], estimatedMinutes = 20, starterCode }) {
    const sampleList = samples.map(([input, expectedOutput, explanation = '']) => ({ input, expectedOutput, explanation }));
    return { code, title, description: `Bài thực hành ${title}.`, catalogTrack: 'UNIVERSITY_IT', language: 'javascript', supportedLanguages: ['javascript', 'python', 'cpp'], difficulty, topic: skillCode.replace(/_/g, ' '), skillCode, statement, inputFormat, outputFormat, constraints, samples: sampleList, starterCode: starterCode || templates.javascript, starterCodeTemplates: [{ language: 'javascript', code: starterCode || templates.javascript }, { language: 'python', code: templates.python }, { language: 'cpp', code: templates.cpp }], executionMode: 'STDIN_STDOUT', visibleTestCases: sampleList.map(({ input, expectedOutput }) => ({ input, expectedOutput, weight: 1 })), hiddenTestCases: hidden.map(([input, expectedOutput, weight = 1]) => ({ input, expectedOutput, weight })), hints, scoringCriteria: ['Đọc đúng dữ liệu đầu vào', 'Xử lý đủ trường hợp biên', 'In kết quả theo đúng định dạng yêu cầu'], estimatedMinutes, sourceType: 'ORIGINAL_PRACTICE', status: 'PUBLISHED', version: 1 };
}
function buildAlgorithmTaskSeeds() {
    return [
        codeTask({ code: 'DSA-ARR-SUM-001', title: 'Tính tổng các phần tử mảng', skillCode: 'ARRAY_SUM', statement: 'Cho số nguyên n và n số nguyên. Hãy tính tổng n phần tử. Chương trình đọc từ stdin và in ra một số nguyên duy nhất.', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên.', outputFormat: 'Tổng của các phần tử.', constraints: ['1 ≤ n ≤ 100000', 'Mỗi phần tử nằm trong [-10^9, 10^9].'], samples: [['5\n1 2 3 4 5\n', '15', 'Cộng lần lượt các phần tử.']], hidden: [['1\n-9\n', '-9'], ['4\n1000000000 1000000000 -1 -1\n', '1999999998']], hints: ['Khởi tạo biến tổng bằng 0.', 'Duyệt mảng đúng n phần tử.'], estimatedMinutes: 15 }),
        codeTask({ code: 'DSA-ARR-MAX-002', title: 'Tìm phần tử lớn nhất', skillCode: 'ARRAY_MAX', statement: 'Cho n số nguyên, hãy in ra giá trị lớn nhất. Không sắp xếp mảng nếu chỉ cần tìm cực đại.', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên.', outputFormat: 'Một số nguyên là giá trị lớn nhất.', constraints: ['1 ≤ n ≤ 100000'], samples: [['5\n-2 7 3 9 1\n', '9']], hidden: [['1\n-100\n', '-100'], ['4\n-8 -3 -11 -5\n', '-3']], hints: ['Khởi tạo cực đại bằng phần tử đầu tiên, không mặc định bằng 0.'], estimatedMinutes: 15 }),
        codeTask({ code: 'DSA-SEARCH-LINEAR-003', title: 'Tìm kiếm tuyến tính', skillCode: 'LINEAR_SEARCH', statement: 'Cho mảng n phần tử và giá trị x. In chỉ số xuất hiện đầu tiên của x theo chỉ số bắt đầu từ 0; nếu không thấy, in -1.', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên. Dòng 3: x.', outputFormat: 'Chỉ số đầu tiên hoặc -1.', constraints: ['1 ≤ n ≤ 100000'], samples: [['5\n4 8 2 8 9\n8\n', '1']], hidden: [['3\n1 2 3\n4\n', '-1'], ['4\n7 7 7 1\n7\n', '0']], hints: ['Dừng khi gặp phần tử đầu tiên bằng x.'], estimatedMinutes: 20 }),
        codeTask({ code: 'DSA-ARR-REVERSE-004', title: 'Đảo ngược mảng', skillCode: 'ARRAY_REVERSE', statement: 'Cho mảng n số nguyên. In các phần tử theo thứ tự ngược lại, cách nhau bởi một dấu cách.', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên.', outputFormat: 'n phần tử đã đảo ngược.', constraints: ['1 ≤ n ≤ 100000'], samples: [['5\n1 2 3 4 5\n', '5 4 3 2 1']], hidden: [['1\n42\n', '42'], ['4\n-3 0 9 2\n', '2 9 0 -3']], hints: ['Có thể duyệt chỉ số từ n-1 về 0.'], estimatedMinutes: 15 }),
        codeTask({ code: 'DSA-STR-PALINDROME-005', title: 'Kiểm tra chuỗi palindrome', skillCode: 'STRING_PALINDROME', difficulty: 'EASY', statement: 'Cho một dòng văn bản chỉ gồm chữ cái Latin và khoảng trắng. Bỏ qua khoảng trắng, không phân biệt chữ hoa/thường. In YES nếu chuỗi còn lại đọc xuôi và ngược giống nhau, ngược lại in NO.', inputFormat: 'Một dòng văn bản.', outputFormat: 'YES hoặc NO.', constraints: ['Độ dài dòng không quá 100000 ký tự.'], samples: [['Never odd or even\n', 'YES']], hidden: [['Hello world\n', 'NO'], ['A man a plan a canal Panama\n', 'YES']], hints: ['Chuẩn hóa chữ thường rồi dùng hai con trỏ ở hai đầu.'], estimatedMinutes: 20, starterCode: 'const fs = require("fs");\nconst text = fs.readFileSync(0, "utf8").replace(/\\s/g, "").toLowerCase();\n// TODO: kiểm tra đối xứng và in YES hoặc NO.\n' }),
        codeTask({ code: 'DSA-SEARCH-BINARY-006', title: 'Tìm kiếm nhị phân', skillCode: 'BINARY_SEARCH', difficulty: 'MEDIUM', statement: 'Cho mảng đã được sắp xếp tăng dần và số x. In chỉ số đầu tiên của x (bắt đầu từ 0), hoặc -1 nếu không có. Dùng tìm kiếm nhị phân.', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên tăng dần. Dòng 3: x.', outputFormat: 'Chỉ số đầu tiên hoặc -1.', constraints: ['1 ≤ n ≤ 200000', 'Mảng đầu vào đã được sắp xếp không giảm.'], samples: [['5\n1 3 5 7 9\n7\n', '3']], hidden: [['4\n2 4 6 8\n1\n', '-1'], ['6\n1 2 2 2 5 8\n2\n', '1']], hints: ['Duy trì đoạn tìm kiếm [left, right].', 'Muốn tìm chỉ số đầu tiên, tiếp tục tìm về bên trái sau khi thấy x.'], estimatedMinutes: 30 }),
        codeTask({ code: 'DSA-SORT-BUBBLE-007', title: 'Sắp xếp tăng dần', skillCode: 'SORTING', difficulty: 'EASY', statement: 'Cho n số nguyên, hãy sắp xếp theo thứ tự tăng dần và in trên một dòng, cách nhau bởi dấu cách. Ưu tiên giải pháp O(n log n) khi n lớn.', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên.', outputFormat: 'Mảng đã sắp xếp tăng dần.', constraints: ['1 ≤ n ≤ 100000'], samples: [['5\n4 1 5 2 3\n', '1 2 3 4 5']], hidden: [['3\n0 -5 -1\n', '-5 -1 0'], ['1\n7\n', '7']], hints: ['Dùng hàm sort sẵn có hoặc tự cài thuật toán sắp xếp.', 'Kiểm tra cả số âm và mảng một phần tử.'], estimatedMinutes: 25 }),
        codeTask({ code: 'DSA-RECURSION-FACTORIAL-008', title: 'Giai thừa và điều kiện dừng', skillCode: 'RECURSION_FACTORIAL', difficulty: 'EASY', statement: 'Cho số nguyên n (0 ≤ n ≤ 20), in n! với quy ước 0! = 1. Có thể dùng vòng lặp hoặc đệ quy có điều kiện dừng.', inputFormat: 'Một số nguyên n.', outputFormat: 'Giá trị n! dưới dạng số nguyên.', constraints: ['0 ≤ n ≤ 20'], samples: [['5\n', '120']], hidden: [['0\n', '1'], ['10\n', '3628800']], hints: ['Điều kiện gốc là n bằng 0 hoặc 1.', 'Kiểu số cần chứa được kết quả đến 20!.'], estimatedMinutes: 20 }),
        codeTask({ code: 'DSA-DP-FIBONACCI-009', title: 'Số Fibonacci thứ n', skillCode: 'FIBONACCI', difficulty: 'MEDIUM', statement: 'Dãy Fibonacci được định nghĩa F0 = 0, F1 = 1, Fn = F(n-1) + F(n-2). Cho n, in Fn. Hãy tránh tính lặp theo cấp số nhân.', inputFormat: 'Một số nguyên n.', outputFormat: 'Fibonacci thứ n.', constraints: ['0 ≤ n ≤ 90'], samples: [['7\n', '13']], hidden: [['0\n', '0'], ['10\n', '55']], hints: ['Dùng hai biến lưu hai giá trị gần nhất để đạt O(n) thời gian, O(1) bộ nhớ.'], estimatedMinutes: 25 }),
        codeTask({ code: 'DSA-STACK-BRACKETS-010', title: 'Kiểm tra dấu ngoặc hợp lệ', skillCode: 'STACK_BRACKETS', difficulty: 'MEDIUM', statement: 'Cho chuỗi gồm các ký tự ngoặc () [] {}. In YES nếu mọi ngoặc được đóng đúng cặp và đúng thứ tự; ngược lại in NO.', inputFormat: 'Một chuỗi không có khoảng trắng.', outputFormat: 'YES hoặc NO.', constraints: ['1 ≤ độ dài chuỗi ≤ 100000'], samples: [['([]{})\n', 'YES']], hidden: [['([)]\n', 'NO'], ['((()))\n', 'YES']], hints: ['Dùng stack: ngoặc mở được đẩy vào; ngoặc đóng phải khớp phần tử trên đỉnh.'], estimatedMinutes: 30 }),
        codeTask({ code: 'DSA-HASH-FREQ-011', title: 'Đếm tần suất phần tử', skillCode: 'HASH_FREQUENCY', difficulty: 'MEDIUM', statement: 'Cho n số nguyên và số x. In số lần x xuất hiện trong mảng.', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên. Dòng 3: x.', outputFormat: 'Số lần xuất hiện.', constraints: ['1 ≤ n ≤ 200000'], samples: [['6\n1 2 2 3 2 5\n2\n', '3']], hidden: [['4\n9 9 9 9\n8\n', '0'], ['5\n-1 0 -1 2 -1\n-1\n', '3']], hints: ['Duyệt từng phần tử và tăng biến đếm khi bằng x.'], estimatedMinutes: 15 }),
        codeTask({ code: 'DSA-TWOPTR-TWOSUM-012', title: 'Hai số có tổng bằng X', skillCode: 'TWO_SUM', difficulty: 'HARD', statement: 'Cho n số nguyên và giá trị X. In YES nếu có hai phần tử ở hai vị trí khác nhau có tổng bằng X; ngược lại in NO.', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên. Dòng 3: X.', outputFormat: 'YES hoặc NO.', constraints: ['1 ≤ n ≤ 200000'], samples: [['5\n2 7 11 15 3\n10\n', 'YES']], hidden: [['3\n1 2 4\n8\n', 'NO'], ['4\n3 3 1 9\n6\n', 'YES']], hints: ['Có thể dùng set lưu các giá trị đã gặp để đạt thời gian trung bình O(n).'], estimatedMinutes: 35 }),
        codeTask({ code: 'DSA-STRING-UNIQUE-013', title: 'Ký tự đầu tiên không lặp', skillCode: 'FIRST_UNIQUE_CHAR', difficulty: 'MEDIUM', statement: 'Cho chuỗi chỉ gồm chữ cái thường. In ký tự đầu tiên xuất hiện đúng một lần; nếu không có, in -1.', inputFormat: 'Một chuỗi không có khoảng trắng.', outputFormat: 'Một ký tự hoặc -1.', constraints: ['1 ≤ độ dài chuỗi ≤ 100000'], samples: [['swiss\n', 'w']], hidden: [['aabbcc\n', '-1'], ['leetcode\n', 'l']], hints: ['Đếm tần suất trước, sau đó duyệt chuỗi theo thứ tự ban đầu.'], estimatedMinutes: 25 }),
        codeTask({ code: 'DSA-MATH-PRIME-014', title: 'Kiểm tra số nguyên tố', skillCode: 'PRIME_CHECK', difficulty: 'EASY', statement: 'Cho số nguyên n. In YES nếu n là số nguyên tố, ngược lại in NO. Số nhỏ hơn 2 không phải số nguyên tố.', inputFormat: 'Một số nguyên n.', outputFormat: 'YES hoặc NO.', constraints: ['-10^9 ≤ n ≤ 10^9'], samples: [['17\n', 'YES']], hidden: [['1\n', 'NO'], ['49\n', 'NO']], hints: ['Chỉ cần thử ước từ 2 đến căn bậc hai của n.'], estimatedMinutes: 20 }),
        codeTask({ code: 'DSA-TREE-TRAVERSE-015', title: 'Duyệt cây nhị phân theo mức', skillCode: 'BINARY_TREE_BFS', difficulty: 'HARD', statement: 'Cho cây nhị phân được biểu diễn bằng mảng theo thứ tự level-order, ký hiệu null là -1. In các giá trị khác -1 theo thứ tự duyệt theo mức. Phiên bản này dùng mảng biểu diễn cây, không yêu cầu cấp phát node.', inputFormat: 'Dòng 1: n. Dòng 2: n giá trị theo level-order, -1 biểu thị node rỗng.', outputFormat: 'Các giá trị node tồn tại theo thứ tự level-order.', constraints: ['1 ≤ n ≤ 100000'], samples: [['7\n1 2 3 4 5 -1 7\n', '1 2 3 4 5 7']], hidden: [['1\n5\n', '5'], ['5\n1 -1 2 -1 3\n', '1 2 3']], hints: ['Dùng hàng đợi hoặc lần lượt duyệt mảng biểu diễn theo level-order; bỏ qua marker -1.'], estimatedMinutes: 30 }),
        codeTask({ code: 'DSA-DAC-MERGE-SORT-016', title: 'Divide and Conquer: Merge Sort', skillCode: 'DIVIDE_CONQUER_MERGE_SORT', difficulty: 'MEDIUM', statement: 'Cài đặt Merge Sort theo tư tưởng chia để trị: chia mảng thành hai nửa, sắp xếp đệ quy và trộn hai nửa đã sắp xếp. Không dùng hàm sort có sẵn trong bài này.', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên.', outputFormat: 'In dãy tăng dần, các số cách nhau bởi một dấu cách.', constraints: ['1 ≤ n ≤ 100000', 'Giá trị mỗi phần tử thuộc [-10^9, 10^9].'], samples: [['6\n8 3 5 1 9 2\n', '1 2 3 5 8 9']], hidden: [['1\n-7\n', '-7'], ['5\n4 4 -1 0 -1\n', '-1 -1 0 4 4']], hints: ['Điều kiện gốc là đoạn có 0 hoặc 1 phần tử.', 'Sau khi đệ quy hai nửa, trộn bằng hai con trỏ và xử lý nốt phần còn lại.'], estimatedMinutes: 35 }),
        codeTask({ code: 'DSA-DAC-MAX-SUBARRAY-017', title: 'Divide and Conquer: Tổng dãy con lớn nhất', skillCode: 'DIVIDE_CONQUER_MAX_SUBARRAY', difficulty: 'HARD', statement: 'Cho dãy số nguyên, tìm tổng lớn nhất của một dãy con liên tiếp không rỗng. Hãy trình bày hoặc cài đặt hướng chia để trị, xét dãy con nằm nửa trái, nửa phải và dãy con băng qua điểm giữa.', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên.', outputFormat: 'Một số nguyên là tổng lớn nhất của dãy con liên tiếp.', constraints: ['1 ≤ n ≤ 100000', 'Mảng có thể chứa toàn số âm.'], samples: [['9\n-2 1 -3 4 -1 2 1 -5 4\n', '6']], hidden: [['3\n-8 -2 -5\n', '-2'], ['1\n-100\n', '-100']], hints: ['Tính tổng tốt nhất ở nửa trái và nửa phải.', 'Tính thêm suffix tốt nhất của nửa trái cộng prefix tốt nhất của nửa phải; không mặc định đáp án bằng 0.'], estimatedMinutes: 45 }),
        codeTask({ code: 'DSA-DAC-COUNT-INVERSIONS-018', title: 'Divide and Conquer: Đếm nghịch thế', skillCode: 'DIVIDE_CONQUER_INVERSIONS', difficulty: 'HARD', statement: 'Một nghịch thế là cặp chỉ số i < j nhưng a[i] > a[j]. Hãy đếm số nghịch thế bằng cách mở rộng bước trộn của Merge Sort; không duyệt mọi cặp O(n²).', inputFormat: 'Dòng 1: n. Dòng 2: n số nguyên.', outputFormat: 'Số cặp nghịch thế.', constraints: ['1 ≤ n ≤ 100000', 'Số nghịch thế có thể vượt giới hạn int 32-bit.'], samples: [['5\n2 4 1 3 5\n', '3']], hidden: [['5\n1 2 3 4 5\n', '0'], ['5\n5 4 3 2 1\n', '10']], hints: ['Khi phần tử bên phải được chọn trước phần tử bên trái còn lại trong bước trộn, cộng số phần tử bên trái chưa lấy.', 'Dùng kiểu số đủ rộng cho kết quả.'], estimatedMinutes: 45 })
    ];
}

function auditCourseCatalog({ courses = [], lessons = [], questions = [], assessments = [], practiceTasks = [], blocks = [] } = {}) {
    const publishedQuestions = new Set(questions.filter(question => question.status === 'PUBLISHED').map(question => String(question._id)));
    const items = courses.map(course => {
        const courseId = String(course._id || course.id || '');
        const courseLessons = lessons.filter(lesson => String(lesson.courseId?._id || lesson.courseId || '') === courseId || String(lesson.parentCourseId || '') === courseId);
        const lessonIds = new Set(courseLessons.map(lesson => String(lesson._id)));
        const courseBlocks = blocks.filter(block => lessonIds.has(String(block.lessonId)) || String(block.courseId || '') === courseId);
        const courseQuestions = questions.filter(question => String(question.courseId || '') === courseId || lessonIds.has(String(question.lessonId || '')));
        const courseAssessments = assessments.filter(assessment => String(assessment.courseId || '') === courseId || lessonIds.has(String(assessment.lessonId || '')));
        const courseTasks = practiceTasks.filter(task => String(task.courseId || '') === courseId || (task.catalogTrack && task.catalogTrack === (course.subjectId || course.code)));
        const hasBlock = (lesson, types) => courseBlocks.some(block => String(block.lessonId || '') === String(lesson._id) && types.includes(String(block.type || '').toUpperCase()) && String(block.body || block.content || '').trim());
        const hasQuestion = lesson => courseQuestions.some(question => String(question.lessonId || '') === String(lesson._id) && ['PUBLISHED', 'DRAFT'].includes(String(question.status || '').toUpperCase()));
        const issues = [];
        if (!courseLessons.length) issues.push('Khóa học chưa có bài học liên kết.');
        if (courseLessons.some(lesson => !String(lesson.theory || lesson.content || lesson.description || '').trim() && !hasBlock(lesson, ['THEORY', 'LECTURE']))) issues.push('Có bài học thiếu lý thuyết/bài giảng có nội dung.');
        if (courseLessons.some(lesson => !hasBlock(lesson, ['EXAMPLE', 'WORKED_EXAMPLE', 'DEMO']) && !(Array.isArray(lesson.examples) && lesson.examples.some(example => String(example?.solution || example?.explanation || example?.content || '').trim())))) issues.push('Có bài học thiếu ví dụ mẫu kèm lời giải.');
        if (courseLessons.some(lesson => !hasBlock(lesson, ['GUIDED_PRACTICE', 'PRACTICE', 'EXERCISE']) && !(Array.isArray(lesson.activities) && lesson.activities.length) && !courseTasks.some(task => String(task.lessonId || '') === String(lesson._id)))) issues.push('Có bài học thiếu bài luyện tập độc lập/có hướng dẫn.');
        if (courseLessons.some(lesson => !hasBlock(lesson, ['LAB', 'PRACTICAL', 'CODE_CHALLENGE', 'PROJECT', 'ACTIVITY']) && !(Array.isArray(lesson.practicalTasks) && lesson.practicalTasks.length) && !courseTasks.some(task => String(task.lessonId || '') === String(lesson._id) && Boolean(task.submissionSchema || task.rubric)))) issues.push('Có bài học thiếu bài thực hành có sản phẩm nộp/chấm điểm.');
        if (courseLessons.some(lesson => !courseAssessments.some(assessment => String(assessment.lessonId || '') === String(lesson._id)) && !hasQuestion(lesson))) issues.push('Có bài học thiếu bài kiểm tra/câu hỏi.');
        if (courseLessons.some(lesson => !courseAssessments.some(assessment => String(assessment.lessonId || '') === String(lesson._id) && Array.isArray(assessment.questionIds) && assessment.questionIds.length > 0) && !hasQuestion(lesson))) issues.push('Có bài học chưa gắn bộ câu hỏi để kiểm tra kiến thức.');
        if (courseQuestions.some(question => ['essay', 'speaking', 'practical', 'project'].includes(String(question.type).toLowerCase()) && !(question.rubric && typeof question.rubric === 'object' && Object.keys(question.rubric).length))) issues.push('Câu tự luận/nói/thực hành thiếu rubric chấm điểm.');
        if (/CNTT|IT|PROGRAMM|DSA|COMPUTER/i.test(`${course.subjectId || ''} ${course.code || ''} ${course.name || ''}`) && !courseTasks.some(task => task.submissionSchema || task.rubric)) issues.push('Khóa CNTT chưa có bài lập trình/thực hành với cơ chế nộp và chấm.');
        if (courseAssessments.some(assessment => (assessment.questionIds || []).some(id => !publishedQuestions.has(String(id))))) issues.push('Đề có liên kết tới câu hỏi không còn công bố.');
        const score = Math.max(0, 100 - issues.length * 15);
        return { courseId, courseCode: course.code || '', courseTitle: course.name || course.title || '', lessonCount: courseLessons.length, publishedLessonCount: courseLessons.filter(lesson => lesson.status === 'PUBLISHED').length, questionCount: courseQuestions.length, practiceCount: courseTasks.length + courseBlocks.filter(block => ['PRACTICE', 'CODE_CHALLENGE', 'ACTIVITY', 'LAB', 'PRACTICAL', 'PROJECT'].includes(String(block.type || '').toUpperCase())).length, issues, score, status: issues.length ? score >= 60 ? 'NEEDS_REVIEW' : 'FAIL' : 'PASS' };
    });
    const summary = { courseCount: courses.length, lessonCount: lessons.length, questionCount: questions.length, assessmentCount: assessments.length, practiceTaskCount: practiceTasks.length, contentBlockCount: blocks.length, pass: items.filter(item => item.status === 'PASS').length, needsReview: items.filter(item => item.status === 'NEEDS_REVIEW').length, fail: items.filter(item => item.status === 'FAIL').length };
    return { summary, courses: items };
}

function buildAdaptiveRecommendations({ profile = {}, education = {}, learning = {}, mastery = [], errors = [], lessons = [], courses = [], tasks = [], now = new Date() } = {}) {
    const allMastery = Array.isArray(mastery) ? mastery : [];
    const allErrors = Array.isArray(errors) ? errors : [];
    const normalize = value => cleanText(value, 500).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
    const toList = value => Array.isArray(value) ? value : value ? [value] : [];
    const survey = learning.survey || {};
    const latestErrorSkills = new Map();
    for (const error of allErrors) {
        const skill = cleanText(error.skill || error.skillCode || error.concept, 180);
        if (skill && !latestErrorSkills.has(skill)) latestErrorSkills.set(skill, error);
    }
    const candidates = allMastery.map(item => ({ skill: cleanText(item.skill || item.skillCode, 180), accuracy: Number(item.accuracy ?? item.averageScore ?? item.recentScore ?? 0), status: item.status, reviewDueAt: item.reviewDueAt, courseId: item.courseId })).filter(item => item.skill);
    for (const [skill, error] of latestErrorSkills) if (!candidates.some(item => normalize(item.skill) === normalize(skill))) candidates.push({ skill, accuracy: Number(error.score || 0), status: 'REVIEW_REQUIRED', courseId: error.courseId });
    const declaredWeaknesses = [...toList(survey.weaknesses), ...toList(survey.weakSkills), ...toList(survey.skillGaps), ...toList(learning.weaknesses)].map(value => typeof value === 'object' ? value.skill || value.name || value.label || '' : value).map(value => cleanText(value, 180)).filter(Boolean);
    for (const skill of declaredWeaknesses) if (!candidates.some(item => normalize(item.skill) === normalize(skill))) candidates.push({ skill, accuracy: 0, status: 'USER_DECLARED_WEAKNESS', courseId: null });
    candidates.sort((a, b) => {
        const dueA = a.reviewDueAt && new Date(a.reviewDueAt) <= now ? 1 : 0;
        const dueB = b.reviewDueAt && new Date(b.reviewDueAt) <= now ? 1 : 0;
        return dueB - dueA || a.accuracy - b.accuracy;
    });
    const context = normalize([education.educationLevel, education.grade ? `lớp ${education.grade}` : '', education.majorName, education.fieldName, toList(learning.goals).join(' '), survey.targetExam, toList(survey.favoriteSubjects || survey.subjectInterests).join(' ')].join(' '));
    const age = ageFromDob(profile.dob);
    const ageBand = age === null ? 'UNKNOWN' : age <= 12 ? 'PRIMARY_CHILD' : age <= 15 ? 'LOWER_SECONDARY' : age <= 18 ? 'UPPER_SECONDARY' : age <= 24 ? 'YOUNG_ADULT' : 'ADULT';
    const isYoungerLearner = age !== null && age <= 12;
    const isTeenLearner = age !== null && age >= 13 && age <= 17;
    const relevantLesson = (lesson, skill) => {
        if (lesson.status && lesson.status !== 'PUBLISHED') return false;
        const lessonText = normalize([lesson.title, lesson.description, ...toList(lesson.skills), ...toList(lesson.knowledge), ...toList(lesson.objectives), lesson.subjectId, lesson.code].join(' '));
        const norm = normalize(skill);
        if (!norm) return false;
        if (lessonText.includes(norm)) return true;
        const tokens = norm.split(/\s+/).filter(token => token.length > 3);
        return tokens.length > 0 && tokens.filter(token => lessonText.includes(token)).length >= Math.min(2, tokens.length);
    };
    const linkCourse = lesson => {
        if (!lesson) return null;
        const lessonCourseId = String(lesson.courseId?._id || lesson.courseId || lesson.parentId || '');
        if (lessonCourseId) {
            const explicit = courses.find(course => String(course._id || course.id || '') === lessonCourseId);
            if (explicit) return explicit;
        }
        if (!lesson.subjectId) return null;
        const sameSubject = courses.filter(course => normalize(course.subjectId || '') === normalize(lesson.subjectId));
        return sameSubject.find(course => (!lesson.grade || !course.grade || Number(lesson.grade) === Number(course.grade)) && (!lesson.educationLevel || !course.educationLevel || normalize(lesson.educationLevel) === normalize(course.educationLevel))) || null;
    };
    const recommendations = [];
    const seen = new Set();
    for (const item of candidates) {
        const skill = item.skill;
        const norm = normalize(skill);
        const due = item.reviewDueAt && new Date(item.reviewDueAt) <= now;
        const matching = lessons.filter(lesson => relevantLesson(lesson, skill));
        const linkedLesson = matching.find(lesson => !item.courseId || String(lesson.courseId?._id || lesson.courseId || lesson.parentId || '') === String(item.courseId)) || matching[0] || null;
        const linkedCourse = linkCourse(linkedLesson) || (item.courseId ? courses.find(course => String(course._id || course.id) === String(item.courseId)) : null);
        const task = tasks.find(candidate => candidate.status === 'PUBLISHED' && (normalize(candidate.skillCode) === norm || normalize(candidate.title).includes(norm) || normalize(candidate.topic).includes(norm)));
        const key = `${norm}:${due ? 'review' : 'learn'}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const current = Math.max(0, Math.min(100, Number.isFinite(item.accuracy) ? item.accuracy : 0));
        const gap = Math.max(0, 80 - current);
        let estimatedMinutes = Number(task?.estimatedMinutes || linkedLesson?.estimatedMinutes || 20);
        if (isYoungerLearner) estimatedMinutes = Math.min(15, estimatedMinutes);
        else if (isTeenLearner) estimatedMinutes = Math.min(25, estimatedMinutes);
        recommendations.push({ skill, currentLevel: current, targetLevel: 80, gap, priority: Math.min(100, (due ? 30 : 0) + gap + (latestErrorSkills.has(skill) ? 20 : 0) + (item.status === 'USER_DECLARED_WEAKNESS' ? 10 : 0)), type: due ? 'REVIEW' : current < 50 ? 'REMEDIATION' : task ? 'PRACTICE' : 'LESSON', courseId: linkedCourse?._id || (linkedLesson?.courseId || null), courseCode: linkedCourse?.code || '', courseName: linkedCourse?.name || linkedCourse?.title || '', lessonId: linkedLesson?._id || null, lessonTitle: linkedLesson?.title || '', practiceTaskId: task?._id || null, practiceTaskTitle: task?.title || '', courseGap: !linkedLesson && !linkedCourse && !task, reason: due ? 'Đã đến hạn ôn tập theo lịch.' : latestErrorSkills.has(skill) ? 'Dựa trên lỗi gần đây và bằng chứng kỹ năng.' : item.status === 'USER_DECLARED_WEAKNESS' ? 'Dựa trên điểm cần cải thiện do người học khai báo; cần bài chẩn đoán để xác minh.' : current < 50 ? 'Điểm thành thạo còn thấp; cần củng cố kiến thức tiên quyết.' : 'Củng cố và mở rộng kỹ năng theo kết quả đã ghi nhận.', estimatedMinutes, ageBand, sessionFormat: isYoungerLearner ? 'SHORT_GUIDED_STEPS' : isTeenLearner ? 'GUIDED_PRACTICE' : 'FLEXIBLE' });
    }
    if (!recommendations.length) {
        const requestedGrade = Number(education.grade || survey.currentGrade || 0);
        const normalizedLevel = normalize(education.educationLevel || survey.educationLevel || '');
        const requestedSubjects = normalize([...toList(survey.favoriteSubjects || survey.subjectInterests), ...toList(learning.goals)].join(' '));
        const suitableLessons = lessons.filter(lesson => {
            if (lesson.status && lesson.status !== 'PUBLISHED') return false;
            if (requestedGrade && lesson.grade && Number(lesson.grade) !== requestedGrade) return false;
            if (normalizedLevel && lesson.educationLevel && !normalize(lesson.educationLevel).includes(normalizedLevel) && !normalizedLevel.includes(normalize(lesson.educationLevel))) return false;
            if (requestedSubjects) {
                const haystack = normalize([lesson.title, lesson.subjectId, lesson.description].join(' '));
                const tokens = requestedSubjects.split(/\s+/).filter(token => token.length > 3);
                if (tokens.length && !tokens.some(token => haystack.includes(token))) return false;
            }
            return true;
        }).slice(0, 3);
        for (const lesson of suitableLessons) {
            const course = linkCourse(lesson);
            recommendations.push({ skill: cleanText(lesson.subjectId || lesson.title, 180), currentLevel: 0, targetLevel: 80, gap: 80, priority: 60, type: 'FOUNDATION', courseId: course?._id || lesson.courseId || null, courseCode: course?.code || '', courseName: course?.name || course?.title || '', lessonId: lesson._id || null, lessonTitle: lesson.title || '', practiceTaskId: null, courseGap: !course, reason: 'Gợi ý bài bắt đầu từ cấp học/mục tiêu khai báo; hãy làm bài kiểm tra để hiệu chỉnh.', estimatedMinutes: isYoungerLearner ? 10 : 20, ageBand, sessionFormat: isYoungerLearner ? 'SHORT_GUIDED_STEPS' : isTeenLearner ? 'GUIDED_PRACTICE' : 'FLEXIBLE' });
        }
    }
    if (!recommendations.length && (context.includes('toeic') || context.includes('ielts') || context.includes('university') || context.includes('đại học') || education.grade)) {
        recommendations.push({ skill: context.includes('ielts') ? 'IELTS diagnostic' : context.includes('toeic') ? 'TOEIC diagnostic' : education.grade ? `Kiến thức nền lớp ${education.grade}` : 'Kiến thức nền theo ngành', currentLevel: 0, targetLevel: 80, gap: 80, priority: 60, type: 'COURSE_GAP', courseGap: true, reason: 'Chưa có bằng chứng kỹ năng hoặc bài học khớp chính xác. Hãy làm placement phù hợp; nếu catalog còn thiếu, quản trị viên cần bổ sung nội dung.', estimatedMinutes: isYoungerLearner ? 10 : 30, ageBand, sessionFormat: isYoungerLearner ? 'SHORT_GUIDED_STEPS' : 'FLEXIBLE' });
    }
    return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 30);
}
function ageFromDob(dob, now = new Date()) {
    if (!dob) return null;
    const year = Number(dob.year), month = Number(dob.month), day = Number(dob.day);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date > now) return null;
    let age = now.getFullYear() - year;
    if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age -= 1;
    return age >= 0 && age <= 120 ? age : null;
}
function scorePracticeTests(visibleResults = [], hiddenResults = []) {
    const weightOf = test => Math.max(0.0001, Math.min(100, Number(test && typeof test === 'object' ? test.weight : 1) || 1));
    const passedOf = test => typeof test === 'boolean' ? test : Boolean(test && test.passed);
    const scoreGroup = list => list.reduce((result, item) => { const weight = weightOf(item); result.possibleWeight += weight; if (passedOf(item)) result.earnedWeight += weight; if (passedOf(item)) result.passed += 1; result.total += 1; return result; }, { earnedWeight: 0, possibleWeight: 0, passed: 0, total: 0 });
    const visible = scoreGroup(visibleResults), hidden = scoreGroup(hiddenResults);
    const earnedWeight = visible.earnedWeight + hidden.earnedWeight;
    const possibleWeight = visible.possibleWeight + hidden.possibleWeight;
    return { score: possibleWeight ? Math.round(earnedWeight / possibleWeight * 100) : 0, earnedWeight: Number(earnedWeight.toFixed(3)), possibleWeight: Number(possibleWeight.toFixed(3)), visible, hidden };
}
function sanitizeTaskForLearner(task) {
    if (!task) return null;
    const value = typeof task.toObject === 'function' ? task.toObject() : { ...task };
    value.hiddenTestCaseCount = Array.isArray(value.hiddenTestCases) ? value.hiddenTestCases.length : 0;
    value.scoringModel = 'WEIGHTED_TEST_CASES';
    delete value.hiddenTestCases; delete value.solution; delete value.sourceVerified;
    return value;
}
function validatePublishableQuestion(question) {
    const normalized = normalizeQuestionForm(question);
    const type = normalized.question.type;
    if (['essay', 'speaking'].includes(type) && !question.rubric) normalized.errors.push('Câu trả lời mở cần rubric trước khi công bố.');
    if (type === 'coding' && !question.practice?.hiddenTestCases?.length && !question.hiddenTestCases?.length) normalized.errors.push('Câu lập trình cần có hidden tests được lưu ở server trước khi công bố.');
    normalized.valid = normalized.errors.length === 0;
    return normalized;
}

module.exports = { VALID_BLOCK_TYPES, VALID_LANGUAGES, VALID_QUESTION_TYPES, normalizeCode, normalizeOutput, normalizeOptions, normalizeQuestionForm, normalizeContentBlock, validatePracticeTask, buildAlgorithmTaskSeeds, auditCourseCatalog, buildAdaptiveRecommendations, ageFromDob, sanitizeTaskForLearner, scorePracticeTests, validatePublishableQuestion };

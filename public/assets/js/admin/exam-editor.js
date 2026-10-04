/**
 * SOẠN CÂU HỎI / XEM ĐỀ (quản trị).
 *
 * Một trang, hai chế độ, quyết định theo tham số URL:
 *   ?questionId=...  -> sửa một câu hỏi
 *   ?examId=...      -> xem và kiểm tra một đề thi trước khi công bố
 *
 * Biểu mẫu ĐỔI theo dạng câu hỏi: mỗi dạng có đúng phần nhập liệu của nó
 * (lựa chọn, mệnh đề, ô điền khuyết, rubric…) chứ không dùng một form chung.
 */

import { adminApi, studentApi } from '../core/api.js';
import {
    createElement,
    render,
    message,
    questionTypeLabel,
    toast,
    formatNumber
} from '../core/dom.js';
import { startAdminPage } from './admin-page.js';

const form = document.getElementById('question-form');
const gradeSelect = document.getElementById('grade');
const subjectSelect = document.getElementById('subjectId');
const typeSelect = document.getElementById('type');
const difficultySelect = document.getElementById('difficulty');
const pointsInput = document.getElementById('points');
const textInput = document.getElementById('questionText');
const explanationInput = document.getElementById('explanation');
const typeFields = document.getElementById('type-fields');
const formMessage = document.getElementById('form-message');

/** Tạo một ô nhập có nhãn. */
function labelled(labelText, control, hint = '') {
    return createElement('label', { className: 'field', children: [
        createElement('span', { className: 'field-label', text: labelText }),
        control,
        hint ? createElement('span', { className: 'field-hint', text: hint }) : null
    ].filter(Boolean) });
}

/** Đọc danh sách lựa chọn dạng "A. nội dung" thành mảng { label, text }. */
function parseOptions(text) {
    return text.split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, index) => {
            const match = line.match(/^([A-Z])[).:]\s*(.*)$/);
            return match
                ? { label: match[1], text: match[2] }
                : { label: String.fromCharCode(65 + index), text: line };
        });
}

/** Đọc danh sách đáp án chấp nhận, mỗi dòng một đáp án. */
function parseAnswers(text) {
    return text.split('\n').map(line => line.trim()).filter(Boolean);
}
/**
 * Dựng phần nhập liệu riêng cho từng dạng câu hỏi.
 * Trả về đối tượng `collect()` gom dữ liệu đúng cấu trúc mà máy chủ mong đợi.
 */
function buildTypeFields(type) {
    const nodes = [];

    if (type === 'single_choice' || type === 'multiple_choice') {
        const optionsBox = createElement('textarea', {
            attrs: { rows: '5', placeholder: 'A. Một\nB. Hai\nC. Ba\nD. Bốn' }
        });
        const answerBox = createElement('input', {
            attrs: { type: 'text', placeholder: type === 'single_choice' ? 'A' : 'A,C' }
        });

        nodes.push(
            labelled('Các lựa chọn (mỗi dòng một lựa chọn)', optionsBox),
            labelled('Đáp án đúng', answerBox, type === 'multiple_choice'
                ? 'Nhiều đáp án thì viết dấu phẩy, ví dụ A,C'
                : 'Chỉ một ký hiệu, ví dụ A')
        );
        return {
            nodes,
            collect: () => ({
                options: parseOptions(optionsBox.value),
                correctAnswer: parseAnswers(answerBox.value)[0] || ''
            })
        };
    }

    if (type === 'true_false') {
        const answerBox = createElement('select', {
            attrs: { 'aria-label': 'Đáp án đúng sai' },
            children: [
                createElement('option', { text: 'Đúng', attrs: { value: 'true' } }),
                createElement('option', { text: 'Sai', attrs: { value: 'false' } })
            ]
        });
        nodes.push(labelled('Đáp án đúng', answerBox));
        return { nodes, collect: () => ({ correctAnswer: answerBox.value === 'true' }) };
    }

    if (type === 'fill_blank') {
        const countInput = createElement('input', { attrs: { type: 'number', value: '1', min: '1', max: '10' } });
        const answersBox = createElement('textarea', {
            attrs: { rows: '3', placeholder: 'Mỗi dòng một đáp án cho từng ô, theo thứ tự' }
        });
        nodes.push(
            labelled('Số ô điền khuyết', countInput),
            labelled('Đáp án của các ô', answersBox)
        );
        return {
            nodes,
            collect: () => {
                const answers = parseAnswers(answersBox.value);
                const count = Math.max(1, Number(countInput.value) || 1);
                return {
                    blanks: Array.from({ length: count }, (_, index) => ({
                        blankId: `blank-${index + 1}`,
                        position: index + 1,
                        correctAnswers: answers[index] ? [answers[index]] : [],
                        points: Number(pointsInput.value) / count
                    }))
                };
            }
        };
    }

    if (type === 'short_answer' || type === 'essay') {
        const answersBox = createElement('textarea', {
            attrs: { rows: 3, placeholder: 'Mỗi dòng một đáp án được chấp nhận' }
        });
        const modeSelect = createElement('select', {
            children: [
                createElement('option', { text: 'Chấm tay', attrs: { value: 'manual' } }),
                createElement('option', { text: 'Máy chấm nếu khớp', attrs: { value: 'auto' } }),
                createElement('option', { text: 'Thử máy, lệch thì chấm tay', attrs: { value: 'hybrid' } })
            ]
        });

        nodes.push(labelled('Đáp án được chấp nhận', answersBox), labelled('Cách chấm', modeSelect));

        if (type !== 'essay') {
            return {
                nodes,
                collect: () => ({
                    acceptedAnswers: parseAnswers(answersBox.value),
                    gradingMode: modeSelect.value
                })
            };
        }

        const minWords = createElement('input', { attrs: { type: 'number', min: '0', value: '50' } });
        const maxWords = createElement('input', { attrs: { type: 'number', min: '0', value: '300' } });
        const rubricBox = createElement('textarea', {
            attrs: { rows: 3, placeholder: 'Mỗi dòng một tiêu chí: Nội dung | 2' }
        });
        nodes.push(
            labelled('Số từ tối thiểu', minWords),
            labelled('Số từ tối đa', maxWords),
            labelled('Rubric chấm điểm', rubricBox, 'Mỗi dòng: mô tả | điểm tối đa')
        );
        return {
            nodes,
            collect: () => ({
                acceptedAnswers: parseAnswers(answersBox.value),
                gradingMode: modeSelect.value,
                minWords: Number(minWords.value) || null,
                maxWords: Number(maxWords.value) || null,
                rubric: rubricBox.value.split('\n')
                    .map(line => line.trim())
                    .filter(Boolean)
                    .map((line, index) => {
                        const [description, points] = line.split('|').map(part => part.trim());
                        return {
                            criterionId: `criterion-${index + 1}`,
                            description: description || line,
                            maxPoints: Number(points) || 0
                        };
                    })
            })
        };
    }

    return { nodes, collect: () => ({}) };
}
let currentTypeFields = { nodes: [], collect: () => ({}) };

/** Đổi biểu mẫu theo dạng câu hỏi đang chọn. */
function onTypeChange() {
    currentTypeFields = buildTypeFields(typeSelect.value);
    render(typeFields, ...currentTypeFields.nodes);
}

/** Gom dữ liệu biểu mẫu thành payload gửi máy chủ. */
function collectPayload() {
    return {
        grade: Number(gradeSelect.value),
        subjectId: subjectSelect.value,
        type: typeSelect.value,
        difficulty: difficultySelect.value,
        points: Number(pointsInput.value) || 1,
        questionText: textInput.value.trim(),
        explanation: explanationInput.value.trim(),
        ...currentTypeFields.collect()
    };
}

startAdminPage(async () => {
    const params = new URLSearchParams(window.location.search);
    const questionId = params.get('questionId');
    const examId = params.get('examId');

    const catalog = await adminApi.getCatalog();
    render(typeSelect, ...(catalog.questionTypes || []).map(item => createElement('option', {
        text: item.label,
        attrs: { value: item.type }
    })));

    const grades = await studentApi.getGrades();
    render(gradeSelect, ...grades.map(grade => createElement('option', {
        text: grade.gradeName || `Lớp ${grade.grade}`,
        attrs: { value: grade.grade }
    })));

    /** Nạp danh sách môn theo lớp. */
    async function loadSubjects() {
        const subjects = await studentApi.getSubjects(Number(gradeSelect.value));
        render(subjectSelect, ...subjects.map(subject => createElement('option', {
            text: subject.displayName,
            attrs: { value: subject.subjectId }
        })));
    }

    await loadSubjects();
    onTypeChange();

    gradeSelect.addEventListener('change', loadSubjects);
    typeSelect.addEventListener('change', onTypeChange);

    // Nếu đang sửa một câu hỏi có sẵn, nạp dữ liệu của câu đó vào biểu mẫu.
    if (questionId) {
        try {
            const question = await adminApi.getQuestion(questionId);
            document.getElementById('page-title').textContent = 'Sửa câu hỏi';
            gradeSelect.value = String(question.grade);
            await loadSubjects();
            subjectSelect.value = question.subjectId;
            typeSelect.value = question.type;
            difficultySelect.value = question.difficulty || 'medium';
            pointsInput.value = question.points || 1;
            textInput.value = question.questionText || '';
            explanationInput.value = question.explanation || '';
            onTypeChange();
        } catch (error) {
            render(formMessage, message(error.message || 'Không tải được câu hỏi.', 'error'));
        }
    }

    // Chế độ xem đề thi: hiển thị kết quả kiểm tra trước khi công bố.
    if (examId) {
        const section = document.getElementById('exam-section');
        section.hidden = false;
        document.getElementById('exam-title').textContent = `Kiểm tra đề ${examId}`;
        try {
            const exam = await adminApi.getExam(examId);
            const validation = exam.validation || {};
            render(document.getElementById('exam-body'),
                createElement('p', { text: `${exam.title} · ${exam.questions?.length || 0} câu · ${exam.totalPoints} điểm` }),
                validation.valid
                    ? message('Đề hợp lệ, có thể công bố.', 'success')
                    : createElement('div', { className: 'message message-error', children: [
                        createElement('strong', { text: 'Đề chưa thể công bố:' }),
                        createElement('ul', { children: (validation.errors || []).map(item => createElement('li', {
                            text: item.message || String(item)
                        })) })
                    ] }),
                createElement('button', {
                    className: 'btn btn-primary',
                    text: 'Công bố đề',
                    attrs: { type: 'button' },
                    onClick: async event => {
                        event.target.disabled = true;
                        try {
                            await adminApi.publishExam(examId);
                            toast('Đã công bố đề thi.');
                        } catch (error) {
                            toast(error.message || 'Không công bố được.', 'error');
                        } finally {
                            event.target.disabled = false;
                        }
                    }
                })
            );
        } catch (error) {
            render(document.getElementById('exam-body'), message(error.message || 'Không tải được đề.', 'error'));
        }
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        render(formMessage);

        const payload = collectPayload();
        if (!payload.questionText) {
            render(formMessage, message('Vui lòng nhập nội dung câu hỏi.', 'error'));
            return;
        }

        try {
            if (questionId) {
                await adminApi.updateQuestion(questionId, payload);
                toast('Đã cập nhật câu hỏi.');
            } else {
                await adminApi.createQuestion(payload);
                toast('Đã tạo câu hỏi.');
            }
            render(formMessage, message('Lưu thành công.', 'success'));
        } catch (error) {
            render(formMessage, message(error.message || 'Không lưu được câu hỏi.', 'error'));
        }
    });
});

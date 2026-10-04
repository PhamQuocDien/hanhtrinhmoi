/**
 * TRANG LUYỆN TẬP — xem ngân hàng câu hỏi đã công bố.
 *
 * Câu hỏi luyện tập KHÔNG kèm đáp án đúng (đó là nguyên tắc bảo mật của toàn hệ
 * thống), và máy chủ không có endpoint chấm điểm cho luyện tập rời.
 * Vì vậy trang này dùng để ÔN TẬP: xem nội dung câu hỏi theo đúng dạng, sau đó
 * chuyển sang làm bài kiểm tra để được chấm điểm và xem giải thích.
 *
 * Không hiển thị điểm giả, không tự chấm ở trình duyệt.
 */

import { studentApi, authApi, requireUser } from '../core/api.js';
import {
    createElement,
    render,
    message,
    renderShell,
    STUDENT_MENU,
    queryParam,
    questionTypeLabel,
    formatNumber
} from '../core/dom.js';

const gradeSelect = document.getElementById('grade');
const subjectSelect = document.getElementById('subjectId');
const typeSelect = document.getElementById('type');
const root = document.getElementById('practice-root');

/** 7 dạng câu hỏi mà hệ thống hỗ trợ. */
const QUESTION_TYPES = [
    'single_choice', 'multiple_choice', 'true_false',
    'fill_blank', 'short_answer', 'numeric', 'essay'
];

/** Hiển thị phần lựa chọn của câu trắc nghiệm (không có ô chọn để trả lời). */
function renderOptions(question) {
    const options = question.options || [];
    if (!options.length) return null;

    return createElement('ul', { className: 'stack small', children: options.map(option => createElement('li', {
        children: [
            createElement('strong', { text: `${option.label}. ` }),
            createElement('span', { text: option.text })
        ]
    })) });
}

/** Một thẻ câu hỏi xem trước. */
function questionCard(question, index) {
    return createElement('article', { className: 'card', children: [
        createElement('p', { className: 'small muted', children: [
            createElement('strong', { text: `Câu ${index + 1}` }),
            ` · ${questionTypeLabel(question.type)}`,
            ` · ${formatNumber(question.points, 1)} điểm`
        ] }),
        createElement('p', { text: question.questionText }),
        renderOptions(question),
        // Điền khuyết: hiện các ô trống mà không nói đáp án.
        (question.blanks || []).length
            ? createElement('p', { className: 'small muted', text: `Câu này có ${question.blanks.length} ô điền khuyết.` })
            : null,
        question.minWords || question.maxWords
            ? createElement('p', {
                className: 'small muted',
                text: `Gợi ý độ dài: ${question.minWords || 0}–${question.maxWords || 'không giới hạn'} từ.`
            })
            : null
    ].filter(Boolean) });
}

/** Nạp và hiển thị câu hỏi theo bộ lọc. */
async function loadQuestions() {
    const grade = Number(gradeSelect.value) || undefined;
    const subjectId = subjectSelect.value || undefined;
    const type = typeSelect.value || undefined;
    const lessonId = queryParam('lessonId') || undefined;

    root.setAttribute('aria-busy', 'true');
    render(root, message('Đang tải câu hỏi…', 'info'));

    try {
        const questions = await studentApi.getPracticeQuestions({ grade, subjectId, type, lessonId });

        if (!questions.length) {
            render(root, message('Chưa có câu hỏi nào phù hợp với bộ lọc này.', 'info'));
            return;
        }

        render(root,
            createElement('p', { className: 'small muted', text: `Có ${questions.length} câu hỏi.` }),
            createElement('div', { className: 'stack', children: questions.map(questionCard) })
        );
    } catch (error) {
        render(root, message(error.message || 'Không tải được câu hỏi.', 'error'));
    } finally {
        root.setAttribute('aria-busy', 'false');
    }
}

/** Nạp danh sách môn theo lớp đang chọn. */
async function loadSubjects(grade) {
    if (!grade) return;
    try {
        const subjects = await studentApi.getSubjects(grade);
        render(subjectSelect,
            createElement('option', { text: 'Tất cả môn', attrs: { value: '' } }),
            ...subjects.map(subject => createElement('option', {
                text: subject.displayName,
                attrs: { value: subject.subjectId }
            }))
        );
    } catch {
        render(subjectSelect, createElement('option', { text: 'Tất cả môn', attrs: { value: '' } }));
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireUser();
    if (!user) return;

    renderShell({
        user,
        menu: STUDENT_MENU,
        onLogout: async () => {
            await authApi.logout();
            window.location.href = '/auth/login.html';
        }
    });

    render(typeSelect,
        createElement('option', { text: 'Tất cả dạng', attrs: { value: '' } }),
        ...QUESTION_TYPES.map(type => createElement('option', {
            text: questionTypeLabel(type),
            attrs: { value: type }
        }))
    );

    const grades = await studentApi.getGrades();
    const grade = Number(queryParam('grade')) || Number(user.grade) || grades[0]?.grade;

    render(gradeSelect, ...grades.map(item => createElement('option', {
        text: item.gradeName || `Lớp ${item.grade}`,
        attrs: { value: item.grade, selected: item.grade === grade }
    })));

    await loadSubjects(grade);
    await loadQuestions();

    gradeSelect.addEventListener('change', async () => {
        await loadSubjects(Number(gradeSelect.value));
        loadQuestions();
    });
    subjectSelect.addEventListener('change', loadQuestions);
    document.getElementById('btn-load').addEventListener('click', loadQuestions);
});
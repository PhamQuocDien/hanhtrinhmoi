/**
 * DỰNG GIAO DIỆN CHO TỪNG LOẠI CÂU HỎI.
 *
 * Yêu cầu bắt buộc: mỗi loại câu phải có giao diện RIÊNG, không dùng chung
 * một form cho tất cả:
 *   single_choice   -> radio
 *   multiple_choice -> checkbox
 *   true_false      -> hai nút Đúng / Sai (hoặc radio nếu nhiều ý)
 *   fill_blank      -> input cho từng ô trống
 *   short_answer    -> input ngắn hoặc textarea tuỳ độ dài
 *   numeric         -> input số
 *   essay           -> textarea lớn kèm đếm số từ
 *
 * Bảo mật: module này KHÔNG BAO GIỜ nhận hay hiển thị đáp án đúng.
 * Nó chỉ gom câu trả lời và trả về cho `collectAnswers()`.
 */

import { createElement } from '../core/dom.js';

/** Nhãn ký hiệu đếm số từ (tiếng Việt xấp xỉ theo khoảng trắng). */
function countWords(text) {
    const trimmed = String(text || '').trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Danh sách lựa chọn A-D dùng chung cho hai loại trắc nghiệm. */
function buildOptionList(question, { inputType }) {
    const list = createElement('div', { className: 'options', attrs: { role: inputType === 'radio' ? 'radiogroup' : 'group' } });

    for (const option of question.options || []) {
        const inputId = `${question.questionId}-${option.label}`;
        const input = createElement('input', {
            attrs: { type: inputType, name: question.questionId, id: inputId, value: option.label }
        });

        list.append(createElement('div', { className: 'option', children: [
            input,
            createElement('label', {
                className: 'option-label',
                attrs: { for: inputId },
                children: [
                    createElement('span', { className: 'option-key', text: option.label }),
                    createElement('span', { className: 'option-text', text: option.text })
                ]
            })
        ] }));
    }

    return list;
}

/** Câu trắc nghiệm một đáp án -> radio. */
function renderSingleChoice(question) {
    return createElement('div', { className: 'answer answer-single-choice', children: [
        buildOptionList(question, { inputType: 'radio' })
    ] });
}

/** Câu trắc nghiệm nhiều đáp án -> checkbox, có nút bỏ chọn tất cả. */
function renderMultipleChoice(question) {
    const wrapper = createElement('div', { className: 'answer answer-multiple-choice', children: [
        createElement('p', {
            className: 'answer-hint',
            text: 'Chọn nhiều đáp án đúng.'
        }),
        buildOptionList(question, { inputType: 'checkbox' })
    ] });

    const clearButton = createElement('button', {
        className: 'btn btn-ghost',
        text: 'Bỏ chọn tất cả',
        attrs: { type: 'button' }
    });
    clearButton.addEventListener('click', () => {
        wrapper.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.checked = false;
        });
    });
    wrapper.querySelector('.answer-hint').after(clearButton);

    return wrapper;
}

/**
 * Câu Đúng/Sai.
 *   - Dạng đơn: hai nút lớn "Đúng" / "Sai" dễ bấm trên điện thoại.
 *   - Dạng nhiều ý: mỗi ý một cặp nút, điểm chia theo máy chấm.
 */
function renderTrueFalse(question) {
    const statements = question.statements || [];
    const wrapper = createElement('div', { className: 'answer answer-true-false' });

    if (!statements.length) {
        // Dạng đơn: một cặp nút cho cả câu.
        const group = createElement('div', { className: 'tf-group', attrs: { 'data-question': question.questionId } });
        for (const [value, label] of [[true, 'Đúng'], [false, 'Sai']]) {
            group.append(createElement('button', {
                className: 'btn btn-tf',
                text: label,
                attrs: {
                    type: 'button',
                    'data-value': String(value),
                    'aria-pressed': 'false'
                }
            }));
        }
        wrapper.append(group);
        return wrapper;
    }

    wrapper.append(createElement('p', { className: 'answer-hint', text: 'Chọn Đúng hoặc Sai cho từng ý.' }));

    for (const statement of statements) {
        const group = createElement('div', {
            className: 'tf-group',
            attrs: { 'data-statement': statement.statementId }
        });
        group.append(createElement('p', { className: 'tf-text', text: statement.text }));

        const buttons = createElement('div', { className: 'tf-buttons' });
        for (const [value, label] of [[true, 'Đúng'], [false, 'Sai']]) {
            buttons.append(createElement('button', {
                className: 'btn btn-tf',
                text: label,
                attrs: { type: 'button', 'data-value': String(value), 'aria-pressed': 'false' }
            }));
        }
        group.append(buttons);
        wrapper.append(group);
    }

    return wrapper;
}

/**
 * Câu điền khuyết.
 *
 * Nội dung câu có thể chứa placeholder `[[blank-1]]` (do DOCX import thay dấu ô
 * trống). Ta thay placeholder bằng ô input thật để học sinh gõ đúng chỗ.
 */
function renderFillBlank(question) {
    const wrapper = createElement('div', { className: 'answer answer-fill-blank' });
    const blanks = question.blanks || [];
    const inputById = new Map();

    const text = String(question.questionText || '');
    const hasPlaceholder = /\[\[blank-\d+\]\]/.test(text);

    for (const blank of blanks) {
        const input = createElement('input', {
            className: 'blank-input',
            attrs: {
                type: 'text',
                id: `${question.questionId}-${blank.blankId}`,
                'data-blank': blank.blankId,
                placeholder: blank.hint || `Ô ${blank.position || ''}`.trim(),
                autocomplete: 'off'
            }
        });
        inputById.set(blank.blankId, input);
    }

    if (hasPlaceholder) {
        // Tách nội dung quanh placeholder và dựng lại xen kẽ input.
        const parts = text.split(/(\[\[blank-\d+\]\])/g);
        const line = createElement('p', { className: 'fill-line' });

        for (const part of parts) {
            const match = part.match(/^\[\[blank-(\d+)\]\]$/);
            if (!match) {
                if (part) line.append(document.createTextNode(part));
                continue;
            }
            const blankId = `blank-${match[1]}`;
            line.append(inputById.get(blankId) || createElement('span', { className: 'blank-missing', text: '____' }));
        }
        wrapper.append(line);
    }

    // Ô không nằm trong nội dung (nhập tay) -> vẫn hiển thị để không bị bỏ sót.
    const inlineCount = (text.match(/\[\[blank-\d+\]\]/g) || []).length;
    if (!hasPlaceholder || inlineCount < blanks.length) {
        const extra = createElement('div', { className: 'fill-extra' });
        for (const blank of blanks) {
            if (hasPlaceholder && text.includes(`[[${blank.blankId}]]`)) continue;
            extra.append(createElement('label', {
                className: 'fill-extra-item',
                children: [
                    createElement('span', { text: `Ô ${blank.position || blanks.indexOf(blank) + 1}:` }),
                    inputById.get(blank.blankId)
                ]
            }));
        }
        if (extra.children.length) wrapper.append(extra);
    }

    return wrapper;
}

/**
 * Câu trả lời ngắn.
 *
 * Dùng `input` cho câu ngắn (một dòng) và `textarea` khi câu cần nhiều chữ.
 * Không giới hạn về một từ — học sinh có thể trả lời "2, 3, 5, 7".
 */
function renderShortAnswer(question) {
    const useTextarea = /nêu.*(là các|tất cả)|liệt kê|so sánh|giải thích/i
        .test(String(question.questionText || ''));
    const input = useTextarea
        ? createElement('textarea', {
            className: 'short-answer-input',
            attrs: { id: question.questionId, rows: 3, 'data-question': question.questionId }
        })
        : createElement('input', {
            className: 'short-answer-input',
            attrs: { type: 'text', id: question.questionId, 'data-question': question.questionId, autocomplete: 'off' }
        });

    return createElement('div', { className: 'answer answer-short-answer', children: [input] });
}

/** Câu số -> input số, có gợi ý đơn vị nếu câu khai báo. */
function renderNumeric(question) {
    const input = createElement('input', {
        className: 'numeric-input',
        attrs: {
            type: 'text',
            inputmode: 'decimal',
            id: question.questionId,
            'data-question': question.questionId,
            autocomplete: 'off'
        }
    });

    const children = [input];
    if (question.unit) {
        children.push(createElement('span', { className: 'numeric-unit', text: question.unit }));
    }

    return createElement('div', { className: 'answer answer-numeric', children });
}

/**
 * Câu tự luận -> textarea lớn, kèm đếm số từ / ký tự và cảnh báo nếu vượt
 * min/maxWords do giáo viên đặt. Việc kiểm tra độ dài CHỈ để gợi ý —
 * quyền quyết định đạt/không đạt thuộc về người chấm, không phải máy.
 */
function renderEssay(question) {
    const textarea = createElement('textarea', {
        className: 'essay-input',
        attrs: {
            id: question.questionId,
            rows: 12,
            'data-question': question.questionId,
            placeholder: 'Viết câu trả lời của bạn tại đây…'
        }
    });

    const wordCount = createElement('span', { className: 'count-words', text: '0 từ' });
    const charCount = createElement('span', { className: 'count-chars', text: '0 ký tự' });
    const warning = createElement('p', { className: 'essay-warning' });

    const min = Number(question.minWords) || 0;
    const max = Number(question.maxWords) || 0;

    const update = () => {
        const words = countWords(textarea.value);
        wordCount.textContent = max ? `${words}/${max} từ` : `${words} từ`;
        charCount.textContent = `${textarea.value.length} ký tự`;

        if (!words) {
            warning.textContent = '';
        } else if (min && words < min) {
            warning.textContent = `Bài còn ngắn hơn tối thiểu (${words}/${min} từ).`;
        } else if (max && words > max) {
            warning.textContent = `Bài dài hơn tối đa (${words}/${max} từ).`;
        } else {
            warning.textContent = '';
        }
    };

    textarea.addEventListener('input', update);
    update();

    return createElement('div', { className: 'answer answer-essay', children: [
        textarea,
        createElement('div', { className: 'essay-counter', children: [wordCount, charCount] }),
        warning,
        createElement('p', { className: 'essay-note', text: 'Bài này sẽ được giáo viên chấm tay.' })
    ] });
}

/** Bảng tra cứu renderer theo loại câu. */
const RENDERERS = Object.freeze({
    single_choice: renderSingleChoice,
    multiple_choice: renderMultipleChoice,
    true_false: renderTrueFalse,
    fill_blank: renderFillBlank,
    short_answer: renderShortAnswer,
    numeric: renderNumeric,
    essay: renderEssay
});

/** Loại câu có giao diện riêng trong module này. */
export const SUPPORTED_TYPES = Object.keys(RENDERERS);

/** Có phải loại câu mà module này biết dựng không. */
export function canRender(type) {
    return Object.prototype.hasOwnProperty.call(RENDERERS, type);
}

/**
 * Dựng phần trả lời cho một câu.
 * Loại lạ -> hiện thông báo "giao diện chưa hỗ trợ" thay vì im lặng.
 */
export function renderAnswer(question) {
    const renderer = RENDERERS[question?.type];
    if (!renderer) {
        return createElement('div', {
            className: 'answer answer-unsupported',
            text: `Giao diện chưa hỗ trợ loại câu "${question?.type || 'không rõ'}". Vui lòng báo cho quản trị viên.`
        });
    }
    return renderer(question);
}

/**
 * Gom câu trả lời từ DOM theo đúng hình dạng mà máy chủ mong đợi.
 *
 *   single_choice   -> "B"
 *   multiple_choice -> ["A", "C"]
 *   true_false      -> true | false | { "s-01": true, ... }
 *   fill_blank      -> { "blank-1": "Hà Nội" }
 *   short_answer    -> "..."
 *   numeric         -> "15" (giữ chuỗi để không mất dấu phẩy thập phân kiểu VN)
 *   essay           -> "..."
 *
 * @param {HTMLElement} root     phần tử chứa các câu hỏi
 * @param {Array} questions      danh sách câu để biết cần đọc loại nào
 * @returns {object} map { questionId: đáp án }
 */
export function collectAnswers(root, questions = []) {
    const answers = {};

    for (const question of questions) {
        const questionId = question.questionId;
        const safeId = CSS.escape(questionId);

        switch (question.type) {
            case 'single_choice': {
                const checked = root.querySelector(`input[name="${safeId}"]:checked`);
                if (checked) answers[questionId] = checked.value;
                break;
            }

            case 'multiple_choice': {
                const checked = [...root.querySelectorAll(`input[name="${safeId}"]:checked`)];
                if (checked.length) {
                    // Sắp xếp để thứ tự bấm không ảnh hưởng việc so khớp.
                    answers[questionId] = checked.map(input => input.value).sort();
                }
                break;
            }

            case 'true_false': {
                const group = root.querySelector(`.tf-group[data-question="${safeId}"]`);
                if (group) {
                    // Dạng đơn: nút đang được chọn -> boolean.
                    const active = group.querySelector('.btn-tf[aria-pressed="true"]');
                    if (active) answers[questionId] = active.dataset.value === 'true';
                    break;
                }
                // Dạng nhiều ý: gom từng cặp nút theo statementId.
                const statements = question.statements || [];
                if (!statements.length) break;
                const result = {};
                for (const statement of statements) {
                    const statementGroup = root.querySelector(
                        `.tf-group[data-statement="${CSS.escape(statement.statementId)}"]`
                    );
                    const active = statementGroup?.querySelector('.btn-tf[aria-pressed="true"]');
                    if (active) result[statement.statementId] = active.dataset.value === 'true';
                }
                if (Object.keys(result).length) answers[questionId] = result;
                break;
            }

            case 'fill_blank': {
                // Chỉ lấy ô thuộc câu này: mỗi câu được bọc trong [data-question-id].
                const scope = root.querySelector(`[data-question-id="${safeId}"]`) || root;
                const result = {};
                let hasValue = false;
                for (const input of scope.querySelectorAll('input[data-blank]')) {
                    result[input.dataset.blank] = input.value;
                    if (input.value.trim()) hasValue = true;
                }
                if (hasValue) answers[questionId] = result;
                break;
            }

            case 'short_answer':
            case 'numeric':
            case 'essay': {
                const input = root.querySelector(`[data-question="${safeId}"]`);
                const value = input?.value?.trim();
                if (value) answers[questionId] = value;
                break;
            }

            default:
                break;
        }
    }

    return answers;
}

/** Gắn sự kiện chọn/bỏ chọn cho nút Đúng/Sai (đổi trạng thái aria-pressed). */
export function bindTrueFalseButtons(root) {
    for (const group of root.querySelectorAll('.tf-buttons, .tf-group[data-question]')) {
        group.addEventListener('click', event => {
            const target = event.target.closest('.btn-tf');
            if (!target) return;
            // Chỉ một nút trong mỗi nhóm ở trạng thái đang chọn.
            for (const other of group.querySelectorAll('.btn-tf')) {
                other.setAttribute('aria-pressed', String(other === target));
            }
        });
    }
}

/**
 * Điền lại câu trả lời đã lưu nháp, dùng khi học sinh tải lại trang.
 *
 * Hàm này chỉ khôi phục DỮ LIỆU NGƯỜI DÙNG đã nhập. Nó không liên can gì tới
 * đáp án đúng — nháp lưu ở máy chủ theo attemptId, không chứa khoá đáp án.
 */
export function restoreAnswers(root, questions, answers) {
    for (const question of questions) {
        const value = answers?.[question.questionId];
        if (value === undefined || value === null) continue;
        const safeId = CSS.escape(question.questionId);

        switch (question.type) {
            case 'single_choice':
            case 'multiple_choice': {
                const selected = Array.isArray(value) ? value : [value];
                for (const input of root.querySelectorAll(`input[name="${safeId}"]`)) {
                    input.checked = selected.includes(input.value);
                }
                break;
            }

            case 'true_false': {
                if (typeof value === 'boolean') {
                    const group = root.querySelector(`.tf-group[data-question="${safeId}"]`);
                    const target = group?.querySelector(`.btn-tf[data-value="${value}"]`);
                    if (target) target.setAttribute('aria-pressed', 'true');
                    break;
                }
                if (value && typeof value === 'object') {
                    for (const [statementId, answer] of Object.entries(value)) {
                        const group = root.querySelector(
                            `.tf-group[data-statement="${CSS.escape(statementId)}"]`
                        );
                        const target = group?.querySelector(`.btn-tf[data-value="${answer}"]`);
                        if (target) target.setAttribute('aria-pressed', 'true');
                    }
                }
                break;
            }

            case 'fill_blank': {
                const scope = root.querySelector(`[data-question-id="${safeId}"]`) || root;
                for (const [blankId, answer] of Object.entries(value)) {
                    const input = scope.querySelector(`input[data-blank="${CSS.escape(blankId)}"]`);
                    if (input) input.value = answer;
                }
                break;
            }

            case 'short_answer':
            case 'numeric':
            case 'essay': {
                const input = root.querySelector(`[data-question="${safeId}"]`);
                if (input) {
                    input.value = value;
                    // Kích hoạt sự kiện input để cập nhật bộ đếm số từ.
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
                break;
            }

            default:
                break;
        }
    }
}
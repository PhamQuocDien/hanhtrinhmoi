/**
 * TRANG CHỦ — dựng header, bộ chọn lớp và luồng chọn chương trình.
 *
 * Trang này chỉ gọi các API chương trình từng bước khi người dùng chọn, nên mở
 * trang rất nhanh: ban đầu chỉ có 12 dòng lớp.
 */

import { render, formatNumber } from '../core/dom.js';
import { initHeader } from './app-header.js';
import { renderGradePicker, gradePickerHeading } from './grade-picker.js';
import { CurriculumPicker } from './curriculum-picker.js';
import { getGrades, getSubjects, getTextbookSeries, getTextbooks, getChapters, lessonHref } from '../student/curriculum.service.js';
import { studentApi } from '../core/api.js';

const pickerHost = document.getElementById('curriculum-picker');
const noteBox = document.getElementById('curriculum-note');

/** Dịch vụ chương trình mà bộ chọn dùng. */
const service = {
    getSubjects,
    getTextbookSeries,
    getTextbooks,
    getChapters,
    lessonHref
};

/**
 * Khởi tạo trang.
 *
 * @returns {Promise<void>}
 */
async function main() {
    await initHeader();

    // Bộ chọn các bước sau lớp: môn → bộ sách → sách → chương → bài.
    const steps = new CurriculumPicker(document.createElement('div'), service);
    pickerHost.append(steps.host);

    // Bước đầu tiên: chọn lớp. Chọn xong sẽ mở tiếp bước "chọn môn".
    const grades = await getGrades().catch(() => []);
    const gradeSection = document.createElement('section');
    gradeSection.className = 'picker';
    gradeSection.append(gradePickerHeading(grades.length || null));
    const gradeGrid = document.createElement('div');
    gradeSection.append(gradeGrid);
    pickerHost.prepend(gradeSection);

    await renderGradePicker(
        gradeGrid,
        () => getGrades(),
        chosen => {
            gradeSection.hidden = true;
            steps.loadSubjects(chosen);
            // Đưa người học tới phần môn học sau khi chọn lớp.
            steps.sections.subject.root.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    );

    // Ghi chú trạng thái xác minh của dữ liệu chương trình.
    try {
        const overview = await studentApi.getOverview();
        if (overview) {
            noteBox.textContent = `Chương trình ${overview.curriculumVersion || ''} · `
                + `${formatNumber(overview.subjectCount)} môn, ${formatNumber(overview.lessonCount)} bài học. `
                + 'Dữ liệu chưa đối chiếu xong với nguồn chính thức nên được đánh dấu “đang xác minh”.';
        }
    } catch (error) {
        noteBox.textContent = '';
    }
}

main();
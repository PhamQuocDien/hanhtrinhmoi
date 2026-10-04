/**
 * BỘ CHỌN CHƯƠNG TRÌNH — luồng môn → bộ sách → sách → chương → bài.
 *
 * Mỗi bước là một `section` riêng, ẩn/hiện theo lựa chọn trước đó. Bước chọn lớp
 * do `grade-picker.js` đảm nhiệm trước khi khởi tạo thành phần này.
 *
 * Nguyên tắc quan trọng:
 *   - Danh sách bộ sách lấy ĐỘNG từ API (`curriculumService.getTextbookSeries`).
 *     Không có `if (subject === 'Toán') { show ... }` trong tệp này. Thêm bộ
 *     sách mới ở dữ liệu là giao diện tự hiện, không phải sửa mã.
 *   - Bộ sách chưa có đầu sách vẫn hiện, kèm nhãn "chưa có đầu sách" — không bịa.
 */

import { createElement, render } from '../core/dom.js';
import { emptyState, errorState, loadingText, notice } from './ui-states.js';
import {
    chapterCard,
    groupSubjectsByStatus,
    lessonCard,
    seriesCard,
    subjectCard,
    textbookCard
} from './picker-cards.js';

/** Thứ tự các bước trong luồng. */
const STEPS = ['subject', 'series', 'book', 'chapter', 'lesson'];

/** Tiêu đề và mô tả từng bước. */
const STEP_LABELS = {
    subject: ['Chọn môn học', 'Chọn môn học bạn muốn học trong lớp này.'],
    series: ['Chọn bộ sách', 'Mỗi môn có thể dùng nhiều bộ sách. Chọn bộ sách đang dùng tại trường.'],
    book: ['Chọn sách giáo khoa', 'Chọn đầu sách để xem chương và bài học.'],
    chapter: ['Chọn chương', 'Chọn chương để xem các bài học bên trong.'],
    lesson: ['Chọn bài học', 'Chọn bài học để bắt đầu học.']
};

/**
 * Bộ chọn nhiều bước.
 *
 * `context` là nguồn sự thật duy nhất cho lớp/môn/bộ sách đang chọn; mỗi bước
 * dựng lại danh sách từ dữ liệu mới nhận thay vì sửa DOM tại chỗ.
 */
export class CurriculumPicker {
    /**
     * @param {HTMLElement} host phần tử chứa
     * @param {object} service curriculumService
     */
    constructor(host, service) {
        this.host = host;
        this.service = service;
        this.context = { grade: null, subjectId: null, seriesId: null };
        this.sections = {};
        this.buildShell();
    }

    /** Dựng khung các bước, tất cả đều ẩn trước khi có dữ liệu. */
    buildShell() {
        render(this.host, ...STEPS.map(key => {
            const [title, subtext] = STEP_LABELS[key];
            const body = createElement('div', { className: 'picker-body' });
            const root = createElement('section', {
                className: 'picker',
                attrs: { 'data-step': key, hidden: true },
                children: [
                    createElement('div', { className: 'picker-header', children: [
                        createElement('h2', { className: 'picker-title', text: title }),
                        createElement('p', { className: 'picker-subtext', text: subtext })
                    ] }),
                    body
                ]
            });
            this.sections[key] = { root, body };
            return root;
        }));
    }

    /** Hiện hoặc ẩn một bước. */
    show(key, visible) {
        if (this.sections[key]) this.sections[key].root.hidden = !visible;
    }

    /** Ẩn mọi bước từ `key` trở đi và xoá nội dung cũ. */
    resetFrom(key) {
        for (const name of STEPS.slice(STEPS.indexOf(key))) {
            this.show(name, false);
            render(this.sections[name].body);
        }
    }

    /**
     * Nạp danh sách môn của một lớp rồi hiện bước "chọn môn".
     *
     * @param {number|object} grade lớp hoặc đối tượng lớp từ bộ chọn lớp
     */
    async loadSubjects(grade) {
        const gradeNumber = typeof grade === 'number' ? grade : grade.grade;
        this.context = { grade: gradeNumber, subjectId: null, seriesId: null };
        this.resetFrom('subject');

        const { body } = this.sections.subject;
        render(body, loadingText('Đang tải danh sách môn học…'));
        this.show('subject', true);

        try {
            const subjects = await this.service.getSubjects(gradeNumber);
            if (!subjects.length) {
                render(body, emptyState('Chưa có dữ liệu chương trình cho lớp này',
                    'Dữ liệu môn học của lớp đang được bổ sung. Hãy thử lại sau.'));
                return;
            }
            render(body, ...[...groupSubjectsByStatus(subjects)].map(([label, items]) => (
                createElement('div', { className: 'picker-group', children: [
                    createElement('h3', { className: 'picker-group-title', text: label }),
                    createElement('div', { className: 'grid', children: items.map(subject => (
                        subjectCard(subject, chosen => this.selectSubject(chosen, gradeNumber))
                    )) })
                ] })
            )));
        } catch (error) {
            render(body, errorState('Không thể tải danh sách môn học. Vui lòng thử lại.',
                () => this.loadSubjects(grade)));
        }
    }
/** Chọn môn → tải danh sách bộ sách của môn đó. */
    async selectSubject(subject, grade) {
        this.context = { ...this.context, subjectId: subject.subjectId, seriesId: null };
        this.resetFrom('series');
        this.show('subject', false);

        const { body } = this.sections.series;
        render(body, loadingText('Đang tải bộ sách…'));
        this.show('series', true);

        try {
            const series = await this.service.getTextbookSeries(grade, subject.subjectId);
            this.renderSeries(series, subject, grade);
        } catch (error) {
            render(body, errorState('Không thể tải danh sách bộ sách. Vui lòng thử lại.',
                () => this.selectSubject(subject, grade)));
        }
    }

    /**
     * Dựng bước chọn bộ sách.
     *
     * Danh sách đến hoàn toàn từ dữ liệu: một môn có 1 hay nhiều bộ sách đều hiện
     * đúng, không cần sửa giao diện.
     */
    renderSeries(series, subject, grade) {
        const { body } = this.sections.series;

        if (!series.length) {
            render(body, emptyState('Chưa có dữ liệu bộ sách',
                `Chưa có thông tin bộ sách cho môn ${subject.displayName} ở lớp này.`));
            return;
        }

        const pending = series.filter(item => item.textbookCount === 0);

        render(body,
            createElement('div', { className: 'grid', children: series.map(item => (
                seriesCard(item, chosen => this.selectSeries(chosen, subject, grade))
            )) }),
            pending.length
                ? notice(`${pending.length} bộ sách chưa có đầu sách trong hệ thống. `
                    + 'Thông tin đang được đối chiếu với nguồn phát hành chính thống.')
                : null,
            series.every(item => item.textbookCount === 0)
                ? emptyState('Chưa có đầu sách để mở',
                    'Các bộ sách của môn này chưa được nhập vào hệ thống.')
                : null
        );
    }

    /** Chọn bộ sách → tải đầu sách. */
    async selectSeries(series, subject, grade) {
        this.context = { ...this.context, seriesId: series.seriesId };
        this.resetFrom('book');
        this.show('series', false);

        const { body } = this.sections.book;
        render(body, loadingText('Đang tải sách giáo khoa…'));
        this.show('book', true);

        try {
            const books = await this.service.getTextbooks(grade, subject.subjectId, series.seriesId);
            if (!books.length) {
                render(body, emptyState('Chưa có đầu sách',
                    `Bộ sách "${series.seriesName}" chưa có đầu sách cho môn này ở lớp ${grade}.`));
                return;
            }
            render(body, createElement('div', { className: 'grid', children: books.map(book => (
                textbookCard(book, series, chosen => this.selectBook(chosen, series, subject, grade))
            )) }));
        } catch (error) {
            render(body, errorState('Không thể tải đầu sách. Vui lòng thử lại.',
                () => this.selectSeries(series, subject, grade)));
        }
    }

/** Chọn đầu sách → tải chương. */
    async selectBook(book, series, subject, grade) {
        this.resetFrom('chapter');
        this.show('book', false);

        const { body } = this.sections.chapter;
        render(body, loadingText('Đang tải danh sách chương…'));
        this.show('chapter', true);

        try {
            const result = await this.service.getChapters(grade, subject.subjectId, series.seriesId);
            this.renderChapters(result, series);
        } catch (error) {
            render(body, errorState('Không thể tải danh sách chương. Vui lòng thử lại.',
                () => this.selectBook(book, series, subject, grade)));
        }
    }

    /**
     * Dựng danh sách chương.
     *
     * Khi đầu sách chưa có dữ liệu, hiện trạng thái rỗng và nói rõ đang chờ — KHÔNG
     * bịa tên chương.
     */
    renderChapters(result, series) {
        const { body } = this.sections.chapter;

        if (!result?.hasContent || !result.chapters?.length) {
            render(body, emptyState('Chưa có dữ liệu chương',
                `Sách "${result?.textbook?.officialTitle || series.seriesName}" chưa có danh sách chương. `
                + 'Nội dung đang được bổ sung.'));
            return;
        }

        render(body, createElement('div', { className: 'grid', children: result.chapters.map(chapter => (
            chapterCard(chapter, chosen => this.selectChapter(chosen, series))
        )) }));
    }

    /** Chọn chương → hiện danh sách bài học kèm liên kết mở bài. */
    selectChapter(chapter, series) {
        this.show('chapter', false);
        const { body } = this.sections.lesson;

        if (!chapter.lessons?.length) {
            render(body, emptyState('Chưa có bài học',
                `Chương "${chapter.displayTitle}" chưa có bài học.`));
            this.show('lesson', true);
            return;
        }

        render(body, createElement('div', { className: 'grid', children: chapter.lessons.map(lesson => (
            lessonCard(lesson, this.service.lessonHref(this.context, lesson.lessonId))
        )) }));
        this.show('lesson', true);
    }
}

export default CurriculumPicker;
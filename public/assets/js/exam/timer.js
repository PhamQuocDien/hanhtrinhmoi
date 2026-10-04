/**
 * BỘ ĐẾM THỜI GIAN LÀM BÀI.
 *
 * Nguyên tắc bất di bất dịch: thời gian TÍNH TỪ THỜI ĐIỂM MÁY CHỦ BẮT ĐẦU.
 * Đồng hồ trình duyệt chỉ hiển thị; nếu người dùng sửa đồng hồ máy thì máy chủ
 * vẫn chấm đúng theo thời gian thật.
 */
export class ExamTimer {
    /**
     * @param {number} durationSeconds thời lượng cho phép
     * @param {object} handlers { onTick(remaining), onExpire() }
     */
    constructor(durationSeconds, { onTick, onExpire } = {}) {
        this.duration = Math.max(0, Number(durationSeconds) || 0);
        // Mốc thời gian máy chủ: nguồn sự thật duy nhất.
        this.deadline = Date.now() + this.duration * 1000;
        this.onTick = onTick;
        this.onExpire = onExpire;
        this.expired = false;
        this.intervalId = null;
    }

    /** Số giây còn lại, luôn không âm. */
    get remaining() {
        return Math.max(0, Math.round((this.deadline - Date.now()) / 1000));
    }

    /** Bắt đầu đếm. */
    start() {
        if (this.intervalId) return this;
        // Cập nhật mỗi giây; đồng hồ người dùng chỉ là phép hiển thị.
        this.intervalId = setInterval(() => {
            const remaining = this.remaining;
            this.onTick?.(remaining);
            if (remaining <= 0) this.expire();
        }, 1000);
        this.onTick?.(this.remaining);
        return this;
    }

    /** Hết giờ: báo một lần rồi dừng. */
    expire() {
        if (this.expired) return;
        this.expired = true;
        this.stop();
        this.onExpire?.();
    }

    /** Dừng đếm (khi nộp bài hoặc rời trang). */
    stop() {
        if (!this.intervalId) return;
        clearInterval(this.intervalId);
        this.intervalId = null;
    }

    /** Điều chỉnh mốc thời gian theo số giây còn lại do máy chủ báo về. */
    sync(remainingSeconds) {
        const remaining = Math.max(0, Number(remainingSeconds) || 0);
        this.deadline = Date.now() + remaining * 1000;
        this.onTick?.(this.remaining);
        return this;
    }
}

/**
 * LƯU NHÁP TỰ ĐỘNG.
 *
 * Học sinh có thể tải lại trang hoặc rơi mạng mà không mất bài làm.
 * Nháp chỉ chứa câu trả lời của học sinh, lưu ở máy chủ theo attemptId —
 * không có đáp án đúng, không có điểm.
 */
export class AutosaveManager {
    /**
     * @param {object} options { attemptId, answers, api, intervalMs, onSaved, onError }
     */
    constructor({ attemptId, getAnswers, api, intervalMs = 15000, onSaved, onError }) {
        this.attemptId = attemptId;
        this.getAnswers = getAnswers;
        this.api = api;
        this.intervalMs = intervalMs;
        this.onSaved = onSaved;
        this.onError = onError;
        this.timerId = null;
        this.saving = false;
        this.dirty = false;
    }

    /** Đánh dấu có thay đổi -> lần lưu kế tiếp sẽ gửi lên. */
    markDirty() {
        this.dirty = true;
    }

    /** Bắt đầu lưu định kỳ. */
    start() {
        if (this.timerId) return this;
        this.timerId = setInterval(() => {
            if (this.dirty) this.flush();
        }, this.intervalMs);
        return this;
    }

    /** Dừng lưu định kỳ. */
    stop() {
        if (!this.timerId) return;
        clearInterval(this.timerId);
        this.timerId = null;
    }

    /**
     * Gửi nháp lên máy chủ ngay.
     * Không gửi nếu đang lưu hoặc không có thay đổi.
     */
    async flush() {
        if (this.saving || !this.dirty) return null;
        this.saving = true;
        this.dirty = false;

        try {
            const result = await this.api.saveAnswers(this.attemptId, this.getAnswers());
            this.onSaved?.(result);
            return result;
        } catch (error) {
            // Giữ cờ dirty để thử lại ở lần kế tiếp thay vì mất bài làm.
            this.dirty = true;
            this.onError?.(error);
            return null;
        } finally {
            this.saving = false;
        }
    }

    /**
     * Cảnh báo trước khi rời trang nếu còn thay đổi chưa lưu.
     * Trả về hàm gỡ sự kiện để trang khác dùng lại được.
     */
    guardBeforeUnload() {
        const handler = event => {
            if (!this.dirty) return;
            // Không thể gọi fetch trong sự kiện unload -> chỉ cảnh báo.
            event.preventDefault();
            event.returnValue = 'Bài làm chưa được lưu. Bạn có chắc muốn rời trang?';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }
}

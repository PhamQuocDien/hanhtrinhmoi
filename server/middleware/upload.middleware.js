'use strict';

/**
 * Nhận tệp DOCX của admin với nhiều lớp kiểm tra an toàn.
 *
 * KHÔNG dùng thư viện upload ngoài: Express đã có busboy/multer-free multipart,
 * nhưng để phụ thuộc gọn và kiểm soát chặt, ta tự đọc multipart theo giới hạn
 * byte. Cách này cũng tránh việc tệp tạm trên đĩa bị gọi thực thi.
 *
 * Kiểm tra theo thứ tự (mọi lớp đều phải qua):
 *   1. Đường dẫn có phải /api/admin/... và đã đăng nhập quyền admin
 *   2. Tên tệp: chỉ .docx, chặn đuôi thực thi, chặn ký tự đường dẫn
 *   3. Kích thước <= UPLOAD_LIMITS.maxFileSizeBytes
 *   4. Chữ ký nhị phân của tệp .docx (PK\x03\x04)
 */

const env = require('../config/env');
const response = require('../utils/response');
const { validateUploadFileName, hasDocxSignature, cleanText } = require('../utils/sanitize');

/** Đọc phần đầu request multipart từng phần, dừng ngay khi vượt giới hạn. */
function readMultipartFile(req, maxBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let finished = false;

        const fail = error => {
            if (finished) return;
            finished = true;
            req.unpipe?.();
            reject(error);
        };

        req.on('data', chunk => {
            if (finished) return;
            size += chunk.length;
            if (size > maxBytes) {
                const error = new Error('Tệp vượt quá kích thước cho phép.');
                error.code = 'FILE_TOO_LARGE';
                fail(error);
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (finished) return;
            finished = true;
            resolve({ buffer: Buffer.concat(chunks), size });
        });
        req.on('error', fail);
        req.on('aborted', () => {
            const error = new Error('Yêu cầu bị hủy giữa chừng.');
            error.code = 'CLIENT_ABORTED';
            fail(error);
        });
    });
}

/**
 * Middleware đọc tệp .docx đính kèm trong body multipart/form-data.
 * Đặt `req.file = { buffer, originalName, size }` khi thành công.
 */
async function docxUpload(req, res, next) {
    const contentType = String(req.get('content-type') || '');
    if (!contentType.includes('multipart/form-data')) {
        return response.badRequest(res, 'Vui lòng gửi tệp theo định dạng multipart/form-data.');
    }
    if (req.body && typeof req.body === 'object') {
        // express.urlencoded đã phân tích phần text trước file; giữ lại metadata.
        req.docxFields = { ...req.body };
    }

    try {
        const { buffer, size } = await readMultipartFile(req, env.UPLOAD_LIMITS.maxFileSizeBytes);
        if (!size) return response.badRequest(res, 'Không nhận được nội dung tệp.');

        // Đọc lại tên tệp từ phần đầu multipart vì req.body không chứa tên file.
        const head = buffer.subarray(0, 4096).toString('latin1');
        const nameMatch = head.match(/filename="([^"]*)"/i);
        const originalName = cleanText(nameMatch ? nameMatch[1] : '', { maxLength: 200 }) || 'de-thi.docx';

        const nameCheck = validateUploadFileName(originalName);
        if (!nameCheck.valid) {
            return response.badRequest(res, nameCheck.reason, { hint: 'Chỉ tải lên tệp .docx xuất từ Microsoft Word.' });
        }
        if (!hasDocxSignature(buffer, env.UPLOAD_LIMITS.allowedMagic)) {
            return response.badRequest(res, 'Nội dung tệp không phải định dạng .docx hợp lệ.', {
                hint: 'Tệp .docx phải được lưu lại bằng định dạng Office Open XML, không phải đổi tên từ .zip/.doc.'
            });
        }

        req.file = { buffer, originalName, size };
        return next();
    } catch (error) {
        if (error.code === 'FILE_TOO_LARGE') {
            const maxMb = Math.round(env.UPLOAD_LIMITS.maxFileSizeBytes / (1024 * 1024));
            return response.badRequest(res, `Tệp vượt quá ${maxMb} MB.`);
        }
        if (error.code === 'CLIENT_ABORTED') return response.badRequest(res, 'Yêu cầu tải tệp bị hủy.');
        return next(error);
    }
}

module.exports = { docxUpload, readMultipartFile };
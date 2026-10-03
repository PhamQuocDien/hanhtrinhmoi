'use strict';

/**
 * Đọc cấu trúc tệp .docx (Office Open XML) và trả về văn bản + hình ảnh.
 *
 * .docx là một tệp ZIP. Không dùng thư viện ngoài để giữ nhẹ dependency và
 * tránh rủi ro thư viện giải nén tệp người dùng tải lên. Ta tự đọc:
 *   - central directory của ZIP để liệt kê thành phần
 *   - `word/document.xml` là nội dung chính
 *   - `word/media/*` là hình ảnh nhúng
 *
 * Công thức OMML (Toán/Lý/Hóa) được phát hiện và đánh dấu, KHÔNG tự chuyển
 * đổi: nếu không chắc chắn thì câu hỏi được đưa sang trạng thái cần duyệt.
 */

const zlib = require('zlib');

/** Central directory record: 46 byte cố định trước tên. */
const CENTRAL_HEADER_SIZE = 46;
/** Local file header: 30 byte cố định trước tên. */
const LOCAL_HEADER_SIZE = 30;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;

/**
 * Đọc bảng central directory của tệp ZIP.
 * Trả về Map<tên, { offset, compressedSize, size, method }>.
 */
function readCentralDirectory(buffer) {
    // Tìm signature kết thúc từ cuối file về phía trước.
    let eocdOffset = -1;
    const minimum = Math.max(0, buffer.length - 66_000);
    for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
        if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
            eocdOffset = offset;
            break;
        }
    }
    if (eocdOffset < 0) throw new Error('Không đọc được bảng central directory — tệp không phải ZIP hợp lệ.');

    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    let pointer = buffer.readUInt32LE(eocdOffset + 16);
    const entries = new Map();

    for (let index = 0; index < entryCount; index += 1) {
        if (pointer + CENTRAL_HEADER_SIZE > buffer.length) break;
        if (buffer.readUInt32LE(pointer) !== CENTRAL_FILE_SIGNATURE) break;

        const method = buffer.readUInt16LE(pointer + 10);
        const compressedSize = buffer.readUInt32LE(pointer + 20);
        const size = buffer.readUInt32LE(pointer + 24);
        const nameLength = buffer.readUInt16LE(pointer + 28);
        const extraLength = buffer.readUInt16LE(pointer + 30);
        const commentLength = buffer.readUInt16LE(pointer + 32);
        const localOffset = buffer.readUInt32LE(pointer + 42);
        const name = buffer.toString('utf8', pointer + CENTRAL_HEADER_SIZE, pointer + CENTRAL_HEADER_SIZE + nameLength);

        if (!name.endsWith('/')) {
            entries.set(name, { offset: localOffset, compressedSize, size, method });
        }
        pointer += CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
    }

    return entries;
}

/** Giải nén một thành phần trong tệp ZIP. */
function readEntry(buffer, entry) {
    const nameStart = entry.offset + LOCAL_HEADER_SIZE;
    const nameLength = buffer.readUInt16LE(entry.offset + 26);
    const extraLength = buffer.readUInt16LE(entry.offset + 28);
    const dataStart = nameStart + nameLength + extraLength;
    const raw = buffer.subarray(dataStart, dataStart + entry.compressedSize);

    if (entry.method === 0) return raw;
    if (entry.method === 8) return zlib.inflateRawSync(raw);
    throw new Error(`Phương thức nén ${entry.method} không được hỗ trợ.`);
}

/** Giải nén một entry dạng văn bản. */
function readTextEntry(buffer, entry) {
    return readEntry(buffer, entry).toString('utf8');
}

/**
 * Thực thể XML cần giải mã khi trích xuất văn bản.
 * Bảng mã Word hay bị quên nên văn bản tiếng Việt dễ thành ký tự lỗi.
 */
function decodeXmlText(value) {
    return value
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

/** Các thẻ Word bị bỏ khi trích xuất văn bản (nội dung đã bị gạch xoá). */
const SKIPPED_TAGS = ['w:del', 'w:instrText', 'w:proofErr'];

/**
 * Chuyển `word/document.xml` thành danh sách đoạn văn.
 * Mỗi phần tử: { text, hasFormula, imageRelIds, isListItem }
 */
function extractParagraphs(xml) {
    const paragraphs = [];

    // Cắt theo từng <w:p> ... </w:p>
    const paragraphPattern = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>|<w:p\b[^>]*\/>/g;
    let match;

    while ((match = paragraphPattern.exec(xml)) !== null) {
        const inner = match[1] || '';
        let cursor = 0;
        let text = '';
        const imageRelIds = [];
        let hasFormula = false;

        const tagPattern = /<(\/?)(w:[A-Za-z]+|m:[A-Za-z]+|a:blip)([^>]*?)(\/?)>/g;
        let tagMatch;

        while ((tagMatch = tagPattern.exec(inner)) !== null) {
            const [full, closing, tagName, attrs, selfClosing] = tagMatch;

            // Bỏ qua toàn bộ nội dung nằm trong thẻ cần loại bỏ (ví dụ w:del).
            if (SKIPPED_TAGS.includes(tagName)) {
                if (closing) {
                    text += strippedText(inner.slice(cursor, tagMatch.index));
                    cursor = tagMatch.index + full.length;
                }
                continue;
            }

            text += strippedText(inner.slice(cursor, tagMatch.index));
            cursor = tagMatch.index + full.length;

            // Công thức OMML: KHÔNG tự chuyển, chỉ đánh dấu cho người duyệt.
            if (tagName === 'm:oMath' || tagName === 'm:oMathPara') {
                hasFormula = true;
                if (!closing && !selfClosing) text += ' [CÔNG THỨC] ';
                continue;
            }

            // Hình ảnh: lấy r:id tham chiếu quan hệ trong document.xml.rels.
            if (tagName === 'a:blip') {
                const relMatch = attrs.match(/r:embed="([^"]+)"/);
                if (relMatch) imageRelIds.push(relMatch[1]);
                continue;
            }

            if (tagName === 'w:tab' && !closing) text += '\t';
            if (tagName === 'w:br' && !closing) text += '\n';
        }
        text += strippedText(inner.slice(cursor));

        const cleaned = decodeXmlText(text).replace(/[ \t]+/g, ' ').trim();
        if (!cleaned && !imageRelIds.length && !hasFormula) continue;

        paragraphs.push({
            text: cleaned,
            hasFormula,
            imageRelIds,
            isListItem: /<w:numPr\b/.test(inner)
        });
    }

    return paragraphs;
}

/** Lấy nội dung chữ của một đoạn XML, bỏ qua thẻ bên trong. */
function strippedText(fragment) {
    return fragment ? fragment.replace(/<[^>]*>/g, '') : '';
}

/** Đọc `word/_rels/document.xml.rels` để ánh xạ rId -> đường dẫn media. */
function readRelationships(xml) {
    const map = new Map();
    const pattern = /<Relationship\b([^>]*?)\/>/g;
    let match;
    while ((match = pattern.exec(xml)) !== null) {
        const attrs = match[1];
        const id = attrs.match(/Id="([^"]+)"/)?.[1];
        const target = attrs.match(/Target="([^"]+)"/)?.[1];
        if (id && target) map.set(id, target.replace(/^\/?(word\/)?/, ''));
    }
    return map;
}

/** Đuôi tệp trong word/media/ quyết định loại MIME. */
function mimeTypeForMedia(name) {
    const extension = String(name).slice(String(name).lastIndexOf('.')).toLowerCase();
    const map = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        '.emf': 'image/emf',
        '.wmf': 'image/wmf'
    };
    return map[extension] || 'application/octet-stream';
}

/**
 * Đọc một tệp .docx và trả về:
 *   { paragraphs, media: [{ name, mimeType, data(Buffer) }], hasFormula }
 */
function parseDocxBuffer(buffer) {
    const entries = readCentralDirectory(buffer);

    const documentEntry = entries.get('word/document.xml');
    if (!documentEntry) {
        throw new Error('Tệp không có phần word/document.xml — có thể không phải tài liệu Word.');
    }

    const documentXml = readTextEntry(buffer, documentEntry);
    const paragraphs = extractParagraphs(documentXml);

    const relsEntry = entries.get('word/_rels/document.xml.rels');
    const relationships = relsEntry ? readRelationships(readTextEntry(buffer, relsEntry)) : new Map();

    // Gom các hình được tham chiếu, bỏ phần media không dùng trong bài.
    const usedTargets = new Set();
    for (const relId of new Set(paragraphs.flatMap(item => item.imageRelIds))) {
        const target = relationships.get(relId);
        if (target) usedTargets.add(target);
    }

    const media = [];
    // Ánh xạ trực tiếp rId -> media để tầng trên gắn hình đúng vào câu hỏi,
    // thay vì phải đoán theo thứ tự xuất hiện.
    const mediaByRelId = new Map();

    for (const target of usedTargets) {
        const entry = entries.get(target) || entries.get(`word/${target}`);
        if (!entry) continue;
        const index = media.length;
        media.push({
            name: target,
            mimeType: mimeTypeForMedia(target),
            data: readEntry(buffer, entry)
        });
        for (const [relId, relTarget] of relationships.entries()) {
            if (relTarget === target) mediaByRelId.set(relId, index);
        }
    }

    return {
        paragraphs,
        media,
        mediaByRelId,
        hasFormula: paragraphs.some(item => item.hasFormula)
    };
}

module.exports = {
    mimeTypeForMedia,
    parseDocxBuffer,
    readCentralDirectory,
    readEntry,
    readRelationships,
    readTextEntry,
    decodeXmlText,
    extractParagraphs,
    strippedText
};
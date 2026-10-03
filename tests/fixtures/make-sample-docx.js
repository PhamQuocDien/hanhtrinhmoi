'use strict';

/**
 * Tạo các tệp .docx mẫu ĐÚNG CHUẨN Office Open XML để kiểm thử parser.
 *
 * Tệp .docx là ZIP. Ở đây ta dựng ZIP bằng zlib (DEFLATE) với cấu trúc
 * local header + central directory + EOCD, đủ để parser thật đọc được.
 *
 *   node tests/fixtures/make-sample-docx.js [đường/dẫn/đầu-ra.docx]
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/** CRC-32 (bảng tra cứu dựng một lần). */
const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();

function crc32(buffer) {
    let crc = -1;
    for (let i = 0; i < buffer.length; i += 1) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
}

/** Dựng một tệp ZIP chứa danh sách { name, data }. */
function buildZip(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;

    for (const file of files) {
        const nameBuffer = Buffer.from(file.name, 'utf8');
        const content = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, 'utf8');
        const compressed = zlib.deflateRawSync(content);
        const crc = crc32(content);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);   // signature local file
        local.writeUInt16LE(20, 4);            // version needed
        local.writeUInt16LE(0, 6);             // flags
        local.writeUInt16LE(8, 8);             // method = deflate
        local.writeUInt16LE(0, 10);            // mod time
        local.writeUInt16LE(0x21, 12);         // mod date
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(content.length, 22);
        local.writeUInt16LE(nameBuffer.length, 26);
        local.writeUInt16LE(0, 28);            // extra length
        locals.push(local, nameBuffer, compressed);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);  // signature central directory
        central.writeUInt16LE(20, 4);           // version made by
        central.writeUInt16LE(20, 6);           // version needed
        central.writeUInt16LE(0, 8);            // flags
        central.writeUInt16LE(8, 10);           // method
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0x21, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(content.length, 24);
        central.writeUInt16LE(nameBuffer.length, 28);
        central.writeUInt16LE(0, 30);           // extra
        central.writeUInt16LE(0, 32);           // comment
        central.writeUInt16LE(0, 34);           // disk number
        central.writeUInt16LE(0, 36);           // internal attrs
        central.writeUInt32LE(0, 38);           // external attrs
        central.writeUInt32LE(offset, 42);      // local header offset
        centrals.push(central, nameBuffer);

        offset += local.length + nameBuffer.length + compressed.length;
    }

    const centralBuffer = Buffer.concat(centrals);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(centralBuffer.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...locals, centralBuffer, eocd]);
}

/** Bọc nội dung thành một đoạn văn Word. */
function paragraph(text) {
    return `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

/** Một câu hỏi trắc nghiệm đầy đủ theo định dạng Word phổ biến. */
function sampleQuestion(number, stem, options, answer, explanation) {
    const parts = [paragraph(`Câu ${number}. ${stem}`)];
    for (const option of options) parts.push(paragraph(option));
    parts.push(paragraph(`Đáp án: ${answer}`));
    parts.push(paragraph(`Giải thích: ${explanation}`));
    return parts.join('');
}

/** Nội dung tài liệu mẫu có câu hỏi, lựa chọn, đáp án và giải thích. */
function buildDocumentXml() {
    const questions = [
        sampleQuestion(
            1,
            'Giá trị của biểu thức 12 + 8 là bao nhiêu?',
            ['A. 18', 'B. 20', 'C. 21', 'D. 16'],
            'B',
            '12 + 8 = 20.'
        ),
        sampleQuestion(
            2,
            'Hình nào có 3 cạnh?',
            ['A. Hình tròn', 'B. Hình vuông', 'C. Hình tam giác', 'D. Hình ngũ giác'],
            'C',
            'Hình tam giác có 3 cạnh.'
        ),
        sampleQuestion(
            3,
            'Câu nào sau đây là câu lệnh?',
            ['A. Em rất vui', 'B. Em yêu mẹ', 'C. Em ơi, đến chơi nhé!', 'D. Xin lỗi bạn'],
            'C',
            'Câu lệnh dùng để giao tiếp, có dấu chấm than.'
        )
    ];

    const title = '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Kiểm tra Toán lớp 3</w:t></w:r></w:p>';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
<w:body>${title}${questions.join('')}<w:sectPr/></w:body>
</w:document>`;
}

/** Tài liệu chứa công thức OMML để kiểm thử việc đánh dấu cần duyệt. */
function buildFormulaDocumentXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
<w:body>
<w:p><w:r><w:t>Câu 1. Tính giá trị biểu thức:</w:t></w:r>
<m:oMath><m:r><m:t>a2 + b2 = c2</m:t></m:r></m:oMath></w:p>
</w:body>
</w:document>`;
}

/** Quan hệ rId -> media/image1.png */
function buildRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;
}

/** Tài liệu có nhúng hình qua rId10. */
function buildImageDocumentXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<w:body>
<w:p><w:r><w:t>Câu 1. Quan sát hình bên dưới, hãy chọn đáp án đúng.</w:t></w:r></w:p>
<w:p><w:r><w:drawing><a:blip r:embed="rId10"/></w:drawing></w:r></w:p>
<w:p><w:r><w:t>A. Hình vuông</w:t></w:r></w:p>
<w:p><w:r><w:t>B. Hình tròn</w:t></w:r></w:p>
<w:p><w:r><w:t>Đáp án: A</w:t></w:r></w:p>
</w:body>
</w:document>`;
}

/** PNG 1x1 tối thiểu, dùng làm hình nhúng mẫu. */
const TINY_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

/** Tạo đủ bộ tệp kiểm thử. Trả về đối tượng chứa buffer của từng loại đề. */
function buildSampleFiles() {
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const emptyRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

    return {
        // Đề thi 3 câu, đáp án nằm ngay trong nội dung.
        exam: buildZip([
            { name: '[Content_Types].xml', data: contentTypes },
            { name: '_rels/.rels', data: rootRels },
            { name: 'word/document.xml', data: buildDocumentXml() },
            { name: 'word/_rels/document.xml.rels', data: emptyRels }
        ]),
        // Đề có công thức OMML -> phải đánh dấu cần duyệt.
        formula: buildZip([
            { name: '[Content_Types].xml', data: contentTypes },
            { name: '_rels/.rels', data: rootRels },
            { name: 'word/document.xml', data: buildFormulaDocumentXml() }
        ]),
        // Đề có hình nhúng -> phải giữ lại media.
        image: buildZip([
            { name: '[Content_Types].xml', data: contentTypes },
            { name: '_rels/.rels', data: rootRels },
            { name: 'word/document.xml', data: buildImageDocumentXml() },
            { name: 'word/_rels/document.xml.rels', data: buildRelsXml() },
            { name: 'word/media/image1.png', data: TINY_PNG }
        ])
    };
}

if (require.main === module) {
    const target = process.argv[2]
        ? path.resolve(process.argv[2])
        : path.join(__dirname, 'sample-exam.docx');
    const files = buildSampleFiles();
    fs.writeFileSync(target, files.exam);
    console.log(`Đã tạo tệp DOCX mẫu: ${target} (${files.exam.length} bytes)`);
    console.log('Dùng làm đề thi để thử luồng import trên trang quản trị.');
}

module.exports = { buildSampleFiles, buildZip, crc32, TINY_PNG };
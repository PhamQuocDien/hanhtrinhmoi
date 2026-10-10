'use strict';

const models = require('../../server/models/platform-models.js');

const majors = [
    ['SE', 'Kỹ thuật phần mềm', 'Software Engineering'],
    ['CS', 'Khoa học máy tính', 'Computer Science'],
    ['IS', 'Hệ thống thông tin', 'Information Systems'],
    ['DS', 'Khoa học dữ liệu', 'Data Science'],
    ['AI', 'Trí tuệ nhân tạo', 'Artificial Intelligence'],
    ['CY', 'An toàn thông tin', 'Cybersecurity'],
    ['NET', 'Mạng máy tính và truyền thông dữ liệu', 'Computer Networks'],
    ['IT', 'Công nghệ thông tin', 'Information Technology']
];

async function up({ connection, logger = console } = {}) {
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB connection must be ready before running migration 008.');
    const university = await models.University.findOneAndUpdate(
        { code: 'HTM-IT-DEMO' },
        { $set: { name: 'Hành Trình Mới — Danh mục CNTT mẫu', shortName: 'HTM-IT', type: 'DEMO', description: 'Danh mục đại học CNTT mẫu để AI học và đề xuất; không đại diện cho chương trình chính thức của một trường đại học cụ thể.', status: 'ACTIVE' }, $setOnInsert: { code: 'HTM-IT-DEMO' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const faculty = await models.Faculty.findOneAndUpdate(
        { universityId: university._id, code: 'CNTT-FAC' },
        { $set: { name: 'Khoa Công nghệ Thông tin', description: 'Danh mục CNTT mẫu phục vụ recommendation và AI curriculum.' }, $setOnInsert: { universityId: university._id, code: 'CNTT-FAC' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const field = await models.Field.findOneAndUpdate(
        { code: 'ICT' },
        { $set: { name: 'Công nghệ thông tin và truyền thông', description: 'Lĩnh vực CNTT mẫu.' }, $setOnInsert: { code: 'ICT' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const group = await models.DisciplineGroup.findOneAndUpdate(
        { fieldId: field._id, code: 'ICT-CS' },
        { $set: { name: 'Máy tính và công nghệ phần mềm', description: 'Nhóm ngành CNTT mẫu.' }, $setOnInsert: { fieldId: field._id, code: 'ICT-CS' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const majorDocs = [];
    for (const [code, name, englishName] of majors) {
        const major = await models.Major.findOneAndUpdate(
            { disciplineGroupId: group._id, code },
            { $set: { name, degreeLevel: 'UNDERGRADUATE', duration: 4, status: 'ACTIVE' }, $setOnInsert: { disciplineGroupId: group._id, code } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
        majorDocs.push({ major, code, englishName });
        const specialization = await models.Specialization.findOneAndUpdate(
            { majorId: major._id, code: `${code}-GEN` },
            { $set: { name: `${name} — Định hướng tổng quát`, description: `${englishName} general orientation.` }, $setOnInsert: { majorId: major._id, code: `${code}-GEN` } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
        await models.TrainingProgram.findOneAndUpdate(
            { institutionId: university._id, majorId: major._id, programName: `${name} — Chương trình mẫu` },
            { $set: { facultyId: faculty._id, fieldId: field._id, disciplineGroupId: group._id, specializationId: specialization._id, version: '1.0', totalCredits: 135, learningOutcomes: [{ description: `Đạt nền tảng ${name} và có thể phát triển theo mục tiêu nghề nghiệp.` }], educationStandard: { demo: true }, graduationRequirements: { demo: true }, status: 'ACTIVE' }, $setOnInsert: { institutionId: university._id, programName: `${name} — Chương trình mẫu` } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }
    const result = { migration: '008-v18-academic-catalog', universities: 1, faculties: 1, fields: 1, disciplineGroups: 1, majors: majorDocs.length };
    logger.log(JSON.stringify(result));
    return result;
}
module.exports = { id: '008-v18-academic-catalog', up };

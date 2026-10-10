'use strict';

// The education stage is UNIVERSITY/HIGHER_EDUCATION. Computing, Economics,
// Applied Sciences, Mechatronics and Engineering are academic domains below it.
const UNIVERSITY_DOMAINS = Object.freeze([
    { code: 'COMPUTING', name: 'Công nghệ thông tin và Máy tính', track: 'UNIVERSITY_IT', facultyCode: 'HTM-FAC-CNTT', facultyName: 'Khoa Công nghệ thông tin', fieldCode: 'HTM-CNTT-FIELD', fieldName: 'Công nghệ thông tin và máy tính', disciplineGroupCode: 'HTM-CNTT-GROUP', disciplineGroupName: 'Máy tính và công nghệ số', majors: [['CNTT', 'Công nghệ thông tin'], ['SE', 'Kỹ thuật phần mềm'], ['CS', 'Khoa học máy tính'], ['IS', 'Hệ thống thông tin'], ['DS', 'Khoa học dữ liệu'], ['AI', 'Trí tuệ nhân tạo'], ['SEC', 'An toàn thông tin'], ['NET', 'Mạng máy tính và truyền thông dữ liệu']] },
    { code: 'APPLIED_SCIENCES', name: 'Khoa học ứng dụng', track: 'UNIVERSITY_APPLIED_SCIENCES', facultyCode: 'HTM-FAC-APPSCI', facultyName: 'Khoa Khoa học ứng dụng', fieldCode: 'HTM-APPSCI-FIELD', fieldName: 'Khoa học tự nhiên và ứng dụng', disciplineGroupCode: 'HTM-APPSCI-GROUP', disciplineGroupName: 'Khoa học ứng dụng', majors: [['APPSCI', 'Khoa học ứng dụng'], ['MATH', 'Toán ứng dụng'], ['PHYS', 'Vật lý ứng dụng'], ['CHEM', 'Hóa học ứng dụng'], ['BIO', 'Sinh học ứng dụng'], ['ENV', 'Khoa học môi trường'], ['FOOD', 'Công nghệ thực phẩm'], ['SCI-DATA', 'Phân tích dữ liệu khoa học']] },
    { code: 'ECONOMICS', name: 'Kinh tế và Kinh doanh', track: 'UNIVERSITY_ECONOMICS', facultyCode: 'HTM-FAC-ECON', facultyName: 'Khoa Kinh tế và Kinh doanh', fieldCode: 'HTM-ECON-FIELD', fieldName: 'Kinh tế và kinh doanh', disciplineGroupCode: 'HTM-ECON-GROUP', disciplineGroupName: 'Kinh tế và quản trị', majors: [['ECON', 'Kinh tế'], ['BA', 'Phân tích kinh doanh'], ['FIN', 'Tài chính'], ['ACC', 'Kế toán'], ['MKT', 'Marketing'], ['LOG', 'Logistics'], ['IE', 'Quản trị công nghiệp']] },
    { code: 'MECHATRONICS', name: 'Cơ điện tử và Tự động hóa', track: 'UNIVERSITY_MECHATRONICS', facultyCode: 'HTM-FAC-MECH', facultyName: 'Khoa Cơ khí và Cơ điện tử', fieldCode: 'HTM-MECH-FIELD', fieldName: 'Kỹ thuật và công nghệ', disciplineGroupCode: 'HTM-MECH-GROUP', disciplineGroupName: 'Cơ điện tử và tự động hóa', majors: [['MECH', 'Cơ điện tử'], ['EE', 'Kỹ thuật điện - điện tử'], ['AUTO', 'Kỹ thuật điều khiển và tự động hóa'], ['ROBOT', 'Robot và hệ thống thông minh']] },
    { code: 'ENGINEERING', name: 'Kỹ thuật ứng dụng', track: 'UNIVERSITY_ENGINEERING', facultyCode: 'HTM-FAC-ENG', facultyName: 'Khoa Kỹ thuật tổng hợp', fieldCode: 'HTM-ENG-FIELD', fieldName: 'Kỹ thuật', disciplineGroupCode: 'HTM-ENG-GROUP', disciplineGroupName: 'Kỹ thuật ứng dụng', majors: [['ENG', 'Kỹ thuật'], ['IE', 'Kỹ thuật công nghiệp'], ['EE', 'Kỹ thuật điện - điện tử'], ['AUTO', 'Kỹ thuật điều khiển và tự động hóa']] }
]);

function getUniversityDomain(track, subjectId) {
    const value = String(track || '').toUpperCase();
    const subject = String(subjectId || '').toUpperCase();
    return UNIVERSITY_DOMAINS.find(domain => domain.track === value)
        || (['CNTT', 'COMPUTING', 'CS', 'SE', 'IS', 'DS', 'AI', 'SEC', 'NET'].includes(subject) ? UNIVERSITY_DOMAINS[0] : null)
        || null;
}

function getUniversityAcademicContext({ track, subjectId, majorTracks = [] } = {}) {
    const domain = getUniversityDomain(track, subjectId);
    if (!domain) return null;
    return {
        educationStage: 'HIGHER_EDUCATION',
        educationStageName: 'Đại học',
        degreeLevel: 'UNDERGRADUATE',
        academicDomainCode: domain.code,
        academicDomainName: domain.name,
        facultyCode: domain.facultyCode,
        facultyName: domain.facultyName,
        fieldCode: domain.fieldCode,
        fieldName: domain.fieldName,
        disciplineGroupCode: domain.disciplineGroupCode,
        disciplineGroupName: domain.disciplineGroupName,
        majorCodes: [...new Set((majorTracks || []).map(String))],
        isOfficialUniversityCurriculum: false,
        curriculumScope: 'GENERAL_SKILL_CATALOG'
    };
}

function universityTrackForDomain(domainCode) {
    return UNIVERSITY_DOMAINS.find(domain => domain.code === String(domainCode || '').toUpperCase())?.track || 'UNIVERSITY';
}

module.exports = { UNIVERSITY_DOMAINS, getUniversityDomain, getUniversityAcademicContext, universityTrackForDomain };

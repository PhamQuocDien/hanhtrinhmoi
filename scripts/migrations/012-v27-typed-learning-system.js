'use strict';

const models = require('../../server/models/platform-models.js');
const { validateSurvey, validatePlacement } = require('../../server/services/diagnostic-validation.js');
const { buildAlgorithmTaskSeeds, normalizeContentBlock } = require('../../server/services/learning-system-v27.js');
const surveyPlacementV21 = require('./011-v21-survey-placement.js');

const SOURCE_REF = { sourceType: 'ORIGINAL_PRACTICE', documentName: 'Hanh Trinh Moi diagnostic seed', version: '27.0.0', verification: 'unverified' };

function extraPlacementDefinitions() {
    const make = (code, prompt, options, answer) => ({ code, id: code, prompt, type: 'single_choice', options: options.map(value => ({ label: value, value })), answer, points: 1, difficulty: 'MEDIUM' });
    const section = (code, skill, questions) => ({ code, skill, title: skill, questions });
    return [
        {
            code: 'HTM-PLACEMENT-UNIVERSITY-ECONOMICS-V27', title: 'Placement Đại học · Kinh tế, kinh doanh và dữ liệu', target: 'UNIVERSITY_ECONOMICS', version: '27.0.0', status: 'PUBLISHED', sourceRef: SOURCE_REF,
            skillSections: [
                section('ECON-FUNDAMENTALS', 'Kinh tế học cơ bản', [make('ECON-Q1', 'Khi giá một hàng hóa tăng, các yếu tố khác không đổi, lượng cầu thường thay đổi thế nào?', ['Tăng', 'Giảm', 'Không đổi trong mọi trường hợp', 'Tăng vô hạn'], 'Giảm'), make('ECON-Q2', 'Chi phí cơ hội là gì?', ['Chi phí ghi trên hóa đơn', 'Giá trị của lựa chọn tốt nhất bị bỏ qua', 'Tổng thuế phải trả', 'Lợi nhuận kế toán'], 'Giá trị của lựa chọn tốt nhất bị bỏ qua')]),
                section('ECON-DATA', 'Số liệu và thống kê', [make('ECON-Q3', 'Doanh thu được tính như thế nào trong trường hợp một sản phẩm có giá đơn vị cố định?', ['Giá bán × số lượng bán', 'Chi phí cố định − số lượng', 'Lợi nhuận + số lượng', 'Thuế × chi phí'], 'Giá bán × số lượng bán'), make('ECON-Q4', 'Một cửa hàng bán 20 sản phẩm, mỗi sản phẩm 50.000 đồng. Doanh thu là bao nhiêu?', ['500.000 đồng', '1.000.000 đồng', '2.500.000 đồng', '10.000.000 đồng'], '1.000.000 đồng')]),
                section('ECON-REASONING', 'Tư duy kinh doanh', [make('ECON-Q5', 'Khi chi phí biến đổi tăng mà giá bán và sản lượng không đổi, lợi nhuận thường sẽ thế nào?', ['Tăng', 'Giảm', 'Không thể thay đổi', 'Luôn bằng 0'], 'Giảm'), make('ECON-Q6', 'Trước khi kết luận một chiến dịch marketing thành công, chỉ số nào có ý nghĩa hơn lượt xem đơn thuần?', ['Số màu trong quảng cáo', 'Chuyển đổi hoặc doanh thu theo mục tiêu', 'Độ dài tên chiến dịch', 'Số lượng ảnh'], 'Chuyển đổi hoặc doanh thu theo mục tiêu')])
            ]
        },
        {
            code: 'HTM-PLACEMENT-UNIVERSITY-MECHATRONICS-V27', title: 'Placement Đại học · Cơ điện tử và tự động hóa', target: 'UNIVERSITY_MECHATRONICS', version: '27.0.0', status: 'PUBLISHED', sourceRef: SOURCE_REF,
            skillSections: [
                section('MECHA-MATH', 'Toán và mô hình hóa', [make('MECHA-Q1', 'Đơn vị SI của lực là gì?', ['Watt', 'Newton', 'Volt', 'Pascal'], 'Newton'), make('MECHA-Q2', 'Nếu vận tốc không đổi và thời gian tăng gấp đôi, quãng đường sẽ thế nào?', ['Giảm một nửa', 'Tăng gấp đôi', 'Không đổi', 'Tăng gấp bốn'], 'Tăng gấp đôi')]),
                section('MECHA-ELECTRIC', 'Mạch điện cơ bản', [make('MECHA-Q3', 'Theo định luật Ohm, dòng điện I bằng biểu thức nào?', ['I = U × R', 'I = U / R', 'I = R / U', 'I = U + R'], 'I = U / R'), make('MECHA-Q4', 'Trong mạch nối tiếp lý tưởng, đại lượng nào bằng nhau qua mọi phần tử?', ['Dòng điện', 'Điện áp trên từng phần tử', 'Điện trở từng phần tử', 'Công suất từng phần tử'], 'Dòng điện')]),
                section('MECHA-CONTROL', 'Điều khiển và logic', [make('MECHA-Q5', 'Cảm biến thường đóng vai trò gì trong hệ tự động?', ['Đo trạng thái vật lý và gửi tín hiệu', 'Chỉ lưu tài liệu', 'Thay thế mọi cơ cấu chấp hành', 'Tạo nguồn điện vô hạn'], 'Đo trạng thái vật lý và gửi tín hiệu'), make('MECHA-Q6', 'Trong sơ đồ điều khiển cơ bản, PLC thường làm nhiệm vụ nào?', ['Nhận tín hiệu vào, xử lý logic và điều khiển đầu ra', 'Chỉ tăng điện áp nguồn', 'Chỉ hiển thị hình ảnh', 'Làm mát động cơ bằng nước'], 'Nhận tín hiệu vào, xử lý logic và điều khiển đầu ra')])
            ]
        }
    ];
}
function contentText(value) {
    if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
    if (!value || typeof value !== 'object') return '';
    const preferred = ['body', 'content', 'text', 'markdown', 'theory', 'description', 'explanation', 'statement', 'title', 'prompt', 'question'];
    const parts = preferred.map(key => value[key]).filter(item => typeof item === 'string' && item.trim());
    if (parts.length) return parts.join('\n\n').trim();
    return '';
}
function blocksForLesson(lesson) {
    const out = [];
    const add = (field, type, items) => {
        const values = Array.isArray(items) ? items : items == null ? [] : [items];
        values.forEach((item, index) => {
            const body = contentText(item);
            if (!body) return;
            const title = typeof item === 'object' ? item.title || item.name || `${type === 'THEORY' ? 'Kiến thức' : type === 'EXAMPLE' ? 'Ví dụ' : 'Hoạt động'} ${index + 1}` : `${type === 'THEORY' ? 'Lý thuyết' : type === 'LECTURE' ? 'Bài giảng' : type === 'EXAMPLE' ? 'Ví dụ' : 'Thực hành'} ${index + 1}`;
            const rawCode = `LEGACY-${lesson._id}-${field}-${index + 1}`;
            const normalized = normalizeContentBlock({ code: rawCode, title, type, body, bodyFormat: 'MARKDOWN', order: out.length, status: lesson.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT', sourceType: 'ORIGINAL_PRACTICE' });
            if (normalized.valid) out.push({ ...normalized.block, code: normalized.block.code.slice(0, 180), lessonId: lesson._id, courseId: lesson.courseId || null, curriculumContentId: lesson._id, legacySourceId: lesson._id, legacyField: `${field}:${index + 1}` });
        });
    };
    add('theory', 'THEORY', lesson.theory);
    add('theorySections', 'THEORY', lesson.theorySections);
    add('lecture', 'LECTURE', lesson.payload?.lecture || lesson.payload?.lessonScript);
    add('examples', 'EXAMPLE', lesson.examples);
    add('activities', 'PRACTICE', lesson.activities);
    return out;
}

async function ensureDiagnostics(logger = console) {
    const baseSurvey = { title: 'Khảo sát mục tiêu học tập toàn diện · V21', description: 'Khảo sát điều kiện học tập, cấp học, mục tiêu, điểm mạnh/yếu, sở thích, định hướng nghề nghiệp và hồ sơ đại học để tạo lộ trình cá nhân hóa.', targetLevel: 'ALL', version: '21.0.0', questions: surveyPlacementV21.surveyQuestions(), status: 'PUBLISHED', sourceRef: SOURCE_REF };
    const publishedSurveys = await models.Survey.find({ status: 'PUBLISHED' }).lean();
    let validSurvey = publishedSurveys.find(item => validateSurvey(item).valid);
    let surveyCreated = false;
    if (!validSurvey) {
        if (publishedSurveys.length) await models.Survey.updateMany({ status: 'PUBLISHED' }, { $set: { status: 'DRAFT' } });
        validSurvey = await models.Survey.findOneAndUpdate({ title: baseSurvey.title, version: baseSurvey.version }, { $set: baseSurvey }, { upsert: true, new: true, setDefaultsOnInsert: true });
        surveyCreated = true;
    }
    const publishedPlacements = await models.PlacementTest.find({ status: 'PUBLISHED' }).lean();
    const validCodes = new Set(publishedPlacements.filter(item => validatePlacement(item).valid).map(item => item.code));
    let placementCreated = 0;
    for (const item of [...surveyPlacementV21.placementDefinitions(), ...extraPlacementDefinitions()]) {
        if (validCodes.has(item.code)) continue;
        const found = await models.PlacementTest.findOne({ code: item.code });
        if (found && !validatePlacement(found.toObject ? found.toObject() : found).valid) {
            found.status = 'DRAFT';
            await found.save();
        }
        const existing = await models.PlacementTest.findOne({ code: item.code });
        if (!existing || !validatePlacement(existing.toObject ? existing.toObject() : existing).valid) {
            await models.PlacementTest.findOneAndUpdate({ code: item.code }, { $set: item }, { upsert: true, new: true, setDefaultsOnInsert: true });
            placementCreated += 1;
        }
    }
    logger.info?.(`Migration 012 diagnostics: surveyValid=${Boolean(validSurvey)}, placementAdded=${placementCreated}`);
    return { surveyCreated, placementCreated };
}
async function up({ connection, logger = console } = {}) {
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB must be connected before migration 012.');
    const allModels = ['ContentBlock', 'PracticeTask', 'PracticeAttempt', 'LearningPlanStep', 'LearningEvent', 'CourseQualitySnapshot'];
    for (const name of allModels) {
        const Model = models[name];
        await Model.createCollection().catch(error => { if (error?.codeName !== 'NamespaceExists' && error?.code !== 48) throw error; });
        await Model.syncIndexes();
    }
    const seedTasks = buildAlgorithmTaskSeeds();
    let practiceAdded = 0;
    for (const task of seedTasks) {
        const existing = await models.PracticeTask.findOne({ code: task.code });
        if (!existing) { await models.PracticeTask.create(task); practiceAdded += 1; }
    }
    const lessons = await models.CurriculumContent.find({ type: 'LESSON' }).select('_id courseId title status theory theorySections examples activities payload').lean();
    const operations = [];
    for (const lesson of lessons) {
        for (const block of blocksForLesson(lesson)) {
            operations.push({ updateOne: { filter: { code: block.code, version: block.version || 1 }, update: { $setOnInsert: block }, upsert: true } });
        }
    }
    let contentBlocksUpserted = 0;
    for (let start = 0; start < operations.length; start += 500) {
        const result = await models.ContentBlock.bulkWrite(operations.slice(start, start + 500), { ordered: false });
        contentBlocksUpserted += result.upsertedCount || 0;
    }
    const diagnostics = await ensureDiagnostics(logger);
    logger.info?.(`Migration 012: practiceSeeds=${practiceAdded}, contentBlockCandidates=${operations.length}, contentBlocksUpserted=${contentBlocksUpserted}`);
    return { practiceTasksAdded: practiceAdded, lessonsScanned: lessons.length, contentBlocksUpserted, ...diagnostics };
}
module.exports = { id: '012-v27-typed-learning-system', up, extraPlacementDefinitions, contentText, blocksForLesson, ensureDiagnostics };

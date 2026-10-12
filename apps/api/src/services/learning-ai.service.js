'use strict';

const { setTimeout: delay } = require('node:timers/promises');

let requestQueue = Promise.resolve();
let lastRequestAt = 0;
let cooldownUntil = 0;

function aiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('replace-') && process.env.AI_MODE !== 'OFF');
}
function stripJsonFence(value) {
  return String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}
function parseScoreJson(text) {
  const parsed = JSON.parse(stripJsonFence(text));
  const score = Number(parsed.score);
  return {
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
    feedback: String(parsed.feedback || 'Hãy xem lại yêu cầu và bổ sung cách giải thích.').slice(0, 1200),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map((item) => String(item).slice(0, 240)).slice(0, 4) : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map((item) => String(item).slice(0, 240)).slice(0, 4) : [],
    sampleAnswer: String(parsed.sampleAnswer || '').slice(0, 1000),
    uncertain: Boolean(parsed.uncertain)
  };
}

function preferredModel(purpose) {
  if (purpose === 'smart' && String(process.env.AI_MODE || 'SMART').toUpperCase() === 'SMART') {
    return process.env.GEMINI_SMART_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  }
  return process.env.GEMINI_MODEL || 'gemini-3.8-flash';
}

async function postGemini(model, prompt, maxOutputTokens, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'Bạn là trợ giảng học tập an toàn cho học sinh Việt Nam. Hãy dùng tiếng Việt rõ ràng, tích cực, phù hợp lứa tuổi và chỉ dựa vào nội dung đã cung cấp. Không yêu cầu thông tin riêng tư, không làm thay toàn bộ khi mục tiêu là gợi mở, không bịa trích dẫn sách giáo khoa. Khi được yêu cầu JSON, chỉ trả JSON hợp lệ.' }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, maxOutputTokens, responseMimeType: 'application/json' }
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const error = new Error(`GEMINI_HTTP_${response.status}`);
      error.status = response.status;
      error.providerMessage = body.slice(0, 1200);
      throw error;
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n');
    if (!text) throw new Error('GEMINI_EMPTY_RESPONSE');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiNow(prompt, maxOutputTokens, purpose) {
  if (!aiConfigured()) throw new Error('AI_PROVIDER_NOT_CONFIGURED');
  const now = Date.now();
  if (cooldownUntil > now) throw new Error('GEMINI_COOLDOWN_ACTIVE');
  const minGapMs = Math.min(Math.max(Number(process.env.GEMINI_MIN_REQUEST_GAP_MS) || 8000, 0), 60000);
  const waitMs = Math.max(0, lastRequestAt + minGapMs - Date.now());
  if (waitMs > 0) await delay(waitMs);
  if (cooldownUntil > Date.now()) throw new Error('GEMINI_COOLDOWN_ACTIVE');
  lastRequestAt = Date.now();
  const model = preferredModel(purpose);
  const timeoutMs = Math.min(Math.max(Number(process.env.GEMINI_TIMEOUT_MS) || 45000, 5000), 420000);
  const retryCount = Math.min(Math.max(Number(process.env.GEMINI_RETRY_COUNT) || 0, 0), 2);
  let lastError;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await postGemini(model, prompt, Math.min(Math.max(Number(maxOutputTokens) || 1800, 256), 24000), timeoutMs);
    } catch (error) {
      lastError = error;
      const providerMessage = String(error.providerMessage || '').toLowerCase();
      if (error.status === 429 || /quota|resource_exhausted|rate.?limit/.test(providerMessage)) {
        const daily = /daily|per day|requests per day|quota exceeded for quota metric/i.test(providerMessage);
        const cooldown = daily
          ? Math.max(60000, Number(process.env.GEMINI_DAILY_QUOTA_COOLDOWN_MS) || 86400000)
          : Math.max(60000, Number(process.env.GEMINI_QUOTA_COOLDOWN_MS) || 600000);
        cooldownUntil = Date.now() + cooldown;
        break;
      }
      if (attempt < retryCount) await delay(Math.min(Number(process.env.GEMINI_RETRY_BASE_MS) || 6000, 30000));
    }
  }
  if (lastError && cooldownUntil <= Date.now()) cooldownUntil = Date.now() + Math.max(1000, Number(process.env.GEMINI_FAILURE_COOLDOWN_MS) || 300000);
  if (lastError) throw lastError;
  throw new Error('GEMINI_REQUEST_FAILED');
}

function callGemini(prompt, maxOutputTokens = 1800, purpose = 'normal') {
  const job = requestQueue.catch(() => undefined).then(() => callGeminiNow(prompt, maxOutputTokens, purpose));
  requestQueue = job.catch(() => undefined);
  return job;
}

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN').replace(/[^a-z0-9]+/g, ' ').trim();
}

function heuristicGrade({ answer, question, lesson }) {
  const text = normalizeText(answer);
  const terms = (question.keyConcepts || []).map(normalizeText).filter((term) => term.length > 2);
  const rubricCount = (question.rubric || []).length || 4;
  const lengthScore = text.length >= 30 ? 25 : text.length >= 12 ? 15 : text.length > 0 ? 6 : 0;
  const matches = terms.filter((term) => text.includes(term)).length;
  const conceptScore = terms.length ? Math.min(45, Math.round(matches / terms.length * 45)) : 0;
  const structureScore = /vi du|giai thich|vi sao|buoc|ket qua|nhan xet/.test(text) ? 20 : 8;
  const clarityScore = text.split(' ').filter(Boolean).length >= Math.min(8, rubricCount * 2) ? 10 : 4;
  const score = Math.min(75, lengthScore + conceptScore + structureScore + clarityScore);
  return {
    score,
    feedback: score >= 55
      ? 'Đây là điểm sơ bộ theo độ đầy đủ và từ khóa, chưa phải kết luận chuyên môn. Hãy kiểm tra lại xem câu trả lời có đúng trọng tâm bài học và giải thích rõ bằng ví dụ không.'
      : 'Câu trả lời còn ngắn hoặc chưa thể hiện rõ cách suy nghĩ. Hãy trả lời đúng câu hỏi, nêu một ý chính, giải thích lí do và thêm một ví dụ. Điểm này chỉ là ước lượng khi AI trực tuyến chưa khả dụng.',
    strengths: text ? ['Bạn đã bắt đầu trình bày ý tưởng của mình.'] : [],
    improvements: ['Bám sát yêu cầu câu hỏi.', 'Thêm một lí do, bước làm hoặc ví dụ phù hợp.'],
    sampleAnswer: `Gợi ý cấu trúc: nêu ý chính về “${lesson.title}” → giải thích bằng lời của em → đưa một ví dụ → kiểm tra lại câu trả lời.`,
    uncertain: true
  };
}

async function gradeWrittenAnswer({ answer, question, lesson, grade }) {
  const cleanAnswer = String(answer || '').trim().slice(0, 5000);
  if (!cleanAnswer) return { ...heuristicGrade({ answer: '', question, lesson }), score: 0, feedback: 'Em chưa nhập câu trả lời. Hãy thử viết ý của mình trước khi nộp.', gradingMode: 'heuristic-fallback' };
  if (!aiConfigured()) return { ...heuristicGrade({ answer: cleanAnswer, question, lesson }), gradingMode: 'heuristic-fallback' };
  const prompt = `Chấm bài viết của học sinh lớp ${grade} ở môn ${lesson.subjectName}.\nBài học: ${lesson.title}\nCâu hỏi: ${question.prompt}\nTiêu chí: ${(question.rubric || []).join('; ')}\nNội dung bài liên quan: ${lesson.objective}\nCâu trả lời học sinh:\n${cleanAnswer}\n\nĐánh giá công bằng theo lứa tuổi, không phạt lỗi chính tả nhỏ nếu không phải mục tiêu. Không đòi một đáp án duy nhất nếu có nhiều cách đúng. Nếu không đủ căn cứ, đặt uncertain=true và không đưa điểm quá tự tin. Trả JSON đúng cấu trúc: {"score":0,"feedback":"...","strengths":["..."],"improvements":["..."],"sampleAnswer":"...","uncertain":false}. Điểm 0-100.`;
  try {
    const raw = await callGemini(prompt, Math.min(Number(process.env.GEMINI_COURSE_MAX_OUTPUT_TOKENS) || 1800, 2200), 'smart');
    const graded = parseScoreJson(raw);
    return { ...graded, gradingMode: 'gemini-ai' };
  } catch (_error) {
    return { ...heuristicGrade({ answer: cleanAnswer, question, lesson }), gradingMode: 'heuristic-fallback' };
  }
}

async function tutorReply({ message, lesson, grade, progressSummary }) {
  const cleanMessage = String(message || '').trim().slice(0, 1500);
  if (!cleanMessage) return { answer: 'Em hãy nhập câu hỏi hoặc nói rõ phần nào em chưa hiểu nhé.', mode: 'rule-based' };
  if (aiConfigured()) {
    try {
      const prompt = `Học sinh lớp ${grade}, môn ${lesson.subjectName}, bài “${lesson.title}”. Mục tiêu: ${lesson.objective}.\nNội dung phần học hiện tại: ${lesson.parts.map((part) => `${part.title}: ${part.content}`).join('\n').slice(0, 4500)}\nTình hình học tập: ${progressSummary || 'Chưa có đủ dữ liệu.'}\nCâu hỏi của học sinh: ${cleanMessage}\nHãy trả lời ngắn gọn, chia bước, dùng ví dụ dễ hiểu; nếu phù hợp hãy hỏi lại một câu để kiểm tra hiểu bài. Không đưa thông tin cá nhân hoặc nội dung không phù hợp lứa tuổi. Trả JSON {"answer":"...","followUp":"..."}.`;
      const raw = await callGemini(prompt, 1200);
      const parsed = JSON.parse(stripJsonFence(raw));
      if (typeof parsed.answer === 'string' && parsed.answer.trim()) return { answer: parsed.answer.slice(0, 2500), followUp: String(parsed.followUp || '').slice(0, 500), mode: 'gemini-ai' };
    } catch (_error) { /* Continue with the local pedagogical fallback. */ }
  }
  const text = normalizeText(cleanMessage);
  let answer;
  if (/dap an|ket qua|bao nhieu|tinh/.test(text) && lesson.subjectCode === 'math') {
    answer = `Mình cùng làm từng bước nhé. Trong bài “${lesson.title}”, trước hết hãy xác định dữ kiện và điều đề bài yêu cầu. Sau đó chọn phép tính phù hợp, tính chậm từng bước rồi thử thay kết quả vào đề để kiểm tra. Em gửi cách làm hiện tại, mình sẽ giúp tìm bước cần sửa.`;
  } else if (/khong hieu|chua hieu|giai thich|la gi|vi sao/.test(text)) {
    answer = `Mình giải thích lại bằng cách đơn giản hơn nhé. Ý chính của bài “${lesson.title}” là: ${lesson.objective} Hãy xem lại phần “Lý thuyết trọng tâm”, sau đó tự nêu một ví dụ gần gũi. Nếu vẫn khó, hãy cho biết từ hoặc bước nào làm em bối rối.`;
  } else {
    answer = `Câu hỏi hay đó! Với bài “${lesson.title}”, em hãy bắt đầu bằng việc nói điều mình đã biết, xác định điều muốn tìm rồi liên hệ với ví dụ trong phần bài giảng. ${lesson.parts[2]?.content?.split('\n')[0] || 'Làm từng bước và tự kiểm tra kết quả.'} Em có thể gửi thử một cách giải thích của mình để mình cùng xem lại.`;
  }
  return { answer, followUp: 'Em thử giải thích lại bằng lời của mình được không?', mode: 'rule-based' };
}

function recommendNextStep({ progressDocs, courseCatalog = [], grade, programCode }) {
  const docsByCourse = new Map(progressDocs.map((doc) => [doc.courseId, doc]));
  const records = [];
  for (const doc of progressDocs) {
    for (const lesson of doc.lessons || []) records.push({ ...lesson, subjectCode: doc.subjectCode, courseId: doc.courseId });
  }
  const completed = records.filter((lesson) => lesson.passed).length;
  const weak = records.filter((lesson) => !lesson.passed && Number(lesson.attempts) > 0).sort((a, b) => Number(a.bestScore || 0) - Number(b.bestScore || 0))[0];
  if (weak) return { type: 'review', title: 'Ôn lại một phần còn khó', message: `Bài học đang cần ôn lại có điểm tốt nhất ${weak.bestScore || 0}. Hãy xem phản hồi, học lại từng phần rồi thử lại.`, grade, programCode, subjectCode: weak.subjectCode, lessonId: weak.lessonId, completedLessons: completed };

  let nextLesson = null;
  let nextCourse = null;
  for (const course of courseCatalog) {
    const progress = docsByCourse.get(course.id) || { lessons: [] };
    const recordMap = new Map((progress.lessons || []).map((item) => [item.lessonId, item]));
    const lessons = (course.units || []).flatMap((unit) => unit.lessons || []);
    for (let index = 0; index < lessons.length; index += 1) {
      const current = lessons[index];
      const currentRecord = recordMap.get(current.id);
      if (currentRecord?.passed) continue;
      const previousRecord = index > 0 ? recordMap.get(lessons[index - 1].id) : null;
      if (index === 0 || previousRecord?.passed) {
        nextLesson = current;
        nextCourse = course;
        break;
      }
    }
    if (nextLesson) break;
  }

  const totalLessons = courseCatalog.reduce((sum, course) => sum + Number(course.lessonCount || 0), 0);
  if (!nextLesson) return { type: 'review', title: 'Ôn tập để củng cố kiến thức', message: 'Em đã đạt điều kiện các bài hiện tại. Hãy làm đề luyện tập hoặc xem lại những phần muốn ghi nhớ lâu hơn.', grade, programCode, completedLessons: completed, totalLessons };
  if (completed === 0) return { type: 'start', title: 'Bắt đầu với bài đầu tiên', message: `Gợi ý bắt đầu môn ${nextCourse.subjectName}: ${nextLesson.title}. Học từng phần, làm câu hỏi kiểm tra ngắn rồi mới chuyển sang phần tiếp theo.`, grade, programCode, subjectCode: nextCourse.subjectCode, lessonId: nextLesson.id, completedLessons: 0, totalLessons };
  return { type: 'continue', title: `Tiếp tục: ${nextLesson.title}`, message: `${completed} bài đã đạt điều kiện. Bước học kế tiếp được chọn theo tiến độ hiện tại: ${nextCourse.subjectName} · ${nextLesson.title}.`, grade, programCode, subjectCode: nextCourse.subjectCode, lessonId: nextLesson.id, completedLessons: completed, totalLessons, remainingLessons: Math.max(0, totalLessons - completed) };
}


function subjectPreferences(survey = {}) {
  const values = new Set(survey.topics || []);
  const goal = String(survey.goal || 'school_support');
  const preferred = [];
  const add = (code) => { if (!preferred.includes(code)) preferred.push(code); };
  if (values.has('math')) add('math');
  if (values.has('english') || values.has('toeic') || goal === 'english') add('english');
  if (values.has('school_subjects') || goal === 'school_support' || goal === 'entrance_exam') { add('vietnamese'); add('math'); }
  if (values.has('javascript') || values.has('css_html') || values.has('cpp') || values.has('java') || values.has('csharp') || values.has('python') || goal === 'programming' || goal === 'career') add('ict');
  if (!preferred.length) { add('math'); add('vietnamese'); }
  return preferred;
}

function buildStudyPlanFallback({ survey = null, grade, programCode, programName, courseCatalog = [], progressDocs = [] }) {
  const preferences = subjectPreferences(survey || {});
  const progressByCourse = new Map(progressDocs.map((doc) => [doc.courseId, doc]));
  const candidates = [];
  for (const course of courseCatalog) {
    const progress = progressByCourse.get(course.id) || { lessons: [] };
    const records = new Map((progress.lessons || []).map((item) => [item.lessonId, item]));
    const lessons = (course.units || []).flatMap((unit) => unit.lessons || []);
    for (let index = 0; index < lessons.length; index += 1) {
      const lesson = lessons[index];
      if (records.get(lesson.id)?.passed) continue;
      const previous = index > 0 ? records.get(lessons[index - 1].id) : null;
      if (index === 0 || previous?.passed) {
        candidates.push({ lessonId: lesson.id, title: lesson.title, subjectCode: course.subjectCode, subjectName: course.subjectName, unitTitle: lesson.unitTitle || '', sequence: lesson.sequence });
      }
      break;
    }
  }
  candidates.sort((a, b) => {
    const aRank = preferences.indexOf(a.subjectCode);
    const bRank = preferences.indexOf(b.subjectCode);
    return (aRank < 0 ? 999 : aRank) - (bRank < 0 ? 999 : bRank);
  });
  const hours = String(survey?.weeklyHours || '3-5');
  const sessionCount = hours === '1-2' ? 2 : hours === '3-5' ? 3 : hours === '6-9' ? 4 : 5;
  const duration = hours === '1-2' ? 20 : hours === '3-5' ? 25 : hours === '6-9' ? 30 : 40;
  const style = String(survey?.learningStyle || 'mixed');
  const activity = style === 'reading' ? 'Đọc lý thuyết, ghi 3 ý chính rồi tự nói lại bằng lời của mình.'
    : style === 'video' ? 'Học phần bài giảng/ví dụ, dừng sau mỗi bước và tự giải thích cách làm.'
    : style === 'practice' ? 'Làm luyện tập có hướng dẫn, kiểm tra nhanh và xem lại câu sai.'
    : style === 'project' ? 'Vận dụng kiến thức vào một tình huống gần gũi, trình bày cách làm hoặc sản phẩm nhỏ.'
    : 'Học lý thuyết, làm checkpoint và kết thúc bằng một câu giải thích hoặc ví dụ.';
  const sessions = [];
  for (let index = 0; index < sessionCount; index += 1) {
    const item = candidates[index % Math.max(candidates.length, 1)];
    if (!item) break;
    sessions.push({ session: index + 1, lessonId: item.lessonId, title: item.title, subjectCode: item.subjectCode, subjectName: item.subjectName, minutes: duration, focus: index === 0 ? 'Bắt đầu với bài đang mở; đọc mục tiêu và học phần đầu tiên.' : index === 1 ? 'Tiếp tục bài học, làm checkpoint và ghi lại lỗi cần sửa.' : index === 2 ? 'Ôn lại câu sai rồi thử giải thích kiến thức bằng lời của mình.' : 'Ôn tập ngắn và củng cố phần đã học trước khi tăng độ khó.', activity });
  }
  const levelText = ({ beginner: 'bắt đầu từ bước nhỏ', basic: 'ôn nhanh kiến thức nền trước khi luyện tập', intermediate: 'kết hợp luyện tập và giải thích cách làm', advanced: 'ưu tiên vận dụng và tự kiểm tra sâu hơn' })[survey?.currentLevel] || 'học từng phần và tăng độ khó theo kết quả';
  return {
    title: 'Kế hoạch học tập cá nhân trong tuần',
    summary: `Lớp ${grade} · ${programName}. Kế hoạch dựa trên hồ sơ hiện có và tiến độ mở khóa, ${levelText}. Mỗi buổi khoảng ${duration} phút; chỉ chọn bài đang đủ điều kiện học.`,
    mode: 'rule-based',
    sessionCount: sessions.length,
    sessions,
    notice: 'Gợi ý dự phòng theo quy tắc; chưa phải kế hoạch do AI trực tuyến tạo.'
  };
}

async function createPersonalizedStudyPlan(input) {
  const fallback = buildStudyPlanFallback(input);
  if (!fallback.sessions.length || !aiConfigured()) return fallback;
  const candidates = fallback.sessions.map(({ lessonId, title, subjectCode, subjectName, minutes }) => ({ lessonId, title, subjectCode, subjectName, minutes }));
  const survey = input.survey || {};
  const safeProfile = {
    goal: survey.goal || 'school_support',
    topics: Array.isArray(survey.topics) ? survey.topics.slice(0, 12) : [],
    currentLevel: survey.currentLevel || 'beginner',
    weeklyHours: survey.weeklyHours || '3-5',
    learningStyle: survey.learningStyle || 'mixed',
    educationLevel: survey.educationLevel || 'primary'
  };
  const prompt = `Tạo một kế hoạch học tập tuần phù hợp với học sinh theo lớp và cấp học ở Việt Nam. Chỉ chọn lessonId trong danh sách ứng viên; tuyệt đối không tự tạo mã bài, không chọn bài khác danh sách. Dùng tiếng Việt thân thiện và phù hợp lớp ${input.grade}. Bộ sách: ${input.programName}. Hồ sơ khảo sát (các mã lựa chọn): ${JSON.stringify(safeProfile)}. Ứng viên đang đủ điều kiện: ${JSON.stringify(candidates)}. Tạo tối đa ${fallback.sessions.length} buổi, mỗi buổi 15–40 phút. Nội dung buổi phải khuyến khích tự học, checkpoint và xem lại lỗi, không khẳng định điểm số chắc chắn. Trả JSON: {"summary":"...","sessions":[{"lessonId":"mã từ ứng viên","focus":"...","activity":"...","minutes":25}],"notice":"..."}.`;
  try {
    const raw = await callGemini(prompt, 1400, 'smart');
    const parsed = JSON.parse(stripJsonFence(raw));
    const allowed = new Map(candidates.map((item) => [item.lessonId, item]));
    const sessions = (Array.isArray(parsed.sessions) ? parsed.sessions : []).slice(0, fallback.sessions.length).flatMap((session, index) => {
      const candidate = allowed.get(String(session.lessonId || ''));
      if (!candidate) return [];
      return [{
        session: index + 1,
        lessonId: candidate.lessonId,
        title: candidate.title,
        subjectCode: candidate.subjectCode,
        subjectName: candidate.subjectName,
        minutes: Math.min(40, Math.max(15, Number(session.minutes) || candidate.minutes)),
        focus: String(session.focus || fallback.sessions[index]?.focus || 'Học từng phần, làm checkpoint và xem lại câu sai.').slice(0, 300),
        activity: String(session.activity || fallback.sessions[index]?.activity || 'Học lý thuyết và làm bài kiểm tra ngắn.').slice(0, 400)
      }];
    });
    if (!sessions.length) return fallback;
    return { title: fallback.title, summary: String(parsed.summary || fallback.summary).slice(0, 800), mode: 'gemini-ai', sessionCount: sessions.length, sessions, notice: String(parsed.notice || 'Kế hoạch AI tạo dựa trên hồ sơ và danh sách bài học đang mở; hãy điều chỉnh theo thời gian thực tế.').slice(0, 400) };
  } catch (_error) {
    return { ...fallback, notice: 'AI trực tuyến chưa tạo được kế hoạch; hệ thống dùng gợi ý theo quy tắc.' };
  }
}

module.exports = { aiConfigured, callGemini, gradeWrittenAnswer, tutorReply, recommendNextStep, buildStudyPlanFallback, createPersonalizedStudyPlan, normalizeText, preferredModel };

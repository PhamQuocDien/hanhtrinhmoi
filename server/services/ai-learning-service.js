'use strict';

const { hashText, generateStructured, generateSpeech, generateText, getGeminiModel, getAiMode, isRemoteAiAllowed, isGeminiConfigured } = require('./gemini-service');
const { findStarterCourse, buildStarterDraft, STARTER_COURSES } = require('./starter-course-catalog');
const { makeCourseDraft } = require('./local-course-composer');
const { queueGenerationJob } = require('./generation-job-queue');
const { validateAssessmentScope, prepareAdaptiveDiagnosticQuestions, auditLessonLearningContent } = require('./assessment-integrity-v37');

const COURSE_LEVELS = new Set(['PRIMARY', 'SECONDARY_LOWER', 'SECONDARY_UPPER', 'HIGHER_EDUCATION', 'ENGLISH_CERTIFICATION']);
const QUESTION_TYPES = new Set(['single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'short_answer', 'ordering', 'matching', 'numerical', 'essay', 'listening', 'speaking', 'image_based', 'reading_comprehension', 'coding', 'practical', 'timed_simulation']);
function listValues(value, depth = 0) {
    if (depth > 5 || value === null || value === undefined || value === '') return [];
    if (Array.isArray(value)) return value.slice(0, 300);
    if (typeof value === 'string') return value.split(/[\n,;]+/).map(item => item.trim()).filter(Boolean).slice(0, 300);
    if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
    if (typeof value === 'object') {
        for (const key of ['items', 'values', 'skills', 'majorTracks', 'aliases', 'goals', 'data']) if (value[key] !== undefined) return listValues(value[key], depth + 1);
        const label = value.label ?? value.name ?? value.title ?? value.text ?? value.value ?? value.code;
        return label === undefined || label === null ? [] : listValues(label, depth + 1);
    }
    return [];
}
const listText = value => listValues(value).map(item => typeof item === 'object' ? (item.label ?? item.name ?? item.title ?? item.text ?? item.value ?? item.code ?? '') : String(item)).map(item => String(item ?? '').trim()).filter(Boolean).slice(0, 300);

const courseSchema = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        code: { type: 'string' },
        description: { type: 'string' },
        audience: { type: 'string' },
        courseType: { type: 'string' },
        educationLevel: { type: 'string' },
        grade: { type: 'integer' },
        subjectId: { type: 'string' },
        targetExam: { type: 'string' },
        targetVariant: { type: 'string' },
        difficulty: { type: 'string' },
        estimatedMinutes: { type: 'integer' },
        objectives: { type: 'array', items: { type: 'string' } },
        prerequisites: { type: 'array', items: { type: 'string' } },
        skills: { type: 'array', items: { type: 'string' } },
        learningOutcomes: { type: 'array', items: { type: 'string' } },
        chapters: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    test: {
                        type: 'object',
                        properties: {
                            passingScore: { type: 'number' },
                            durationSeconds: { type: 'integer' },
                            questions: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        prompt: { type: 'string' }, type: { type: 'string' }, options: { type: 'array', items: { type: 'string' } },
                                        answer: { type: 'string' }, explanation: { type: 'string' }, skill: { type: 'string' }, difficulty: { type: 'string' }, points: { type: 'number' }
                                    }, required: ['prompt', 'type', 'answer', 'explanation']
                                }
                            }
                        }, required: ['questions']
                    },
                    lessons: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' }, description: { type: 'string' }, objectives: { type: 'array', items: { type: 'string' } }, skills: { type: 'array', items: { type: 'string' } },
                                theorySections: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } }, required: ['title', 'content'] } },
                                examples: { type: 'array', items: { type: 'string' } }, commonMistakes: { type: 'array', items: { type: 'string' } },
                                audioScript: { type: 'string' }, estimatedMinutes: { type: 'integer' }, difficulty: { type: 'string' },
                                test: {
                                    type: 'object',
                                    properties: {
                                        passingScore: { type: 'number' }, durationSeconds: { type: 'integer' },
                                        questions: {
                                            type: 'array', items: {
                                                type: 'object', properties: {
                                                    prompt: { type: 'string' }, type: { type: 'string' }, options: { type: 'array', items: { type: 'string' } },
                                                    answer: { type: 'string' }, explanation: { type: 'string' }, skill: { type: 'string' }, difficulty: { type: 'string' }, points: { type: 'number' }
                                                }, required: ['prompt', 'type', 'answer', 'explanation']
                                            }
                                        }
                                    }, required: ['questions']
                                }
                            }, required: ['title', 'description', 'objectives', 'theorySections', 'test']
                        }
                    }
                }, required: ['title', 'lessons']
            }
        },
        finalAssessment: {
            type: 'object',
            properties: {
                passingScore: { type: 'number' }, durationSeconds: { type: 'integer' },
                questions: {
                    type: 'array', items: {
                        type: 'object', properties: {
                            prompt: { type: 'string' }, type: { type: 'string' }, options: { type: 'array', items: { type: 'string' } },
                            answer: { type: 'string' }, explanation: { type: 'string' }, skill: { type: 'string' }, difficulty: { type: 'string' }, points: { type: 'number' }
                        }, required: ['prompt', 'type', 'answer', 'explanation']
                    }
                }
            }, required: ['questions']
        }
    },
    required: ['title', 'description', 'objectives', 'chapters', 'finalAssessment']
};

const directorSchema = {
    type: 'object',
    properties: {
        decision: { type: 'string', enum: ['CONTINUE_COURSE', 'REVIEW_SKILL', 'CREATE_PERSONAL_COURSE', 'GENERATE_DIAGNOSTIC', 'RECOMMEND_ENGLISH_TRACK', 'RECOMMEND_UNIVERSITY_TRACK'] },
        priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH'] },
        reason: { type: 'array', items: { type: 'string' } },
        skillGaps: { type: 'array', items: { type: 'string' } },
        recommendedCourseId: { type: 'string' },
        recommendedAction: { type: 'string' },
        courseRequest: { type: 'string' }
    },
    required: ['decision', 'priority', 'reason', 'skillGaps', 'recommendedAction']
};

const profileInferenceSchema = {
    type: 'object',
    properties: {
        domain: { type: 'string' }, field: { type: 'string' }, disciplineGroup: { type: 'string' }, major: { type: 'string' }, specialization: { type: 'string' },
        careerGoal: { type: 'string' }, confidence: { type: 'number' }, evidence: { type: 'array', items: { type: 'string' } }, needsConfirmation: { type: 'boolean' }
    },
    required: ['domain', 'field', 'disciplineGroup', 'major', 'specialization', 'careerGoal', 'confidence', 'evidence', 'needsConfirmation']
};

const diagnosticSchema = {
    type: 'object',
    properties: {
        title: { type: 'string' }, purpose: { type: 'string' }, stoppingRule: { type: 'string' },
        skills: { type: 'array', items: { type: 'string' } },
        questions: { type: 'array', items: { type: 'object', properties: { prompt: { type: 'string' }, type: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answer: { type: 'string' }, explanation: { type: 'string' }, skill: { type: 'string' }, difficulty: { type: 'string' }, points: { type: 'number' } }, required: ['prompt', 'type', 'answer', 'explanation', 'skill'] } }
    },
    required: ['title', 'purpose', 'stoppingRule', 'skills', 'questions']
};


const codingQuestionSchema = {
    type: 'object',
    properties: {
        language: { type: 'string' }, starterCode: { type: 'string' }, statement: { type: 'string' }, inputFormat: { type: 'string' }, outputFormat: { type: 'string' }, timeLimitMs: { type: 'integer' },
        visibleTestCases: { type: 'array', items: { type: 'object', properties: { input: { type: 'string' }, output: { type: 'string' } }, required: ['input','output'] } },
        hiddenTestCases: { type: 'array', items: { type: 'object', properties: { input: { type: 'string' }, output: { type: 'string' } }, required: ['input','output'] } }
    },
    required: ['language','starterCode','statement','inputFormat','outputFormat','visibleTestCases']
};
const generatedQuestionSchema = {
    type: 'object',
    properties: {
        prompt: { type: 'string' }, type: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answer: { type: 'string' }, explanation: { type: 'string' }, skill: { type: 'string' }, difficulty: { type: 'string' }, points: { type: 'number' },
        rubric: { type: 'object', properties: { criteria: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, weight: { type: 'number' }, description: { type: 'string' } }, required: ['name','weight'] } } } },
        media: { type: 'object', properties: { coding: codingQuestionSchema } }
    },
    required: ['prompt','type','answer','explanation','skill']
};
const courseAssessmentSchema = { type: 'object', properties: { title: { type: 'string' }, passingScore: { type: 'number' }, durationSeconds: { type: 'integer' }, questions: { type: 'array', items: generatedQuestionSchema } }, required: ['title','questions'] };
const courseBlueprintSchema = {
    type: 'object', properties: {
        title: { type: 'string' }, code: { type: 'string' }, description: { type: 'string' }, audience: { type: 'string' }, courseType: { type: 'string' }, educationLevel: { type: 'string' }, grade: { type: 'integer' }, subjectId: { type: 'string' }, targetExam: { type: 'string' }, targetVariant: { type: 'string' }, difficulty: { type: 'string' }, estimatedMinutes: { type: 'integer' },
        objectives: { type: 'array', items: { type: 'string' } }, prerequisites: { type: 'array', items: { type: 'string' } }, skills: { type: 'array', items: { type: 'string' } }, learningOutcomes: { type: 'array', items: { type: 'string' } },
        chapters: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, test: courseAssessmentSchema, lessons: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, objectives: { type: 'array', items: { type: 'string' } }, skills: { type: 'array', items: { type: 'string' } } }, required: ['title','description','objectives','skills'] } } }, required: ['title','description','test','lessons'] } },
        midtermAssessment: courseAssessmentSchema, finalAssessment: courseAssessmentSchema, mockAssessment: courseAssessmentSchema
    }, required: ['title','description','objectives','skills','chapters','midtermAssessment','finalAssessment','mockAssessment']
};
const lessonContentSchema = {
    type: 'object', properties: {
        title: { type: 'string' }, description: { type: 'string' }, objectives: { type: 'array', items: { type: 'string' } }, skills: { type: 'array', items: { type: 'string' } },
        theorySections: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } }, required: ['title','content'] } },
        lecture: { type: 'object', properties: { title: { type: 'string' }, script: { type: 'string' }, keyPoints: { type: 'array', items: { type: 'string' } } }, required: ['title','script','keyPoints'] },
        examples: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, problem: { type: 'string' }, solution: { type: 'string' } }, required: ['title','problem','solution'] } },
        activities: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, title: { type: 'string' }, instruction: { type: 'string' } }, required: ['type','title','instruction'] } },
        practiceTasks: { type: 'array', items: { type: 'string' } }, commonMistakes: { type: 'array', items: { type: 'string' } }, audioScript: { type: 'string' }, visualPrompt: { type: 'string' }, estimatedMinutes: { type: 'integer' }, difficulty: { type: 'string' },
        test: { type: 'object', properties: { passingScore: { type: 'number' }, durationSeconds: { type: 'integer' }, questions: { type: 'array', items: generatedQuestionSchema } }, required: ['questions'] }
    }, required: ['title','description','objectives','skills','theorySections','lecture','examples','activities','practiceTasks','commonMistakes','audioScript','visualPrompt','test']
};

function clean(value, max = 5000) { return String(value ?? '').trim().slice(0, max); }
function safeArray(value, max = 30) { return Array.isArray(value) ? value.slice(0, max) : []; }
function fingerprint(input) { return hashText(JSON.stringify(input)); }
function normalizeTokens(value) { return clean(value, 1000).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter(item => item.length > 2); }
function similarity(a, b) {
    const left = new Set(normalizeTokens(a));
    const right = new Set(normalizeTokens(b));
    if (!left.size || !right.size) return 0;
    let overlap = 0;
    for (const token of left) if (right.has(token)) overlap += 1;
    return overlap / Math.max(left.size, right.size);
}
function normalizeEducationLevel(value, grade) {
    if (COURSE_LEVELS.has(value)) return value;
    if (Number(grade) >= 1 && Number(grade) <= 5) return 'PRIMARY';
    if (Number(grade) >= 6 && Number(grade) <= 9) return 'SECONDARY_LOWER';
    if (Number(grade) >= 10 && Number(grade) <= 12) return 'SECONDARY_UPPER';
    return 'HIGHER_EDUCATION';
}

async function loadEducationNames(models, education) {
    if (!education) return {};
    const lookups = [
        ['university', models.University, education.universityId], ['faculty', models.Faculty, education.facultyId], ['field', models.Field, education.fieldId],
        ['disciplineGroup', models.DisciplineGroup, education.disciplineGroupId], ['major', models.Major, education.majorId], ['specialization', models.Specialization, education.specializationId],
        ['trainingProgram', models.TrainingProgram, education.trainingProgramId]
    ];
    const entries = await Promise.all(lookups.map(async ([key, Model, id]) => {
        if (!id || !Model) return [key, null];
        const doc = await Model.findById(id).lean();
        return [key, doc ? { id: doc._id, code: doc.code, name: doc.name || doc.programName || doc.shortName || '' } : null];
    }));
    return Object.fromEntries(entries);
}

async function buildLearnerContext(models, username) {
    const [profile, education, learning, mastery, plans, courses, surveyAttempt, placementAttempt, aiDecisions] = await Promise.all([
        models.Profile.findOne({ username }).lean(), models.EducationProfile.findOne({ username }).lean(), models.LearningProfile.findOne({ username }).lean(),
        models.SkillMastery.find({ username }).sort({ updatedAt: -1 }).limit(100).lean(), models.LearningPlan.find({ username }).sort({ version: -1 }).limit(2).lean(),
        models.Course.find({ $or: [{ ownerUsername: username }, { kind: 'CANONICAL' }] }).sort({ createdAt: -1 }).limit(120).lean(),
        models.SurveyAttempt.findOne({ username }).sort({ submittedAt: -1, createdAt: -1 }).lean(),
        models.PlacementAttempt.findOne({ username }).sort({ submittedAt: -1, createdAt: -1 }).lean(),
        models.AIDecisionLog.find({ username }).sort({ createdAt: -1 }).limit(12).lean()
    ]);
    const educationContext = await loadEducationNames(models, education);
    const currentPlan = plans[0] || null;
    return {
        profile, education, educationContext, learning, mastery, currentPlan, surveyAttempt, placementAttempt,
        recentAiDecisions: aiDecisions.map(item => ({ decision: item.decision, reason: item.reason, actionTaken: item.actionTaken, timestamp: item.createdAt })),
        courses: courses.map(course => ({ id: String(course._id), code: course.code, name: course.name, grade: course.grade, educationLevel: course.educationLevel, subjectId: course.subjectId, kind: course.kind, category: course.category, ownerUsername: course.ownerUsername, majorId: course.majorId, trainingProgramId: course.trainingProgramId, syllabus: course.syllabus || {} }))
    };
}

function fallbackLearnerInference(context, error = null) {
    const education = context?.education || {};
    const names = context?.educationContext || {};
    const existing = context?.learning?.inference || {};
    const major = clean(names.major?.name || existing.major, 200);
    const field = clean(names.field?.name || existing.field, 200);
    const specialization = clean(names.specialization?.name || existing.specialization, 200);
    const disciplineGroup = clean(names.disciplineGroup?.name || existing.disciplineGroup, 200);
    const domain = clean(names.field?.name || names.disciplineGroup?.name || existing.domain || education.educationLevel, 200);
    const careerGoal = clean((context?.learning?.goals || [])[0] || existing.careerGoal, 300);
    const evidence = [];
    if (education.grade) evidence.push(`Lớp ${education.grade} được khai báo trong hồ sơ.`);
    if (major) evidence.push(`Ngành ${major} đã có trong hồ sơ/quan hệ đào tạo.`);
    if (specialization) evidence.push(`Chuyên ngành ${specialization} đã có trong hồ sơ/quan hệ đào tạo.`);
    if (careerGoal) evidence.push(`Mục tiêu học tập/nghề nghiệp: ${careerGoal}.`);
    return {
        domain, field, disciplineGroup, major, specialization, careerGoal,
        confidence: Math.min(0.72, Math.max(0.45, 0.45 + evidence.length * 0.06)), evidence,
        needsConfirmation: !major && !field && !careerGoal, model: 'RULE_BASED_FALLBACK', promptVersion: 'RULE-FALLBACK-1', generatedAt: new Date(), source: 'RULE_BASED_FALLBACK',
        degraded: true, aiErrorCode: error?.code || 'GEMINI_UNAVAILABLE'
    };
}

async function inferLearnerContext({ models, username, force = false } = {}) {
    const context = await buildLearnerContext(models, username);
    const existingInference = context.learning?.inference;
    const generatedAt = existingInference?.generatedAt ? new Date(existingInference.generatedAt).getTime() : 0;
    const inferenceTtlMs = 30 * 60 * 1000;
    if (!force && existingInference && generatedAt && generatedAt > Date.now() - inferenceTtlMs) return { context, inference: existingInference, reused: true, degraded: existingInference.source === 'RULE_BASED_FALLBACK' || Boolean(existingInference.degraded) };
    if (!isRemoteAiAllowed()) {
        const inference = fallbackLearnerInference(context, { code: 'SMART_MODE_LOCAL' });
        try { await models.LearningProfile.findOneAndUpdate({ username }, { $set: { inference } }, { upsert: true, new: true, setDefaultsOnInsert: true }); } catch (_) {}
        return { context: await buildLearnerContext(models, username), inference, reused: false, degraded: false, smartMode: getAiMode() };
    }
    const prompt = `Xác định ngữ cảnh học tập của người dùng Hành Trình Mới dựa trên hồ sơ khai báo, khảo sát, mục tiêu, học kỳ, các khóa học và lịch sử học. Không được tự bịa trường/ngành chính thức. Nếu chưa đủ dữ liệu, để chuỗi rỗng và needsConfirmation=true. Chỉ suy luận ngành/chuyên ngành khi có bằng chứng. Context: ${JSON.stringify(context).slice(0, 30000)}`;
    try {
        const result = await generateStructured({ prompt, schema: profileInferenceSchema, systemInstruction: 'Bạn là Education Context Analyzer. Phân biệt khai báo trực tiếp với suy luận. Không biến suy luận thành dữ liệu chính thức.', maxOutputTokens: 1800, temperature: 0.15 });
        const inference = { ...result.data, model: result.model, promptVersion: 'AI-PROFILE-1', generatedAt: new Date(), source: result.fallbackUsed ? 'AI_INFERENCE_FALLBACK_MODEL' : 'AI_INFERENCE', degraded: false, fallbackUsed: Boolean(result.fallbackUsed) };
        await models.LearningProfile.findOneAndUpdate({ username }, { $set: { inference } }, { upsert: true, new: true, setDefaultsOnInsert: true });
        return { context: await buildLearnerContext(models, username), inference, reused: false, degraded: Boolean(result.fallbackUsed) };
    } catch (error) {
        const inference = fallbackLearnerInference(context, error);
        try { await models.LearningProfile.findOneAndUpdate({ username }, { $set: { inference } }, { upsert: true, new: true, setDefaultsOnInsert: true }); } catch (_) {}
        return { context: await buildLearnerContext(models, username), inference, reused: false, degraded: true, fallback: true };
    }
}

function courseMetadataText(course) {
    return [course.name, course.code, course.subjectId, course.category, course.syllabus?.audience, course.syllabus?.track, course.syllabus?.targetExam, course.syllabus?.targetVariant, ...listText(course.syllabus?.skills), ...listText(course.syllabus?.majorTracks), ...listText(course.syllabus?.aliases)].filter(Boolean).join(' ');
}
function compatibleCourse(context, course) {
    if (!course || course.ownerUsername === context.profile?.username) return false;
    const currentLevel = context.education?.educationLevel || '';
    const targetExam = String(context.learning?.survey?.englishGoal || '').toUpperCase();
    if (course.grade && context.education?.grade && Number(course.grade) !== Number(context.education.grade)) return false;
    if (course.educationLevel === currentLevel) return true;
    if (course.syllabus?.track === 'MOS') return true;
    if (course.syllabus?.targetExam && targetExam && course.syllabus.targetExam === targetExam) return true;
    if (course.syllabus?.track === 'ENGLISH' && (targetExam === 'TOEIC' || targetExam === 'IELTS')) return true;
    if (!currentLevel && course.kind === 'CANONICAL') return true;
    return false;
}
function findBestCourse(context, searchText) {
    let candidate = null; let best = 0;
    for (const course of listValues(context.courses)) {
        if (!course || typeof course !== 'object') continue;
        if (!compatibleCourse(context, course)) continue;
        const text = courseMetadataText(course);
        const score = Math.max(similarity(searchText, text), similarity(context.educationContext?.major?.name, text), similarity(context.educationContext?.major?.code, text));
        const targetExam = String(context.learning?.survey?.englishGoal || '').toUpperCase();
        let boosted = score;
        if (targetExam && String(course.syllabus?.targetExam || '').toUpperCase() === targetExam) boosted += 0.25;
        if (context.educationContext?.major?.code && listText(course.syllabus?.majorTracks).some(track => track.toLowerCase() === String(context.educationContext.major.code).toLowerCase())) boosted += 0.2;
        if (boosted > best) { best = boosted; candidate = course; }
    }
    return { candidate, best: Math.min(1, best) };
}
async function createPersonalFromStarter({ models, username, context, request, starter } = {}) {
    if (!starter) return null;
    const gaps = (context.mastery || []).filter(item => Number(item.accuracy) < 70).slice(0, 8).map(item => item.skill);
    const requestedNeed = clean(request?.prompt || request?.goal || request?.domain || '', 800);
    const debugTestingTarget = /debug|kiểm thử|kiem thu|unit\s*test|testing|test\s*case|regression|gỡ lỗi|go loi/i.test(`${requestedNeed} ${request?.courseTitle || ''}`);
    const draft = debugTestingTarget ? makeCourseDraft({
        ...request,
        mode: 'PERSONAL',
        prompt: requestedNeed || 'Debug và kiểm thử phần mềm theo lộ trình cá nhân',
        courseTitle: request?.courseTitle || `${requestedNeed || 'Debug và kiểm thử phần mềm'} · Lộ trình cá nhân`,
        domain: requestedNeed || 'Debug và kiểm thử phần mềm',
        major: context.educationContext?.major?.name || context.learning?.inference?.major || 'Khoa học máy tính',
        subjectId: request?.subjectId || 'computer_science',
        educationLevel: 'HIGHER_EDUCATION'
    }) : buildStarterDraft(starter, {
        title: `${starter.name} · Cá nhân hóa cho ${username}`,
        educationLevel: starter.educationLevel,
        grade: context.education?.grade || null,
        subjectId: starter.subjectId,
        goal: listText(context.learning?.goals)[0] || request?.goal || '',
        major: context.educationContext?.major?.name || context.learning?.inference?.major || '',
        specialization: context.educationContext?.specialization?.name || '',
        skillGaps: gaps
    });
    const result = await materializeCourse({
        models, draft, mode: 'PERSONAL', ownerUsername: username, request: { ...request, subjectId: request.subjectId || starter.subjectId, targetExam: request.targetExam || starter.targetExam, targetVariant: request.targetVariant || starter.targetVariant },
        context: { educationLevel: starter.educationLevel, grade: context.education?.grade || null, subjectId: starter.subjectId, institutionId: context.education?.universityId, facultyId: context.education?.facultyId, majorId: context.education?.majorId, specializationId: context.education?.specializationId, trainingProgramId: context.education?.trainingProgramId, semester: context.education?.semester, targetExam: starter.targetExam, targetVariant: starter.targetVariant, generationModel: 'STARTER-CATALOG-18' },
        generateAudioAssets: false, sourceType: 'ORIGINAL_PRACTICE'
    });
    return { result, starterCode: starter.code, generatedBy: 'STARTER_CATALOG_FALLBACK' };
}

function heuristicDirectorDecision({ context, request = {}, error = null } = {}) {
    const weak = (context.mastery || []).filter(item => Number(item.accuracy) < 60).sort((a, b) => Number(a.accuracy || 0) - Number(b.accuracy || 0)).slice(0, 5);
    const overdue = (context.mastery || []).filter(item => item.reviewDueAt && new Date(item.reviewDueAt) <= new Date()).slice(0, 5);
    const major = clean(context.educationContext?.major?.name || context.learning?.inference?.major, 200);
    const goal = clean((context.learning?.goals || [])[0] || context.learning?.inference?.careerGoal || request.goal, 300);
    const explicit = clean(request.prompt || '', 1500);
    const searchText = [explicit, goal, major, ...weak.map(item => item.skill)].filter(Boolean).join(' ');
    let candidate = null; let best = 0;
    for (const course of context.courses || []) {
        const text = `${course.name || ''} ${course.code || ''} ${course.subjectId || ''} ${course.category || ''} ${course.syllabus?.audience || ''} ${JSON.stringify(course.syllabus?.skills || '')}`;
        const score = Math.max(similarity(searchText, text), similarity(major, text));
        if (course.ownerUsername === context.profile?.username) continue;
        if (context.education?.grade && course.grade && Number(course.grade) !== Number(context.education.grade)) continue;
        if (score > best) { best = score; candidate = course; }
    }
    if (overdue.length || weak.length) return { decision: 'REVIEW_SKILL', priority: weak.length >= 2 ? 'HIGH' : 'NORMAL', reason: [weak.length ? `Kỹ năng đang dưới 60%: ${weak.map(item => item.skill).join(', ')}.` : '', overdue.length ? `Có ${overdue.length} nội dung đến hạn ôn lại.` : ''].filter(Boolean), skillGaps: [...new Set([...weak.map(item => item.skill), ...overdue.map(item => item.skill)])].slice(0, 6), recommendedAction: 'Ôn lại các kỹ năng yếu/đến hạn trước khi tăng độ khó.', model: 'RULE_BASED_FALLBACK', context, promptVersion: 'RULE-DIRECTOR-1', degraded: true, aiErrorCode: error?.code || 'GEMINI_UNAVAILABLE' };

    if (candidate && best >= 0.28) return { decision: 'CONTINUE_COURSE', priority: 'NORMAL', reason: ['Đã tìm thấy khóa học phù hợp trong catalog.', `Độ tương đồng khoảng ${Math.round(best * 100)}%.`], skillGaps: [], recommendedCourseId: candidate.id, recommendedAction: `Tiếp tục với ${candidate.name}.`, model: 'RULE_BASED_FALLBACK', context, promptVersion: 'RULE-DIRECTOR-1', degraded: true, aiErrorCode: error?.code || 'GEMINI_UNAVAILABLE' };
    if (/toeic|ielts/i.test(`${goal} ${explicit}`)) return { decision: 'RECOMMEND_ENGLISH_TRACK', priority: 'NORMAL', reason: ['Phát hiện mục tiêu tiếng Anh chuẩn hóa từ hồ sơ/yêu cầu hiện tại.'], skillGaps: [], recommendedAction: 'Tiếp tục track English và tập trung kỹ năng thấp nhất.', courseRequest: `Thiết kế track English cá nhân theo mục tiêu ${goal || explicit}.`, model: 'RULE_BASED_FALLBACK', context, promptVersion: 'RULE-DIRECTOR-1', degraded: true, aiErrorCode: error?.code || 'GEMINI_UNAVAILABLE' };
    if (major) return { decision: 'RECOMMEND_UNIVERSITY_TRACK', priority: 'NORMAL', reason: [`Ngành hiện tại: ${major}.`], skillGaps: weak.map(item => item.skill), recommendedAction: `Ưu tiên các học phần/kỹ năng liên quan đến ${major}.`, courseRequest: `Tạo micro-course bổ trợ cho sinh viên ngành ${major}${weak.length ? `; tập trung ${weak.map(item => item.skill).join(', ')}.` : '.'}`, model: 'RULE_BASED_FALLBACK', context, promptVersion: 'RULE-DIRECTOR-1', degraded: true, aiErrorCode: error?.code || 'GEMINI_UNAVAILABLE' };
    return { decision: 'CONTINUE_COURSE', priority: 'LOW', reason: ['AI tạm thời không truy cập được; hệ thống đang dùng phân tích dự phòng từ dữ liệu hiện có.'], skillGaps: weak.map(item => item.skill), recommendedAction: 'Tiếp tục bài học kế tiếp trong lộ trình hiện tại.', model: 'RULE_BASED_FALLBACK', context, promptVersion: 'RULE-DIRECTOR-1', degraded: true, aiErrorCode: error?.code || 'GEMINI_UNAVAILABLE' };
}

function validateCourseDraft(draft) {
    const errors = [];
    if (!draft || typeof draft !== 'object') return { valid: false, errors: ['Draft phải là object.'], lessonCount: 0 };
    if (!clean(draft.title, 200)) errors.push('Thiếu title.');
    if (!Array.isArray(draft.chapters) || draft.chapters.length < 2) errors.push('Course cần ít nhất 2 chương/mô-đun để thể hiện tiến trình học; số chương cụ thể do AI chọn theo mục tiêu.');
    if (!draft.midtermAssessment || !Array.isArray(draft.midtermAssessment.questions) || draft.midtermAssessment.questions.length < 8) errors.push('Course cần bài kiểm tra giữa kỳ độc lập ít nhất 8 câu.');
    if (!draft.finalAssessment || !Array.isArray(draft.finalAssessment.questions) || draft.finalAssessment.questions.length < 10) errors.push('Course cần bài kiểm tra cuối khóa độc lập ít nhất 10 câu.');
    if (!draft.mockAssessment || !Array.isArray(draft.mockAssessment.questions) || draft.mockAssessment.questions.length < 10) errors.push('Course cần bài mô phỏng độc lập ít nhất 10 câu.');
    let lessonCount = 0; let chapterCount = 0;
    const lessonTitles = new Set();
    const lessonQuestionPrompts = new Map();
    const normalizeQuestionPrompt = value => clean(value, 1800).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    for (const chapter of safeArray(draft.chapters, 20)) {
        chapterCount += 1;
        if (!clean(chapter?.title, 200)) errors.push('Chapter thiếu title.');
        if (!chapter?.test || !Array.isArray(chapter.test.questions) || chapter.test.questions.length < 5) errors.push(`Chapter "${clean(chapter?.title, 100)}" cần chapter test độc lập ít nhất 5 câu.`);
        for (const lesson of safeArray(chapter?.lessons, 30)) {
            lessonCount += 1;
            const normalizedLessonTitle = normalizeQuestionPrompt(lesson?.title);
            if (normalizedLessonTitle && lessonTitles.has(normalizedLessonTitle)) errors.push(`Lesson bị trùng tên: "${clean(lesson?.title, 100)}".`);
            if (normalizedLessonTitle) lessonTitles.add(normalizedLessonTitle);
            if (!clean(lesson?.title, 200)) errors.push('Lesson thiếu title.');
            const theory = Array.isArray(lesson?.theorySections) ? lesson.theorySections : [];
            if (theory.length < 3 || theory.some(section => clean(section?.content, 6000).length < 120)) errors.push(`Lesson "${clean(lesson?.title, 100)}" thiếu lý thuyết chi tiết.`);
            if (clean(lesson?.lecture?.script, 10000).length < 180) errors.push(`Lesson "${clean(lesson?.title, 100)}" thiếu bài giảng đầy đủ.`);
            if (!Array.isArray(lesson?.examples) || lesson.examples.length < 2) errors.push(`Lesson "${clean(lesson?.title, 100)}" thiếu ví dụ.`);
            if (!Array.isArray(lesson?.practiceTasks) || lesson.practiceTasks.length < 2) errors.push(`Lesson "${clean(lesson?.title, 100)}" thiếu bài tập thực hành.`);
            if (!lesson?.test || !Array.isArray(lesson.test.questions) || lesson.test.questions.length < 5) errors.push(`Lesson "${clean(lesson?.title, 100)}" cần lesson test ít nhất 5 câu.`);
            if (Array.isArray(lesson?.test?.questions)) {
                const localPrompts = new Set();
                for (const question of lesson.test.questions) {
                    const prompt = normalizeQuestionPrompt(question?.prompt || question?.question || question?.text);
                    if (!prompt) { errors.push(`Lesson "${clean(lesson?.title, 100)}" có câu hỏi thiếu nội dung.`); continue; }
                    if (localPrompts.has(prompt)) errors.push(`Lesson "${clean(lesson?.title, 100)}" có câu hỏi trùng lặp.`);
                    localPrompts.add(prompt);
                    const previousLesson = lessonQuestionPrompts.get(prompt);
                    if (previousLesson && previousLesson !== clean(lesson?.title, 200)) errors.push(`Câu hỏi bị trùng giữa hai bài: "${previousLesson}" và "${clean(lesson?.title, 100)}".`);
                    else lessonQuestionPrompts.set(prompt, clean(lesson?.title, 200));
                }
            }
            if (lesson?.audioScript && clean(lesson.audioScript, 500).length < 100) errors.push(`Lesson "${clean(lesson?.title, 100)}" có audioScript quá ngắn.`);
        }
    }
    if (lessonCount < 6) errors.push('Course cần ít nhất 6 bài học; số bài còn lại do AI lựa chọn theo độ rộng mục tiêu, không ép cùng một khuôn mẫu.');
    return { valid: !errors.length, errors: [...new Set(errors)], lessonCount, chapterCount, assessmentStructure: { lessonTests: lessonCount, chapterTests: chapterCount, midterm: true, final: true, mock: true } };
}


function validateAdaptiveAICourseDraftV38(draft, target = {}) {
    const base = validateCourseDraft(draft);
    const errors = [...base.errors];
    const normalizeScope = value => clean(value, 200).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
    if (!clean(draft?.subjectId, 120)) errors.push('Khóa học AI thiếu subjectId; không thể bảo đảm đúng môn.');
    if (!clean(draft?.educationLevel, 80)) errors.push('Khóa học AI thiếu educationLevel.');
    if (target.grade && Number(draft.grade) !== Number(target.grade)) errors.push(`AI trả về lớp ${draft.grade || 'không xác định'}, nhưng yêu cầu là lớp ${target.grade}.`);
    if (target.subjectId && normalizeScope(draft.subjectId) !== normalizeScope(target.subjectId)) errors.push(`AI trả về môn ${draft.subjectId || 'không xác định'}, không khớp môn yêu cầu ${target.subjectId}.`);
    if (target.targetExam && !['other','general','university','k12'].includes(normalizeScope(target.targetExam)) && !normalizeScope(draft.targetExam).includes(normalizeScope(target.targetExam))) errors.push(`AI trả về track ${draft.targetExam || 'không xác định'}, không khớp chứng chỉ ${target.targetExam}.`);
    const prompts = new Map();
    const questionGroups = [
        ...safeArray(draft?.chapters, 20).flatMap((chapter, ci) => [
            { label: `chapter ${ci + 1}`, questions: safeArray(chapter.test?.questions, 40) },
            ...safeArray(chapter.lessons, 30).map(lesson => ({ label: `lesson ${clean(lesson.title, 100)}`, questions: safeArray(lesson.test?.questions, 40) }))
        ]),
        { label: 'midterm', questions: safeArray(draft?.midtermAssessment?.questions, 40) },
        { label: 'final', questions: safeArray(draft?.finalAssessment?.questions, 50) },
        { label: 'mock', questions: safeArray(draft?.mockAssessment?.questions, 40) }
    ];
    for (const group of questionGroups) for (const question of group.questions) {
        const prompt = clean(question?.prompt || question?.question || question?.text, 1800).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
        if (!prompt) { errors.push(`${group.label}: có câu hỏi thiếu nội dung.`); continue; }
        const previous = prompts.get(prompt);
        if (previous) errors.push(`Câu hỏi bị dùng lại giữa ${previous} và ${group.label}; đề bài/chương/cuối khóa phải độc lập.`);
        else prompts.set(prompt, group.label);
        if (clean(question?.explanation, 4000).split(/\s+/).filter(Boolean).length < 8) errors.push(`${group.label}: câu hỏi thiếu giải thích đáp án.`);
        const type = String(question?.type || '').toLowerCase();
        if (['single_choice','multiple_choice','true_false'].includes(type) && safeArray(question?.options, 12).length < 2) errors.push(`${group.label}: câu trắc nghiệm thiếu phương án.`);
        if (type === 'coding' && (!question?.media?.coding?.starterCode || !question?.media?.coding?.statement || safeArray(question?.media?.coding?.visibleTestCases, 30).length < 2)) errors.push(`${group.label}: câu coding thiếu starter code/đề bài/test case.`);
        if (['essay','speaking','writing','practical','open_response'].includes(type) && safeArray(question?.rubric?.criteria, 20).length < 2) errors.push(`${group.label}: câu tự luận/thực hành thiếu rubric.`);
    }
    return { ...base, valid: errors.length === 0, errors: [...new Set(errors)], version: '38.0.0', qualityGate: 'ADAPTIVE_AI_V38' };
}

function buildTarget({ request, context, mode }) {
    const education = context?.education || {};
    const inferred = context?.learning?.inference || {};
    return {
        mode,
        prompt: clean(request?.prompt || request?.goal || 'Tạo lộ trình học phù hợp cho người học.', 6000),
        courseTitle: clean(request?.courseTitle || '', 220),
        target: request?.target || {},
        domain: clean(request?.domain || inferred.domain || context?.educationContext?.field?.name || context?.educationContext?.major?.name, 240),
        educationLevel: clean(request?.educationLevel || education.educationLevel, 80),
        grade: Number(request?.grade || education.grade || 0) || undefined,
        subjectId: clean(request?.subjectId, 120),
        targetExam: clean(request?.targetExam || request?.exam, 60),
        targetVariant: clean(request?.targetVariant || request?.variant, 80),
        major: clean(request?.major || context?.educationContext?.major?.name || inferred.major, 200),
        specialization: clean(request?.specialization || context?.educationContext?.specialization?.name || inferred.specialization, 200),
        semester: clean(request?.semester || education.semester, 50),
        institution: clean(request?.institution || context?.educationContext?.university?.name || education.institution, 300),
        careerGoal: clean(request?.careerGoal || inferred.careerGoal, 300),
        generateAudio: request?.generateAudio !== false,
        lessonCountRange: request?.lessonCountRange || '',
        audience: clean(request?.audience, 300)
    };
}


function auditCourseBlueprintV38(blueprint, target = {}) {
    const errors = [];
    const chapters = safeArray(blueprint?.chapters, 20);
    const lessons = chapters.flatMap(chapter => safeArray(chapter.lessons, 30));
    if (chapters.length < 2) errors.push('Blueprint cần ít nhất 2 chương/mô-đun.');
    if (lessons.length < 6) errors.push('Blueprint cần ít nhất 6 bài học, nhưng số bài còn lại do AI lựa chọn theo mục tiêu.');
    if (!clean(blueprint?.subjectId, 120)) errors.push('Blueprint thiếu subjectId.');
    if (!clean(blueprint?.educationLevel, 80)) errors.push('Blueprint thiếu educationLevel.');
    for (const [index, chapter] of chapters.entries()) if (safeArray(chapter.test?.questions, 40).length < 5) errors.push(`Chương ${index + 1} cần ít nhất 5 câu kiểm tra độc lập.`);
    if (safeArray(blueprint?.midtermAssessment?.questions, 40).length < 8) errors.push('Midterm cần ít nhất 8 câu độc lập.');
    if (safeArray(blueprint?.finalAssessment?.questions, 50).length < 10) errors.push('Final cần ít nhất 10 câu độc lập.');
    if (safeArray(blueprint?.mockAssessment?.questions, 40).length < 10) errors.push('Mock test cần ít nhất 10 câu độc lập.');
    const assessmentGroups = [...chapters.map((chapter, index) => ({ label: `chapter ${index + 1}`, questions: safeArray(chapter.test?.questions, 40) })), { label: 'midterm', questions: safeArray(blueprint?.midtermAssessment?.questions, 40) }, { label: 'final', questions: safeArray(blueprint?.finalAssessment?.questions, 50) }, { label: 'mock', questions: safeArray(blueprint?.mockAssessment?.questions, 40) }];
    const assessmentPrompts = new Map();
    for (const group of assessmentGroups) for (const question of group.questions) {
        const prompt = clean(question?.prompt, 1800).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
        if (!prompt) errors.push(`${group.label}: có câu hỏi rỗng.`);
        else if (assessmentPrompts.has(prompt)) errors.push(`Câu hỏi ${group.label} bị trùng với ${assessmentPrompts.get(prompt)}.`);
        else assessmentPrompts.set(prompt, group.label);
        if (clean(question?.explanation, 4000).split(/\s+/).filter(Boolean).length < 8) errors.push(`${group.label}: câu hỏi thiếu giải thích đáp án.`);
        if (!clean(question?.answer, 2000)) errors.push(`${group.label}: câu hỏi thiếu đáp án.`);
        if (['single_choice','multiple_choice','true_false'].includes(String(question?.type || '').toLowerCase()) && safeArray(question?.options, 12).length < 2) errors.push(`${group.label}: câu trắc nghiệm thiếu phương án.`);
    }
    const norm = value => clean(value, 200).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
    if (target.grade && Number(blueprint.grade) !== Number(target.grade)) errors.push(`Sai lớp: yêu cầu ${target.grade}, AI trả ${blueprint.grade || 'không xác định'}.`);
    if (target.subjectId && norm(blueprint.subjectId) !== norm(target.subjectId)) errors.push(`Sai môn: yêu cầu ${target.subjectId}, AI trả ${blueprint.subjectId || 'không xác định'}.`);
    if (target.targetExam && !norm(blueprint.targetExam).includes(norm(target.targetExam))) errors.push(`Sai track/chứng chỉ: yêu cầu ${target.targetExam}, AI trả ${blueprint.targetExam || 'không xác định'}.`);
    return { valid: errors.length === 0, errors };
}
function auditGeneratedLessonV38(lesson) {
    const errors = [];
    const sections = safeArray(lesson?.theorySections, 12);
    if (sections.length < 3 || sections.some(section => clean(section?.content, 6000).length < 120)) errors.push('Lý thuyết cần ít nhất 3 phần có giải thích cụ thể.');
    if (clean(lesson?.lecture?.script, 12000).length < 180) errors.push('Bài giảng cần có hướng dẫn diễn giải đầy đủ.');
    if (safeArray(lesson?.examples, 12).length < 2 || safeArray(lesson?.examples, 12).some(example => clean(example?.problem, 3000).length < 20 || clean(example?.solution, 6000).length < 50)) errors.push('Cần ít nhất 2 ví dụ có đề bài và lời giải giải thích.');
    if (safeArray(lesson?.practiceTasks, 20).length < 2 || safeArray(lesson?.practiceTasks, 20).some(task => clean(task, 3000).length < 20)) errors.push('Cần ít nhất 2 bài luyện có chỉ dẫn cụ thể.');
    const questions = safeArray(lesson?.test?.questions, 40);
    if (questions.length < 5) errors.push('Bài kiểm tra cần ít nhất 5 câu riêng.');
    const seen = new Set();
    for (const question of questions) {
        const prompt = clean(question?.prompt, 3000).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
        if (!prompt || seen.has(prompt)) errors.push('Câu hỏi rỗng hoặc trùng lặp.');
        seen.add(prompt);
        if (clean(question?.explanation, 4000).split(/\s+/).filter(Boolean).length < 8) errors.push('Câu hỏi thiếu giải thích đáp án.');
        const type = String(question?.type || '').toLowerCase();
        if (['single_choice','multiple_choice','true_false'].includes(type) && safeArray(question?.options, 12).length < 2) errors.push('Câu trắc nghiệm thiếu phương án.');
        if (type === 'coding' && (!question?.media?.coding?.starterCode || !question?.media?.coding?.statement || safeArray(question?.media?.coding?.visibleTestCases, 30).length < 2)) errors.push('Câu coding thiếu starter code, đề bài hoặc test case.');
        if (['essay','speaking','writing','practical','open_response'].includes(type) && safeArray(question?.rubric?.criteria, 20).length < 2) errors.push('Câu tự luận/thực hành thiếu rubric.');
    }
    return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

async function generateCourseDraft({ request, context, mode = 'PERSONAL' } = {}) {
    const target = buildTarget({ request, context, mode });
    const starterResult = findStarterCourse({ major: target.major, goal: target.prompt, targetExam: target.targetExam, targetVariant: target.targetVariant, subjectId: target.subjectId, prompt: target.prompt });
    const starter = starterResult?.course || null;
    const focusedDebugNeed = /debug|kiểm thử|kiem thu|unit\s*test|testing|test\s*case|regression|gỡ lỗi|go loi/i.test(`${target.prompt} ${target.courseTitle} ${target.domain}`);
    const fallbackDraft = starter && !request.forceCreate && !focusedDebugNeed ? buildStarterDraft(starter, { educationLevel: target.educationLevel, grade: target.grade, subjectId: target.subjectId || starter.subjectId, goal: target.prompt, major: target.major, specialization: target.specialization, skillGaps: (context.mastery || []).filter(item => Number(item.accuracy) < 70).slice(0, 10).map(item => item.skill) }) : null;
    const makeFocusedLocalDraft = () => makeCourseDraft({ ...target, mode, courseTitle: target.courseTitle || (focusedDebugNeed ? `${target.prompt.slice(0, 150)} · Lộ trình cá nhân` : ''), domain: target.domain || target.major });
    const base = { starter: starter ? { code: starter.code, name: starter.name, lessonTitles: starter.lessonTitles, skills: starter.skills, objectives: starter.objectives, track: starter.track, targetExam: starter.targetExam, targetVariant: starter.targetVariant } : null, target, education: context?.education, educationContext: context?.educationContext, goals: context?.learning?.goals || [], mastery: (context?.mastery || []).slice(0, 30), generationBudget: { maxAiLessons: Math.max(6, Math.min(72, Number(process.env.AI_COURSE_MAX_AI_LESSONS || 24))) } };
    if (!isGeminiConfigured() || getAiMode() === 'OFF') {
        if (request.allowRuleBasedFallback === true) {
            const localDraft = request.useStarterFallback === true && fallbackDraft ? fallbackDraft : makeFocusedLocalDraft();
            return { draft: localDraft, validation: validateCourseDraft(localDraft), model: request.useStarterFallback === true && fallbackDraft ? 'SMART-CATALOG-V19' : 'LOCAL-EDUCATION-COMPOSER-V32', promptVersion: 'EXPLICIT_LOCAL_FALLBACK_V38', generationTarget: target, degraded: true, smartMode: getAiMode(), sourceStarterCode: starter?.code || '', localComposer: true };
        }
        const error = new Error('Chưa thể tự tạo khóa học mới: cần GEMINI_API_KEY/GOOGLE_API_KEY và AI_MODE khác OFF. V38 không âm thầm thay AI bằng dàn ý mẫu.'); error.code = 'COURSE_AI_REQUIRED'; error.retryable = false; throw error;
    }
    let blueprint;
    let blueprintModel = '';
    try {
        const bp = await generateStructured({ profile: 'course', model: process.env.GEMINI_SMART_MODEL || '', timeoutMs: 240000, maxOutputTokens: Number(process.env.GEMINI_COURSE_MAX_OUTPUT_TOKENS || 12000), temperature: 0.35, schema: courseBlueprintSchema, dedupeKey: `course-blueprint-v38:${hashText(JSON.stringify(base))}`, systemInstruction: 'Bạn là AI Curriculum Architect V38. Không sao chép khung khóa mẫu và không ép số chương/bài giống nhau. Thiết kế cấu trúc riêng theo mục tiêu, cấp học, môn, track/chứng chỉ, kiến thức tiên quyết và kết quả cần đạt. Mỗi chương có đề kiểm tra riêng; midterm, final và mock là các bộ đề độc lập, không sao chép câu hỏi lesson. Không tự nhận nội dung AI là official.', prompt: `Tạo blueprint riêng cho nhu cầu học này. Chọn số chương/bài phù hợp với phạm vi, không theo dàn ý cố định; tổng số bài phải nằm trong generationBudget.maxAiLessons được cung cấp trong context, nếu mục tiêu rộng hãy ưu tiên các mô-đun có giá trị cao và nêu rõ phạm vi. Ở bước blueprint, hãy tạo đủ bộ câu hỏi riêng cho từng chapter test (>=5 câu), midterm (>=8), final (>=10), mock (>=10), có đáp án/giải thích và bao phủ kỹ năng/độ khó. Nội dung bài học chi tiết sẽ được AI tạo riêng ở bước tiếp theo. Context: ${JSON.stringify(base).slice(0, 30000)}\nMục tiêu: ${JSON.stringify(target)}` });
        blueprint = bp.data; blueprintModel = bp.model;
    } catch (error) {
        if (request.allowStarterFallback === true) {
            const localDraft = fallbackDraft || makeFocusedLocalDraft();
            return { draft: localDraft, validation: validateCourseDraft(localDraft), model: fallbackDraft ? 'STARTER-CATALOG-FULL' : 'LOCAL-EDUCATION-COMPOSER-V32', promptVersion: 'EXPLICIT_AI_FALLBACK_V38', generationTarget: target, degraded: true, aiErrorCode: error?.code || 'GEMINI_UNAVAILABLE', sourceStarterCode: starter?.code || '', localComposer: true };
        }
        throw error;
    }
    let blueprintAudit = auditCourseBlueprintV38(blueprint, target);
    if (!blueprintAudit.valid) {
        const repair = await generateStructured({ profile: 'course', timeoutMs: 240000, maxOutputTokens: Number(process.env.GEMINI_COURSE_REPAIR_MAX_OUTPUT_TOKENS || 12000), temperature: 0.2, schema: courseBlueprintSchema, dedupeKey: `course-blueprint-v38-repair:${hashText(JSON.stringify(base))}`, systemInstruction: 'Bạn là AI Curriculum Architect. Sửa đúng các lỗi chất lượng được liệt kê. Không sao chép template, không dùng câu hỏi chung chung và giữ các bộ đề độc lập.', prompt: `Sửa blueprint theo lỗi sau:\n${blueprintAudit.errors.join('\n')}\nBlueprint hiện tại:\n${JSON.stringify(blueprint).slice(0, 30000)}\nMục tiêu và phạm vi gốc:\n${JSON.stringify(target)}` });
        blueprint = repair.data; blueprintModel = repair.model || blueprintModel; blueprintAudit = auditCourseBlueprintV38(blueprint, target);
    }
    if (!blueprintAudit.valid) { const error = new Error(`AI blueprint chưa đạt kiểm định: ${blueprintAudit.errors.join(' | ')}`); error.code = 'AI_COURSE_BLUEPRINT_INVALID'; error.details = blueprintAudit; error.retryable = false; throw error; }
    const generatedChapters = []; let degraded = false; let aiLessonBudget = Math.max(1, Math.min(72, Number(process.env.AI_COURSE_MAX_AI_LESSONS || 24))); let aiLessonsGenerated = 0;
    for (let ci = 0; ci < Math.min(20, blueprint.chapters?.length || 0); ci += 1) {
        const chapter = blueprint.chapters[ci]; const lessons = []; const chapterStarterLessons = fallbackDraft?.chapters?.[ci]?.lessons || [];
        for (let li = 0; li < Math.min(20, chapter.lessons?.length || 0); li += 1) {
            const spec = chapter.lessons[li]; const starterLesson = chapterStarterLessons[li] || fallbackDraft?.chapters?.flatMap(x => x.lessons || [])[li] || null;
            const lessonSeed = { target, starter: starter ? { code: starter.code, name: starter.name, skills: starter.skills } : null, chapter: { title: chapter.title, description: chapter.description }, lesson: spec, sourceLesson: starterLesson ? { title: starterLesson.title, theory: starterLesson.theorySections, lecture: starterLesson.lecture, skills: starterLesson.skills } : null, learner: { major: target.major, specialization: target.specialization, goal: target.prompt, mastery: (context.mastery || []).filter(item => Number(item.accuracy) < 70).slice(0, 8) } };
            try {
                if (aiLessonsGenerated >= aiLessonBudget) { const error = new Error('Khóa học vượt giới hạn số bài được tạo bằng AI; tăng AI_COURSE_MAX_AI_LESSONS thay vì chèn bài mẫu.'); error.code = 'AI_COURSE_LESSON_BUDGET_EXCEEDED'; throw error; }
                let result = await generateStructured({ profile: 'course', timeoutMs: 180000, maxOutputTokens: 6500, temperature: 0.25, schema: lessonContentSchema, dedupeKey: `course-lesson-v38:${hashText(JSON.stringify(lessonSeed))}`, systemInstruction: 'Bạn là AI Lesson Author V38. Hãy viết nội dung có thể học ngay: ít nhất 4 phần lý thuyết chi tiết, một bài giảng như lời giáo viên, ít nhất 2 ví dụ có lời giải, ít nhất 2 bài tập thực hành, lỗi thường gặp và 8 câu lesson test có đáp án + giải thích. Nếu là lập trình, kèm code example và coding task có test case. Nếu là TOEIC/IELTS, bám blueprint kỹ năng/dạng bài. Nếu là MOS, ưu tiên thao tác thực hành. Không sao chép đề thi bảo mật và không dùng đoạn mẫu chung thay cho giải thích chuyên môn.', prompt: `Sinh nội dung hoàn chỉnh cho bài này. Không trả outline hay chỉ tên. Context: ${JSON.stringify(lessonSeed).slice(0, 30000)}` });
                let lessonAudit = auditGeneratedLessonV38(result.data);
                if (!lessonAudit.valid) {
                    result = await generateStructured({ profile: 'course', timeoutMs: 180000, maxOutputTokens: 6500, temperature: 0.2, schema: lessonContentSchema, dedupeKey: `course-lesson-v38-repair:${hashText(JSON.stringify(lessonSeed))}`, systemInstruction: 'Bạn là AI Lesson Quality Repair. Sửa toàn bộ lỗi kiểm định bằng nội dung có ý nghĩa, không thêm placeholder và không rút ngắn phần giải thích.', prompt: `Sửa bài học theo lỗi quality gate:\n${lessonAudit.errors.join('\n')}\nBài hiện tại:\n${JSON.stringify(result.data).slice(0, 20000)}\nNgữ cảnh gốc:\n${JSON.stringify(lessonSeed).slice(0, 18000)}` });
                    lessonAudit = auditGeneratedLessonV38(result.data);
                }
                if (!lessonAudit.valid) { const error = new Error(`Bài “${spec.title}” vẫn không đạt quality gate sau một lượt sửa: ${lessonAudit.errors.join(' | ')}`); error.code = 'AI_LESSON_QUALITY_GATE_FAILED'; error.details = lessonAudit; error.retryable = false; throw error; }
                lessons.push({ ...result.data, generatedByAI: true, generatedModel: result.model, fallbackUsed: Boolean(result.fallbackUsed), qualityVersion: '38.0.0' });
                aiLessonsGenerated += 1;
            } catch (error) {
                if (request.allowStarterFallback === true && starterLesson) { degraded = true; lessons.push({ ...starterLesson, generatedByAI: false, fallbackReason: error?.code || 'AI_UNAVAILABLE' }); }
                else { error.message = `Không thể tạo nội dung AI cho bài “${spec.title || `Chương ${ci + 1}, bài ${li + 1}`}”: ${error.message || error}`; throw error; }
            }
        }
        const chapterQuestions = safeArray(chapter.test?.questions, 40);
        generatedChapters.push({ title: chapter.title, description: chapter.description, lessons, test: { title: clean(chapter.test?.title || `Kiểm tra chương: ${chapter.title}`, 220), passingScore: Number(chapter.test?.passingScore) || 70, durationSeconds: Number(chapter.test?.durationSeconds) || 25 * 60, questions: chapterQuestions } });
    }
    const midtermQuestions = safeArray(blueprint.midtermAssessment?.questions, 40);
    const finalQuestions = safeArray(blueprint.finalAssessment?.questions, 50);
    const mockQuestions = safeArray(blueprint.mockAssessment?.questions, 40);
    const courseTitle = clean(blueprint.title || 'Khóa học AI cá nhân', 220);
    const draft = { title: courseTitle, code: clean(blueprint.code || '', 120), description: clean(blueprint.description || '', 8000), audience: clean(blueprint.audience || target.audience || '', 700), courseType: clean(blueprint.courseType || 'AI_PERSONALIZED', 80), educationLevel: normalizeEducationLevel(blueprint.educationLevel || target.educationLevel, blueprint.grade || target.grade), grade: Number(blueprint.grade || target.grade || 0) || null, subjectId: clean(blueprint.subjectId || target.subjectId || '', 120), targetExam: clean(blueprint.targetExam || target.targetExam || '', 80), targetVariant: clean(blueprint.targetVariant || target.targetVariant || '', 100), difficulty: clean(blueprint.difficulty || 'ADAPTIVE', 60), estimatedMinutes: Number(blueprint.estimatedMinutes || generatedChapters.reduce((sum, ch) => sum + ch.lessons.reduce((n, lesson) => n + (Number(lesson.estimatedMinutes) || 30), 0), 0)), objectives: safeArray(blueprint.objectives, 30).map(x => clean(x, 1000)), prerequisites: safeArray(blueprint.prerequisites, 20).map(x => clean(x, 500)), skills: safeArray(blueprint.skills, 40).map(x => clean(x, 240)), learningOutcomes: safeArray(blueprint.learningOutcomes?.length ? blueprint.learningOutcomes : blueprint.objectives, 30), chapters: generatedChapters, midtermAssessment: { ...blueprint.midtermAssessment, title: clean(blueprint.midtermAssessment?.title || `Kiểm tra giữa kỳ · ${courseTitle}`, 220), passingScore: Number(blueprint.midtermAssessment?.passingScore) || 70, durationSeconds: Number(blueprint.midtermAssessment?.durationSeconds) || 45 * 60, questions: midtermQuestions }, finalAssessment: { ...blueprint.finalAssessment, title: clean(blueprint.finalAssessment?.title || `Kiểm tra cuối kỳ · ${courseTitle}`, 220), passingScore: Number(blueprint.finalAssessment?.passingScore) || 70, durationSeconds: Number(blueprint.finalAssessment?.durationSeconds) || 60 * 60, questions: finalQuestions }, mockAssessment: { ...blueprint.mockAssessment, title: clean(blueprint.mockAssessment?.title || `Mock Test · ${courseTitle}`, 220), passingScore: Number(blueprint.mockAssessment?.passingScore) || 70, durationSeconds: Number(blueprint.mockAssessment?.durationSeconds) || (target.targetExam === 'IELTS' ? 60 * 60 : 45 * 60), questions: mockQuestions }, personalization: { mode, sourceStarterCode: starter?.code || '', target, goal: target.prompt, major: target.major, specialization: target.specialization, generatedAt: new Date(), generationMode: 'ADAPTIVE_AI_V38' } };
    const validation = validateAdaptiveAICourseDraftV38(draft, target);
    if (!validation.valid) { const error = new Error(`Khóa học do AI tạo chưa đạt quality gate: ${validation.errors.slice(0, 30).join(' | ')}`); error.code = 'AI_COURSE_QUALITY_GATE_FAILED'; error.details = validation; error.retryable = false; throw error; }
    return { draft, validation, model: blueprintModel || process.env.GEMINI_SMART_MODEL || getGeminiModel(), promptVersion: 'ADAPTIVE-AI-COURSE-V38', generationTarget: target, degraded, sourceStarterCode: starter?.code || '', aiLessonsGenerated };
}

function mergeRichDraftWithFallback(aiDraft, fallbackDraft) {
    const fallbackLessons = fallbackDraft.chapters.flatMap(chapter => chapter.lessons || []);
    const aiLessons = (aiDraft?.chapters || []).flatMap(chapter => chapter.lessons || []);
    const mergedLessons = [];
    for (let i = 0; i < Math.max(12, fallbackLessons.length); i += 1) {
        const fb = fallbackLessons[i] || fallbackLessons[0];
        const ai = aiLessons[i] || null;
        if (!fb && !ai) continue;
        if (!ai) { mergedLessons.push({ ...fb, generatedByAI: false, fallbackReason: 'AI_BLUEPRINT_SHORTER_THAN_FULL_COURSE' }); continue; }
        const richEnoughTheory = Array.isArray(ai.theorySections) && ai.theorySections.length >= 4 && ai.theorySections.every(x => clean(x?.content, 6000).length >= 180);
        const richEnoughLecture = clean(ai.lecture?.script, 10000).length >= 300;
        const richEnoughExamples = Array.isArray(ai.examples) && ai.examples.length >= 2;
        const richEnoughPractice = Array.isArray(ai.practiceTasks) && ai.practiceTasks.length >= 3;
        const richEnoughTest = Array.isArray(ai.test?.questions) && ai.test.questions.length >= 8;
        mergedLessons.push({ ...fb, ...ai, theorySections: richEnoughTheory ? ai.theorySections : fb.theorySections, lecture: richEnoughLecture ? ai.lecture : fb.lecture, examples: richEnoughExamples ? ai.examples : fb.examples, practiceTasks: richEnoughPractice ? ai.practiceTasks : fb.practiceTasks, commonMistakes: Array.isArray(ai.commonMistakes) && ai.commonMistakes.length >= 3 ? ai.commonMistakes : fb.commonMistakes, audioScript: clean(ai.audioScript, 500).length >= 120 ? ai.audioScript : fb.audioScript, visualPrompt: clean(ai.visualPrompt, 300).length >= 80 ? ai.visualPrompt : fb.visualPrompt, test: richEnoughTest ? ai.test : fb.test });
    }
    const chapters = [];
    for (let ci = 0; ci < Math.max(6, fallbackDraft.chapters.length); ci += 1) {
        const fbChapter = fallbackDraft.chapters[ci] || fallbackDraft.chapters[0];
        const aiChapter = aiDraft?.chapters?.[ci] || {};
        const lessons = mergedLessons.slice(ci * 2, ci * 2 + 2);
        chapters.push({ title: aiChapter.title || fbChapter.title, description: aiChapter.description || fbChapter.description, lessons, test: { ...(fbChapter.test || {}), ...(aiChapter.test || {}), questions: lessons.flatMap(lesson => safeArray(lesson.test?.questions, 12)).slice(0, 16) } });
    }
    const all = chapters.flatMap(chapter => chapter.lessons.flatMap(lesson => lesson.test?.questions || []));
    const midterm = all.filter((_, i) => i % 2 === 0).slice(0, 30);
    const final = all.slice(0, 50);
    const mock = all.filter((_, i) => i % 3 === 0).slice(0, 30);
    return { ...fallbackDraft, ...aiDraft, chapters, midtermAssessment: { ...(fallbackDraft.midtermAssessment || {}), ...(aiDraft?.midtermAssessment || {}), questions: midterm.length >= 10 ? midterm : fallbackDraft.midtermAssessment.questions }, finalAssessment: { ...(fallbackDraft.finalAssessment || {}), ...(aiDraft?.finalAssessment || {}), questions: final.length >= 15 ? final : fallbackDraft.finalAssessment.questions }, mockAssessment: { ...(fallbackDraft.mockAssessment || {}), ...(aiDraft?.mockAssessment || {}), questions: mock.length >= 20 ? mock : fallbackDraft.mockAssessment.questions }, personalization: { ...(fallbackDraft.personalization || {}), ...(aiDraft?.personalization || {}), fullCourseFallback: true, fullLessonCount: chapters.reduce((n, c) => n + c.lessons.length, 0) } };
}

async function buildDirectorDecision({ models, username, request = {} } = {}) {
    const inferred = await inferLearnerContext({ models, username, force: Boolean(request.forceInference) });
    const context = inferred.context;
    if (!isRemoteAiAllowed()) return heuristicDirectorDecision({ context, request, error: { code: 'SMART_MODE_LOCAL' } });
    const prompt = `Phân tích learner context và quyết định bước học tiếp theo cho Hành Trình Mới. User request: ${clean(JSON.stringify(request), 4000)}. Context: ${JSON.stringify(context).slice(0, 32000)}. Quy tắc: ưu tiên resource hiện có; chỉ CREATE_PERSONAL_COURSE khi không đủ resource hoặc gap rõ; nếu có mục tiêu TOEIC/IELTS hãy quyết định track + variant; nếu là đại học hãy xem major/specialization/semester; nếu có skill review overdue hãy ưu tiên review. Không tự khẳng định curriculum official.`;
    try {
        const result = await generateStructured({ prompt, schema: directorSchema, systemInstruction: 'Bạn là AI Learning Director. Bạn quyết định learning experience, không thay đổi quyền hay dữ liệu bảo mật.', maxOutputTokens: 2600, temperature: 0.2 });
        return { ...result.data, model: result.model, context, promptVersion: 'AI-DIRECTOR-2', degraded: Boolean(result.fallbackUsed) };
    } catch (error) {
        return heuristicDirectorDecision({ context, request, error });
    }
}

function collectQuestionPayload(question) {
    const questionType = QUESTION_TYPES.has(clean(question?.type || 'single_choice', 30)) ? clean(question?.type || 'single_choice', 30) : 'single_choice';
    const options = safeArray(question?.options, 12).map(item => {
        if (item && typeof item === 'object' && !Array.isArray(item)) return Object.fromEntries(Object.entries(item).slice(0, 20).map(([key, value]) => [clean(key, 80), typeof value === 'string' ? clean(value, 700) : value]));
        return clean(item, 700);
    });
    const answer = question?.answer === undefined || question?.answer === null ? '' : question.answer;
    const acceptedAnswers = Array.isArray(question?.acceptedAnswers) ? question.acceptedAnswers.slice(0, 20) : (answer === '' ? [] : [answer]);
    return { type: questionType, options, answer, acceptedAnswers, media: question?.media && typeof question.media === 'object' ? question.media : {}, rubric: question?.rubric && typeof question.rubric === 'object' ? question.rubric : {}, cognitiveLevel: clean(question?.cognitiveLevel, 80), tags: safeArray(question?.tags, 30).map(item => clean(item, 100)), prompt: clean(question?.prompt, 6000), explanation: clean(question?.explanation, 4000), points: Math.max(1, Number(question?.points) || 1), difficulty: clean(question?.difficulty, 60), skill: clean(question?.skill, 180) };
}

async function materializeQuestions({ models, course, lessonId, questions, sourceRef, mode, prefix, context }) {
    const ids = [];
    for (const [index, question] of safeArray(questions, 40).entries()) {
        const payload = collectQuestionPayload(question);
        const code = `${prefix}-Q${index + 1}`;
        const doc = await models.Question.findOneAndUpdate({ code, courseId: course._id }, { $set: { lessonId: lessonId || null, curriculumVersionId: course.curriculumVersionId, grade: context.grade || null, educationLevel: context.educationLevel, majorId: context.majorId || null, institutionId: context.institutionId || null, subjectId: context.subjectId || '', ...payload, status: mode === 'PERSONAL' ? 'PUBLISHED' : 'DRAFT', source: sourceRef }, $setOnInsert: { code, courseId: course._id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
        ids.push(doc._id);
    }
    return ids;
}

async function createAssessment({ models, course, lessonId = null, title, code, questionIds, test, sourceRef, mode, context, assessmentType = 'FINAL' }) {
    const ids = [...new Set((Array.isArray(questionIds) ? questionIds : []).map(String))];
    if (ids.length !== (Array.isArray(questionIds) ? questionIds.length : 0)) { const error = new Error(`Assessment ${code} chứa questionId trùng.`); error.code = 'ASSESSMENT_DUPLICATE_QUESTION_IDS'; throw error; }
    const questions = ids.length ? await models.Question.find({ _id: { $in: ids }, courseId: course._id }).lean() : [];
    const lesson = lessonId && models.CurriculumContent ? await models.CurriculumContent.findOne({ _id: lessonId, courseId: course._id, type: 'LESSON' }).select('_id courseId subjectId grade educationLevel').lean() : null;
    const check = validateAssessmentScope({ course, lesson, assessmentType, questions });
    if (!check.valid) { const error = new Error(`Assessment ${code} không đạt kiểm tra liên kết: ${check.errors.join(', ')}`); error.code = 'ASSESSMENT_SCOPE_VALIDATION_FAILED'; error.details = check; throw error; }
    return models.Assessment.findOneAndUpdate({ courseId: course._id, code }, { $set: { title, assessmentType, educationLevel: context.educationLevel, grade: context.grade || null, curriculumVersionId: course.curriculumVersionId, subjectId: context.subjectId || '', lessonId: lessonId || null, questionIds: ids, questionPool: ids, sections: [{ code: assessmentType, title, questionIds: ids }], durationSeconds: Math.max(180, Number(test?.durationSeconds) || 900), attemptLimit: assessmentType === 'MIDTERM' || assessmentType === 'FINAL' ? 2 : 3, passingScore: Math.max(50, Math.min(100, Number(test?.passingScore) || 70)), randomization: { enabled: true, mode: 'question' }, scoring: { method: 'objective_percentage', maxScore: 100 }, reviewSettings: { showExplanationAfterSubmit: true }, publicationStatus: mode === 'PERSONAL' ? 'PUBLISHED' : 'DRAFT', version: '38.0.0', sourceRef }, $setOnInsert: { code, courseId: course._id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}

function evaluateMaterializedCourse(lessons, assessments, expectedLessonCount = 12, course = null) {
    const lessonRows = Array.isArray(lessons) ? lessons : [];
    const assessmentRows = Array.isArray(assessments) ? assessments : [];
    const minimumLessons = Math.max(1, Number(expectedLessonCount) || lessonRows.length || 12);
    const minimumChapterTests = Math.max(1, Math.ceil(minimumLessons / 2));
    const assessmentById = new Map(assessmentRows.map(item => [String(item._id), item]));
    const lessonTests = assessmentRows.filter(item => item.assessmentType === 'LESSON_TEST' && Array.isArray(item.questionIds || item.questionPool) && (item.questionIds || item.questionPool).length >= 6 && item.lessonId);
    const chapterTests = assessmentRows.filter(item => item.assessmentType === 'CHAPTER_TEST' && (item.questionIds || item.questionPool || []).length >= 6);
    const hasAssessment = (type, min) => assessmentRows.some(item => item.assessmentType === type && (item.questionIds || item.questionPool || []).length >= min);
    const completeLesson = lesson => {
        const sections = Array.isArray(lesson.theorySections) && lesson.theorySections.length ? lesson.theorySections : Array.isArray(lesson.theory) ? lesson.theory : [];
        const sectionCount = sections.filter(section => String(typeof section === 'string' ? section : section?.content || '').trim().length >= 80).length;
        const examples = Array.isArray(lesson.examples) ? lesson.examples : [];
        const validExamples = examples.filter(item => String(typeof item === 'string' ? item : `${item?.text || item?.problem || ''} ${item?.solution || ''}`).trim().length >= 18).length;
        const tasks = Array.isArray(lesson.payload?.practiceTasks) ? lesson.payload.practiceTasks : Array.isArray(lesson.activities) ? lesson.activities : [];
        const validTasks = tasks.filter(item => String(typeof item === 'string' ? item : `${item?.title || ''} ${item?.task || item?.prompt || item?.instruction || item?.instructions || item?.description || ''}`).trim().length >= 12).length;
        const lecture = String(lesson.payload?.lectureScript || lesson.payload?.lecture?.script || lesson.lectureScript || '').trim();
        const test = assessmentById.get(String(lesson.lessonTestId || lesson.assessmentIds?.[0] || ''));
        const questions = Array.isArray(test?.resolvedQuestions) ? test.resolvedQuestions : [];
        const audit = auditLessonLearningContent({ lesson, assessment: test, questions });
        const courseAligned = !course || (String(test?.courseId || '') === String(course._id) && questions.every(question => String(question.courseId || '') === String(course._id)));
        const lessonAligned = questions.every(question => String(question.lessonId || '') === String(lesson._id));
        const subjectAligned = !course?.subjectId || questions.every(question => !question.subjectId || String(question.subjectId).toLowerCase() === String(course.subjectId).toLowerCase());
        return sectionCount >= 3 && lecture.length >= 180 && validExamples >= 2 && validTasks >= 2 && Boolean(test && test.assessmentType === 'LESSON_TEST' && test.lessonId && String(test.lessonId) === String(lesson._id) && (test.questionIds || test.questionPool || []).length >= 6 && courseAligned && lessonAligned && subjectAligned && (!questions.length || audit.valid));
    };
    const completeLessons = lessonRows.filter(completeLesson).length;
    const actualLessonTests = lessonTests.filter(test => lessonRows.some(lesson => String(lesson._id) === String(test.lessonId) && String(lesson.lessonTestId || lesson.assessmentIds?.[0] || '') === String(test._id))).length;
    const checks = {
        enoughLessons: lessonRows.length >= minimumLessons,
        lessonContent: lessonRows.length > 0 && completeLessons === lessonRows.length,
        lessonTests: lessonRows.length >= minimumLessons && actualLessonTests >= minimumLessons,
        chapterTests: chapterTests.length >= minimumChapterTests,
        midterm: hasAssessment('MIDTERM', 10),
        final: hasAssessment('FINAL', 15),
        mock: hasAssessment('MOCK', 20)
    };
    return { ready: Object.values(checks).every(Boolean), checks, lessonCount: lessonRows.length, completeLessonCount: completeLessons, lessonTestCount: actualLessonTests, chapterTestCount: chapterTests.length, assessmentCount: assessmentRows.length, missing: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name) };
}

async function inspectMaterializedCourse(models, courseOrId, expectedLessonCount = 12) {
    const course = courseOrId && typeof courseOrId === 'object' && courseOrId._id ? courseOrId : await models.Course.findById(courseOrId).lean();
    if (!course?._id) return { ready: false, course: null, lessons: [], assessments: [], missing: ['course_not_found'], lessonCount: 0, assessmentCount: 0 };
    const [lessons, assessments] = await Promise.all([
        models.CurriculumContent.find({ courseId: course._id, type: 'LESSON', status: 'PUBLISHED' }).sort({ code: 1, createdAt: 1 }).lean(),
        models.Assessment.find({ courseId: course._id, publicationStatus: 'PUBLISHED' }).lean()
    ]);
    const lessonAssessmentIds = assessments.filter(item => item.assessmentType === 'LESSON_TEST').flatMap(item => item.questionIds || item.questionPool || []).map(String);
    const questionRows = models.Question && lessonAssessmentIds.length ? await models.Question.find({ courseId: course._id, _id: { $in: lessonAssessmentIds } }).lean() : [];
    const questionById = new Map(questionRows.map(question => [String(question._id), question]));
    const hydratedAssessments = assessments.map(item => ({ ...item, resolvedQuestions: (item.questionIds || item.questionPool || []).map(id => questionById.get(String(id))).filter(Boolean) }));
    const expectedLessons = Number(course.syllabus?.lessonCount) || Number(expectedLessonCount) || lessons.length || 12;
    const result = evaluateMaterializedCourse(lessons, hydratedAssessments, expectedLessons, course);
    return { ...result, course, lessons, assessments };
}

async function removeIncompleteGeneratedCourse(models, course, ownerUsername) {
    if (!course?._id || course.kind !== 'PERSONAL_AI' || String(course.ownerUsername || '') !== String(ownerUsername || '')) return false;
    const courseId = course._id;
    const [lessonRows, assessmentRows] = await Promise.all([
        models.CurriculumContent.find({ courseId }).select('_id').lean(),
        models.Assessment.find({ courseId }).select('_id').lean()
    ]);
    const lessonIds = lessonRows.map(item => item._id);
    const assessmentIds = assessmentRows.map(item => item._id);
    if (models.AssessmentAttempt && assessmentIds.length) await models.AssessmentAttempt.deleteMany({ assessmentId: { $in: assessmentIds } });
    if (models.PracticeAttempt && lessonIds.length) await models.PracticeAttempt.deleteMany({ taskId: { $in: lessonIds } });
    if (models.LessonProgress && lessonIds.length) await models.LessonProgress.deleteMany({ lessonId: { $in: lessonIds } });
    if (models.Question) await models.Question.deleteMany({ courseId });
    if (models.Assessment) await models.Assessment.deleteMany({ courseId });
    if (models.CurriculumContent) await models.CurriculumContent.deleteMany({ courseId });
    if (models.AIAudioAsset) await models.AIAudioAsset.deleteMany({ courseId });
    if (models.AIImageAsset) await models.AIImageAsset.deleteMany({ courseId });
    if (models.AIGenerationJob) await models.AIGenerationJob.deleteMany({ $or: [{ 'payload.courseId': courseId }, { 'payload.courseId': String(courseId) }] });
    if (models.AIContentDraft) await models.AIContentDraft.deleteMany({ ownerUsername, $or: [{ committedCourseId: courseId }, { 'context.courseId': courseId }] });
    await models.Course.deleteOne({ _id: courseId, ownerUsername, kind: 'PERSONAL_AI' });
    return true;
}

async function materializeCourse({ models, draft, mode = 'PERSONAL', ownerUsername = '', request = {}, context: suppliedContext = {}, generateAudioAssets = false, sourceType = 'ADMIN_CREATED' } = {}) {
    const validation = validateCourseDraft(draft);
    if (!validation.valid) { const error = new Error(`AI course draft không hợp lệ: ${validation.errors.join(' ')}`); error.code = 'AI_COURSE_INVALID'; throw error; }
    const context = { educationLevel: normalizeEducationLevel(request.educationLevel || suppliedContext.educationLevel || draft.educationLevel, request.grade || suppliedContext.grade || draft.grade), grade: Number(request.grade || suppliedContext.grade || draft.grade || 0) || null, subjectId: clean(request.subjectId || suppliedContext.subjectId || draft.subjectId, 120), institutionId: request.institutionId || suppliedContext.institutionId || null, majorId: request.majorId || suppliedContext.majorId || null, specializationId: request.specializationId || suppliedContext.specializationId || null, trainingProgramId: request.trainingProgramId || suppliedContext.trainingProgramId || null, programId: request.programId || suppliedContext.programId || null, facultyId: request.facultyId || suppliedContext.facultyId || null, semester: clean(request.semester || suppliedContext.semester || draft.personalization?.target?.semester || '', 50), targetExam: clean(request.targetExam || suppliedContext.targetExam || draft.targetExam, 50), targetVariant: clean(request.targetVariant || suppliedContext.targetVariant || draft.targetVariant, 80), generationModel: clean(request.generationModel || suppliedContext.generationModel || '', 120) };
    const fingerprintKey = fingerprint({ mode, ownerUsername, title: draft.title, code: draft.code || '', prompt: request.prompt || '', objectives: draft.objectives || [], target: context });
    const existingKind = mode === 'PERSONAL' ? 'PERSONAL_AI' : 'AI_DRAFT';
    const desiredStatus = mode === 'PERSONAL' ? 'ACTIVE' : 'DRAFT';
    let resumableExisting = null;
    const materializedCode = `${mode === 'PERSONAL' ? `AI-P-${hashText(ownerUsername).slice(0, 8)}` : 'AI-D'}-${fingerprintKey.slice(0, 16)}`.slice(0, 120);
    const existing = await models.Course.findOne({ ownerUsername, kind: existingKind, 'aiGeneration.fingerprint': fingerprintKey, status: { $nin: ['ARCHIVED', 'DELETED'] } }).lean();
    if (existing) {
        const persisted = await inspectMaterializedCourse(models, existing, validation.lessonCount);
        if (persisted.ready) return { course: existing, reused: true, lessonCount: persisted.lessonCount, assessmentCount: persisted.assessmentCount, verification: persisted };
        // Resume the same record instead of permanently blocking retries. Re-key related content
        // under a fingerprint-based code; old records/IDs and learner data remain in place.
        const oldCode = clean(existing.code, 120);
        if (oldCode && oldCode !== materializedCode) {
            for (const Model of [models.CurriculumContent, models.Question, models.Assessment]) {
                if (!Model) continue;
                const rows = await Model.find({ courseId: existing._id }).select('_id code').lean();
                for (const row of rows) {
                    const oldRowCode = String(row.code || '');
                    if (oldRowCode.startsWith(`${oldCode}-`)) await Model.updateOne({ _id: row._id }, { $set: { code: `${materializedCode}${oldRowCode.slice(oldCode.length)}` } });
                }
            }
        }
        await models.Course.updateOne({ _id: existing._id }, { $set: { code: materializedCode, contentCompleteness: 0, 'aiGeneration.materializationRecoveryAt': new Date(), 'aiGeneration.materializationRecoveryMissing': persisted.missing } });
        resumableExisting = await models.Course.findById(existing._id).lean();
    }
    const sourceRef = { sourceType, verification: 'unverified', notes: mode === 'PERSONAL' ? 'AI-generated personal course; nội dung luyện tập gốc do hệ thống soạn, không phải nội dung official.' : 'AI-generated course; cần review trước khi public.' };
    const versionCode = mode === 'PERSONAL' ? `AI-PERSONAL-${hashText(ownerUsername).slice(0, 12)}` : 'AI-ADMIN-DRAFT';
    const curriculumVersion = await models.CurriculumVersion.findOneAndUpdate({ code: versionCode, version: '1' }, { $setOnInsert: { code: versionCode, version: '1', status: 'ACTIVE', educationLevel: context.educationLevel, grades: context.grade ? [context.grade] : [], sourceRef } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    const coursePayload = { curriculumVersionId: curriculumVersion?._id || resumableExisting?.curriculumVersionId || null, programId: context.programId, institutionId: context.institutionId, facultyId: context.facultyId, majorId: context.majorId, specializationId: context.specializationId, trainingProgramId: context.trainingProgramId, sourceCourseId: request.sourceCourseId || suppliedContext.sourceCourseId || null, code: materializedCode, name: clean(draft.title, 220), description: clean(draft.description, 8000), educationLevel: context.educationLevel, grade: context.grade, subjectId: context.subjectId, objectives: safeArray(draft.objectives, 30).map(item => clean(item, 1000)), learningOutcomes: safeArray(draft.learningOutcomes, 30), estimatedMinutes: Number(draft.estimatedMinutes) || 900, difficulty: clean(draft.difficulty || 'ADAPTIVE', 60), category: mode === 'PERSONAL' ? 'PERSONAL_AI' : 'OTHER', kind: mode === 'PERSONAL' ? 'PERSONAL_AI' : 'AI_DRAFT', ownerUsername: ownerUsername || '', personalizedFor: mode === 'PERSONAL' ? { username: ownerUsername, request, context } : {}, aiGeneration: { ...(resumableExisting?.aiGeneration || {}), model: context.generationModel || getGeminiModel(), fingerprint: fingerprintKey, generatedAt: resumableExisting?.aiGeneration?.generatedAt || new Date(), promptVersion: 'AI-COURSE-STAGED-5', targetExam: context.targetExam, targetVariant: context.targetVariant, sourceCourseId: request.sourceCourseId || suppliedContext.sourceCourseId || null }, status: desiredStatus, sourceRef, contentCompleteness: 0, syllabus: { ...(resumableExisting?.syllabus || {}), mode, courseType: clean(draft.courseType, 80), lessonCount: safeArray(draft.chapters).reduce((sum, chapter) => sum + safeArray(chapter?.lessons).length, 0), chapterCount: safeArray(draft.chapters).filter(chapter => safeArray(chapter?.lessons).length).length, prerequisites: safeArray(draft.prerequisites), skills: safeArray(draft.skills), audience: clean(draft.audience, 700), targetExam: context.targetExam, targetVariant: context.targetVariant, semester: context.semester, chapters: safeArray(draft.chapters).map((chapter, index) => ({ order: index + 1, title: clean(chapter?.title, 220) })) } };
    const course = resumableExisting
        ? await models.Course.findOneAndUpdate({ _id: resumableExisting._id }, { $set: coursePayload }, { new: true }).lean()
        : await models.Course.create(coursePayload);
    const courseDraftRecord = models.AIContentDraft ? await models.AIContentDraft.findOneAndUpdate({ type: 'COURSE', mode, ownerUsername, sourceFingerprint: fingerprintKey }, { $set: { type: 'COURSE', mode, ownerUsername, requestedBy: ownerUsername, title: draft.title, prompt: clean(request.prompt || draft.description, 8000), context, draft, validation, status: 'VALIDATED', model: context.generationModel || getGeminiModel(), promptVersion: 'AI-COURSE-STAGED-5', sourceFingerprint: fingerprintKey, committedCourseId: course._id, metadata: { materializedAt: new Date() } } }, { upsert: true, new: true, setDefaultsOnInsert: true }) : null;
    let order = 0; let audioGenerated = 0; const chapterAssessments = []; const lessonQuestionIds = [];
    for (const [chapterIndex, chapter] of safeArray(draft.chapters, 16).entries()) {
        const chapterQuestionIds = [];
        for (const lesson of safeArray(chapter?.lessons, 30)) {
            order += 1;
            const baseLessonCode = `${course.code}-L${String(order).padStart(2, '0')}`;
            let lessonCode = baseLessonCode;
            const lessonIdentity = { curriculumVersionId: course.curriculumVersionId, type: 'LESSON' };
            const codeCollision = await models.CurriculumContent.findOne({ ...lessonIdentity, code: lessonCode }).select('_id courseId').lean();
            if (codeCollision && String(codeCollision.courseId || '') !== String(course._id)) lessonCode = `${String(course.code).slice(0, 94)}-L${String(order).padStart(2, '0')}-${hashText(String(course._id)).slice(0, 8)}`;
            const lessonPayload = { curriculumVersionId: course.curriculumVersionId, type: 'LESSON', courseId: course._id, code: lessonCode, title: clean(lesson.title, 220), description: clean(lesson.description, 8000), grade: context.grade, educationLevel: context.educationLevel, subjectId: context.subjectId, objectives: safeArray(lesson.objectives, 30).map(item => clean(item, 1000)), theory: safeArray(lesson.theorySections, 30).map(section => ({ title: clean(section?.title, 240), content: clean(section?.content, 16000) })), theorySections: safeArray(lesson.theorySections, 30).map(section => ({ title: clean(section?.title, 240), content: clean(section?.content, 16000) })), examples: safeArray(lesson.examples, 20).map(item => typeof item === 'string' ? ({ text: clean(item, 5000) }) : ({ title: clean(item?.title, 240), text: clean(item?.problem, 6000), solution: clean(item?.solution, 9000) })), activities: safeArray(lesson.activities, 20), skills: safeArray(lesson.skills, 20).map(item => clean(item, 240)), estimatedMinutes: Number(lesson.estimatedMinutes) || 30, difficulty: clean(lesson.difficulty || draft.difficulty, 60), generationMetadata: { aiGenerated: lesson.generatedByAI !== false, mode, model: context.generationModel || getGeminiModel(), courseId: course._id, chapterIndex: chapterIndex + 1, lessonIndex: order, targetExam: context.targetExam, targetVariant: context.targetVariant }, status: mode === 'PERSONAL' ? 'PUBLISHED' : 'DRAFT', sourceRef, payload: { chapterTitle: clean(chapter.title, 240), lecture: lesson.lecture || {}, lectureScript: clean(lesson.lecture?.script, 24000), audioScript: clean(lesson.audioScript, 24000), visualPrompt: clean(lesson.visualPrompt, 12000), commonMistakes: safeArray(lesson.commonMistakes, 20), practiceTasks: safeArray(lesson.practiceTasks, 20), knowledge: safeArray(lesson.knowledge, 20), programming: Boolean(lesson.programming), language: clean(lesson.language, 30), codeExample: clean(lesson.codeExample, 20000), codingTasks: safeArray(lesson.codingTasks, 20), testCases: safeArray(lesson.testCases, 20), generatedByAI: lesson.generatedByAI !== false, generatedAt: new Date() } };
            let lessonDoc;
            try {
                lessonDoc = await models.CurriculumContent.findOneAndUpdate({ ...lessonIdentity, code: lessonCode }, { $set: lessonPayload }, { upsert: true, new: true, setDefaultsOnInsert: true });
            } catch (error) {
                if (error?.code !== 11000) throw error;
                const conflict = await models.CurriculumContent.findOne({ ...lessonIdentity, code: lessonCode }).select('_id courseId').lean();
                if (conflict && String(conflict.courseId || '') === String(course._id)) lessonDoc = await models.CurriculumContent.findOneAndUpdate({ ...lessonIdentity, code: lessonCode }, { $set: lessonPayload }, { upsert: false, new: true });
                else {
                    lessonCode = `${String(course.code).slice(0, 94)}-L${String(order).padStart(2, '0')}-${hashText(`${course._id}:${order}`).slice(0, 8)}`;
                    lessonPayload.code = lessonCode;
                    lessonDoc = await models.CurriculumContent.findOneAndUpdate({ ...lessonIdentity, code: lessonCode }, { $set: lessonPayload }, { upsert: true, new: true, setDefaultsOnInsert: true });
                }
            }
            if (models.AIContentDraft) await models.AIContentDraft.findOneAndUpdate({ type: 'LESSON', mode, ownerUsername, sourceFingerprint: fingerprint({ courseId: String(course._id), lessonCode }) }, { $set: { type: 'LESSON', mode, ownerUsername, requestedBy: ownerUsername, title: lesson.title, prompt: clean(`${draft.title} / ${chapter.title} / ${lesson.title}`, 8000), context: { ...context, courseId: course._id, chapterIndex: chapterIndex + 1, lessonCode }, draft: lesson, validation: { valid: true, theorySections: lesson.theorySections?.length || 0, questionCount: lesson.test?.questions?.length || 0 }, status: 'COMMITTED', model: context.generationModel || getGeminiModel(), promptVersion: 'AI-LESSON-STAGED-2', sourceFingerprint: fingerprint({ courseId: String(course._id), lessonCode }), committedCourseId: course._id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
            const questionIds = await materializeQuestions({ models, course, lessonId: lessonDoc._id, questions: lesson.test.questions, sourceRef, mode, prefix: lessonCode, context });
            lessonQuestionIds.push(...questionIds); chapterQuestionIds.push(...questionIds);
            const lessonAssessment = await createAssessment({ models, course, lessonId: lessonDoc._id, title: `Kiểm tra bài học: ${clean(lesson.title, 180)}`, code: `${lessonCode}-TEST`, questionIds, test: lesson.test, sourceRef, mode, context, assessmentType: 'LESSON_TEST' });
            if (models.AIContentDraft) await models.AIContentDraft.findOneAndUpdate({ type: 'ASSESSMENT', mode, ownerUsername, sourceFingerprint: fingerprint({ courseId: String(course._id), code: lessonAssessment.code }) }, { $set: { type: 'ASSESSMENT', mode, ownerUsername, requestedBy: ownerUsername, title: lessonAssessment.title, prompt: `AI-created lesson test: ${lesson.title}`, context: { courseId: course._id, lessonId: lessonDoc._id }, draft: lesson.test, validation: { valid: questionIds.length >= 6, questionCount: questionIds.length }, status: 'COMMITTED', model: context.generationModel || getGeminiModel(), promptVersion: 'AI-ASSESSMENT-2', sourceFingerprint: fingerprint({ courseId: String(course._id), code: lessonAssessment.code }), committedCourseId: course._id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
            let audioAssetId = null;
            const audioTextHash = hashText(`${course._id}:${lessonDoc._id}:${lesson.audioScript || ''}`);
            if (generateAudioAssets && clean(lesson.audioScript, 24000)) { try { const audio = await generateSpeech({ text: lesson.audioScript }); const audioDoc = await models.AIAudioAsset.findOneAndUpdate({ courseId: course._id, lessonId: lessonDoc._id, textHash: audioTextHash }, { $setOnInsert: { ownerUsername, courseId: course._id, lessonId: lessonDoc._id, model: audio.model, voice: audio.voice, mimeType: audio.mimeType, data: audio.buffer } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean(); audioAssetId = audioDoc?._id || null; if (audioAssetId) audioGenerated += 1; } catch (error) { if (models.AIGenerationJob) await queueGenerationJob(models, { idempotencyKey: `AUDIO:${course._id}:${lessonDoc._id}`, type: 'AUDIO', username: ownerUsername, priority: 25, payload: { courseId: course._id, lessonId: lessonDoc._id, text: lesson.audioScript, textHash: audioTextHash }, error: { code: error?.code || 'AUDIO_UNAVAILABLE', message: clean(error?.message || error, 1000) } }); } }
            else if (models.AIGenerationJob && clean(lesson.audioScript, 24000)) await queueGenerationJob(models, { idempotencyKey: `AUDIO:${course._id}:${lessonDoc._id}`, type: 'AUDIO', username: ownerUsername, priority: 25, payload: { courseId: course._id, lessonId: lessonDoc._id, text: lesson.audioScript, textHash: audioTextHash } });
            if (models.AIGenerationJob && clean(lesson.visualPrompt, 200)) await queueGenerationJob(models, { idempotencyKey: `IMAGE:${course._id}:${lessonDoc._id}`, type: 'IMAGE', username: ownerUsername, priority: 15, payload: { courseId: course._id, lessonId: lessonDoc._id, prompt: lesson.visualPrompt, promptHash: hashText(`${course._id}:${lessonDoc._id}:${lesson.visualPrompt}`) } });
            await models.CurriculumContent.updateOne({ _id: lessonDoc._id }, { $set: { lessonTestId: lessonAssessment._id, audioAssetId, assessmentIds: [lessonAssessment._id], 'payload.assessmentType': 'LESSON_TEST' } });
        }
        const chapterIds = chapterQuestionIds.slice(0, 20);
        const chapterAssessment = await createAssessment({ models, course, title: `Kiểm tra chương: ${clean(chapter.title, 180)}`, code: `${course.code}-C${chapterIndex + 1}-TEST`, questionIds: chapterIds, test: chapter.test, sourceRef, mode, context, assessmentType: 'CHAPTER_TEST' });
        chapterAssessments.push({ chapter: chapterIndex + 1, title: clean(chapter.title, 220), assessmentId: chapterAssessment._id });
        if (models.AIContentDraft) await models.AIContentDraft.findOneAndUpdate({ type: 'ASSESSMENT', mode, ownerUsername, sourceFingerprint: fingerprint({ courseId: String(course._id), code: chapterAssessment.code }) }, { $set: { type: 'ASSESSMENT', mode, ownerUsername, requestedBy: ownerUsername, title: chapterAssessment.title, prompt: `AI-composed chapter test: ${chapter.title}`, context: { courseId: course._id, chapterIndex: chapterIndex + 1 }, draft: chapter.test, validation: { valid: chapterIds.length >= 6, questionCount: chapterIds.length, composition: 'AI_QUESTION_BANK' }, status: 'COMMITTED', model: context.generationModel || getGeminiModel(), promptVersion: 'AI-ASSESSMENT-2', sourceFingerprint: fingerprint({ courseId: String(course._id), code: chapterAssessment.code }), committedCourseId: course._id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    const midtermIds = lessonQuestionIds.filter((_, index) => index % 2 === 0).slice(0, 30); const finalIds = lessonQuestionIds.slice(0, 50);
    const midterm = await createAssessment({ models, course, title: `Kiểm tra giữa kỳ · ${clean(draft.title, 180)}`, code: `${course.code}-MIDTERM-TEST`, questionIds: midtermIds, test: draft.midtermAssessment, sourceRef, mode, context, assessmentType: 'MIDTERM' });
    const finalAssessment = await createAssessment({ models, course, title: `Kiểm tra cuối kỳ · ${clean(draft.title, 180)}`, code: `${course.code}-FINAL-TEST`, questionIds: finalIds, test: draft.finalAssessment, sourceRef, mode, context, assessmentType: 'FINAL' });
    const mockIds = lessonQuestionIds.filter((_, index) => index % 3 === 0).slice(0, 30);
    const mockAssessment = await createAssessment({ models, course, title: `Mock Test · ${clean(draft.title, 180)}`, code: `${course.code}-MOCK-TEST`, questionIds: mockIds, test: draft.mockAssessment, sourceRef, mode, context, assessmentType: 'MOCK' });
    for (const [assessment, test, type] of [[midterm, draft.midtermAssessment, 'MIDTERM'], [finalAssessment, draft.finalAssessment, 'FINAL'], [mockAssessment, draft.mockAssessment, 'MOCK']]) if (models.AIContentDraft) await models.AIContentDraft.findOneAndUpdate({ type: 'ASSESSMENT', mode, ownerUsername, sourceFingerprint: fingerprint({ courseId: String(course._id), code: assessment.code }) }, { $set: { type: 'ASSESSMENT', mode, ownerUsername, requestedBy: ownerUsername, title: assessment.title, prompt: `AI-composed ${type} assessment: ${draft.title}`, context: { courseId: course._id }, draft: test, validation: { valid: assessment.questionIds.length >= (type === 'MIDTERM' ? 10 : 15), questionCount: assessment.questionIds.length, composition: 'AI_QUESTION_BANK' }, status: 'COMMITTED', model: context.generationModel || getGeminiModel(), promptVersion: 'AI-ASSESSMENT-2', sourceFingerprint: fingerprint({ courseId: String(course._id), code: assessment.code }), committedCourseId: course._id } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const persisted = await inspectMaterializedCourse(models, course._id, validation.lessonCount);
    if (!persisted.ready) { const error = new Error(`Khóa đã tạo nhưng chưa đủ nội dung thực sự được lưu: ${persisted.missing.join(', ')}`); error.code = 'AI_COURSE_MATERIALIZATION_INCOMPLETE'; error.details = persisted; throw error; }
    await models.Course.updateOne({ _id: course._id }, { $set: { 'syllabus.chapterAssessments': chapterAssessments, 'syllabus.midtermAssessmentId': midterm._id, 'syllabus.finalAssessmentId': finalAssessment._id, 'syllabus.mockAssessmentId': mockAssessment._id, 'syllabus.lessonCount': order, 'syllabus.questionCount': lessonQuestionIds.length, 'syllabus.assessmentStructure': { lessonTests: order, chapterTests: chapterAssessments.length, midterm: midterm._id, final: finalAssessment._id, mock: mockAssessment._id }, 'syllabus.audioLessonCount': audioGenerated, 'syllabus.mediaStatus': { audio: audioGenerated === order ? 'READY' : 'QUEUED', images: 'QUEUED' }, contentGeneration: { status: 'COMPLETE', theory: true, lectures: true, lessonTests: true, chapterTests: true, midterm: true, final: true, mock: true, generatedAt: new Date() }, contentCompleteness: 100 } });
    const finalCourse = await models.Course.findById(course._id).lean();
    if (courseDraftRecord) await models.AIContentDraft.updateOne({ _id: courseDraftRecord._id }, { $set: { status: 'COMMITTED', committedCourseId: course._id, metadata: { ...courseDraftRecord.metadata, committedAt: new Date(), lessonCount: order, assessmentCount: chapterAssessments.length + 3, audioGenerated, imageJobsQueued: order, verifiedPersistedContent: true } } });
    return { course: finalCourse, reused: false, lessonCount: order, assessmentCount: persisted.assessmentCount, verification: persisted, audioGenerated, imageJobsQueued: order, chapterAssessments, midtermAssessmentId: midterm._id, finalAssessmentId: finalAssessment._id, mockAssessmentId: mockAssessment._id, generation: { fingerprint: fingerprintKey, model: context.generationModel || getGeminiModel(), promptVersion: 'AI-COURSE-STAGED-5' } };
}

async function ensurePersonalCourse({ models, username, request = {} } = {}) {
    const requestFingerprint = fingerprint({ username, request: { prompt: request.prompt || '', goal: request.goal || '', targetExam: request.targetExam || '', targetVariant: request.targetVariant || '', subjectId: request.subjectId || '' } });
    if (models.PersonalCourseNeed) {
        try {
            await models.PersonalCourseNeed.findOneAndUpdate({ username, fingerprint: requestFingerprint }, { $set: { need: { ...request, fingerprint: requestFingerprint }, status: 'OPEN' } }, { upsert: true, setDefaultsOnInsert: true });
        } catch (_) {}
    }
    const inferred = await inferLearnerContext({ models, username });
    const context = inferred.context;
    const directNeed = clean(request.prompt || request.goal || '', 6000);
    const masteryNeeds = (context.mastery || []).filter(item => Number(item.accuracy) < 60).slice(0, 20).map(item => item.skill).join(' ');
    const targetExam = clean(request.targetExam || context.learning?.survey?.englishGoal || '', 80).toUpperCase();
    const searchText = [directNeed, targetExam, request.targetVariant, request.subjectId, context.educationContext?.field?.name, context.educationContext?.major?.name, context.educationContext?.major?.code, context.educationContext?.specialization?.name, context.learning?.inference?.careerGoal, ...(context.learning?.goals || []), masteryNeeds].filter(Boolean).join(' ');
    const { candidate, best } = findBestCourse(context, searchText);
    const starterMatch = findStarterCourse({ major: context.educationContext?.major?.name || context.educationContext?.major?.code || '', goal: searchText, targetExam, targetVariant: request.targetVariant || '', subjectId: request.subjectId || context.education?.subjectId || '', prompt: directNeed });
    const focusedDebugNeed = /debug|kiểm thử|kiem thu|unit\s*test|testing|test\s*case|regression|gỡ lỗi|go loi/i.test(directNeed);
    const candidateIsFocused = /debug|kiểm thử|kiem thu|unit\s*test|testing|test\s*case|regression|gỡ lỗi|go loi/i.test(`${candidate?.name || ''} ${candidate?.code || ''} ${listText(candidate?.syllabus?.skills || []).join(' ')} ${listText(candidate?.syllabus?.chapters || []).join(' ')}`);
    if (candidate && best >= 0.38 && !request.forceCreate && (!focusedDebugNeed || candidateIsFocused)) {
        const persisted = await inspectMaterializedCourse(models, candidate.id || candidate._id, Number(candidate.syllabus?.lessonCount) || 12);
        if (persisted.ready) return { decision: 'USE_EXISTING_COURSE', courseId: candidate.id || candidate._id, course: candidate, reason: ['Đã tìm thấy khóa học phù hợp và đã xác minh có bài học, bài kiểm tra được lưu thật.', `Độ phù hợp khoảng ${Math.round(best * 100)}%.`], verification: persisted, context, source: 'CATALOG' };
    }
    const starterIsFocused = /debug|kiểm thử|kiem thu|unit\s*test|testing|test\s*case|regression|gỡ lỗi|go loi/i.test(`${starterMatch?.course?.name || ''} ${starterMatch?.course?.code || ''} ${listText(starterMatch?.course?.skills || []).join(' ')}`);
    if (starterMatch?.course && !request.forceCreate && (!focusedDebugNeed || starterIsFocused)) {
        const starter = context.courses?.find(item => item.code === starterMatch.course.code) || null;
        if (starter) {
            const persisted = await inspectMaterializedCourse(models, starter.id || starter._id, Number(starter.syllabus?.lessonCount) || 12);
            if (persisted.ready) return { decision: 'USE_EXISTING_COURSE', courseId: starter.id || starter._id, course: starter, reason: ['Khóa starter đã được xác minh có bài học và kiểm tra đã lưu.'], verification: persisted, context, source: 'STARTER_CATALOG', starterCode: starter.code };
        }
        if (request.allowStarterFallback === true) {
            const fallback = await createPersonalFromStarter({ models, username, context, request, starter: starterMatch.course });
            if (fallback?.result?.course) return { decision: 'CREATE_PERSONAL_COURSE', courseId: String(fallback.result.course._id), course: fallback.result.course, reason: ['Đã tạo khóa dự phòng từ catalog theo lựa chọn cho phép fallback của người gọi.'], generation: { model: 'STARTER-CATALOG-18', fallback: true }, materialized: fallback.result, context, source: 'STARTER_CATALOG_MATERIALIZED', starterCode: fallback.starterCode };
        }
    }
    let generated;
    try {
        generated = await generateCourseDraft({ request: { ...request, targetExam: request.targetExam || starterMatch?.course?.targetExam || '', targetVariant: request.targetVariant || starterMatch?.course?.targetVariant || '', prompt: directNeed || `Tạo khóa học cá nhân dựa trên profile, ngành/chuyên ngành, mục tiêu, skill gaps và khóa nền ${starterMatch?.course?.name || 'catalog'} để mở rộng nội dung.` }, context, mode: 'PERSONAL' });
    } catch (error) {
        if (request.allowStarterFallback === true && starterMatch?.course) {
            const fallback = await createPersonalFromStarter({ models, username, context, request, starter: starterMatch.course });
            if (fallback?.result?.course) return { decision: 'CREATE_PERSONAL_COURSE', courseId: String(fallback.result.course._id), course: fallback.result.course, reason: ['Đã dùng khóa dự phòng theo lựa chọn cho phép fallback; nội dung không được gắn nhãn là AI tạo mới hoàn chỉnh.'], degraded: true, aiErrorCode: error?.code || 'GEMINI_UNAVAILABLE', generation: { model: 'STARTER-CATALOG-18', fallback: true }, materialized: fallback.result, context, source: 'STARTER_CATALOG_FALLBACK' };
        }
        return { decision: 'AI_TEMPORARILY_UNAVAILABLE', courseId: candidate?.id || '', course: candidate || null, reason: [error?.code === 'AI_COURSE_QUALITY_GATE_FAILED' ? 'Khóa AI chưa đạt kiểm định chất lượng nên chưa được lưu thành khóa học.' : 'AI chưa khả dụng hoặc quota đã hết; hệ thống không thay bằng khóa mẫu.'], degraded: true, aiErrorCode: error?.code || 'GEMINI_UNAVAILABLE', validation: error?.details || null, retryAfterSeconds: Math.max(30, Math.ceil(Number(error?.retryAfterMs || (error?.dailyQuota ? 86400000 : 60000)) / 1000)), context };
    }
    const materialContext = { educationLevel: context.education?.educationLevel, grade: context.education?.grade, subjectId: request.subjectId || starterMatch?.course?.subjectId, institutionId: context.education?.universityId, facultyId: context.education?.facultyId, majorId: context.education?.majorId, specializationId: context.education?.specializationId, trainingProgramId: context.education?.trainingProgramId, semester: context.education?.semester, targetExam: request.targetExam || starterMatch?.course?.targetExam, targetVariant: request.targetVariant || starterMatch?.course?.targetVariant };
    const courseResult = await materializeCourse({ models, draft: generated.draft, mode: 'PERSONAL', ownerUsername: username, request, context: { ...materialContext, generationModel: generated.model }, generateAudioAssets: false });
    return { decision: 'CREATE_PERSONAL_COURSE', courseId: String(courseResult.course._id), course: courseResult.course, reason: ['Không tìm thấy resource đủ phù hợp hoặc người học yêu cầu tạo mới; AI đã sinh khóa cá nhân dựa trên profile và catalog.'], generation: generated, materialized: courseResult, context, source: 'GEMINI_GENERATED' };
}

async function generateDiagnosticAssessment({ models, username, request = {} } = {}) {
    const context = (await inferLearnerContext({ models, username })).context;
    if (!isRemoteAiAllowed()) {
        const starterMatch = findStarterCourse({ major: context.educationContext?.major?.name, goal: (context.learning?.goals || [])[0], targetExam: request.targetExam || request.exam, targetVariant: request.targetVariant || request.variant, subjectId: request.subjectId, prompt: request.prompt });
        const starter = starterMatch?.course || STARTER_COURSES[0];
        const draft = buildStarterDraft(starter);
        const starterQuestionPool = draft.chapters.flatMap(ch => ch.lessons.flatMap(lesson => lesson.test.questions.map((question, index) => ({ ...question, skill: question.skill || lesson.skills?.[index % Math.max(1, lesson.skills?.length || 1)] || lesson.title, difficulty: ['FOUNDATION', 'INTERMEDIATE', 'ADVANCED'][index % 3] }))));
        const prepared = prepareAdaptiveDiagnosticQuestions({ questions: [], fallbackQuestions: starterQuestionPool, skills: starter.skills, limit: 30 });
        if (!prepared.valid) { const error = new Error('Ngân hàng chẩn đoán dự phòng chưa đủ 12 câu, 3 kỹ năng và 2 mức độ khó.'); error.code = 'DIAGNOSTIC_BLUEPRINT_INCOMPLETE'; error.details = prepared.diagnostics; throw error; }
        const questions = prepared.questions;
        const localResult = { data: { title: `Diagnostic · ${starter.name}`, purpose: 'Xác định kỹ năng hiện tại bằng câu hỏi cân bằng theo nhiều kỹ năng và độ khó.', stoppingRule: 'Dừng khi đã đủ bằng chứng cho ít nhất 3 kỹ năng hoặc đạt giới hạn câu hỏi.', skills: [...new Set(questions.map(question => question.skill))], questions }, model: 'SMART-CATALOG-V19' };
        const sourceRef = { sourceType: 'ORIGINAL_PRACTICE', verification: 'unverified', notes: 'Smart-mode personalized diagnostic; not official.' };
        const version = await models.CurriculumVersion.findOneAndUpdate({ code: `AI-DIAGNOSTIC-${hashText(username).slice(0, 12)}`, version: '1' }, { $set: { status: 'ACTIVE', educationLevel: normalizeEducationLevel(context.education?.educationLevel, context.education?.grade), grades: context.education?.grade ? [context.education.grade] : [], sourceRef }, $setOnInsert: { code: `AI-DIAGNOSTIC-${hashText(username).slice(0, 12)}`, version: '1' } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
        const pseudoCourse = await models.Course.create({ curriculumVersionId: version._id, code: `AI-DIAG-${hashText(`${username}:${Date.now()}`).slice(0, 12)}`, name: localResult.data.title, description: localResult.data.purpose, educationLevel: normalizeEducationLevel(context.education?.educationLevel, context.education?.grade), grade: context.education?.grade || null, subjectId: clean(request.subjectId || starter.subjectId, 120), category: 'PERSONAL_AI', kind: 'PERSONAL_AI', ownerUsername: username, personalizedFor: { username, diagnostic: true, request }, aiGeneration: { model: localResult.model, generatedAt: new Date(), promptVersion: 'SMART-DIAGNOSTIC-1' }, sourceRef, syllabus: { mode: 'SMART_DIAGNOSTIC', skills: localResult.data.skills, stoppingRule: localResult.data.stoppingRule }, status: 'ACTIVE' });
        const questionIds = await materializeQuestions({ models, course: pseudoCourse, lessonId: null, questions, sourceRef, mode: 'PERSONAL', prefix: `${pseudoCourse.code}-Q`, context: { educationLevel: pseudoCourse.educationLevel, grade: pseudoCourse.grade, subjectId: pseudoCourse.subjectId } });
        const diagnosticQuestionRows = await models.Question.find({ _id: { $in: questionIds }, courseId: pseudoCourse._id }).lean();
        const diagnosticScope = validateAssessmentScope({ course: pseudoCourse, assessmentType: 'DIAGNOSTIC', questions: diagnosticQuestionRows });
        if (!diagnosticScope.valid) { const error = new Error(`Diagnostic không đạt kiểm tra liên kết: ${diagnosticScope.errors.join(', ')}`); error.code = 'DIAGNOSTIC_SCOPE_VALIDATION_FAILED'; error.details = diagnosticScope; throw error; }
        const assessment = await models.Assessment.create({ code: `${pseudoCourse.code}-TEST`, title: localResult.data.title, assessmentType: 'DIAGNOSTIC', educationLevel: pseudoCourse.educationLevel, grade: pseudoCourse.grade, curriculumVersionId: version._id, subjectId: pseudoCourse.subjectId, courseId: pseudoCourse._id, questionIds, questionPool: questionIds, durationSeconds: 1800, attemptLimit: 2, passingScore: 70, randomization: { enabled: true, mode: 'question' }, scoring: { method: 'objective_percentage' }, reviewSettings: { showExplanationAfterSubmit: true }, publicationStatus: 'PUBLISHED', version: '38.0.0', sourceRef });
        await models.Course.updateOne({ _id: pseudoCourse._id }, { $set: { 'syllabus.assessmentId': assessment._id, 'syllabus.questionCount': questionIds.length } });
        return { assessmentId: assessment._id, courseId: pseudoCourse._id, test: localResult.data, model: localResult.model, sourceLabel: 'Smart-mode personalized diagnostic; not official exam.' };
    }
    const prompt = `Tạo adaptive diagnostic test cho người học. Request: ${JSON.stringify(request)}. Context: ${JSON.stringify(context).slice(0, 32000)}. Kiểm tra skill quan trọng nhất theo mục tiêu; độ khó tăng/giảm theo evidence; có stopping rule; không official. Mỗi câu phải có answer và explanation.`;
    const result = await generateStructured({ prompt, schema: diagnosticSchema, systemInstruction: 'Bạn là Adaptive Assessment Composer. Hãy tạo diagnostic có thể lưu thành Assessment cá nhân. Không gắn nhãn official.', maxOutputTokens: 10000, temperature: 0.3, profile: 'assessment', timeoutMs: 300000 });
    const diagnosticStarter = findStarterCourse({ major: context.educationContext?.major?.name, goal: (context.learning?.goals || [])[0], targetExam: request.targetExam || request.exam, targetVariant: request.targetVariant || request.variant, subjectId: request.subjectId, prompt: request.prompt });
    const diagnosticFallbackDraft = buildStarterDraft(diagnosticStarter?.course || STARTER_COURSES[0]);
    const diagnosticFallbackQuestions = diagnosticFallbackDraft.chapters.flatMap(ch => ch.lessons.flatMap(lesson => lesson.test.questions.map((question, index) => ({ ...question, skill: question.skill || lesson.skills?.[index % Math.max(1, lesson.skills?.length || 1)] || lesson.title, difficulty: ['FOUNDATION', 'INTERMEDIATE', 'ADVANCED'][index % 3] }))));
    const preparedDiagnostic = prepareAdaptiveDiagnosticQuestions({ questions: result.data.questions, fallbackQuestions: diagnosticFallbackQuestions, skills: result.data.skills, limit: 30 });
    if (!preparedDiagnostic.valid) { const error = new Error('Bài kiểm tra đầu vào chưa đủ độ phủ: cần ít nhất 12 câu duy nhất, 3 kỹ năng và 2 mức độ khó.'); error.code = 'DIAGNOSTIC_BLUEPRINT_INCOMPLETE'; error.details = preparedDiagnostic.diagnostics; throw error; }
    result.data.questions = preparedDiagnostic.questions;
    result.data.skills = [...new Set(preparedDiagnostic.questions.map(question => question.skill))];
    const sourceRef = { sourceType: 'ORIGINAL_PRACTICE', verification: 'unverified', notes: 'AI-generated personalized diagnostic; supplemented with same-track local question bank if needed; not official.' };
    const version = await models.CurriculumVersion.findOneAndUpdate({ code: `AI-DIAGNOSTIC-${hashText(username).slice(0, 12)}`, version: '1' }, { $setOnInsert: { code: `AI-DIAGNOSTIC-${hashText(username).slice(0, 12)}`, version: '1', status: 'ACTIVE', educationLevel: normalizeEducationLevel(context.education?.educationLevel, context.education?.grade), grades: context.education?.grade ? [context.education.grade] : [], sourceRef } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    const pseudoCourse = await models.Course.create({ curriculumVersionId: version._id, code: `AI-DIAG-${hashText(`${username}:${Date.now()}`).slice(0, 12)}`, name: result.data.title, description: result.data.purpose, educationLevel: normalizeEducationLevel(context.education?.educationLevel, context.education?.grade), grade: context.education?.grade || null, subjectId: clean(request.subjectId, 120), category: 'PERSONAL_AI', kind: 'PERSONAL_AI', ownerUsername: username, personalizedFor: { username, diagnostic: true, request }, aiGeneration: { model: result.model, generatedAt: new Date(), promptVersion: 'AI-DIAGNOSTIC-1', fingerprint: fingerprint({ username, request, skills: result.data.skills }) }, sourceRef, syllabus: { mode: 'AI_DIAGNOSTIC', skills: result.data.skills, stoppingRule: result.data.stoppingRule }, status: 'ACTIVE' });
    const questionIds = await materializeQuestions({ models, course: pseudoCourse, lessonId: null, questions: result.data.questions, sourceRef, mode: 'PERSONAL', prefix: `${pseudoCourse.code}-Q`, context: { educationLevel: pseudoCourse.educationLevel, grade: pseudoCourse.grade, subjectId: pseudoCourse.subjectId } });
    const diagnosticQuestionRows = await models.Question.find({ _id: { $in: questionIds }, courseId: pseudoCourse._id }).lean();
    const diagnosticScope = validateAssessmentScope({ course: pseudoCourse, assessmentType: 'DIAGNOSTIC', questions: diagnosticQuestionRows });
    if (!diagnosticScope.valid) { const error = new Error(`Diagnostic không đạt kiểm tra liên kết: ${diagnosticScope.errors.join(', ')}`); error.code = 'DIAGNOSTIC_SCOPE_VALIDATION_FAILED'; error.details = diagnosticScope; throw error; }
    const assessment = await models.Assessment.create({ code: `${pseudoCourse.code}-TEST`, title: result.data.title, assessmentType: 'DIAGNOSTIC', educationLevel: pseudoCourse.educationLevel, grade: pseudoCourse.grade, curriculumVersionId: version._id, subjectId: pseudoCourse.subjectId, courseId: pseudoCourse._id, questionIds, questionPool: questionIds, durationSeconds: 1800, attemptLimit: 2, passingScore: 70, randomization: { enabled: true, mode: 'question' }, scoring: { method: 'objective_percentage' }, reviewSettings: { showExplanationAfterSubmit: true }, publicationStatus: 'PUBLISHED', version: '38.0.0', sourceRef });
    await models.Course.updateOne({ _id: pseudoCourse._id }, { $set: { 'syllabus.assessmentId': assessment._id, 'syllabus.questionCount': questionIds.length } });
    return { assessmentId: assessment._id, courseId: pseudoCourse._id, test: result.data, model: result.model, sourceLabel: 'AI-generated personalized diagnostic / practice, not official exam.' };
}

module.exports = { buildLearnerContext, inferLearnerContext, validateCourseDraft, validateAdaptiveAICourseDraftV38, generateCourseDraft, buildDirectorDecision, materializeCourse, ensurePersonalCourse, generateDiagnosticAssessment, inspectMaterializedCourse, evaluateMaterializedCourse, courseSchema, directorSchema, fingerprint, STARTER_COURSES };

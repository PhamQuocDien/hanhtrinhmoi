'use strict';

/**
 * Idempotent platform migration definition.
 * This file is intentionally not executed automatically and never drops data.
 * The runner receives a connected mongoose connection and creates only the
 * collections/indexes declared by registered models.
 */

const models = require('../../server/models/platform-models.js');
const { getCatalog, getSubject } = require('../../curriculum-data.js');

async function seedLegacyCurriculum({ version, logger = console } = {}) {
    const inserted = [];
    for (let grade = 1; grade <= 12; grade += 1) {
        const catalog = getCatalog(grade);
        for (const subject of catalog.subjects || []) {
            const legacySubject = getSubject(grade, subject.id, { includeLessons: true }) || subject;
            const subjectCode = `legacy-g${grade}-${subject.id}`;
            let subjectDoc = await models.CurriculumContent.findOne({ curriculumVersionId: version._id, type: 'SUBJECT', code: subjectCode });
            if (!subjectDoc) {
                subjectDoc = await models.CurriculumContent.create({ curriculumVersionId: version._id, type: 'SUBJECT', code: subjectCode, title: subject.name, grade, subjectId: subject.id, objectives: subject.gradeFocus ? [subject.gradeFocus] : [], status: 'PUBLISHED', sourceRef: { sourceType: 'ORIGINAL_PRACTICE', documentName: 'curriculum-data.js', version: catalog.programVersion, verification: 'unverified' }, payload: { adapter: 'legacy-curriculum-data', lessonCount: subject.lessonCount } });
                inserted.push(subjectDoc._id);
            }
            for (const lesson of legacySubject.lessons || []) {
                const lessonCode = `${subjectCode}-${lesson.id}`;
                const exists = await models.CurriculumContent.exists({ curriculumVersionId: version._id, type: 'LESSON', code: lessonCode });
                if (exists) continue;
                const lessonDoc = await models.CurriculumContent.create({ curriculumVersionId: version._id, type: 'LESSON', parentId: subjectDoc._id, code: lessonCode, title: lesson.title, grade, subjectId: subject.id, objectives: lesson.objectives || [], knowledge: lesson.knowledge || [], skills: lesson.skills || [], outcomes: lesson.outcomes || [], status: 'PUBLISHED', sourceRef: { sourceType: 'ORIGINAL_PRACTICE', documentName: 'curriculum-data.js', version: catalog.programVersion, verification: 'unverified' }, payload: { adapter: 'legacy-curriculum-data', legacyLessonId: lesson.id } });
                inserted.push(lessonDoc._id);
            }
        }
    }
    logger.log(JSON.stringify({ migration: '001-platform-collections', legacyCurriculumInserted: inserted.length }));
    return inserted.length;
}

async function up({ connection = require('mongoose').connection, logger = console } = {}) {
    if (!connection || connection.readyState !== 1) throw new Error('MongoDB connection must be ready before running a migration.');
    const before = {};
    const after = {};
    for (const [name, Model] of Object.entries(models)) {
        const collection = Model.collection;
        before[name] = await collection.countDocuments();
        await Model.createCollection().catch(error => {
            if (error?.codeName !== 'NamespaceExists' && error?.code !== 48) throw error;
        });
        await Model.syncIndexes();
        after[name] = await collection.countDocuments();
    }
    const curriculumCode = 'LEGACY-CURRICULUM-ADAPTER';
    let curriculumVersion = await models.CurriculumVersion.findOne({ code: curriculumCode, version: '1' });
    if (!curriculumVersion) curriculumVersion = await models.CurriculumVersion.create({ code: curriculumCode, version: '1', status: 'ACTIVE', grades: Array.from({ length: 12 }, (_, index) => index + 1), sourceRef: { sourceType: 'ORIGINAL_PRACTICE', documentName: 'curriculum-data.js', version: 'adapter', verification: 'unverified' }, metadata: { adapter: 'legacy-curriculum-data', explicitMigrationOnly: true } });
    const legacyCurriculumInserted = await seedLegacyCurriculum({ version: curriculumVersion, logger });
    logger.log(JSON.stringify({ migration: '001-platform-collections', before, after }));
    return { migration: '001-platform-collections', before, after, legacyCurriculumInserted };
}

module.exports = { id: '001-platform-collections', up };
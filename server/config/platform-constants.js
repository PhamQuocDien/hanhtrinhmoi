'use strict';

const EDUCATION_LEVELS = Object.freeze(['PRIMARY', 'SECONDARY_LOWER', 'SECONDARY_UPPER', 'HIGHER_EDUCATION', 'ENGLISH_CERTIFICATION', 'SELF_STUDY']);
const GRADES = Object.freeze(Array.from({ length: 12 }, (_, index) => index + 1));
const QUESTION_TYPES = Object.freeze([
    'single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'short_answer',
    'ordering', 'matching', 'numerical', 'essay', 'listening', 'speaking',
    'image_based', 'reading_comprehension', 'coding', 'practical', 'timed_simulation'
]);
const ENGLISH_SKILLS = Object.freeze(['LISTENING', 'READING', 'SPEAKING', 'WRITING']);
const COURSE_CATEGORIES = Object.freeze([
    'GENERAL_EDUCATION', 'FOUNDATION', 'MAJOR_FOUNDATION', 'MAJOR_REQUIRED',
    'MAJOR_ELECTIVE', 'SPECIALIZATION', 'INTERNSHIP', 'PROJECT', 'THESIS_CAPSTONE', 'PERSONAL_AI', 'OTHER'
]);
const SOURCE_TYPES = Object.freeze([
    'OFFICIAL_PUBLIC_SAMPLE', 'OFFICIAL_REFERENCE', 'ORIGINAL_PRACTICE',
    'SIMULATION', 'USER_IMPORTED', 'ADMIN_CREATED'
]);

function sourceRefSchema() {
    return {
        sourceType: { type: String, default: 'ADMIN_CREATED' },
        organization: { type: String, default: '' },
        documentName: { type: String, default: '' },
        documentNumber: { type: String, default: '' },
        url: { type: String, default: '' },
        effectiveDate: { type: Date, default: null },
        version: { type: String, default: '' },
        verifiedAt: { type: Date, default: null },
        verification: { type: String, enum: ['unverified', 'title_verified', 'full_text_verified'], default: 'unverified' },
        notes: { type: String, default: '' }
    };
}

module.exports = { EDUCATION_LEVELS, GRADES, QUESTION_TYPES, ENGLISH_SKILLS, COURSE_CATEGORIES, SOURCE_TYPES, sourceRefSchema };
# Release Notes — V21.1.0 Phase 2 Hardening

## Delivered

- Survey/profile/education sync, including higher-education fields and provenance.
- Per-grade K12 placement catalogs for grades 1–12; dedicated University IT, TOEIC, IELTS and MOS diagnostic catalogs.
- Skill-level placement evidence, `SkillMastery` updates, learning-plan versioning, course/lesson matching when an actual catalog match is found, and explicit course-gap markers when no reliable match exists.
- Admin quick creation UI with Word/Markdown/TXT import, preview/edit/validation and draft creation for course, lesson/lecture, question bank and assessment.
- DOCX paragraph extraction with heading styles preserved; Vietnamese question-type aliases; one-question documents are recognized as question banks.
- Assessment publish validation for question presence, prompt validity and objective-answer completeness.
- Mongo/Mongoose `SELF_STUDY` education-level support and old runtime version assertions updated for V21.



## Hardening follow-up (V21.1.0)

- Strict survey validation and Admin `INVALID / NEEDS_REPAIR` diagnostics; hidden branch questions are not required or persisted by the learner submit path.
- Correct survey metadata display (question count and distinct section count); true/false objective questions require two valid distinct choices.
- Assessment results now create skill-level evidence/mastery and a new active Learning Plan version where auto-scored evidence exists; prior plans are archived rather than overwritten.
- TOEIC/IELTS profile sync also runs for regular assessment submissions, not only placement. Writing/Speaking or other review-required answers stay marked for review and practice estimates are explicitly non-official.
- Adaptive placement reduces repeated questions, adapts target difficulty, protects answer/rubric/hidden-test fields, and honors minimum per-skill coverage.
- Added hardening tests for survey validation, branching, English per-skill profiles, provenance and goal-to-plan candidates.

No Course Factory expansion was performed in this phase.

## Content import limitations

This is text extraction, not OCR. Scanned/image-only Word files, text inside images, embedded audio/video and complex document layouts need manual review or preprocessing. All imported content is saved as a draft and marked unverified until reviewed by an administrator.

## Test status

Run `npm test` and `npm run validate` from the project root after deploying dependencies/environment. The ZIP does not contain secrets or runtime `.env` values. Database-backed migration and signed-in browser flows require the deployment's MongoDB and account permissions, so they must also be verified in the target environment.

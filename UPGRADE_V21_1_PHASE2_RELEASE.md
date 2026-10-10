# Hành Trình Mới V21.1.0 — Phase 2 Hardening

## Scope

This is a hardening follow-up to Phase 2 only. No Course Factory work was added.

## Changes

- Enforced survey validation: title, description, version, valid question types/options, unique question codes and required question. Invalid published records are not exposed to learners and are marked `INVALID / NEEDS_REPAIR` in Admin.
- Applied branch-aware required checks and filtered hidden conditional answers before saving attempts. Corrected question/group count metadata in Survey UI.
- Added adaptive placement selection by skill coverage and difficulty, using only IDs from the validated question pool. Sensitive answer keys, rubrics and hidden test cases are stripped from client responses.
- Synced assessment skill evidence and mastery into versioned Learning Plans. Previous ACTIVE plans are archived; recommendations link to actual catalog courses/lessons only when a reliable match exists, otherwise `COURSE_GAP` is recorded.
- TOEIC and IELTS store separate Listening/Reading and four-skill IELTS diagnostic profiles. Normal practice assessments can also update those profiles. Writing/Speaking and other subjective tasks remain review-required; diagnostic results are not claimed as official scores.
- Added regression tests for invalid survey records, conditional questions, options, placement adaptive coverage, hidden-answer protection, provenance and English skill profiles.

## Validation

Run from project root with Node.js 20.x and dependencies installed:

```bash
npm test
npm run validate
```

Database-backed seed and signed-in routes still require testing against the actual deployment MongoDB and user permissions. Back up production data before deploying.

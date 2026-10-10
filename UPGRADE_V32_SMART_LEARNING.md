# Hành Trình Mới V32.0.0 — Course Integrity, Assessment UX, Safe Runner

## V32 changes

- Verify persisted course material before reusing or linking a catalog course in an adaptive plan. A generated personal course is marked complete only after the database has the expected lesson count, substantive theory sections, lecture scripts, solved examples, practice tasks, published lesson tests, chapter tests, midterm, final and mock assessment. Incomplete generated personal courses are cleaned up before a retry; the roadmap keeps `COURSE_GAP` rather than writing a fake link.
- The roadmap automatically tries to materialize a small batch of unmatched priority skills as personal courses. Each successful item displays a real course link and first lesson. Failures remain visible gaps and are not represented as completed curriculum.
- Assessment UX supports aliases for ordering/matching/programming question types, working move-up/move-down controls, robust data-attribute lookup, executor status messages and an explicit confirmation if the learner submits with unanswered questions.
- `/api/ai-learning/code/status` checks `/health` of a configured remote executor before claiming it is ready. Running student code inside the main Express process remains prohibited.
- The isolated executor shares a configured absolute host work directory with the Docker daemon, fixing the prior container-only path mount. `.env.example` and `executor-service/README.md` now explain required configuration. Code execution is still off by default until the isolated service is actually deployed and reachable.
- Long legacy learning material is split into short readable pieces; numbered steps become ordered lists. Generated personal-course pages use the same short-form treatment. All HTML assets referencing the V31 cache version are bumped to V32 to avoid stale browser JS/CSS.
- Automated scoring continues for objective questions, ordering, matching, coding test cases when a runner is ready, and essay/practical answers using the local rubric evaluator. Rubric results are formative feedback, not a professional or official certification grade. Speech analysis or unavailable infrastructure may still be marked as requiring a specialized pipeline; no external AI API is called to grade ordinary objective questions.
- The local curriculum composer remains the cost-saving default for creating an original structured draft. The application must not present generated content as officially verified: generated courses need curriculum review before being promoted into the canonical shared catalog.

## Executor installation

1. On a dedicated trusted Linux host with Docker Engine, copy `executor-service/.env.example` to `.env`.
2. Set `CODE_EXECUTOR_TOKEN` to a random secret (for example `openssl rand -hex 32`). Set `EXECUTOR_HOST_WORK_ROOT` to an absolute, non-root path such as `/opt/hanhtrinhmoi-code-executor/runtime-work`.
3. Create that host directory with restricted ownership/permissions. Run `docker compose up -d --build` from `executor-service` and verify `curl http://127.0.0.1:8090/health`.
4. Configure the main app's environment with `CODE_RUNNER_ENABLED=true`, `CODE_RUNNER_EXECUTOR=remote`, private `CODE_EXECUTOR_URL` and the same token. For separate hosts, use private networking/VPN plus TLS; do not expose the executor publicly.

## Verification

Run `npm test`, `npm run validate`, and the JavaScript syntax checks. Real MongoDB persistence, real email/SMS delivery, Docker image availability and hosted Render networking cannot be proven by source-only tests; verify those on a staging deployment before promoting the version.

# Hành Trình Mới V33.0.0 — resilience, onboarding and executor setup

## Fixes

- Normalize API collection envelopes (`items`, `data`, `data.items`) before rendering surveys, placement tests, learner hub and Admin lists. Missing collections become empty arrays instead of `undefined`.
- Normalize legacy values such as `goals`, `glossary`, `commonMistakes`, `quickChecks` and skills before calling `join()` or `map()`.
- Guard UI visibility updates and Admin quick-create result panels before writing `.hidden`, `innerHTML` or event handlers.
- Localize `REUSE_OR_ENRICH` as “Dùng khóa hiện có / bổ sung nội dung” in learning-engine status chips.
- Synchronize the app version and static asset cache query versions to V33.
- After registration, the browser attempts to create a session and redirects to `/survey.html?onboarding=1`. If session creation fails, a visible fallback appears rather than claiming the survey opened.
- Survey, placement, assessment-result and manually generated plans schedule automatic personal-course provisioning after the plan is persisted. The standard plan flow works through up to eight missing courses sequentially per cycle; the adaptive-evidence flow works through up to two at once. Both share a single-flight lock per learner/skill, persist `READY`/`FAILED` state, and never clear `COURSE_GAP` unless saved lessons and assessments pass integrity checks. Failed generations are retried after a 30-minute cooldown on a later plan load, or immediately through the learner-facing “Thử tạo khóa học + bài học” action (`POST /api/learning-system/plan/retry-gaps`). Adaptive recommendation polls status for background generation. Personal courses are learner-private and never published into the shared catalog without a separate publishing workflow.
- Add an executor deployment script, compose health check and private-host setup documentation. The service was source-checked and its health behavior is verified by tests; the current build environment has no Docker CLI, so a real isolated code run could not be executed here.

## Code execution safety

The executor is a separate private service; learner code is never executed in the main Express process. It accepts only allow-listed languages, requires a bearer token and runs each submission in a Docker container with `--network none`, CPU/memory/PID/file/time/output limits, read-only root filesystem, dropped capabilities and a non-root execution UID. `/health` checks that Docker Engine actually responds.

This source package cannot deploy to the user's VPS/cloud account because it has no access to that host, Docker daemon or deployment credentials. A real deployment requires running `executor-service/deploy-linux.sh` on a dedicated Linux host and configuring the main app with the private HTTPS/VPN URL and the same token. Until `/api/ai-learning/code/status` reports healthy and securely isolated, code execution stays disabled instead of running learner code inside Express.

## Validation

`npm test` and `npm run check` include the V33 resilience suite. Additional validation is still needed against a live staging MongoDB and the deployed private executor.

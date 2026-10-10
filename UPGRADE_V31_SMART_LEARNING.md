# Hành Trình Mới V31.0.0 — Smart Learning & Assessment Repair

## Main changes

- The local education composer can create a course specifically for a missing skill/topic without requiring an external AI API. The result is validated for chapters, 12 lessons, typed theory sections, examples, guided/independent practice, lesson/chapter tests and larger assessments before it is materialized.
- Adaptive plan course gaps request a targeted course by the missing skill and persist links only after a course and a real lesson are saved.
- Vietnamese topic normalization now maps `đ/Đ` to `d/D`, so topics such as “Hiện tại đơn” can select the topic-specific question bank.
- Assessment interactions support ordering, matching, code editor/input, running tests against an isolated executor, and submitting the assessment. Matching/order responses are scored by their structures rather than object-string order.
- Essay and practical responses can receive immediate local rubric feedback (`LOCAL_RUBRIC_AUTO`) without an admin approval gate. It is a heuristic, not a guarantee of expert-quality language assessment. Speaking still requires speech-specific assessment support for reliable pronunciation scoring.
- K–12 lesson theory uses named sections, paragraph segmentation and an expandable/collapsible lesson view to avoid a wall of text.
- Code execution is off by default. Student code is never evaluated in the Express web process. Use the separate `executor-service/` on a dedicated Linux host with Docker, private network access and a shared secret of at least 32 characters.

## Configure code execution

1. Read `executor-service/README.md` and deploy it on a dedicated trusted Linux host with Docker Engine.
2. Generate a random secret with `openssl rand -hex 32` and set it as `CODE_EXECUTOR_TOKEN` for the executor.
3. Keep the executor endpoint private, behind a private network/VPN, firewall allow-list and TLS if traffic crosses hosts. Do not expose port 8090 to the public internet.
4. In the main app environment, set `CODE_RUNNER_ENABLED=true`, `CODE_RUNNER_EXECUTOR=remote`, `CODE_EXECUTOR_URL` to the private executor URL plus `/execute`, and the same `CODE_EXECUTOR_TOKEN`.
5. Until this service is configured and reachable, the UI intentionally reports that the runner is unavailable instead of pretending to compile code.

## Other environment settings

- Copy `.env.example` to `.env` for local runs. Never commit a real `.env` or place API tokens in the ZIP.
- Configure MongoDB and a random `SESSION_SECRET` before running the app.
- OTP sending requires a configured Resend email adapter or Twilio SMS adapter. Automated tests use mock providers, not real outbound messages.
- The default AI course composer, question bank selection and adaptive course-gap creation do not require remote AI API keys. Remote AI fallback remains disabled by default.

## Checks run

- `npm test` — all scripted regression suites, including V31 smart learning.
- `npm run validate` — HTML/JavaScript project validator.
- `node --check` on the key changed server-side modules and learning-catalog client.
- ZIP integrity is checked after packaging.

## Deployment caveat

These source-level tests do not prove that the live Render service's MongoDB, email/SMS provider, Docker host or private executor are configured. Deploy the main app and executor service separately, set environment variables securely, and perform end-to-end smoke tests after deployment.

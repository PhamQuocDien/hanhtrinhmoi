# Hành Trình Mới V26.0.0 — Phase 4, Phase 5, Phase 6

## Phase 4 — Integration hardening and safety

- Added account-scoped `LessonProgress` persistence with unique per-user/per-lesson indexes.
- Added authenticated GET/PUT lesson-progress API. Completion percent is derived by the server from recognized lesson steps; the client cannot submit arbitrary percent. Assessment completion requires a submitted/review-required assessment attempt.
- Tightened `/api/ready`: in production it requires MongoDB to be connected and a stable `SESSION_SECRET` of at least 32 characters. Missing secret uses a random process-local fallback rather than a predictable Mongo URI-derived value; sessions may reset on restart until the deployment secret is configured.
- Added rate limiting to the code execution and local AI endpoints. User code execution remains disabled by default and is blocked in production unless the unsafe non-sandbox bypass is explicitly enabled. Do not enable that bypass on a public host; deploy an isolated executor first.

## Phase 5 — Bite-sized lesson experience

- Added lesson progress checklist for theory sections (or a legacy single-theory field), examples, practice, practical/lab, quick-check and eligible assessment steps.
- Progress syncs to MongoDB for catalog items with Mongo ObjectIds and falls back to browser localStorage for legacy or temporarily offline flows.
- Added the project-specific Local Tutor panel to course detail; answers include published lesson sources when available.

## Phase 6 — Local AI / retrieval-augmented tutor

- Added `server/services/local-ai-runtime.js`: Vietnamese query normalization, keyword/reranked retrieval, context-limited lesson extraction, citations, no-source refusal and optional Ollama local-model generation.
- Added authenticated `/api/ai-learning/local/status` and `/api/ai-learning/local/ask`; only published lesson text/theory/examples/skills is retrieved, not question-bank answer keys or hidden coding tests. Personal AI courses must belong to the requesting learner.
- The built-in retrieval path requires no cloud API key. For free-form local generation, install Ollama and the configured model on a trusted private host; model weights are intentionally not included in the application ZIP.
- Private host override only allows private-network IPs/trusted local names, not arbitrary public URLs. Public response omits the configured base URL.

## Configuration

Review `.env.example`. Production should set a stable random `SESSION_SECRET` and a valid `MONGO_URI`. Local model is optional and disabled by default. Code runner remains disabled by default until a separate sandbox executor is available.

## Verification

- `npm test`: PASS across previous runtime/catalog/survey/placement/Phase 3 regressions, plus Phase 4 (5 checks), Phase 5 (5 checks), and Phase 6 (7 checks).
- `npm run validate`: PASS; 53 HTML pages and 116 JavaScript files syntactically checked, required endpoints/assets/runbook present.
- ZIP integrity checked after packaging.

## Honest deployment limitations

- Automated tests in this environment are contract/unit/regression checks; they are not a full production E2E test against the user's live MongoDB/Render instance. A direct local server boot smoke test could not run because project dependencies (for example `dotenv`) are not installed in this workspace. Run `npm ci`, configure `.env`, connect MongoDB, then test `/healthz`, `/api/ready`, login roles, progress save/load, local tutor and Admin flows in a staging deployment.
- This package contains retrieval logic, not a bundled large language model. `LOCAL_RETRIEVAL_ONLY` works without external services; a truly generative model requires installing/configuring Ollama and model weights separately. Other pre-existing Gemini-powered routes remain available when an operator explicitly configures Gemini; the local tutor/Course Factory paths described here do not call those remote routes.
- Real safe code execution in production needs a dedicated isolated sandbox/container executor. The package intentionally blocks unsafe in-process execution by default.

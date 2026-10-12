# Code runner — V6.1.0

The web lesson editor posts source code to `POST /api/career/code/run`. The API confirms learner authentication, course enrollment, lesson-level runner configuration and rate limits before sending code to Judge0 CE. It never evaluates submitted code inside the Node.js web process.

## Supported execution languages

- C++
- Java
- C# (Mono runtime offered by the selected Judge0 instance)
- JavaScript (Node.js)
- Python
- SQL (SQLite, if enabled by the selected Judge0 instance)

HTML and CSS lessons run only as previews inside an iframe with a restrictive sandbox; preview is not described as compilation. A language option only appears on a lesson if the lesson has its own `codeExercise` definition.

## Environment variables

The project keeps its original variable names and uses these controls:

- `CODE_RUNNER_ENABLED=true`
- `CODE_RUNNER_EXECUTOR=judge0`
- `CODE_JUDGE0_URL=https://ce.judge0.com`
- `CODE_RUNNER_TIMEOUT_MS=10000`
- `CODE_RUNNER_CPU_SECONDS=2`
- `CODE_RUNNER_MEMORY_KB=128000`
- `CODE_EXECUTOR_TOKEN=...` only when the selected endpoint requires it

`CODE_RUNNER_TIMEOUT_MS`, CPU time and memory are clamped by the API. Network access for a submission is requested disabled. The hosted endpoint may impose queue quotas, rate limits, or different installed language versions; configure `CODE_JUDGE0_URL` to a private/self-hosted Judge0 instance for production control. The optional `CODE_EXECUTOR_URL` remains available in configuration but the integrated driver in this version uses the Judge0 API URL.

## Production security and privacy

Source code and stdin sent to a hosted Judge0 provider leave this application and are processed by that provider. Tell users about this in your privacy notice. Do not send credentials or personal data in sample inputs. For deployment, use a private runner or self-hosted Judge0, isolate it from the application/database network, set CPU/memory/wall-clock limits, rate-limit user submissions, restrict result size, and monitor cost/abuse. Public educational endpoints may be subject to fair-use controls and can be unavailable.

# Private isolated code executor

The main web application must never execute learner code in its own Node.js process. This service is a private bridge that runs a fixed language allow-list in per-run Docker containers with networking disabled, memory/CPU/PID/file limits, a read-only root filesystem and a wall-clock timeout.

## Quick deployment on a dedicated Linux host with Docker Engine

1. Run `bash deploy-linux.sh` as a deployment operator on a **dedicated trusted Linux host** with Docker Engine, Docker Compose v2, `openssl`, `curl`, and `sudo` available. It creates a random token in a permission-600 `.env` if one does not exist, prepares the host work directory, builds the image, starts the service and checks `/health`. Review the script before running it. Never commit `.env`.
2. `EXECUTOR_HOST_WORK_ROOT` in `.env` must be an **absolute, non-root path on the Docker host**, such as `/opt/hanhtrinhmoi-code-executor/runtime-work`. Compose mounts that same host directory at `/srv/runtime-work`; Docker Engine on the host must be able to resolve it.
3. The API binds to `127.0.0.1:8090` by default and the compose health check requires a live Docker Engine. Do not put this port directly on the public Internet.
4. Configure the main app with `CODE_RUNNER_ENABLED=true`, `CODE_RUNNER_EXECUTOR=remote`, `CODE_EXECUTOR_URL=<private HTTPS/VPN address>/execute`, and exactly the same `CODE_EXECUTOR_TOKEN` stored in the executor host's `.env`. The main app cannot reach `127.0.0.1` on a separate host; connect the hosts using private VPN/network and TLS. Never expose the Docker socket or executor unauthenticated.

## Web application integration

In the main app service settings, add `CODE_RUNNER_ENABLED=true`, `CODE_RUNNER_EXECUTOR=remote`, `CODE_EXECUTOR_URL` pointing at the private executor `/execute` URL, and the same `CODE_EXECUTOR_TOKEN` from the executor host. Restart the web app after saving. Open a coding assessment as an authenticated learner and check `/api/ai-learning/code/status`; `healthy` and `securelyIsolated` must both be true before execution is enabled. A running Node process alone is not enough.

## Important security boundary

The service requires host Docker access through `/var/run/docker.sock`, which is a high-privilege boundary. Run it only on a dedicated trusted Linux host, keep Docker updated, restrict host access and do not let learners administer this host. It accepts only `cpp`, `c`, `java`, `python`, and `javascript`; learners cannot select an image, command, mounts, network, memory limits or runtime options. Containers run with `--network none`, resource limits, no extra Linux capabilities, a non-root UID and a read-only root filesystem.

The source package cannot confirm that the hosted deployment has Docker Engine or a reachable private executor. Until the service is deployed and its `/health` endpoint can be reached from the main app, code execution remains unavailable with an explicit status rather than running unsafe code in Express.

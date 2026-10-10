#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Chỉ chạy script này trên máy chủ Linux chuyên dụng có Docker Engine." >&2
  exit 1
fi
command -v docker >/dev/null 2>&1 || { echo "Chưa cài Docker Engine/Docker CLI." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Cần Docker Compose v2 (docker compose)." >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "Cần openssl để tạo token ngẫu nhiên." >&2; exit 1; }

if [[ ! -f .env ]]; then
  cp .env.example .env
  token="$(openssl rand -hex 32)"
  if sed --version >/dev/null 2>&1; then
    sed -i "s/^CODE_EXECUTOR_TOKEN=.*/CODE_EXECUTOR_TOKEN=${token}/" .env
  else
    echo "Không thể cập nhật .env an toàn trên nền tảng này." >&2
    exit 1
  fi
  chmod 600 .env
  echo "Đã tạo .env với token ngẫu nhiên. Không commit hoặc chia sẻ file này."
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a
if [[ -z "${CODE_EXECUTOR_TOKEN:-}" || "${CODE_EXECUTOR_TOKEN}" == "replace-with-a-random-secret-of-64-hex-characters" || ${#CODE_EXECUTOR_TOKEN} -lt 32 ]]; then
  echo "CODE_EXECUTOR_TOKEN không hợp lệ. Hãy tạo token ngẫu nhiên tối thiểu 32 ký tự." >&2
  exit 1
fi
if [[ -z "${EXECUTOR_HOST_WORK_ROOT:-}" || "${EXECUTOR_HOST_WORK_ROOT}" != /* || "${EXECUTOR_HOST_WORK_ROOT}" == "/" || "${EXECUTOR_HOST_WORK_ROOT}" == "/tmp"* || "${EXECUTOR_HOST_WORK_ROOT}" == "/var/www"* ]]; then
  echo "EXECUTOR_HOST_WORK_ROOT phải là thư mục tuyệt đối riêng, không phải /, /tmp hay web root." >&2
  exit 1
fi
sudo mkdir -p "${EXECUTOR_HOST_WORK_ROOT}"
sudo chmod 700 "${EXECUTOR_HOST_WORK_ROOT}"

docker compose config >/dev/null
docker compose up -d --build

ok=0
for _ in $(seq 1 20); do
  if curl --fail --silent --show-error http://127.0.0.1:8090/health >/tmp/hanhtrinhmoi-executor-health.json 2>/dev/null; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "${ok}" != "1" ]]; then
  echo "Executor chưa healthy. Xem log bằng: docker compose logs --tail=100 code-executor" >&2
  exit 1
fi
cat /tmp/hanhtrinhmoi-executor-health.json
printf '\nExecutor đang nghe ở loopback 127.0.0.1:8090, chưa công khai ra Internet.\n'
printf 'Trên ứng dụng web, cấu hình CODE_RUNNER_ENABLED=true, CODE_RUNNER_EXECUTOR=remote, CODE_EXECUTOR_URL=<URL riêng HTTPS tới executor>/execute và CODE_EXECUTOR_TOKEN=<cùng token trong file .env>.\n'
printf 'Vì web và executor nếu ở khác máy, phải nối bằng private VPN/network và TLS; tuyệt đối không đổi bind sang 0.0.0.0 để mở public port.\n'
printf 'Token được lưu trong %s/.env (quyền 600); không tự động gửi token lên dịch vụ web.\n' "$PWD"

#!/usr/bin/env bash
set -euo pipefail

BASE_IMAGE="e2m-tracker-base:runtime-test"
ADDON_IMAGE="e2m-tracker-ha:runtime-test"
CONTAINER_NAME="e2m-tracker-runtime-test"
HOST_PORT="${ADDON_TEST_PORT:-18126}"

cleanup() {
  docker rm --force "${CONTAINER_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_until_ready() {
  for _ in $(seq 1 45); do
    if docker exec "${CONTAINER_NAME}" node -e "fetch('http://127.0.0.1:3000/api/ready').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"; then
      return 0
    fi
    sleep 1
  done
  docker logs "${CONTAINER_NAME}" >&2 || true
  return 1
}

start_container() {
  cleanup
  docker run --detach \
    --name "${CONTAINER_NAME}" \
    --restart no \
    --publish "127.0.0.1:${HOST_PORT}:3000" \
    --tmpfs /data \
    "${ADDON_IMAGE}" >/dev/null
  wait_until_ready
}

expect_supervised_exit() {
  local process_name="$1"
  local kill_command="$2"

  docker exec "${CONTAINER_NAME}" sh -c "${kill_command}"

  for _ in $(seq 1 15); do
    if [[ "$(docker inspect --format '{{.State.Status}}' "${CONTAINER_NAME}")" == "exited" ]]; then
      local exit_code
      exit_code="$(docker inspect --format '{{.State.ExitCode}}' "${CONTAINER_NAME}")"
      if [[ "${exit_code}" == "0" ]]; then
        echo "${process_name} failure stopped the container with an unexpected zero exit code" >&2
        return 1
      fi
      return 0
    fi
    sleep 1
  done

  docker logs "${CONTAINER_NAME}" >&2 || true
  echo "Container stayed running after ${process_name} was terminated" >&2
  return 1
}

docker build --tag "${BASE_IMAGE}" --file Dockerfile .
docker build \
  --tag "${ADDON_IMAGE}" \
  --build-arg "BUILD_FROM=${BASE_IMAGE}" \
  --file ha-addon/fitness-habit-tracker/Dockerfile .

start_container
export SMOKE_BASE_URL="http://127.0.0.1:${HOST_PORT}"
if [[ -r /proc/sys/kernel/osrelease ]] && grep -qi microsoft /proc/sys/kernel/osrelease; then
  export WSLENV="${WSLENV:+${WSLENV}:}SMOKE_BASE_URL"
fi
npm run test:ingress
docker exec "${CONTAINER_NAME}" nginx -t
PLAYWRIGHT_BASE_URL="${SMOKE_BASE_URL}" npm run test:ui
expect_supervised_exit "Nginx" 'kill $(pidof nginx)'

start_container
expect_supervised_exit "Next.js" 'kill $(pidof node)'

echo "Add-on ingress and process-supervision tests passed"

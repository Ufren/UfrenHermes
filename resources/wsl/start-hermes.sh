#!/usr/bin/env bash
set -euo pipefail

BRAND_PREFIX="[Ufren Hermes Desktop]"
RUNTIME_DIR="${UFREN_RUNTIME_DIR:-$HOME/.local/share/ufren-hermes/runtime}"
LOG_FILE="$RUNTIME_DIR/logs/hermes-runtime.log"
PID_FILE="$RUNTIME_DIR/state/hermes-runtime.pid"
VENV_HERMES="$RUNTIME_DIR/.venv/bin/hermes"
AGENT_DIR="$RUNTIME_DIR/hermes-agent"
API_SERVER_ENABLED="${UFREN_API_SERVER_ENABLED:-true}"
API_SERVER_HOST="${UFREN_API_SERVER_HOST:-127.0.0.1}"
API_SERVER_PORT="${UFREN_API_SERVER_PORT:-8642}"
HEALTH_URL="http://${API_SERVER_HOST}:${API_SERVER_PORT}/health"
START_TIMEOUT_SECONDS="${UFREN_RUNTIME_START_TIMEOUT_SECONDS:-15}"

mkdir -p "$RUNTIME_DIR/logs" "$RUNTIME_DIR/state"

probe_health() {
  python3 - "$HEALTH_URL" <<'PY'
import sys
import urllib.request

url = sys.argv[1]
try:
    with urllib.request.urlopen(url, timeout=1.5) as response:
        sys.exit(0 if 200 <= response.status < 300 else 1)
except Exception:
    sys.exit(1)
PY
}

is_runtime_pid() {
  local pid="${1:-}"
  local cmdline=""

  [[ -n "$pid" ]] || return 1
  [[ -r "/proc/$pid/cmdline" ]] || return 1

  cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
  [[ "$cmdline" == *"$VENV_HERMES"* ]] && [[ "$cmdline" == *"gateway run"* ]]
}

find_runtime_pid() {
  local proc=""
  local pid=""

  for proc in /proc/[0-9]*; do
    pid="${proc#/proc/}"
    if is_runtime_pid "$pid"; then
      echo "$pid"
      return 0
    fi
  done

  return 1
}

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if is_runtime_pid "$EXISTING_PID"; then
    echo "already-running"
    exit 0
  fi

  # Remove stale state left behind by previous failed starts.
  rm -f "$PID_FILE"
fi

LIVE_PID="$(find_runtime_pid || true)"
if [[ -n "$LIVE_PID" ]]; then
  echo "$LIVE_PID" >"$PID_FILE"
  echo "already-running"
  exit 0
fi

if [[ ! -d "$AGENT_DIR" ]]; then
  echo "$BRAND_PREFIX missing-agent-dir: $AGENT_DIR" >&2
  exit 1
fi

if [[ ! -x "$VENV_HERMES" ]]; then
  echo "$BRAND_PREFIX missing-hermes-binary: $VENV_HERMES" >&2
  exit 1
fi

echo "$BRAND_PREFIX starting runtime with API server ${API_SERVER_HOST}:${API_SERVER_PORT}" >>"$LOG_FILE"
nohup env \
  API_SERVER_ENABLED="$API_SERVER_ENABLED" \
  API_SERVER_HOST="$API_SERVER_HOST" \
  API_SERVER_PORT="$API_SERVER_PORT" \
  bash -c "cd \"$AGENT_DIR\" && exec \"$VENV_HERMES\" gateway run" >>"$LOG_FILE" 2>&1 &
PID="$!"
echo "$PID" >"$PID_FILE"

DEADLINE=$((SECONDS + START_TIMEOUT_SECONDS))
while (( SECONDS < DEADLINE )); do
  LIVE_PID="$(find_runtime_pid || true)"
  if [[ -n "$LIVE_PID" ]]; then
    PID="$LIVE_PID"
    echo "$PID" >"$PID_FILE"
  fi

  if ! is_runtime_pid "$PID"; then
    rm -f "$PID_FILE"
    echo "$BRAND_PREFIX runtime-exited-before-ready" >&2
    tail -n 40 "$LOG_FILE" >&2 || true
    exit 1
  fi

  if probe_health; then
    echo "started"
    exit 0
  fi

  sleep 1
done

if is_runtime_pid "$PID"; then
  echo "starting"
  exit 0
fi

rm -f "$PID_FILE"
echo "$BRAND_PREFIX runtime-exited-before-healthcheck" >&2
tail -n 40 "$LOG_FILE" >&2 || true
exit 1

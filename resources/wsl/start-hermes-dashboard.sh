#!/usr/bin/env bash
set -euo pipefail

BRAND_PREFIX="[Ufren Hermes Desktop]"
RUNTIME_DIR="${UFREN_RUNTIME_DIR:-$HOME/.local/share/ufren-hermes/runtime}"
LOG_FILE="$RUNTIME_DIR/logs/hermes-dashboard.log"
PID_FILE="$RUNTIME_DIR/state/hermes-dashboard.pid"
VENV_HERMES="$RUNTIME_DIR/.venv/bin/hermes"
AGENT_DIR="$RUNTIME_DIR/hermes-agent"
DASHBOARD_HOST="${UFREN_DASHBOARD_HOST:-127.0.0.1}"
DASHBOARD_PORT="${UFREN_DASHBOARD_PORT:-9119}"
DASHBOARD_READY_URL="http://${DASHBOARD_HOST}:${DASHBOARD_PORT}/"
START_TIMEOUT_SECONDS="${UFREN_DASHBOARD_START_TIMEOUT_SECONDS:-20}"

mkdir -p "$RUNTIME_DIR/logs" "$RUNTIME_DIR/state"

probe_dashboard() {
  python3 - "$DASHBOARD_READY_URL" <<'PY'
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

is_dashboard_pid() {
  local pid="${1:-}"
  local cmdline=""

  [[ -n "$pid" ]] || return 1
  [[ -r "/proc/$pid/cmdline" ]] || return 1

  cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
  [[ "$cmdline" == *"$VENV_HERMES"* ]] && [[ "$cmdline" == *"dashboard"* ]]
}

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if is_dashboard_pid "$EXISTING_PID"; then
    echo "already-running"
    exit 0
  fi

  rm -f "$PID_FILE"
fi

if [[ ! -d "$AGENT_DIR" ]]; then
  echo "$BRAND_PREFIX missing-agent-dir: $AGENT_DIR" >&2
  exit 1
fi

if [[ ! -x "$VENV_HERMES" ]]; then
  echo "$BRAND_PREFIX missing-hermes-binary: $VENV_HERMES" >&2
  exit 1
fi

echo "$BRAND_PREFIX starting dashboard at ${DASHBOARD_HOST}:${DASHBOARD_PORT}" >>"$LOG_FILE"
nohup bash -c "cd \"$AGENT_DIR\" && exec \"$VENV_HERMES\" dashboard --host \"$DASHBOARD_HOST\" --port \"$DASHBOARD_PORT\" --no-open" >>"$LOG_FILE" 2>&1 &
PID="$!"
echo "$PID" >"$PID_FILE"

DEADLINE=$((SECONDS + START_TIMEOUT_SECONDS))
while (( SECONDS < DEADLINE )); do
  if ! is_dashboard_pid "$PID"; then
    rm -f "$PID_FILE"
    echo "$BRAND_PREFIX dashboard-exited-before-ready" >&2
    tail -n 40 "$LOG_FILE" >&2 || true
    exit 1
  fi

  if probe_dashboard; then
    echo "started"
    exit 0
  fi

  sleep 1
done

if is_dashboard_pid "$PID"; then
  echo "starting"
  exit 0
fi

rm -f "$PID_FILE"
echo "$BRAND_PREFIX dashboard-exited-before-healthcheck" >&2
tail -n 40 "$LOG_FILE" >&2 || true
exit 1

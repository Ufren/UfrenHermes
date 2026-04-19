#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="${UFREN_RUNTIME_DIR:-$HOME/.local/share/ufren-hermes/runtime}"
PID_FILE="$RUNTIME_DIR/state/hermes-runtime.pid"
VENV_HERMES="$RUNTIME_DIR/.venv/bin/hermes"
API_SERVER_HOST="${UFREN_API_SERVER_HOST:-127.0.0.1}"
API_SERVER_PORT="${UFREN_API_SERVER_PORT:-8642}"
HEALTH_URL="http://${API_SERVER_HOST}:${API_SERVER_PORT}/health"

probe_health() {
  python3 - "$HEALTH_URL" <<'PY'
import sys
import urllib.request

url = sys.argv[1]
try:
    with urllib.request.urlopen(url, timeout=1.0) as response:
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

if [[ ! -f "$PID_FILE" ]]; then
  LIVE_PID="$(find_runtime_pid || true)"
  if [[ -n "$LIVE_PID" ]]; then
    echo "$LIVE_PID" >"$PID_FILE"
    if probe_health; then
      echo "running"
    else
      echo "starting"
    fi
  else
    echo "stopped"
  fi
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [[ -z "$PID" ]]; then
  rm -f "$PID_FILE"
  echo "stopped"
  exit 0
fi

if is_runtime_pid "$PID"; then
  if probe_health; then
    echo "running"
  else
    echo "starting"
  fi
else
  LIVE_PID="$(find_runtime_pid || true)"
  if [[ -n "$LIVE_PID" ]]; then
    echo "$LIVE_PID" >"$PID_FILE"
    if probe_health; then
      echo "running"
    else
      echo "starting"
    fi
  else
    rm -f "$PID_FILE"
    echo "degraded"
  fi
fi

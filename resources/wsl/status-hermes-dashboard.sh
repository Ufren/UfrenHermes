#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="${UFREN_RUNTIME_DIR:-$HOME/.local/share/ufren-hermes/runtime}"
PID_FILE="$RUNTIME_DIR/state/hermes-dashboard.pid"
DASHBOARD_HOST="${UFREN_DASHBOARD_HOST:-127.0.0.1}"
DASHBOARD_PORT="${UFREN_DASHBOARD_PORT:-9119}"
DASHBOARD_READY_URL="http://${DASHBOARD_HOST}:${DASHBOARD_PORT}/"

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
  [[ "$cmdline" == *"dashboard"* ]]
}

if [[ ! -f "$PID_FILE" ]]; then
  echo "stopped"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if is_dashboard_pid "$PID"; then
  if probe_dashboard; then
    echo "running"
  else
    echo "starting"
  fi
else
  rm -f "$PID_FILE"
  echo "degraded"
fi

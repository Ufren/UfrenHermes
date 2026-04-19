#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="${UFREN_RUNTIME_DIR:-$HOME/.local/share/ufren-hermes/runtime}"
PID_FILE="$RUNTIME_DIR/state/hermes-dashboard.pid"

is_dashboard_pid() {
  local pid="${1:-}"
  local cmdline=""

  [[ -n "$pid" ]] || return 1
  [[ -r "/proc/$pid/cmdline" ]] || return 1

  cmdline="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true)"
  [[ "$cmdline" == *"dashboard"* ]]
}

if [[ ! -f "$PID_FILE" ]]; then
  echo "not-running"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if is_dashboard_pid "$PID"; then
  kill "$PID"
fi

rm -f "$PID_FILE"
echo "stopped"

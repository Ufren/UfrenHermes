#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="${UFREN_RUNTIME_DIR:-$HOME/.local/share/ufren-hermes/runtime}"
PID_FILE="$RUNTIME_DIR/state/hermes-runtime.pid"
VENV_HERMES="$RUNTIME_DIR/.venv/bin/hermes"

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
  PID="$(find_runtime_pid || true)"
  if [[ -z "$PID" ]]; then
    echo "not-running"
    exit 0
  fi
else
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -z "$PID" ]] || ! is_runtime_pid "$PID"; then
    PID="$(find_runtime_pid || true)"
  fi
fi

if is_runtime_pid "$PID"; then
  kill "$PID"

  for _ in $(seq 1 20); do
    if ! is_runtime_pid "$PID"; then
      break
    fi
    sleep 0.5
  done

  if is_runtime_pid "$PID"; then
    echo "failed-to-stop"
    exit 1
  fi
fi

rm -f "$PID_FILE"
echo "stopped"

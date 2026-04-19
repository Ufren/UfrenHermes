#!/usr/bin/env bash
set -euo pipefail

LINES="${1:-200}"
RUNTIME_DIR="${UFREN_RUNTIME_DIR:-$HOME/.local/share/ufren-hermes/runtime}"
LOG_FILE="$RUNTIME_DIR/logs/hermes-runtime.log"

if [[ ! -f "$LOG_FILE" ]]; then
  echo ""
  exit 0
fi

tail -n "$LINES" "$LOG_FILE"

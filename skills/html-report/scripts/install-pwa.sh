#!/usr/bin/env bash
# Fast launcher for /html-install PWA Packaging & Installer
# Auto-detects Node.js vs No-Node environments with instant browser launch.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

TARGET="${1:-$REPO_ROOT/create.html}"
PORT="${PORT:-${HTML_REPORT_PORT:-3030}}"

if command -v node >/dev/null 2>&1; then
  exec node "$SCRIPT_DIR/install-pwa.mjs" "$TARGET" --port "$PORT" "$@"
else
  # Fallback for environments without Node.js: open target HTML directly
  echo "Node.js not detected. Opening target in local browser directly..."
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$TARGET" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$TARGET" >/dev/null 2>&1 &
  elif command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "Start-Process '$TARGET'" >/dev/null 2>&1 &
  elif command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c start "$TARGET" >/dev/null 2>&1 &
  fi
fi

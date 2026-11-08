#!/usr/bin/env bash
# Fast launcher for html-create Interactive Studio
# Auto-detects Node.js vs No-Node environments with instant browser launch.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Resolve create.html path
if [ -f "$REPO_ROOT/create.html" ]; then
  CREATE_HTML="$REPO_ROOT/create.html"
elif [ -f "$REPO_ROOT/skills/html-report/assets/create.html" ]; then
  CREATE_HTML="$REPO_ROOT/skills/html-report/assets/create.html"
else
  CREATE_HTML="$SCRIPT_DIR/../assets/create.html"
fi

open_browser() {
  local target="$1"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$target" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$target" >/dev/null 2>&1 &
  elif command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "Start-Process '$target'" >/dev/null 2>&1 &
  elif command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c start "$target" >/dev/null 2>&1 &
  elif command -v python3 >/dev/null 2>&1; then
    python3 -m webbrowser "$target" >/dev/null 2>&1 &
  else
    echo "Please open in browser: $target"
  fi
}

# Check if Node.js is installed
if command -v node >/dev/null 2>&1; then
  # Node.js environment: Check if live dev server is already running on port 3000
  PORT="${PORT:-3000}"
  SERVER_URL="http://localhost:$PORT/create.html"

  if curl -s -f -m 1 "http://localhost:$PORT/" >/dev/null 2>&1; then
    echo "✓ Dev server detected on http://localhost:$PORT/"
    open_browser "$SERVER_URL"
  else
    echo "Starting lightweight dev server on port $PORT..."
    HTML_REPORT_NO_OPEN=1 node "$REPO_ROOT/skills/html-report/scripts/serve-report.mjs" "$CREATE_HTML" --port "$PORT" >/dev/null 2>&1 &
    # Allow quick 250ms spin-up then open browser
    sleep 0.25
    open_browser "$SERVER_URL"
  fi
  echo "🚀 html-create studio launched at $SERVER_URL"
else
  # No-Node environment: Fallback directly to file:// protocol
  FILE_URL="file://$CREATE_HTML"
  echo "Node.js not detected on this machine. Falling back to static browser launch..."
  open_browser "$FILE_URL"
  echo "🚀 html-create studio opened via file URL: $FILE_URL"
fi

#!/usr/bin/env bash
# Capture PNG screenshots for every scene into ../../docs/assets/.
# Requires: agent-browser CLI (https://www.npmjs.com/package/agent-browser).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../../docs/assets"
PORT=5175

mkdir -p "$OUT_DIR"

# Scenes to capture. Keep this list in sync with src/main.ts.
SCENES=(hero hero-candle auto-detection)

# Filter if an explicit list was passed: ./capture.sh hero auto-detection
if [[ $# -gt 0 ]]; then
  SCENES=("$@")
fi

# Kill any stale server still holding the port from a previous aborted run.
if lsof -ti:$PORT > /dev/null 2>&1; then
  echo "▶ releasing stale port $PORT"
  lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo "▶ starting vite dev server on port $PORT"
pnpm dev --port $PORT > /tmp/docs-screenshots-vite.log 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT

# Wait for the dev server.
for _ in {1..60}; do
  if curl -sf "http://localhost:$PORT" > /dev/null; then
    break
  fi
  sleep 0.25
done

# Lay the chart out at a README-like width and capture at deviceScaleFactor 2,
# so the PNG stays crisp on Retina displays while labels keep a readable size
# when GitHub scales the image down to its content column (about 1000px or
# narrower). Enlarging the viewport instead lays the chart out at full width
# and shrinks the text to a few pixels.
VIEWPORT_W=1200
VIEWPORT_H=675
VIEWPORT_SCALE=2

echo "▶ setting viewport ${VIEWPORT_W}x${VIEWPORT_H} @${VIEWPORT_SCALE}x"
agent-browser set viewport "$VIEWPORT_W" "$VIEWPORT_H" "$VIEWPORT_SCALE" > /dev/null

echo "▶ capturing ${#SCENES[@]} scene(s)"
for scene in "${SCENES[@]}"; do
  echo -n "  $scene … "
  agent-browser open "http://localhost:$PORT?scene=$scene" > /dev/null

  # Re-apply viewport after navigation (some browsers reset on navigation).
  agent-browser set viewport "$VIEWPORT_W" "$VIEWPORT_H" "$VIEWPORT_SCALE" > /dev/null

  # Wait for scene readiness flag (set at the end of src/main.ts).
  for _ in {1..40}; do
    ready=$(agent-browser eval 'window.__chartReady === true ? "y" : "n"' 2>/dev/null || echo "n")
    if [[ "$ready" == *"y"* ]]; then
      break
    fi
    sleep 0.25
  done

  agent-browser screenshot "$OUT_DIR/$scene.png" > /dev/null
  echo "→ $OUT_DIR/$scene.png"
done

echo "✓ done"

#!/usr/bin/env bash
# Runs the browser tests against the running app (APP_PORT, default 3001) using the system Chromium.
# Playwright lives in .browser-tests/ (git-ignored), so the app stays dependency-free.
set -euo pipefail
cd "$(dirname "$0")/.."

PW_DIR=".browser-tests"
PW_ENTRY="$PWD/$PW_DIR/node_modules/playwright/index.mjs"
if [ ! -f "$PW_ENTRY" ]; then
  npm install --prefix "$PW_DIR" --ignore-scripts --no-audit --no-fund playwright
fi

export PLAYWRIGHT_MODULE="file://$PW_ENTRY"
for t in test-placement-browser.mjs test-timeline-browser.mjs; do
  echo "== $t"
  node "$t"
done
echo "browser tests: ok"

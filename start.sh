#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -f /usr/local/lib/workshop-devguard.sh ]; then
  source /usr/local/lib/workshop-devguard.sh
  devguard_acquire "${APP_PORT:-3001}"
fi

PORT="${APP_PORT:-3001}" node server.mjs

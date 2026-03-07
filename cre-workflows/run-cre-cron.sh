#!/usr/bin/env bash
# Run a cron-triggered CRE workflow simulation and forward output to the API for live terminal display.
#
# Usage:
#   ./run-cre-cron.sh <workflow-folder> <log-key>
#
# Examples:
#   ./run-cre-cron.sh create-auction-workflow create-auction

set -euo pipefail

API_URL="${API_URL:-https://sealbid.onrender.com}"
WORKFLOW_DIR="${1:?Usage: ./run-cre-cron.sh <workflow-folder> <log-key>}"
LOG_KEY="${2:?Usage: ./run-cre-cron.sh <workflow-folder> <log-key>}"
shift 2

# Post a single line to the API
post_line() {
  local line="$1"
  curl -s -X POST "$API_URL/workflow-logs" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg rh "$LOG_KEY" --arg l "$line" '{requestHash: $rh, line: $l}')" \
    > /dev/null 2>&1 || true
}

# Signal start
post_line "▶ CRE cron simulation started: $WORKFLOW_DIR"
post_line "  log-key: $LOG_KEY"
post_line "---"

# Run the CRE simulation (cron-triggered — no evm-tx-hash needed)
cre workflow simulate "$WORKFLOW_DIR" \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --broadcast \
  --verbose \
  "$@" 2>&1 | while IFS= read -r line; do
    echo "$line"
    clean=$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g')
    post_line "$clean"
done

EXIT_CODE=${PIPESTATUS[0]}

if [ "$EXIT_CODE" -eq 0 ]; then
  post_line "---"
  post_line "✓ CRE simulation completed successfully"
else
  post_line "---"
  post_line "✗ CRE simulation failed (exit code: $EXIT_CODE)"
fi

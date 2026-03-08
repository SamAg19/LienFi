#!/usr/bin/env bash
# Run the settlement CRE workflow (cron-triggered) and forward output to the API for live terminal display.
#
# Usage:
#   ./run-cre-settlement.sh [log-key]

set -euo pipefail

API_URL="${API_URL:-https://sealbid.onrender.com}"
LOG_KEY="${1:-settlement}"

# Post a single line to the API
post_line() {
  local line="$1"
  curl -s -X POST "$API_URL/workflow-logs" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg rh "$LOG_KEY" --arg l "$line" '{requestHash: $rh, line: $l}')" \
    > /dev/null 2>&1 || true
}

# Signal start
post_line "▶ CRE settlement workflow started"
post_line "  Reads on-chain bid hashes → Vickrey settlement → DON-signed report"
post_line "---"

# Capture CRE output so we can extract the forwarder broadcast tx hash after
TMPOUT=$(mktemp /tmp/cre-output-XXXXXX.txt)
trap 'rm -f "$TMPOUT"' EXIT

# Run the CRE simulation (cron-triggered)
cre workflow simulate ./settlement-workflow \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --broadcast \
  --verbose \
  2>&1 | tee "$TMPOUT" | while IFS= read -r line; do
    echo "$line"
    clean=$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g')
    post_line "$clean"
done

EXIT_CODE=${PIPESTATUS[0]}

if [ "$EXIT_CODE" -eq 0 ]; then
  # Extract forwarder broadcast tx hash — the last 0x{64} hash in CRE output
  REPORT_TX=$(sed 's/\x1b\[[0-9;]*m//g' "$TMPOUT" | grep -oE '0x[a-fA-F0-9]{64}' | tail -1)
  if [ -n "$REPORT_TX" ]; then
    post_line "REPORT_TX:$REPORT_TX"
  fi
  post_line "---"
  post_line "✓ Settlement workflow completed successfully"
else
  post_line "---"
  post_line "✗ Settlement workflow failed (exit code: $EXIT_CODE)"
fi

#!/usr/bin/env bash
# Run CRE workflow simulation and forward output to the API for live terminal display.
#
# Usage:
#   ./run-cre.sh <workflow-folder> <evm-tx-hash> <request-hash>
#
# Examples:
#   ./run-cre.sh credit-assessment-workflow 0xabc...txhash 0x7123...requesthash

set -euo pipefail

API_URL="${API_URL:-https://sealbid.onrender.com}"
WORKFLOW_DIR="${1:?Usage: ./run-cre.sh <workflow-folder> <evm-tx-hash> <request-hash>}"
EVM_TX_HASH="${2:?Usage: ./run-cre.sh <workflow-folder> <evm-tx-hash> <request-hash>}"
REQUEST_HASH="${3:?Usage: ./run-cre.sh <workflow-folder> <evm-tx-hash> <request-hash>}"
shift 3

# Post a single line to the API
post_line() {
  local line="$1"
  curl -s -X POST "$API_URL/workflow-logs" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg rh "$REQUEST_HASH" --arg l "$line" '{requestHash: $rh, line: $l}')" \
    > /dev/null 2>&1 || true
}

# Signal start
post_line "▶ CRE simulation started: $WORKFLOW_DIR"
post_line "  evm-tx-hash: $EVM_TX_HASH"
post_line "  requestHash: $REQUEST_HASH"
post_line "---"

# Capture CRE output so we can extract the forwarder broadcast tx hash after
TMPOUT=$(mktemp /tmp/cre-output-XXXXXX.txt)
trap 'rm -f "$TMPOUT"' EXIT

# Run the CRE simulation and tee output to both terminal and API
cre workflow simulate "$WORKFLOW_DIR" \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --broadcast \
  --verbose \
  --evm-tx-hash "$EVM_TX_HASH" \
  --evm-event-index 0 \
  "$@" 2>&1 | tee "$TMPOUT" | while IFS= read -r line; do
    # Print to local terminal as usual
    echo "$line"
    # Strip ANSI escape codes and forward to API
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
  post_line "✓ CRE simulation completed successfully"
else
  post_line "---"
  post_line "✗ CRE simulation failed (exit code: $EXIT_CODE)"
fi

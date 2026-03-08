#!/usr/bin/env bash
# Auto-fetch pending bids from the API and run CRE bid workflow for each.
# Loops until no more pending bids (API returns 204).
#
# Usage:
#   ./run-cre-bid.sh [log-key]
#
# Requires:
#   BID_API_KEY — API key for authenticated endpoints

set -euo pipefail

API_URL="${API_URL:-https://sealbid.onrender.com}"
BID_API_KEY="${BID_API_KEY:?Set BID_API_KEY env var}"
LOG_KEY="${1:-bid}"
TMPFILE=$(mktemp /tmp/bid-payload-XXXXXX.json)
trap 'rm -f "$TMPFILE"' EXIT

# Post a single line to the API for live terminal display
post_line() {
  local line="$1"
  curl -s -X POST "$API_URL/workflow-logs" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg rh "$LOG_KEY" --arg l "$line" '{requestHash: $rh, line: $l}')" \
    > /dev/null 2>&1 || true
}

BID_NUM=0

while true; do
  # Fetch next pending bid from API
  HTTP_CODE=$(curl -s -o "$TMPFILE" -w "%{http_code}" \
    -H "X-Api-Key: $BID_API_KEY" \
    "$API_URL/pending-bid")

  if [ "$HTTP_CODE" = "204" ]; then
    if [ "$BID_NUM" -eq 0 ]; then
      echo "No pending bids found."
      post_line "No pending bids to process"
    else
      echo "All $BID_NUM pending bid(s) processed."
      post_line "All $BID_NUM pending bid(s) processed"
    fi
    break
  fi

  if [ "$HTTP_CODE" != "200" ]; then
    echo "Error fetching pending bid (HTTP $HTTP_CODE)"
    post_line "Error fetching pending bid (HTTP $HTTP_CODE)"
    exit 1
  fi

  BID_NUM=$((BID_NUM + 1))
  BIDDER=$(jq -r '.bidder // "unknown"' "$TMPFILE")
  AUCTION=$(jq -r '.auctionId // "unknown"' "$TMPFILE" | cut -c1-14)

  echo ""
  echo "=== Bid #$BID_NUM: bidder=${BIDDER:0:14}... auction=${AUCTION}... ==="
  post_line "---"
  post_line "▶ Processing bid #$BID_NUM (bidder=${BIDDER:0:14}... auction=${AUCTION}...)"

  # Capture CRE output so we can extract the forwarder broadcast tx hash after
  TMPOUT=$(mktemp /tmp/cre-output-XXXXXX.txt)

  # Run CRE bid workflow simulation with the fetched payload
  cre workflow simulate ./bid-workflow \
    --target staging-settings \
    --non-interactive \
    --trigger-index 0 \
    --http-payload "@$TMPFILE" \
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
    REPORT_TX=$(sed 's/\x1b\[[0-9;]*m//g' "$TMPOUT" | grep -oE '0x[a-fA-F0-9]{64}' | tail -1 2>/dev/null || true)
    if [ -n "$REPORT_TX" ]; then
      post_line "REPORT_TX:$REPORT_TX"
    fi
    post_line "✓ Bid #$BID_NUM registered on-chain"
  else
    post_line "✗ Bid #$BID_NUM failed (exit code: $EXIT_CODE)"
    echo "Bid #$BID_NUM failed (exit code: $EXIT_CODE), stopping."
    rm -f "$TMPOUT" 2>/dev/null || true
    exit "$EXIT_CODE"
  fi
  rm -f "$TMPOUT" 2>/dev/null || true
done

post_line "---"
post_line "✓ CRE bid workflow complete ($BID_NUM bid(s) processed)"

# Testing the Bid and Settlement CRE Workflows

This guide walks through testing the sealed-bid auction system: the **bid workflow** (HTTP-triggered, registers bids) and the **settlement workflow** (cron-triggered, runs Vickrey second-price settlement).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [Environment Setup](#3-environment-setup)
4. [Pre-requisites: Active Auction On-Chain](#4-pre-requisites-active-auction-on-chain)
5. [Set Up Bidder(s)](#5-set-up-bidders)
6. [Generate Signed Bid Payloads](#6-generate-signed-bid-payloads)
7. [Run the Bid Workflow Simulation](#7-run-the-bid-workflow-simulation)
8. [Run the Settlement Workflow Simulation](#8-run-the-settlement-workflow-simulation)
9. [Expected Output](#9-expected-output)
10. [Verify On-Chain State](#10-verify-on-chain-state)
11. [Workflow Pipeline Steps Explained](#11-workflow-pipeline-steps-explained)
12. [Bugs Found and Fixed](#12-bugs-found-and-fixed)
13. [Common Errors and Troubleshooting](#13-common-errors-and-troubleshooting)

---

## 1. Prerequisites

| Tool | Purpose |
|------|---------|
| **CRE CLI** (`cre`) | Chainlink Runtime Environment CLI for simulating workflows |
| **Foundry** (`cast`) | On-chain calls (pool deposits, balance checks) |
| **Node.js / npx tsx** | Run `generate-bid-payload.ts` to create signed bids |
| **Active auction** | Must have completed the create-auction workflow first |

```bash
cre auth login
```

---

## 2. Architecture Overview

### Bid Flow
```
[Bidder generates EIP-712 signed bid]
        |
        v
[CRE Bid Workflow (HTTP trigger)]
        |
        v
[1. Forward to API via Confidential HTTP]
    API validates:
    ├── EIP-712 signature ✓
    ├── Auction exists & not expired ✓
    ├── Bid >= reserve price ✓
    ├── Pool balance >= bid amount ✓
    ├── Lock expiry >= auction deadline ✓
    └── No duplicate bid ✓
        |
        v
[2. API stores bid in MongoDB, returns bidHash]
        |
        v
[3. Encode report: abi.encode(auctionId, bidHash)]
        |
        v
[4. DON-sign and write to LienFiAuction._registerBid()]
    On-chain: bidHashes[auctionId].push(bidHash)
```

### Settlement Flow
```
[CRE Settlement Workflow (Cron trigger)]
        |
        v
[1. Read activeAuctionId from LienFiAuction]
        |
        v
[2. Call API: POST /settle { auctionId }]
    API runs Vickrey settlement:
    ├── Fetch all bids from MongoDB
    ├── Sort by amount descending
    ├── Winner = highest bidder
    ├── Price = second-highest bid (or reserve if 1 bid)
    └── HMAC proof for integrity
        |
        v
[3. Encode report: abi.encode(auctionId, winner, price)]
        |
        v
[4. DON-sign and write to LienFiAuction._settleAuction()]
    On-chain:
    ├── Verify deadline has passed
    ├── Debit winner's USDC pool
    ├── Transfer USDC to seller
    ├── Transfer PropertyNFT to winner
    └── Notify LoanManager (if default auction)
```

---

## 3. Environment Setup

### 3.1 CRE Workflow `.env`

File: `cre-workflows/.env` (shared by all workflows)

```env
CRE_ETH_PRIVATE_KEY=0x<your_private_key>
CRE_TARGET=staging-settings
MY_API_KEY_ALL=<sealbid_api_key>
AES_KEY_ALL=0000000000000000000000000000000000000000000000000000000000000001
```

### 3.2 Bid Workflow Config

File: `cre-workflows/bid-workflow/config.staging.json`

```json
{
  "url": "https://sealbid.onrender.com",
  "owner": "<YOUR_WALLET_ADDRESS>",
  "evms": [
    {
      "chainSelectorName": "ethereum-testnet-sepolia",
      "contractAddress": "<LIENFI_AUCTION_ADDRESS>",
      "gasLimit": "500000"
    }
  ]
}
```

### 3.3 Settlement Workflow Config

File: `cre-workflows/settlement-workflow/config.staging.json`

```json
{
  "schedule": "*/30 * * * * *",
  "url": "https://sealbid.onrender.com",
  "owner": "<YOUR_WALLET_ADDRESS>",
  "evms": [
    {
      "chainSelectorName": "ethereum-testnet-sepolia",
      "contractAddress": "<LIENFI_AUCTION_ADDRESS>",
      "gasLimit": "500000"
    }
  ]
}
```

### 3.4 API Environment Variables

The deployed API needs these env vars for bid validation:

```env
VERIFYING_CONTRACT=<LIENFI_AUCTION_ADDRESS>   # EIP-712 domain + on-chain reads
USDC_ADDRESS=<MOCK_USDC_ADDRESS>               # Pool balance checks
RPC_URL=<SEPOLIA_RPC_URL>                      # On-chain reads
HMAC_KEY=<any_secret_string>                   # Settlement HMAC proof
```

### 3.5 Workflow Names

| Workflow | `workflow-name` | Contract Constant |
|----------|----------------|-------------------|
| Bid | `"bid"` | `WORKFLOW_BID = SHA256("bid")` |
| Settlement | `"settle"` | `WORKFLOW_SETTLE = SHA256("settle")` |

Both are dispatched by `LienFiAuction._processReport()`.

---

## 4. Pre-requisites: Active Auction On-Chain

You need an active auction before bidding. Follow these guides in order:

1. [TESTING-CREDIT-WORKFLOW.md](./TESTING-CREDIT-WORKFLOW.md) — Get a loan approved
2. [TESTING-CREATE-AUCTION-WORKFLOW.md](./TESTING-CREATE-AUCTION-WORKFLOW.md) — Claim loan, trigger default, create auction

Verify an auction exists:

```bash
cast call $LIENFI_AUCTION_ADDRESS "activeAuctionId()" --rpc-url $SEPOLIA_RPC_URL
```

Should return a non-zero bytes32 value. Save this as `AUCTION_ID`.

Also check the auction details:

```bash
cast call $LIENFI_AUCTION_ADDRESS \
  "auctions(bytes32)(address,uint256,uint256,uint256,bool,address,uint256,bytes32)" \
  $AUCTION_ID --rpc-url $SEPOLIA_RPC_URL
```

Note the `reservePrice` (4th field) and `deadline` (3rd field).

---

## 5. Set Up Bidder(s)

Each bidder needs:
1. USDC in their wallet
2. USDC deposited to the LienFiAuction pool
3. Lock expiry extending past the auction deadline

### 5.1 Mint USDC to Bidder

```bash
cast send $MOCK_USDC_ADDRESS \
  "mint(address,uint256)" $BIDDER_ADDRESS 200000000 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $BIDDER_PRIVATE_KEY
```

### 5.2 Approve LienFiAuction

```bash
cast send $MOCK_USDC_ADDRESS \
  "approve(address,uint256)" $LIENFI_AUCTION_ADDRESS 200000000 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $BIDDER_PRIVATE_KEY
```

### 5.3 Deposit to Pool

The `depositToPool` function requires a World ID proof. On testnet with `MockWorldIDRouter`, any values work:

```bash
LOCK_UNTIL=$((AUCTION_DEADLINE + 86400))  # deadline + 1 day

cast send $LIENFI_AUCTION_ADDRESS \
  "depositToPool(address,uint256,uint256,uint256,uint256,uint256[8])" \
  $MOCK_USDC_ADDRESS \
  $LOCK_UNTIL \
  200000000 \
  1 \
  1 \
  "[0,0,0,0,0,0,0,0]" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $BIDDER_PRIVATE_KEY
```

**Parameters:**
- `token`: USDC address
- `lockUntil`: Must be > auction deadline
- `amount`: USDC amount (6 decimals)
- `root`: World ID root (any value with MockWorldID)
- `nullifierHash`: Must be unique per deposit (any value with MockWorldID)
- `proof`: 8-element array (any values with MockWorldID)

> **Note:** Each `nullifierHash` can only be used once. For a second bidder, use a different nullifierHash (e.g., `2`).

### 5.4 Verify Pool State

```bash
# Check pool balance
cast call $LIENFI_AUCTION_ADDRESS \
  "poolBalance(address,address)(uint256)" \
  $BIDDER_ADDRESS $MOCK_USDC_ADDRESS \
  --rpc-url $SEPOLIA_RPC_URL

# Check lock expiry
cast call $LIENFI_AUCTION_ADDRESS \
  "lockExpiry(address)(uint256)" \
  $BIDDER_ADDRESS \
  --rpc-url $SEPOLIA_RPC_URL
```

---

## 6. Generate Signed Bid Payloads

Edit `cre-workflows/generate-bid-payload.ts`:

```typescript
const PRIVATE_KEY = "<BIDDER_PRIVATE_KEY>";
const VERIFYING_CONTRACT = "<LIENFI_AUCTION_ADDRESS>";
const CHAIN_ID = 11155111;
const AUCTION_ID = "<AUCTION_ID_FROM_STEP_4>";
const BID_AMOUNT = "150000000";  // 150 USDC (must be >= reserve price)
const NONCE = 1;                 // unique per bidder per auction
```

Run:

```bash
cd cre-workflows
npx tsx generate-bid-payload.ts
```

Output: `bid-payload.json`

```json
{
  "auctionId": "0x...",
  "bidder": "0x...",
  "amount": "150000000",
  "nonce": 1,
  "signature": "0x...",
  "auctionDeadline": 1773239940
}
```

**For multiple bidders:** Generate a separate payload for each bidder with different private keys, amounts, and nonces.

---

## 7. Run the Bid Workflow Simulation

Wake the server first (Render free tier cold starts):

```bash
curl -s "https://sealbid.onrender.com/health"
```

Then simulate:

```bash
cd cre-workflows

cre workflow simulate ./bid-workflow \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --http-payload @/absolute/path/to/bid-payload.json \
  --broadcast \
  --verbose
```

**Important:** The `--http-payload` flag with `@` prefix reads from a file. Use an **absolute path**.

---

## 8. Run the Settlement Workflow Simulation

> **Note:** Settlement will only fully succeed on-chain after the auction deadline has passed. Before the deadline, the workflow executes correctly but the on-chain `_settleAuction` call reverts with `AuctionNotExpired` (caught silently by the KeystoneForwarder).

```bash
cd cre-workflows

cre workflow simulate ./settlement-workflow \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --broadcast \
  --verbose
```

---

## 9. Expected Output

### Bid Workflow (Successful)

```
[WORKFLOW] WorkflowExecutionStarted
  WorkflowName: bid
[USER LOG] Bid accepted: 0x<bidHash>
[USER LOG] registerBid submitted: 0x<txHash>
[WORKFLOW] WorkflowExecutionFinished - Status: SUCCESS
```

### Settlement Workflow (Before Deadline)

```
[WORKFLOW] WorkflowExecutionStarted
  WorkflowName: settle
[USER LOG] Active auction detected: 0x<auctionId>
[USER LOG] Settlement result: auctionId=0x... winner=0x... price=100000000
[USER LOG] settleAuction submitted: 0x<txHash>
[WORKFLOW] WorkflowExecutionFinished - Status: SUCCESS
```

The workflow reports SUCCESS, but the on-chain settlement is rejected (AuctionNotExpired). Check the tx receipt — the KeystoneForwarder log data will show `0x00...00` (result=false).

### Settlement Workflow (After Deadline — Full Success)

Same output, but the on-chain settlement actually executes:
- `auction.settled = true`
- `activeAuctionId = bytes32(0)`
- Winner's pool debited
- USDC transferred to seller (LoanManager)
- PropertyNFT transferred to winner
- `LoanManager.onAuctionSettled()` called

---

## 10. Verify On-Chain State

### After Bid

```bash
# Bid count should increment
cast call $LIENFI_AUCTION_ADDRESS \
  "getBidCount(bytes32)(uint256)" $AUCTION_ID \
  --rpc-url $SEPOLIA_RPC_URL
```

### After Settlement (post-deadline)

```bash
# Active auction should be zero
cast call $LIENFI_AUCTION_ADDRESS "activeAuctionId()" --rpc-url $SEPOLIA_RPC_URL

# Auction should show settled=true, winner, settledPrice
cast call $LIENFI_AUCTION_ADDRESS \
  "auctions(bytes32)(address,uint256,uint256,uint256,bool,address,uint256,bytes32)" \
  $AUCTION_ID --rpc-url $SEPOLIA_RPC_URL

# PropertyNFT should be owned by winner
cast call $PROPERTY_NFT_ADDRESS \
  "ownerOf(uint256)(address)" 1 \
  --rpc-url $SEPOLIA_RPC_URL

# Loan should be CLOSED (status=2) after LoanManager.onAuctionSettled
cast call $LOAN_MANAGER_ADDRESS \
  "getLoan(uint256)(uint256,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint8)" 1 \
  --rpc-url $SEPOLIA_RPC_URL
```

---

## 11. Workflow Pipeline Steps Explained

### Bid Workflow

| Step | What | Details |
|------|------|---------|
| **Trigger** | HTTP request | Receives signed bid payload as JSON |
| **1** | Forward to API | Confidential HTTP POST to `/bid` |
| **2** | API validation | EIP-712 sig, on-chain eligibility, duplicate check |
| **3** | Encode report | `abi.encode(bytes32 auctionId, bytes32 bidHash)` |
| **4** | DON sign + write | → KeystoneForwarder → `_registerBid()` |

### Settlement Workflow

| Step | What | Details |
|------|------|---------|
| **Trigger** | Cron (every 30s) | Periodic check |
| **1** | Read auction | `activeAuctionId()` from LienFiAuction |
| **2** | Call API | POST `/settle` — Vickrey second-price calculation |
| **3** | Encode report | `abi.encode(bytes32 auctionId, address winner, uint256 price)` |
| **4** | DON sign + write | → KeystoneForwarder → `_settleAuction()` |

### Vickrey Settlement Rules

- **Highest bidder wins**
- **Winner pays second-highest bid** (privacy-preserving: only winner/price revealed)
- **Single bid**: winner pays reserve price
- **HMAC proof**: `HMAC-SHA256(key, "winner:price")` for integrity

---

## 12. Bugs Found and Fixed

### Bug 1: Stale Contract Addresses in Configs

**Problem**: `bid-workflow/config.staging.json` and `settlement-workflow/config.staging.json` had old or placeholder contract addresses.

**Fix**: Updated `contractAddress` to current `LienFiAuction` address in both configs.

### Bug 2: Missing `configSchema` in Settlement Workflow

**Problem**: `settlement-workflow/main.ts` had `Runner.newRunner<Config>()` without `configSchema`, causing config validation to be skipped.

**Fix**: Changed to `Runner.newRunner<Config>({ configSchema })`.

### Bug 3: Missing API Environment Variables

**Problem**: API was missing `USDC_ADDRESS` env var. The bid route uses `process.env.USDC_ADDRESS!` for pool balance checks.

**Fix**: Added `USDC_ADDRESS` to both local `.env` and Render deployment.

### Bug 4: Stale `VERIFYING_CONTRACT` in API

**Problem**: API's `VERIFYING_CONTRACT` pointed to an old LienFiAuction deployment. This affected both EIP-712 signature domain and on-chain reads.

**Fix**: Updated to current deployment address.

---

## 13. Common Errors and Troubleshooting

### "Bid below reserve price"

- **Cause**: Bid amount < auction's `reservePrice`.
- **Fix**: Check reserve price: `cast call $LIENFI_AUCTION "auctions(bytes32)..." $AUCTION_ID`

### "Insufficient pool balance"

- **Cause**: Bidder hasn't deposited enough USDC to the pool.
- **Fix**: Deposit more USDC via `depositToPool()` (see [Step 5](#5-set-up-bidders)).

### "Lock expires before auction deadline"

- **Cause**: Bidder's `lockExpiry` < auction deadline.
- **Fix**: Call `extendLock(newExpiry)` on LienFiAuction with expiry > deadline.

### "Duplicate bid from this bidder"

- **Cause**: Same bidder already submitted a bid for this auction.
- **Fix**: Each bidder can only bid once per auction. Use a different bidder address.

### "Invalid signature"

- **Cause**: EIP-712 domain mismatch (wrong `verifyingContract` or `chainId`).
- **Fix**: Ensure `generate-bid-payload.ts` uses the same `VERIFYING_CONTRACT` and `CHAIN_ID` as the API env.

### "Auction not found on-chain"

- **Cause**: API's `VERIFYING_CONTRACT` doesn't match the actual LienFiAuction deployment.
- **Fix**: Update `VERIFYING_CONTRACT` in API env to the correct address.

### Settlement "AuctionNotExpired" (tx result=false)

- **Cause**: `block.timestamp < auction.deadline`. Settlement can only execute after deadline.
- **Fix**: Wait for the auction deadline to pass, then re-run settlement workflow.

### "No active auction, skipping settlement"

- **Cause**: No auction exists or it was already settled.
- **Fix**: Create an auction first via the create-auction workflow.

### "InvalidNullifier" on depositToPool

- **Cause**: The `nullifierHash` was already used in a previous deposit.
- **Fix**: Use a different `nullifierHash` value (e.g., increment by 1).

### Confidential HTTP Timeout

- **Cause**: Render free tier cold start.
- **Fix**: Wake server with `curl https://sealbid.onrender.com/health` before running.

---

## Full End-to-End Test Sequence

```
1. Deploy contracts (see TESTING-CREDIT-WORKFLOW.md)
2. Fund LendingPool
3. Run credit-assessment workflow → loan approved
4. Claim loan → loan ACTIVE, NFT locked
5. Run create-auction workflow → loan DEFAULTED, auction created
6. Deposit USDC to pool for bidder(s) with World ID proof
7. Generate signed bid payload(s)
8. Run bid workflow → bids registered on-chain
9. Wait for auction deadline (7 days)
10. Run settlement workflow → auction settled, NFT transferred
11. Verify: loan CLOSED, NFT owned by winner, USDC distributed
```

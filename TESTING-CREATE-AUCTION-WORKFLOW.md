# Testing the Create-Auction CRE Workflow

This guide walks through testing the create-auction CRE workflow using `cre workflow simulate`. The workflow is cron-triggered, scans active loans for defaults (3+ missed EMI periods), fetches a listing hash from the SealBid API, and writes a DON report to `LoanManager._processDefault()` which creates a sealed-bid auction on `LienFiAuction`.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [Environment Setup](#3-environment-setup)
4. [Pre-requisites: Complete the Credit Workflow](#4-pre-requisites-complete-the-credit-workflow)
5. [Claim the Loan](#5-claim-the-loan)
6. [Bypass the Default Threshold (Testing Only)](#6-bypass-the-default-threshold-testing-only)
7. [Wait for Sepolia Finalization](#7-wait-for-sepolia-finalization)
8. [Run the CRE Workflow Simulation](#8-run-the-cre-workflow-simulation)
9. [Expected Output (Successful Run)](#9-expected-output-successful-run)
10. [Verify On-Chain State](#10-verify-on-chain-state)
11. [Revert Testing Overrides](#11-revert-testing-overrides)
12. [Workflow Pipeline Steps Explained](#12-workflow-pipeline-steps-explained)
13. [Bugs Found and Fixed](#13-bugs-found-and-fixed)
14. [Common Errors and Troubleshooting](#14-common-errors-and-troubleshooting)

---

## 1. Prerequisites

| Tool | Purpose |
|------|---------|
| **CRE CLI** (`cre`) | Chainlink Runtime Environment CLI for simulating workflows |
| **Foundry** (`forge`, `cast`) | Smart contract compilation, deployment, and on-chain calls |
| **curl** | API calls to SealBid server |
| **Credit workflow completed** | A loan must exist on-chain (see [TESTING-CREDIT-WORKFLOW.md](./TESTING-CREDIT-WORKFLOW.md)) |

Make sure you are logged into CRE:

```bash
cre auth login
```

---

## 2. Architecture Overview

```
[Cron Trigger: every 5 minutes]
        |
        v
[1. Check activeAuctionId == 0] --> Skip if auction already exists
        |
        v
[2. Read loanCounter] --> Total loans on LoanManager
        |
        v
[3. Loop each loan: getLoan(i)]
        |
        v
[4. Check status == ACTIVE]
        |
        v
[5. Default condition] --> now > nextDueDate + (3 * 30 days)?
        |
        v
[6. Fetch listingHash] --> Confidential HTTP to SealBid API
        |
        v
[7. Encode report] --> abi.encode(loanId, listingHash)
        |
        v
[8. Write DON report to LoanManager]
        |
        v
[9. _processDefault() on-chain]:
    - Set loan status = DEFAULTED
    - Transfer PropertyNFT to LienFiAuction
    - Call initiateDefaultAuction(tokenId, reservePrice, auctionId, deadline, listingHash)
    - Emit LoanDefaulted event
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

The create-auction workflow only needs `apiKey` and `san_marino_aes_gcm_encryption_key` from vault secrets. Groq/Plaid secrets (used by credit-assessment) are ignored.

### 3.2 Config File

File: `cre-workflows/create-auction-workflow/config.staging.json`

```json
{
  "schedule": "0 */5 * * * *",
  "url": "https://sealbid.onrender.com",
  "owner": "<YOUR_WALLET_ADDRESS>",
  "evms": [
    {
      "chainSelectorName": "ethereum-testnet-sepolia",
      "loanManagerAddress": "<LOAN_MANAGER_ADDRESS>",
      "lienFiAuctionAddress": "<LIENFI_AUCTION_ADDRESS>",
      "gasLimit": "500000"
    }
  ]
}
```

### 3.3 Workflow YAML

File: `cre-workflows/create-auction-workflow/workflow.yaml`

```yaml
staging-settings:
  user-workflow:
    workflow-name: "create-auction"
  workflow-artifacts:
    workflow-path: "./main.ts"
    config-path: "./config.staging.json"
    secrets-path: "../secrets.yaml"
```

> **IMPORTANT**: The `workflow-name` must be `"create-auction"` (not `"create"`). The LoanManager contract dispatches reports by `bytes10(SHA256(workflow-name))`, and the constant `WORKFLOW_CREATE` is computed from `"create-auction"`.

---

## 4. Pre-requisites: Complete the Credit Workflow

Before testing the create-auction workflow, you need an **active loan** on-chain. Follow [TESTING-CREDIT-WORKFLOW.md](./TESTING-CREDIT-WORKFLOW.md) through all steps:

1. Deploy contracts (or use existing deployment)
2. Fund the LendingPool with USDC
3. Verify a property via the API
4. Submit a loan request to the API
5. Submit the request on-chain
6. Run the credit-assessment CRE simulation
7. Wait for the approval verdict to be written on-chain

After the credit workflow succeeds, verify the approval exists:

```bash
BORROWER=<YOUR_WALLET_ADDRESS>
cast call $LOAN_MANAGER_ADDRESS \
  "getApproval(address)(bytes32,uint256,uint256,uint256,uint256,uint256,bool)" \
  $BORROWER \
  --rpc-url $SEPOLIA_RPC_URL
```

You should see `exists = true` with a valid `requestHash`, `tokenId`, `approvedLimit`, etc.

---

## 5. Claim the Loan

### 5.1 Mint the PropertyNFT

The PropertyNFT must be minted on-chain before claiming. Compute the metadataHash and mint:

```bash
# Compute metadataHash (for PROP-001: Austin TX, $1M)
METADATA_HASH=$(cast keccak $(cast abi-encode \
  "f(string,uint256,string,string)" \
  "123 Main St, Austin TX" 1000000 "TX-2024-00123" "lienfi-demo-secret-2024"))

echo "metadataHash = $METADATA_HASH"

# Mint PropertyNFT (tokenId will be auto-assigned starting from 1)
cast send $PROPERTY_NFT_ADDRESS \
  "mint(bytes32)" "$METADATA_HASH" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 5.2 Approve LoanManager for the NFT

```bash
cast send $PROPERTY_NFT_ADDRESS \
  "approve(address,uint256)" $LOAN_MANAGER_ADDRESS 1 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

### 5.3 Claim the Loan

```bash
REQUEST_HASH=<REQUEST_HASH_FROM_CREDIT_WORKFLOW>

cast send $LOAN_MANAGER_ADDRESS \
  "claimLoan(bytes32)" $REQUEST_HASH \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

This will:
- Transfer PropertyNFT from borrower to LoanManager (collateral lock)
- Disburse USDC from LendingPool to borrower
- Create loan record with `status = ACTIVE`, `nextDueDate = now + 30 days`

### 5.4 Verify Loan State

```bash
cast call $LOAN_MANAGER_ADDRESS \
  "getLoan(uint256)(uint256,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint8)" 1 \
  --rpc-url $SEPOLIA_RPC_URL
```

Last field should be `0` (ACTIVE).

**Save the block number** from the claimLoan transaction — you'll need to wait for it to finalize.

---

## 6. Bypass the Default Threshold (Testing Only)

The default condition requires `now > nextDueDate + (3 * 30 days)` — that's 120 days after loan origination. On Sepolia testnet, we can't fast-forward time.

**Key insight**: `LoanManager._processDefault()` does NOT re-validate the time condition on-chain. It trusts the CRE DON report. So we can temporarily bypass the time check in the workflow for testing.

In `cre-workflows/create-auction-workflow/main.ts`, change:

```typescript
// Default condition: current time > nextDueDate + (3 * EMI_PERIOD)
const defaultThreshold = nextDueDate + (DEFAULT_THRESHOLD_PERIODS * EMI_PERIOD_SECONDS)
if (now <= defaultThreshold) continue
```

To:

```typescript
// TESTING OVERRIDE: bypass time check (revert after testing)
const defaultThreshold = 0n
if (now <= defaultThreshold) continue
```

> **Remember to revert this after testing!** See [Step 11](#11-revert-testing-overrides).

---

## 7. Wait for Sepolia Finalization

The CRE simulator reads from `LATEST_BLOCK_NUMBER`. Sepolia finalization trails the latest block by ~80 blocks (~16 minutes).

Check finalization status:

```bash
CLAIM_BLOCK=<BLOCK_NUMBER_FROM_STEP_5.3>

cast block-number finalized --rpc-url $SEPOLIA_RPC_URL
```

Wait until the finalized block is >= your claimLoan block number.

Also wake the Render server to avoid cold-start timeouts:

```bash
curl -s "https://sealbid.onrender.com/health"
```

---

## 8. Run the CRE Workflow Simulation

```bash
cd cre-workflows

cre workflow simulate ./create-auction-workflow \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --broadcast \
  --verbose
```

**Flags explained:**
- `./create-auction-workflow` — path to workflow folder (required positional arg)
- `--target staging-settings` — use staging config/secrets
- `--non-interactive` — no prompts
- `--trigger-index 0` — run the cron trigger (only one trigger at index 0)
- `--broadcast` — write the DON report on-chain
- `--verbose` — detailed logging

---

## 9. Expected Output (Successful Run)

```
✓ Workflow compiled
[SIMULATION] Simulator Initialized
[SIMULATION] Running trigger trigger=cron-trigger@1.0.0
[WORKFLOW] WorkflowExecutionStarted
  WorkflowName: create-auction
[SIMULATOR]  step[0]  Capability: evm:... - STARTED     ← Read activeAuctionId
[SIMULATOR]  step[0]  Capability: evm:... - COMPLETED
[SIMULATOR]  step[1]  Capability: evm:... - STARTED     ← Read loanCounter
[SIMULATOR]  step[1]  Capability: evm:... - COMPLETED
[USER LOG] Scanning 1 loans for defaults...
[SIMULATOR]  step[2]  Capability: evm:... - STARTED     ← Read getLoan(1)
[SIMULATOR]  step[2]  Capability: evm:... - COMPLETED
[USER LOG] Loan 1 is in default (nextDueDate=..., now=...)
[USER LOG] Fetched listingHash=0x71718f2b... for tokenId=1
[USER LOG] Default processed for loanId=1: 0x<txHash>
[WORKFLOW] WorkflowExecutionFinished - Status: SUCCESS

✓ Workflow Simulation Result:
"0x<txHash>"
```

---

## 10. Verify On-Chain State

### 10.1 Loan Status Should Be DEFAULTED

```bash
cast call $LOAN_MANAGER_ADDRESS \
  "getLoan(uint256)(uint256,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint8)" 1 \
  --rpc-url $SEPOLIA_RPC_URL
```

Last field should now be `1` (DEFAULTED).

### 10.2 Active Auction Should Exist

```bash
cast call $LIENFI_AUCTION_ADDRESS \
  "activeAuctionId()" \
  --rpc-url $SEPOLIA_RPC_URL
```

Should return a non-zero bytes32 auction ID (e.g., `0xcc69885f...`).

### 10.3 PropertyNFT Should Be Held by LienFiAuction

```bash
cast call $PROPERTY_NFT_ADDRESS \
  "ownerOf(uint256)" 1 \
  --rpc-url $SEPOLIA_RPC_URL
```

Should return the LienFiAuction address.

---

## 11. Revert Testing Overrides

After testing, restore the original default threshold in `main.ts`:

```typescript
// Default condition: current time > nextDueDate + (3 * EMI_PERIOD)
const defaultThreshold = nextDueDate + (DEFAULT_THRESHOLD_PERIODS * EMI_PERIOD_SECONDS)
if (now <= defaultThreshold) continue
```

---

## 12. Workflow Pipeline Steps Explained

| Step | What Happens | On-Chain Read/Write |
|------|-------------|---------------------|
| **1. Check active auction** | Read `activeAuctionId` from LienFiAuction. If non-zero, skip (one auction at a time). | EVM read |
| **2. Read loan counter** | Read `loanCounter` from LoanManager. If 0, skip. | EVM read |
| **3. Scan loans** | Loop `getLoan(i)` for each loan. Check `status == ACTIVE`. | EVM read |
| **4. Default check** | `now > nextDueDate + (3 * 30 days)`. Skip if not defaulted. | Local computation |
| **5. Fetch listingHash** | `GET /listing-hash/{tokenId}` via Confidential HTTP. API computes hash from stored property data. | HTTP (encrypted) |
| **6. Encode report** | `abi.encode(uint256 loanId, bytes32 listingHash)` | Local computation |
| **7. Sign report** | DON consensus on the encoded payload. | CRE signing |
| **8. Write report** | `writeReport` to LoanManager via KeystoneForwarder → `onReport` → `_processReport` → `_processDefault`. | EVM write |

### What `_processDefault()` Does On-Chain

1. Load loan record, verify exists and ACTIVE
2. Set `loan.status = DEFAULTED`
3. Compute `auctionId = keccak256(tokenId, loanId)`
4. Transfer PropertyNFT from LoanManager → LienFiAuction
5. Call `lienFiAuction.initiateDefaultAuction(tokenId, remainingPrincipal, auctionId, now + 7 days, listingHash)`
6. Emit `LoanDefaulted(loanId, borrower, tokenId, remainingPrincipal)`

---

## 13. Bugs Found and Fixed

### Bug 1: `workflow-name` Mismatch

**Problem**: `workflow.yaml` had `workflow-name: "create"` but the LoanManager contract had `WORKFLOW_CREATE = SHA256("create-auction")`. The CRE metadata bytes10 didn't match, causing `LoanManager__UnknownWorkflow` revert.

**Fix**: Changed `workflow.yaml` to `workflow-name: "create-auction"`.

### Bug 2: Viem Returns Struct as Object, Not Tuple

**Problem**: The code used numeric tuple indexing (`loan[10]` for status, `loan[7]` for nextDueDate) but viem's `decodeFunctionResult` returns Solidity structs as named objects (`loan.status`, `loan.nextDueDate`). All indexed values were `undefined`.

**Fix**: Changed from `LoanTuple` (readonly array) to `LoanStruct` (typed object) and use named property access.

### Bug 3: `LOAN_STATUS_ACTIVE` Type Mismatch

**Problem**: `LOAN_STATUS_ACTIVE` was `0` (number) but viem may return uint8 status in a context where it gets compared with `BigInt`. JavaScript strict inequality `0n !== 0` is `true`, so active loans were being skipped.

**Fix**: Changed to `LOAN_STATUS_ACTIVE = 0n` and use `BigInt(loan.status)` for comparison.

### Bug 4: Missing `configSchema` in Runner

**Problem**: `Runner.newRunner<Config>()` was called without passing `{ configSchema }`, causing runtime config validation to be skipped.

**Fix**: Changed to `Runner.newRunner<Config>({ configSchema })`.

---

## 14. Common Errors and Troubleshooting

### "No defaulted loans found"

- **Cause**: The default threshold check is failing. On Sepolia, `nextDueDate` is 30 days out, and default requires 120 days.
- **Fix**: Apply the testing override from [Step 6](#6-bypass-the-default-threshold-testing-only).

### "Auction already active, skipping default detection"

- **Cause**: An auction already exists. Only one auction can be active at a time.
- **Fix**: Wait for the existing auction to be settled, or redeploy contracts.

### "No loans exist, skipping"

- **Cause**: No loans have been claimed on LoanManager.
- **Fix**: Complete the credit workflow and claim the loan first ([Steps 4-5](#4-pre-requisites-complete-the-credit-workflow)).

### "Listing hash API failed: 404"

- **Cause**: The property wasn't stored via the API's `/verify-property` endpoint.
- **Fix**: Re-run the verify-property step from the credit workflow.

### Confidential HTTP Timeout

- **Cause**: Render free tier cold start (~30 seconds).
- **Fix**: Wake the server first with `curl https://sealbid.onrender.com/health`, then re-run.

### `LoanManager__UnknownWorkflow` Revert

- **Cause**: `workflow-name` in `workflow.yaml` doesn't match the contract's `WORKFLOW_CREATE` constant.
- **Fix**: Ensure `workflow-name: "create-auction"` in workflow.yaml.

### Finalization Not Progressing

- **Cause**: Sepolia finalization can stall temporarily.
- **Fix**: Keep checking `cast block-number finalized --rpc-url $SEPOLIA_RPC_URL`. It typically catches up in bursts.

---

## Restarting from Scratch

If you need a clean slate:

1. Redeploy all contracts: `forge script script/DeployLienFi.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast`
2. Update all addresses in `.env`, `config.staging.json` files
3. Re-fund the LendingPool
4. Re-verify the property via the API
5. Re-run the credit workflow
6. Claim the loan
7. Run the create-auction workflow

# Testing the Credit Assessment CRE Workflow

This guide walks through every step needed to test the credit-assessment CRE workflow locally using `cre workflow simulate`. The workflow is triggered by a `LoanRequestSubmitted` EVM event, fetches borrower details from the SealBid API, pulls financial data from Plaid, runs AI credit scoring via Groq, checks on-chain liquidity, and writes a verdict on-chain.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Architecture Overview](#2-architecture-overview)
3. [Environment Setup](#3-environment-setup)
4. [Deploy Contracts](#4-deploy-contracts)
5. [Fund the LendingPool](#5-fund-the-lendingpool)
6. [Generate a Plaid Sandbox Token](#6-generate-a-plaid-sandbox-token)
7. [Run the Full Test Flow](#7-run-the-full-test-flow)
8. [Run the CRE Workflow Simulation](#8-run-the-cre-workflow-simulation)
9. [Expected Output (Successful Run)](#9-expected-output-successful-run)
10. [Workflow Pipeline Steps Explained](#10-workflow-pipeline-steps-explained)
11. [LLM Provider Changes (Anthropic -> Gemini -> Groq)](#11-llm-provider-changes-anthropic---gemini---groq)
12. [Bugs Found and Fixed](#12-bugs-found-and-fixed)
13. [Common Errors and Troubleshooting](#13-common-errors-and-troubleshooting)
14. [Restarting from Scratch](#14-restarting-from-scratch)

---

## 1. Prerequisites

| Tool | Purpose |
|------|---------|
| **CRE CLI** (`cre`) | Chainlink Runtime Environment CLI for compiling and simulating workflows |
| **Foundry** (`forge`, `cast`) | Smart contract compilation, deployment, and on-chain calls |
| **Node.js / Bun** | TypeScript workflow compilation |
| **curl** | API calls to SealBid server and Plaid |
| **python3** | JSON parsing in shell scripts |

Make sure you are logged into CRE:

```bash
cre auth login
```

---

## 2. Architecture Overview

```
[EVM Event: LoanRequestSubmitted]
        |
        v
[1. Decode event] --> borrower address + requestHash
        |
        v
[2. Fetch loan details] --> Confidential HTTP to SealBid API
        |
        v
[3. Verify hash integrity] --> recompute keccak256 and compare
        |
        v
[4. Compute EMI] --> P * r * (1+r)^n / ((1+r)^n - 1)
        |
        v
[5. LTV check] --> requestedAmount / appraisedValue <= 80%
        |
        v
[6. Fetch Plaid data] --> Confidential HTTP to Plaid Sandbox
        |
        v
[7. Hard rule gates] --> Income coverage >= 3x, no defaults
        |
        v
[8. AI credit scoring] --> Confidential HTTP to Groq (Llama 3.3 70B)
        |
        v
[9. Liquidity check] --> EVM read on LendingPool.availableLiquidity()
        |
        v
[10. Write verdict on-chain] --> EVM write via CRE report
```

---

## 3. Environment Setup

### 3.1 CRE Workflow `.env`

File: `cre-workflows/.env`

```env
CRE_ETH_PRIVATE_KEY=0x<your_private_key>
CRE_TARGET=staging-settings
MY_API_KEY_ALL=<sealbid_api_key>
AES_KEY_ALL=0000000000000000000000000000000000000000000000000000000000000001
GROQ_API_KEY_ALL=<your_groq_api_key>
PLAID_SECRET_ALL=<your_plaid_secret>
PLAID_CLIENT_ID_ALL=<your_plaid_client_id>
```

### 3.2 Secrets Mapping

File: `cre-workflows/secrets.yaml`

```yaml
secretsNames:
  apiKey:
    - MY_API_KEY_ALL
  san_marino_aes_gcm_encryption_key:
    - AES_KEY_ALL
  plaidClientId:
    - PLAID_CLIENT_ID_ALL
  plaidSecret:
    - PLAID_SECRET_ALL
  groqApiKey:
    - GROQ_API_KEY_ALL
```

Each key in `secretsNames` maps to a secret name used in the workflow code via `{{.secretName}}` template syntax. The array value is the corresponding `.env` variable name.

### 3.3 Workflow Config

File: `cre-workflows/credit-assessment-workflow/config.staging.json`

```json
{
  "url": "<YOUR_SEALBID_API_URL>",
  "owner": "<YOUR_WALLET_ADDRESS>",
  "evms": [
    {
      "chainSelectorName": "ethereum-testnet-sepolia",
      "loanManagerAddress": "<DEPLOYED_LOAN_MANAGER_ADDRESS>",
      "lendingPoolAddress": "<DEPLOYED_LENDING_POOL_ADDRESS>",
      "gasLimit": "500000"
    }
  ],
  "interestRateBps": 800
}
```

Update `loanManagerAddress` and `lendingPoolAddress` with your deployed contract addresses after step 4.

### 3.4 API Keys Required

| Service | How to Get |
|---------|-----------|
| **Groq** | Sign up at [console.groq.com](https://console.groq.com), create an API key |
| **Plaid** | Sign up at [dashboard.plaid.com](https://dashboard.plaid.com), get Sandbox client_id and secret |
| **SealBid API** | The `MY_API_KEY_ALL` is set during server deployment |

### 3.5 Verify Groq API Key

```bash
curl -s https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer <YOUR_GROQ_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.3-70b-versatile","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

You should get a JSON response with `choices[0].message.content`.

---

## 4. Deploy Contracts

The full LienFi protocol stack must be deployed on Sepolia. This includes MockUSDC, PropertyNFT, clUSDC, LendingPool, LienFiAuction, and LoanManager.

### 4.1 Set Up Contracts `.env`

File: `contracts/.env`

```env
PRIVATE_KEY=0x<your_private_key>
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your_alchemy_key>
WORLD_ID_APP_ID=app_staging_test
```

### 4.2 Run the Deployment Script

```bash
cd contracts
source .env
forge script script/DeployLienFi.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast
```

The output will show all deployed addresses:

```
[1/7] MockWorldIDRouter: 0x...
[2/7] MockUSDC: 0x...
[3/7] PropertyNFT: 0x...
[4/7] clUSDC: 0x...
[5/7] LendingPool: 0x...
[6/7] LienFiAuction: 0x...
[7/7] LoanManager: 0x...
```

**Save the MockUSDC, LendingPool, and LoanManager addresses** — you will need all three in later steps.

### 4.3 Update Workflow Config

Copy the **LoanManager** and **LendingPool** addresses into `config.staging.json`:

```json
"loanManagerAddress": "<LoanManager address from step 4.2>",
"lendingPoolAddress": "<LendingPool address from step 4.2>"
```

### 4.4 Why Fresh Contracts Are Needed

The `LoanManager` contract enforces **one pending request per borrower** and has no cancel function. If a request was already submitted from a previous test, `submitRequest()` will revert with `LoanManager__RequestAlreadyPending`. The `LendingPool` only allows `setLoanManager()` once, so you cannot repoint an existing pool to a new manager. This means **a full redeployment is required for each fresh test run**.

---

## 5. Fund the LendingPool

The workflow checks on-chain liquidity in step 9. The newly deployed LendingPool has zero balance, so you must deposit MockUSDC.

**Important:** Use the **MockUSDC address from your deployment** (step 4.2), NOT any previous deployment's address. Each deployment creates a new MockUSDC contract.

### 5.1 Mint MockUSDC

MockUSDC has no access control on `mint()` — anyone can mint. This is only for testing.

```bash
cast send <MOCK_USDC_ADDRESS> \
  "mint(address,uint256)" <YOUR_WALLET_ADDRESS> 1000000000 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --private-key <YOUR_PRIVATE_KEY>
```

This mints 1000 USDC (1000000000 in 6-decimal).

### 5.2 Approve LendingPool

```bash
cast send <MOCK_USDC_ADDRESS> \
  "approve(address,uint256)" <LENDING_POOL_ADDRESS> 1000000000 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --private-key <YOUR_PRIVATE_KEY>
```

### 5.3 Deposit into LendingPool

```bash
cast send <LENDING_POOL_ADDRESS> \
  "deposit(uint256)" 1000000000 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --private-key <YOUR_PRIVATE_KEY>
```

### 5.4 Verify Liquidity

```bash
cast call <LENDING_POOL_ADDRESS> \
  "availableLiquidity()(uint256)" \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

Expected output: `1000000000 [1e9]`

---

## 6. Generate a Plaid Sandbox Token

Plaid Sandbox requires a **real** access token generated via their API. A hardcoded string like `access-sandbox-test-token` will not work (returns HTTP 400).

### 6.1 Create a Sandbox Public Token

```bash
curl -s -X POST https://sandbox.plaid.com/sandbox/public_token/create \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "<YOUR_PLAID_CLIENT_ID>",
    "secret": "<YOUR_PLAID_SECRET>",
    "institution_id": "ins_109508",
    "initial_products": ["transactions"]
  }'
```

Response:
```json
{
  "public_token": "public-sandbox-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "request_id": "..."
}
```

Save the `public_token`.

### 6.2 Exchange for an Access Token

```bash
curl -s -X POST https://sandbox.plaid.com/item/public_token/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "<YOUR_PLAID_CLIENT_ID>",
    "secret": "<YOUR_PLAID_SECRET>",
    "public_token": "<PUBLIC_TOKEN_FROM_6.1>"
  }'
```

Response:
```json
{
  "access_token": "access-sandbox-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "item_id": "...",
  "request_id": "..."
}
```

Save the `access_token` for use in step 7.

**Plaid sandbox data characteristics:**
- Monthly income: ~$252 (from sandbox test transactions)
- DTI: 0.0%
- Stability score: ~5%
- No overdrafts or defaults

---

## 7. Run the Full Test Flow

This creates an on-chain event that the CRE workflow will read from. There are three sub-steps: verify property, submit loan request to API, submit request on-chain.

### 7.1 Step A: Verify Property

```bash
curl -s -X POST "<YOUR_SEALBID_API_URL>/verify-property" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <YOUR_API_KEY>" \
  -d '{
    "propertyId": "PROP-001",
    "sellerAddress": "<YOUR_WALLET_ADDRESS>"
  }'
```

Available pre-seeded properties:
- `PROP-001`: $1,000,000 — Austin, TX
- `PROP-002`: $2,500,000 — Miami, FL

Expected response:
```json
{
  "valid": true,
  "tokenId": 1,
  "metadataHash": "0x...",
  "appraisedValue": "1000000",
  "message": "Property PROP-001 (123 Main St, Austin TX) verified. TokenId=1"
}
```

### 7.2 Step B: Submit Loan Request to API

```bash
curl -s -X POST "<YOUR_SEALBID_API_URL>/loan-request" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <YOUR_API_KEY>" \
  -d '{
    "borrowerAddress": "<YOUR_WALLET_ADDRESS>",
    "plaidToken": "<ACCESS_TOKEN_FROM_STEP_6>",
    "tokenId": 1,
    "requestedAmount": "100000000",
    "tenureMonths": 360,
    "nonce": 10
  }'
```

- `requestedAmount` is in **USDC 6-decimal** format: `100000000` = $100
- `tokenId` must match the property's tokenId from step 7.1
- `nonce` must be unique per borrower per contract deployment

Expected response:
```json
{
  "requestHash": "0xe3c19b8f...",
  "tokenId": 1,
  "nonce": 10
}
```

Save the `requestHash` for step 7.3.

### 7.3 Step C: Submit Request On-Chain

```bash
cast send <LOAN_MANAGER_ADDRESS> \
  "submitRequest(bytes32)" \
  "<REQUEST_HASH_FROM_7.2>" \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --private-key <YOUR_PRIVATE_KEY>
```

This emits the `LoanRequestSubmitted(address indexed borrower, bytes32 requestHash)` event that the CRE workflow listens for.

From the output, save the **`transactionHash`** value for step 8.

### 7.4 Choosing the Right Loan Amount

The Plaid sandbox gives ~$252/month income. To get the AI to **approve**, use a small loan amount:

| Loan Amount | EMI/month | Income Coverage | AI Verdict |
|-------------|-----------|-----------------|------------|
| $5,000 (`5000000000`) | $36.69 | 6.87x | **Reject** (AI subjective) |
| $100 (`100000000`) | $0.73 | 345x | **Approve** |

The AI rejection at $5,000 happens because the absolute income ($252/mo) and stability score (5%) are very low, even though the coverage ratio passes. At $100, the metrics are overwhelmingly favorable and the AI follows the explicit approval criteria.

---

## 8. Run the CRE Workflow Simulation

### 8.1 Run the Simulation

```bash
cd cre-workflows

cre workflow simulate credit-assessment-workflow \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --evm-tx-hash <TX_HASH_FROM_STEP_7.3> \
  --evm-event-index 0 \
  --broadcast \
  --verbose
```

**Required flags explained:**

| Flag | Purpose |
|------|---------|
| `--target staging-settings` | Uses `workflow.yaml` > `staging-settings` target |
| `--non-interactive` | Required when running from scripts/CI (no TTY) |
| `--trigger-index 0` | Selects the first (only) trigger handler |
| `--evm-tx-hash` | The transaction containing the `LoanRequestSubmitted` event |
| `--evm-event-index 0` | Selects the first log event in the transaction |
| `--broadcast` | Broadcasts `writeReport` transactions on-chain (triggers `onReport` on LoanManager) |
| `--verbose` | Shows debug-level logs including step execution |

### 8.2 Wait for Sepolia Finalization

The workflow uses `LAST_FINALIZED_BLOCK_NUMBER` for on-chain reads. On Sepolia, the finalized block trails the latest block by ~80 blocks (~16 minutes). If you just deployed contracts or deposited USDC, **wait ~15-20 minutes** before running the simulation, otherwise the liquidity check will fail with:

```
Cannot decode zero data ("0x") with ABI parameters.
```

You can check finalization progress:

```bash
# Check if your contracts exist at the finalized block
cast code <LENDING_POOL_ADDRESS> \
  --block finalized \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com

# Should return bytecode starting with 0x6080..., NOT 0x

# Check liquidity at finalized block
cast call <LENDING_POOL_ADDRESS> \
  "availableLiquidity()(uint256)" \
  --block finalized \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com

# Should return 1000000000 [1e9], NOT 0
```

### 8.3 Note on the `--broadcast` Flag

The `--broadcast` flag is required for `writeReport` to actually submit transactions on-chain during simulation. With it, the full end-to-end flow works: `writeReport` → `KeystoneForwarder` → `onReport()` on LoanManager → verdict stored on-chain. Without `--broadcast`, the txHash will be all zeros and no on-chain write occurs.

---

## 9. Expected Output (Successful Run)

```
[USER LOG] LoanRequestSubmitted: borrower=0xf6aC...356a requestHash=0xe3c1...d8e3
[USER LOG] Fetched request: tokenId=1 amount=100000000 tenure=360
[USER LOG] Hash integrity verified
[USER LOG] Computed EMI: 733765 (0.73 USDC/mo)
[USER LOG] Plaid metrics: income=$252/mo DTI=0.0% stability=5%
[USER LOG] AI verdict: verdict=approve approvedAmount=100000000
[USER LOG] All checks passed. Writing approval verdict on-chain.
[USER LOG] Verdict written: approved=true txHash=0x000...000
[WORKFLOW] WorkflowExecutionFinished - Status: SUCCESS
```

**Verdict payload written to LoanManager:**

| Field | Value |
|-------|-------|
| borrower | `<your_wallet_address>` |
| requestHash | `<request_hash>` |
| approved | `true` |
| tokenId | `1` |
| approvedLimit | `100000000` ($100 USDC) |
| tenureMonths | `360` |
| computedEMI | `733765` ($0.73/mo) |
| expiresAt | current timestamp + 7 days |

---

## 10. Workflow Pipeline Steps Explained

| Step | What Happens | Technology |
|------|-------------|-----------|
| **1. Decode Event** | Extract `borrower` (from indexed topic) and `requestHash` (from log data) | viem ABI decoding |
| **2. Fetch Loan Request** | GET `/loan-request/{hash}` from SealBid API | ConfidentialHTTPClient |
| **3. Verify Hash** | Recompute `keccak256(borrower, tokenId, amount, tenure, nonce)` and compare to on-chain hash | viem keccak256 |
| **4. Compute EMI** | `P * r * (1+r)^n / ((1+r)^n - 1)` with `r = interestRateBps / 10000 / 12` | Pure math |
| **5. LTV Check** | `requestedAmount / (appraisedValueUsd * 1e6)` must be <= 0.8 | Hard rule gate |
| **6. Fetch Plaid Data** | POST to `sandbox.plaid.com/transactions/get`, compute income/DTI/stability/overdraft metrics | ConfidentialHTTPClient |
| **7. Income Coverage** | `monthlyIncome / (emi / 1e6)` must be >= 3x. Also rejects if recent defaults found | Hard rule gate |
| **8. AI Scoring** | POST to Groq API with metrics, get `{verdict, approvedAmount}` JSON response | ConfidentialHTTPClient |
| **9. Liquidity Check** | Call `LendingPool.availableLiquidity()` at finalized block, must be >= approvedAmount | EVMClient.callContract |
| **10. Write Verdict** | ABI-encode verdict, sign as CRE report, write to LoanManager via `writeReport` | EVMClient.writeReport |

---

## 11. LLM Provider Changes (Anthropic -> Gemini -> Groq)

The AI credit scoring function went through three LLM provider iterations during development. Each switch required changes to **3 files**: `main.ts`, `secrets.yaml`, and `.env`.

### 11.1 Original: Anthropic (Claude)

**Status:** Failed with HTTP 401 (invalid/expired API key)

```typescript
// main.ts - API call
url: "https://api.anthropic.com/v1/messages",
multiHeaders: {
  "Content-Type": { values: ["application/json"] },
  "x-api-key": { values: ["{{.anthropicApiKey}}"] },
  "anthropic-version": { values: ["2023-06-01"] },
},

// Request body
{ model: "claude-sonnet-4-6", max_tokens: 256, temperature: 0,
  messages: [{ role: "user", content: prompt }] }

// Response parsing (Anthropic format)
const apiResult = json(response) as {
  content: Array<{ type: string; text: string }>
}
const textContent = apiResult.content.find((c) => c.type === "text")
const parsed = JSON.parse(textContent.text)
```

```yaml
# secrets.yaml
anthropicApiKey:
  - ANTHROPIC_API_KEY_ALL
```

```env
# .env
ANTHROPIC_API_KEY_ALL=sk-ant-...
```

### 11.2 Attempt 2: Gemini (Google)

**Status:** Failed with HTTP 429 (free tier rate limit exhausted, `limit: 0`)

This was attempted but never fully committed to the codebase because the API key hit rate limits immediately. Even after generating a new key, the free tier quota was `0`.

### 11.3 Final: Groq (Llama 3.3 70B)

**Status:** Working

```typescript
// main.ts - API call
url: "https://api.groq.com/openai/v1/chat/completions",
multiHeaders: {
  "Content-Type": { values: ["application/json"] },
  "Authorization": { values: ["Bearer {{.groqApiKey}}"] },
},

// Request body (OpenAI-compatible format)
{ model: "llama-3.3-70b-versatile", max_tokens: 256, temperature: 0,
  messages: [{ role: "user", content: prompt }] }

// Response parsing (OpenAI-compatible format)
const apiResult = json(response) as {
  choices: Array<{ message: { content: string } }>
}
const parsed = JSON.parse(apiResult.choices[0].message.content)
```

```yaml
# secrets.yaml
groqApiKey:
  - GROQ_API_KEY_ALL
```

```env
# .env
GROQ_API_KEY_ALL=gsk_...
```

### 11.4 Key Differences Between Providers

| Aspect | Anthropic | Groq (OpenAI-compatible) |
|--------|-----------|--------------------------|
| **URL** | `api.anthropic.com/v1/messages` | `api.groq.com/openai/v1/chat/completions` |
| **Auth header** | `x-api-key: <key>` | `Authorization: Bearer <key>` |
| **Extra header** | `anthropic-version: 2023-06-01` | None |
| **Response format** | `{ content: [{ type: "text", text: "..." }] }` | `{ choices: [{ message: { content: "..." } }] }` |
| **Model** | `claude-sonnet-4-6` | `llama-3.3-70b-versatile` |

### 11.5 Prompt Evolution

The initial prompt was open-ended:

```
You are a mortgage credit scoring AI. Based on these financial metrics,
provide a credit assessment.
```

This caused the AI to **subjectively reject** loans even when all hard metrics were favorable (e.g., 345x income coverage) because the absolute income ($252/mo) and stability (5%) looked weak.

The final prompt uses **explicit deterministic criteria**:

```
Approval Criteria (approve if ALL are met):
1. Income Coverage Ratio >= 3x
2. Debt-to-Income Ratio < 50%
3. Loan-to-Value Ratio < 80%
4. Overdraft Rate < 20%

If all criteria are met, verdict is "approve" and set approvedAmount to
the requested amount.
```

This makes the AI follow rules rather than exercising subjective judgment, resulting in consistent, predictable verdicts.

### 11.6 EMI Display Bug in Prompt

The EMI value passed to the scoring function is in **USDC 6-decimal scale** (e.g., `733765` for $0.73). The original prompt displayed it as:

```
- Monthly EMI: $733765.00    <-- looks like $733K!
```

This caused the AI to reject because it interpreted the EMI as massive. The fix converts to human-readable dollars:

```typescript
// Before (bug)
- Monthly EMI: $${metrics.emi.toFixed(2)}

// After (fix)
- Monthly EMI: $${(metrics.emi / 1e6).toFixed(2)}
```

---

## 12. Bugs Found and Fixed

### 12.1 EMI Unit Mismatch (Income Coverage Always 0.00x)

**File:** `main.ts` (step 7)

`computeEMI()` returns EMI in USDC 6-decimal scale, but `plaidMetrics.monthlyIncome` is in regular dollars. Dividing dollars by a 6-decimal number produces a near-zero ratio.

```typescript
// Before (bug) — coverage was always ~0.00x
const incomeCoverage = plaidMetrics.monthlyIncome / emi

// After (fix) — convert EMI to dollars first
const emiUsd = emi / 1e6
const incomeCoverage = plaidMetrics.monthlyIncome / emiUsd
```

### 12.2 `body` vs `bodyString` (Base64 Error)

**File:** `main.ts` (AI scoring function)

Regular `HTTPClient` expects `body` as a **base64-encoded** string. `ConfidentialHTTPClient` supports `bodyString` which accepts **raw JSON strings**.

```typescript
// Before (bug) — "invalid base64 string" error
const response = httpClient.sendRequest({
  request: { body: jsonString, ... }
})

// After (fix) — use ConfidentialHTTPClient with bodyString
const response = confHttpClient.sendRequest({
  request: { bodyString: jsonString, ... }
})
```

### 12.3 TypeScript Build Error in API Server

**File:** `api/src/routes/loanRequest.ts`

Express route params type `string | string[]` not assignable to `string`.

```typescript
// Before (bug)
const { requestHash } = req.params

// After (fix)
const requestHash = req.params.requestHash as string
```

---

## 13. Common Errors and Troubleshooting

### `could not open a new TTY`

The CRE simulate interactive mode requires a terminal. When running from scripts or non-TTY environments, add these flags:

```bash
cre workflow simulate credit-assessment-workflow \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --evm-tx-hash <TX_HASH> \
  --evm-event-index 0 \
  --verbose
```

### `LoanManager__RequestAlreadyPending`

The LoanManager already has a pending request from this borrower. You must **redeploy the full contract stack** (see [step 4](#4-deploy-contracts)). There is no cancel function.

```bash
cd contracts && source .env
forge script script/DeployLienFi.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast
```

Then update `config.staging.json` with the new addresses.

### `Cannot decode zero data ("0x")`

The contract does not exist at the finalized block. Either:
- You just deployed and finalization hasn't caught up — check with:
  ```bash
  cast code <LENDING_POOL_ADDRESS> --block finalized \
    --rpc-url https://ethereum-sepolia-rpc.publicnode.com
  ```
  Wait until it returns bytecode (starts with `0x6080...`), not `0x`.
- The `lendingPoolAddress` in `config.staging.json` is wrong — double-check it matches your deployment.

### `Loan request API failed: 404`

The SealBid API server restarted and cleared its in-memory store. Re-run steps 7.1 and 7.2 (verify property + submit loan request) to repopulate. You do NOT need a new on-chain transaction — the existing event is still valid.

```bash
# Re-verify property
curl -s -X POST "<YOUR_SEALBID_API_URL>/verify-property" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <YOUR_API_KEY>" \
  -d '{"propertyId":"PROP-001","sellerAddress":"<YOUR_WALLET_ADDRESS>"}'

# Re-submit loan request (same params as before)
curl -s -X POST "<YOUR_SEALBID_API_URL>/loan-request" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <YOUR_API_KEY>" \
  -d '{
    "borrowerAddress":"<YOUR_WALLET_ADDRESS>",
    "plaidToken":"<YOUR_PLAID_ACCESS_TOKEN>",
    "tokenId":1,
    "requestedAmount":"100000000",
    "tenureMonths":360,
    "nonce":10
  }'
```

### `Plaid API failed: 400`

Using a fake/hardcoded Plaid token. You must generate a **real** sandbox access token (see [step 6](#6-generate-a-plaid-sandbox-token)).

### `Groq API failed: 401`

Invalid Groq API key. Verify it works:

```bash
curl -s https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer <YOUR_GROQ_KEY>"
```

Should return a JSON list of available models.

### `Property already tokenized`

The SealBid API server stores state in memory. If the property was verified in a previous test, either:
- Use a different property ID (`PROP-001` or `PROP-002`)
- Restart/redeploy the server to clear in-memory state

This is a warning only — the loan request submission still works even when the property was already tokenized.

### `REJECTED: Income coverage X.XXx below 3x minimum`

The Plaid sandbox income (~$252/mo) is too low relative to the loan's EMI. Reduce the `requestedAmount`. For a $100 loan (`100000000`), coverage is ~345x which passes easily.

### `ERC20InsufficientAllowance`

You approved the wrong MockUSDC address. Each deployment creates a **new** MockUSDC contract. Make sure you use the MockUSDC address from your **current** deployment (step 4.2), not a previous one.

---

## 14. Restarting from Scratch

If you need a completely fresh test run:

### 14.1 Redeploy Contracts

```bash
cd contracts && source .env
forge script script/DeployLienFi.s.sol --rpc-url "$SEPOLIA_RPC_URL" --broadcast
```

Note the new **MockUSDC**, **LendingPool**, and **LoanManager** addresses.

### 14.2 Update Workflow Config

Edit `cre-workflows/credit-assessment-workflow/config.staging.json` with new LoanManager and LendingPool addresses.

### 14.3 Fund the LendingPool

Use the **new MockUSDC address** from this deployment:

```bash
# Mint
cast send <NEW_MOCK_USDC_ADDRESS> \
  "mint(address,uint256)" <YOUR_WALLET_ADDRESS> 1000000000 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --private-key <YOUR_PRIVATE_KEY>

# Approve
cast send <NEW_MOCK_USDC_ADDRESS> \
  "approve(address,uint256)" <NEW_LENDING_POOL_ADDRESS> 1000000000 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --private-key <YOUR_PRIVATE_KEY>

# Deposit
cast send <NEW_LENDING_POOL_ADDRESS> \
  "deposit(uint256)" 1000000000 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --private-key <YOUR_PRIVATE_KEY>

# Verify
cast call <NEW_LENDING_POOL_ADDRESS> \
  "availableLiquidity()(uint256)" \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

### 14.4 Wait for Finalization

Wait ~15-20 minutes for Sepolia finalization to catch up:

```bash
cast call <NEW_LENDING_POOL_ADDRESS> \
  "availableLiquidity()(uint256)" \
  --block finalized \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com

# Wait until this returns 1000000000, not 0
```

### 14.5 Generate a Fresh Plaid Token

```bash
# Create public token
curl -s -X POST https://sandbox.plaid.com/sandbox/public_token/create \
  -H "Content-Type: application/json" \
  -d '{
    "client_id":"<YOUR_PLAID_CLIENT_ID>",
    "secret":"<YOUR_PLAID_SECRET>",
    "institution_id":"ins_109508",
    "initial_products":["transactions"]
  }'

# Exchange for access token (use public_token from above)
curl -s -X POST https://sandbox.plaid.com/item/public_token/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "client_id":"<YOUR_PLAID_CLIENT_ID>",
    "secret":"<YOUR_PLAID_SECRET>",
    "public_token":"<PUBLIC_TOKEN>"
  }'
```

### 14.6 Run the Full Test Flow

```bash
# A: Verify property
curl -s -X POST "<YOUR_SEALBID_API_URL>/verify-property" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <YOUR_API_KEY>" \
  -d '{"propertyId":"PROP-001","sellerAddress":"<YOUR_WALLET_ADDRESS>"}'

# B: Submit loan request
curl -s -X POST "<YOUR_SEALBID_API_URL>/loan-request" \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: <YOUR_API_KEY>" \
  -d '{
    "borrowerAddress":"<YOUR_WALLET_ADDRESS>",
    "plaidToken":"<PLAID_ACCESS_TOKEN>",
    "tokenId":1,
    "requestedAmount":"100000000",
    "tenureMonths":360,
    "nonce":<NEW_UNIQUE_NONCE>
  }'

# C: Submit on-chain (use requestHash from step B)
cast send <NEW_LOAN_MANAGER_ADDRESS> \
  "submitRequest(bytes32)" \
  "<REQUEST_HASH>" \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --private-key <YOUR_PRIVATE_KEY>
```

### 14.7 Run the Simulation

```bash
cd cre-workflows

cre workflow simulate credit-assessment-workflow \
  --target staging-settings \
  --non-interactive \
  --trigger-index 0 \
  --evm-tx-hash <TX_HASH_FROM_14.6_STEP_C> \
  --evm-event-index 0 \
  --broadcast \
  --verbose
```

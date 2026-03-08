# LienFi Demo

Single-command orchestrator that runs the entire LienFi mortgage lifecycle on Sepolia — from pool funding through sealed-bid Vickrey auction settlement.

## Prerequisites

- **Node.js** >= 18
- **CRE CLI** installed and authenticated (`cre auth login`)
- **Contracts deployed** on Sepolia (deployer script runs separately)
- **API server** running (locally or on Render)
- **4 funded Sepolia wallets** (Lender, Borrower, Bidder A, Bidder B) — each needs ~0.01 ETH for gas
- **Plaid sandbox credentials** ([dashboard.plaid.com](https://dashboard.plaid.com))

## Setup

```bash
cd demo
npm install
cp .env.example .env
```

Edit `.env` and fill in all values:

| Variable | Description |
|---|---|
| `RPC_URL` | Sepolia RPC endpoint |
| `API_URL` | LienFi API base URL (e.g. `https://sealbid.onrender.com`) |
| `API_KEY` | API key for authenticated routes |
| `MOCK_USDC_ADDRESS` | Deployed MockUSDC contract |
| `LENDING_POOL_ADDRESS` | Deployed LendingPool contract |
| `LOAN_MANAGER_ADDRESS` | Deployed LoanManager contract |
| `PROPERTY_NFT_ADDRESS` | Deployed PropertyNFT contract |
| `LIENFI_AUCTION_ADDRESS` | Deployed LienFiAuction contract |
| `CL_USDC_ADDRESS` | Deployed clUSDC contract |
| `LENDER_PRIVATE_KEY` | Lender wallet private key (0x-prefixed) |
| `BORROWER_PRIVATE_KEY` | Borrower wallet private key (0x-prefixed) |
| `BIDDER_A_PRIVATE_KEY` | Bidder A wallet private key (0x-prefixed) |
| `BIDDER_B_PRIVATE_KEY` | Bidder B wallet private key (0x-prefixed) |
| `PLAID_CLIENT_ID` | Plaid sandbox client ID |
| `PLAID_SECRET` | Plaid sandbox secret |

### Optional Parameters

These have sensible defaults but can be overridden in `.env`:

| Variable | Default | Description |
|---|---|---|
| `POOL_FUNDING_AMOUNT` | `500000000000` | Lender deposit (500,000 USDC) |
| `LOAN_REQUEST_AMOUNT` | `100000000` | Loan amount ($100 USDC) |
| `LOAN_TENURE_MONTHS` | `360` | Loan tenure in months |
| `LOAN_NONCE` | `10` | Nonce for loan request hash |
| `BID_A_AMOUNT` | `150000000` | Bidder A sealed bid ($150 USDC) |
| `BID_B_AMOUNT` | `120000000` | Bidder B sealed bid ($120 USDC) |
| `BIDDER_DEPOSIT_AMOUNT` | `200000000` | Deposit per bidder ($200 USDC) |
| `PROPERTY_ID` | `PROP-001` | Property identifier for NFT minting |

## Usage

### Run the full demo

```bash
npx tsx src/main.ts
```

### Start fresh (clear checkpoint)

```bash
npx tsx src/main.ts --fresh
```

### Resume from a specific phase

```bash
npx tsx src/main.ts --from c
```

### Run a single phase

```bash
npx tsx src/main.ts --phase f2
```

## Phases

| Phase | Name | What it does |
|---|---|---|
| **A** | Pool Funding | Lender mints USDC, deposits into LendingPool |
| **B** | Property NFT | Borrower verifies property via API, mints PropertyNFT |
| **C** | Credit Assessment | Plaid token generation, loan request via API, CRE credit-assessment workflow, poll for on-chain verdict |
| **D** | Loan Disbursement | Borrower approves NFT collateral, claims loan, USDC disbursed |
| **E** | Repayment | Borrower makes 1 EMI payment, then stops (simulating default) |
| **F1** | Default + Auction | CRE detects missed payments, creates sealed-bid auction on-chain |
| **F2** | Sealed Bidding | Both bidders deposit USDC, sign EIP-712 bids, submit via CRE |
| **F3** | Settlement | Waits for auction deadline, CRE settles Vickrey auction — winner pays second-highest bid |

## Checkpoint System

Progress is automatically saved to `checkpoint.json` after each phase completes. If the script fails mid-run:

1. Fix the issue (e.g. fund a wallet, restart the API)
2. Re-run the script — completed phases are skipped automatically
3. Use `--from <phase>` to restart from a specific phase
4. Use `--fresh` to wipe the checkpoint and start over

## Startup Checks

Before running any phase, the script verifies:

- All 4 wallets have sufficient ETH for gas
- MockUSDC contract is reachable on-chain
- CRE CLI is authenticated
- API server is healthy (with retry for Render cold starts)

## Estimated Runtime

~35-40 minutes total, dominated by waiting for 3 missed EMI periods (default detection) and the auction deadline.

## Troubleshooting

| Issue | Fix |
|---|---|
| `Missing required env var` | Check your `.env` file has all required values |
| `low ETH balance` warning | Fund the wallet with Sepolia ETH from a faucet |
| API phases fail | Ensure the API server is running and `API_URL` is correct |
| `No active auction found` | The create-auction CRE workflow may need a few seconds — re-run with `--from f1` |
| Auction deadline not passed | The script polls automatically — just wait |

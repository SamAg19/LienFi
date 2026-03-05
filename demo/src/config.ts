import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "..", ".env") });

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function requireAddress(name: string): `0x${string}` {
  const val = requireEnv(name);
  if (!/^0x[0-9a-fA-F]{40}$/.test(val))
    throw new Error(`${name} must be a valid 0x-prefixed Ethereum address`);
  return val as `0x${string}`;
}

function requirePrivateKey(name: string): `0x${string}` {
  const val = requireEnv(name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(val))
    throw new Error(`${name} must be a valid 0x-prefixed 32-byte private key`);
  return val as `0x${string}`;
}

export function loadConfig() {
  return {
    rpcUrl: requireEnv("RPC_URL"),
    apiUrl: requireEnv("API_URL"),
    apiKey: requireEnv("API_KEY"),

    // Contract addresses
    mockUsdcAddress: requireAddress("MOCK_USDC_ADDRESS"),
    lendingPoolAddress: requireAddress("LENDING_POOL_ADDRESS"),
    loanManagerAddress: requireAddress("LOAN_MANAGER_ADDRESS"),
    propertyNftAddress: requireAddress("PROPERTY_NFT_ADDRESS"),
    lienFiAuctionAddress: requireAddress("LIENFI_AUCTION_ADDRESS"),
    clUsdcAddress: requireAddress("CL_USDC_ADDRESS"),

    // Actor private keys
    lenderPrivateKey: requirePrivateKey("LENDER_PRIVATE_KEY"),
    borrowerPrivateKey: requirePrivateKey("BORROWER_PRIVATE_KEY"),
    bidderAPrivateKey: requirePrivateKey("BIDDER_A_PRIVATE_KEY"),
    bidderBPrivateKey: requirePrivateKey("BIDDER_B_PRIVATE_KEY"),

    // Plaid
    plaidClientId: requireEnv("PLAID_CLIENT_ID"),
    plaidSecret: requireEnv("PLAID_SECRET"),

    // CRE workflows directory
    creWorkflowsDir: resolve(__dirname, "..", "..", "cre-workflows"),

    // Demo parameters
    poolFundingAmount: BigInt(process.env.POOL_FUNDING_AMOUNT || "500000000000"), // 500k USDC
    loanRequestAmount: process.env.LOAN_REQUEST_AMOUNT || "100000000", // $100 USDC
    loanTenureMonths: Number(process.env.LOAN_TENURE_MONTHS || "360"),
    loanNonce: Number(process.env.LOAN_NONCE || "10"),
    bidAAmount: process.env.BID_A_AMOUNT || "150000000", // $150
    bidBAmount: process.env.BID_B_AMOUNT || "120000000", // $120
    bidderDepositAmount: BigInt(process.env.BIDDER_DEPOSIT_AMOUNT || "200000000"), // $200 each
    propertyId: process.env.PROPERTY_ID || "PROP-001",
  } as const;
}

export type Config = ReturnType<typeof loadConfig>;

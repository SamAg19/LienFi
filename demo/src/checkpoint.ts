import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHECKPOINT_PATH = resolve(__dirname, "..", "checkpoint.json");

export interface Checkpoint {
  phaseA?: {
    step?: number;
    mintTxHash?: string;
    approveTxHash?: string;
    depositTxHash?: string;
    completedAt?: string;
  };
  phaseB?: {
    step?: number;
    tokenId?: number;
    metadataHash?: string;
    mintTxHash?: string;
    completedAt?: string;
  };
  phaseC?: {
    step?: number;
    plaidAccessToken?: string;
    requestHash?: string;
    submitTxHash?: string;
    completedAt?: string;
  };
  phaseD?: {
    step?: number;
    loanId?: number;
    approveTxHash?: string;
    claimTxHash?: string;
    completedAt?: string;
  };
  phaseE?: {
    step?: number;
    repaymentCount?: number;
    lastRepayTxHash?: string;
    stoppedAt?: string;
    completedAt?: string;
  };
  phaseF1?: {
    step?: number;
    auctionId?: string;
    auctionDeadline?: string;
    reservePrice?: string;
    completedAt?: string;
  };
  phaseF2?: {
    step?: number;
    bidderADepositTxHash?: string;
    bidderBDepositTxHash?: string;
    bidderABidSubmitted?: boolean;
    bidderBBidSubmitted?: boolean;
    bidCount?: number;
    completedAt?: string;
  };
  phaseF3?: {
    step?: number;
    winner?: string;
    settledPrice?: string;
    completedAt?: string;
  };
}

export function loadCheckpoint(): Checkpoint {
  if (!existsSync(CHECKPOINT_PATH)) return {};
  const raw = readFileSync(CHECKPOINT_PATH, "utf-8");
  return JSON.parse(raw) as Checkpoint;
}

export function saveCheckpoint(cp: Checkpoint): void {
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

export function clearCheckpoint(): void {
  if (existsSync(CHECKPOINT_PATH)) unlinkSync(CHECKPOINT_PATH);
}

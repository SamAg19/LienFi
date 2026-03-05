import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHECKPOINT_PATH = resolve(__dirname, "..", "checkpoint.json");

export interface Checkpoint {
  phaseA?: {
    depositTxHash: string;
    completedAt: string;
  };
  phaseB?: {
    tokenId: number;
    metadataHash: string;
    mintTxHash: string;
    completedAt: string;
  };
  phaseC?: {
    plaidAccessToken: string;
    requestHash: string;
    submitTxHash: string;
    completedAt: string;
  };
  phaseD?: {
    loanId: number;
    claimTxHash: string;
    completedAt: string;
  };
  phaseE?: {
    repaymentCount: number;
    lastRepayTxHash: string;
    completedAt: string;
  };
  phaseF1?: {
    auctionId: string;
    auctionDeadline: string;
    reservePrice: string;
    completedAt: string;
  };
  phaseF2?: {
    bidderADepositTxHash?: string;
    bidderBDepositTxHash?: string;
    bidCount?: number;
    completedAt?: string;
  };
  phaseF3?: {
    winner: string;
    settledPrice: string;
    completedAt: string;
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

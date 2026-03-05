import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_OUT = resolve(__dirname, "..", "..", "contracts", "out");

function loadAbi(contractDir: string, contractName: string) {
  const path = resolve(CONTRACTS_OUT, contractDir, `${contractName}.json`);
  const artifact = JSON.parse(readFileSync(path, "utf-8"));
  return artifact.abi;
}

export const MockUSDCABI = loadAbi("MockUSDC.sol", "MockUSDC");
export const LendingPoolABI = loadAbi("LendingPool.sol", "LendingPool");
export const LoanManagerABI = loadAbi("LoanManager.sol", "LoanManager");
export const PropertyNFTABI = loadAbi("PropertyNFT.sol", "PropertyNFT");
export const LienFiAuctionABI = loadAbi("LienFiAuction.sol", "LienFiAuction");
export const ClUSDCABI = loadAbi("clUSDC.sol", "clUSDC");

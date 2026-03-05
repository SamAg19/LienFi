import type { Config } from "../config.js";
import type { Clients } from "../clients.js";
import type { Checkpoint } from "../checkpoint.js";
import { saveCheckpoint } from "../checkpoint.js";
import { createLogger } from "../logger.js";
import { shortAddr, formatUsdc } from "../utils.js";
import { PropertyNFTABI, LoanManagerABI, MockUSDCABI } from "../abis.js";

export async function phaseD(
  config: Config,
  clients: Clients,
  checkpoint: Checkpoint
): Promise<void> {
  const log = createLogger("D");
  log.header();

  if (checkpoint.phaseD?.completedAt) {
    log.info("Already completed, skipping.");
    return;
  }

  const borrowerAddr = clients.borrower.account.address;
  const tokenId = checkpoint.phaseB?.tokenId;
  const requestHash = checkpoint.phaseC?.requestHash;
  if (!tokenId) throw new Error("Phase B must complete first (need tokenId)");
  if (!requestHash) throw new Error("Phase C must complete first (need requestHash)");

  // Step 1: Approve LoanManager for PropertyNFT
  log.step(1, 4, `Approving LoanManager for PropertyNFT #${tokenId}`);
  const approveHash = await clients.borrower.writeContract({
    address: config.propertyNftAddress,
    abi: PropertyNFTABI,
    functionName: "approve",
    args: [config.loanManagerAddress, BigInt(tokenId)],
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: approveHash });
  log.tx("approve", approveHash);

  // Step 2: Claim loan
  log.step(2, 4, "Claiming loan (disbursing USDC)");
  const claimHash = await clients.borrower.writeContract({
    address: config.loanManagerAddress,
    abi: LoanManagerABI,
    functionName: "claimLoan",
    args: [requestHash as `0x${string}`],
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: claimHash });
  log.tx("claimLoan", claimHash);

  // Step 3: Verify loan is active
  log.step(3, 4, "Verifying loan state");
  const loan = (await clients.publicClient.readContract({
    address: config.loanManagerAddress,
    abi: LoanManagerABI,
    functionName: "getLoan",
    args: [1n],
  })) as any[];

  // Loan struct: (loanId, borrower, tokenId, principal, interestRateBps, tenureMonths, emiAmount, nextDueDate, missedPayments, remainingPrincipal, status)
  const loanId = Number(loan[0]);
  const status = Number(loan[10]);
  const principal = BigInt(loan[3]);
  const emiAmount = BigInt(loan[6]);

  log.verify("Loan ID", String(loanId));
  log.verify("Status", status === 0 ? "ACTIVE" : String(status));
  log.verify("Principal", formatUsdc(principal));
  log.verify("EMI Amount", formatUsdc(emiAmount));

  if (status !== 0) {
    throw new Error(`Loan status is ${status}, expected 0 (ACTIVE)`);
  }

  // Step 4: Verify USDC disbursed to borrower
  log.step(4, 4, "Verifying USDC disbursement");
  const borrowerBalance = (await clients.publicClient.readContract({
    address: config.mockUsdcAddress,
    abi: MockUSDCABI,
    functionName: "balanceOf",
    args: [borrowerAddr],
  })) as bigint;
  log.verify("Borrower USDC balance", formatUsdc(borrowerBalance));

  const nftOwner = (await clients.publicClient.readContract({
    address: config.propertyNftAddress,
    abi: PropertyNFTABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  })) as `0x${string}`;
  log.verify("NFT now held by", shortAddr(nftOwner));

  checkpoint.phaseD = {
    loanId,
    claimTxHash: claimHash,
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success(`Loan #${loanId} disbursed — ${formatUsdc(principal)} to borrower`);
}

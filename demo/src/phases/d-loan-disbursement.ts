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

  const done = checkpoint.phaseD?.step ?? 0;

  // Step 1: Approve LoanManager for PropertyNFT
  if (done < 1) {
    log.step(1, 4, `Approving LoanManager for PropertyNFT #${tokenId}`);
    const approveHash = await clients.borrower.writeContract({
      address: config.propertyNftAddress,
      abi: PropertyNFTABI,
      functionName: "approve",
      args: [config.loanManagerAddress, BigInt(tokenId)],
    });
    await clients.publicClient.waitForTransactionReceipt({ hash: approveHash });
    log.tx("approve", approveHash);

    checkpoint.phaseD = { ...checkpoint.phaseD, step: 1, approveTxHash: approveHash };
    saveCheckpoint(checkpoint);
  } else {
    log.step(1, 4, "Approve LoanManager for PropertyNFT — already done, skipping");
  }

  // Step 2: Claim loan
  if (done < 2) {
    log.step(2, 4, "Claiming loan (disbursing USDC)");
    const claimHash = await clients.borrower.writeContract({
      address: config.loanManagerAddress,
      abi: LoanManagerABI,
      functionName: "claimLoan",
      args: [requestHash as `0x${string}`],
    });
    await clients.publicClient.waitForTransactionReceipt({ hash: claimHash });
    log.tx("claimLoan", claimHash);

    checkpoint.phaseD = { ...checkpoint.phaseD, step: 2, claimTxHash: claimHash };
    saveCheckpoint(checkpoint);
  } else {
    log.step(2, 4, "Claim loan — already done, skipping");
  }

  // Step 3: Verify loan is active
  log.step(3, 4, "Verifying loan state");
  const borrowerAddr_ = clients.borrower.account.address;
  const activeLoanId = (await clients.publicClient.readContract({
    address: config.loanManagerAddress,
    abi: LoanManagerABI,
    functionName: "getActiveLoanId",
    args: [borrowerAddr_],
  })) as bigint;

  if (activeLoanId === 0n) {
    throw new Error("No active loan found for borrower");
  }

  const loan = (await clients.publicClient.readContract({
    address: config.loanManagerAddress,
    abi: LoanManagerABI,
    functionName: "getLoan",
    args: [activeLoanId],
  })) as any;

  const loanId = Number(activeLoanId);
  const status = Number(loan.status);
  const principal = BigInt(loan.principal);
  const emiAmount = BigInt(loan.emiAmount);

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
    ...checkpoint.phaseD,
    step: 4,
    loanId,
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success(`Loan #${loanId} disbursed — ${formatUsdc(principal)} to borrower`);
}

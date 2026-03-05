import type { Config } from "../config.js";
import type { Clients } from "../clients.js";
import type { Checkpoint } from "../checkpoint.js";
import { saveCheckpoint } from "../checkpoint.js";
import { createLogger } from "../logger.js";
import { formatUsdc } from "../utils.js";
import { MockUSDCABI, LoanManagerABI } from "../abis.js";

export async function phaseE(
  config: Config,
  clients: Clients,
  checkpoint: Checkpoint
): Promise<void> {
  const log = createLogger("E");
  log.header();

  if (checkpoint.phaseE?.completedAt) {
    log.info("Already completed, skipping.");
    return;
  }

  const loanId = checkpoint.phaseD?.loanId;
  if (!loanId) throw new Error("Phase D must complete first (need loanId)");

  // Read EMI amount from loan
  const loan = (await clients.publicClient.readContract({
    address: config.loanManagerAddress,
    abi: LoanManagerABI,
    functionName: "getLoan",
    args: [BigInt(loanId)],
  })) as any[];

  const emiAmount = BigInt(loan[6]);
  const repaymentCount = 1; // Make 1 payment to show the system works, then stop

  // Step 1: Approve LoanManager for USDC repayment
  const approvalAmount = emiAmount * BigInt(repaymentCount + 1); // buffer
  log.step(1, 3, `Approving LoanManager for ${formatUsdc(approvalAmount)}`);
  const approveHash = await clients.borrower.writeContract({
    address: config.mockUsdcAddress,
    abi: MockUSDCABI,
    functionName: "approve",
    args: [config.loanManagerAddress, approvalAmount],
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: approveHash });
  log.tx("approve", approveHash);

  // Step 2: Make repayment(s)
  let lastRepayTxHash = "";
  for (let i = 0; i < repaymentCount; i++) {
    log.step(2, 3, `Repaying EMI #${i + 1} (${formatUsdc(emiAmount)})`);
    const repayHash = await clients.borrower.writeContract({
      address: config.loanManagerAddress,
      abi: LoanManagerABI,
      functionName: "repay",
      args: [BigInt(loanId)],
    });
    await clients.publicClient.waitForTransactionReceipt({ hash: repayHash });
    log.tx(`repay-${i + 1}`, repayHash);
    lastRepayTxHash = repayHash;

    // Read updated loan state
    const updatedLoan = (await clients.publicClient.readContract({
      address: config.loanManagerAddress,
      abi: LoanManagerABI,
      functionName: "getLoan",
      args: [BigInt(loanId)],
    })) as any[];

    log.verify("Remaining principal", formatUsdc(BigInt(updatedLoan[9])));
    log.verify(
      "Next due date",
      new Date(Number(updatedLoan[7]) * 1000).toISOString()
    );
  }

  // Step 3: Stop paying (simulate default)
  log.step(3, 3, "Borrower stops paying — simulating default");
  log.info("No more repayments will be made. Loan will enter default.");

  checkpoint.phaseE = {
    repaymentCount,
    lastRepayTxHash,
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success(`${repaymentCount} EMI payment(s) made, then borrower defaulted`);
}

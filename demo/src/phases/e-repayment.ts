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

  const done = checkpoint.phaseE?.step ?? 0;

  // Read EMI amount from loan
  const loan = (await clients.publicClient.readContract({
    address: config.loanManagerAddress,
    abi: LoanManagerABI,
    functionName: "getLoan",
    args: [BigInt(loanId)],
  })) as any;

  const emiAmount = BigInt(loan.emiAmount);
  const repaymentCount = 1;

  // Step 1: Approve LoanManager for USDC repayment
  if (done < 1) {
    const approvalAmount = emiAmount * BigInt(repaymentCount + 1);
    log.step(1, 3, `Approving LoanManager for ${formatUsdc(approvalAmount)}`);
    const approveHash = await clients.borrower.writeContract({
      address: config.mockUsdcAddress,
      abi: MockUSDCABI,
      functionName: "approve",
      args: [config.loanManagerAddress, approvalAmount],
    });
    await clients.publicClient.waitForTransactionReceipt({ hash: approveHash });
    log.tx("approve", approveHash);

    checkpoint.phaseE = { ...checkpoint.phaseE, step: 1 };
    saveCheckpoint(checkpoint);
  } else {
    log.step(1, 3, "Approve LoanManager — already done, skipping");
  }

  // Step 2: Make repayment(s)
  if (done < 2) {
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

      const updatedLoan = (await clients.publicClient.readContract({
        address: config.loanManagerAddress,
        abi: LoanManagerABI,
        functionName: "getLoan",
        args: [BigInt(loanId)],
      })) as any;

      log.verify("Remaining principal", formatUsdc(BigInt(updatedLoan.remainingPrincipal)));
      log.verify(
        "Next due date",
        new Date(Number(updatedLoan.nextDueDate) * 1000).toISOString()
      );
    }

    checkpoint.phaseE = { ...checkpoint.phaseE, step: 2, repaymentCount, lastRepayTxHash };
    saveCheckpoint(checkpoint);
  } else {
    log.step(2, 3, "EMI repayments — already done, skipping");
  }

  // Step 3: Stop paying and wait for default threshold
  // Default formula (from CRE workflow): now > nextDueDate + (3 × EMI_PERIOD)
  // We read the actual nextDueDate from the contract to compute the exact wait.
  if (done < 3) {
    // Re-read loan to get the current nextDueDate after repayment(s)
    const loanAfterRepay = (await clients.publicClient.readContract({
      address: config.loanManagerAddress,
      abi: LoanManagerABI,
      functionName: "getLoan",
      args: [BigInt(loanId)],
    })) as any;

    const nextDueDate = Number(loanAfterRepay.nextDueDate);
    const EMI_PERIOD = Number(await clients.publicClient.readContract({
      address: config.loanManagerAddress,
      abi: LoanManagerABI,
      functionName: "EMI_PERIOD",
    }) as bigint);
    const DEFAULT_THRESHOLD_PERIODS = 3;
    const defaultThresholdUnix = nextDueDate + DEFAULT_THRESHOLD_PERIODS * EMI_PERIOD;
    // Add 60s buffer to ensure we're safely past the threshold
    const targetUnix = defaultThresholdUnix + 60;
    const waitSec = targetUnix - Math.floor(Date.now() / 1000);

    log.step(3, 3, `Borrower stops paying — waiting ~${Math.ceil(waitSec / 60)} minutes for default threshold`);
    log.info(`nextDueDate=${new Date(nextDueDate * 1000).toISOString()}, default at ${new Date(defaultThresholdUnix * 1000).toISOString()}`);

    const endTime = targetUnix * 1000;

    while (Date.now() < endTime) {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      process.stdout.write(`\r  ⏳ ${mins}m ${secs.toString().padStart(2, "0")}s remaining...`);

      // Ping API every 30s to keep Render warm
      try {
        await fetch(`${config.apiUrl}/health`);
      } catch { /* ignore */ }

      await new Promise((r) => setTimeout(r, 30_000));
    }
    process.stdout.write("\r  ✓ Default threshold reached.                    \n");
  } else {
    log.step(3, 3, "Default wait — already done, skipping");
  }

  checkpoint.phaseE = {
    ...checkpoint.phaseE,
    step: 3,
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success(`${repaymentCount} EMI payment(s) made, then borrower defaulted`);
}

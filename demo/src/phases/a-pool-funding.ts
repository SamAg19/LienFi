import type { Config } from "../config.js";
import type { Clients } from "../clients.js";
import type { Checkpoint } from "../checkpoint.js";
import { saveCheckpoint } from "../checkpoint.js";
import { createLogger } from "../logger.js";
import { formatUsdc, shortAddr } from "../utils.js";
import { MockUSDCABI, LendingPoolABI, ClUSDCABI } from "../abis.js";

export async function phaseA(
  config: Config,
  clients: Clients,
  checkpoint: Checkpoint
): Promise<void> {
  const log = createLogger("A");
  log.header();

  if (checkpoint.phaseA?.completedAt) {
    log.info("Already completed, skipping.");
    return;
  }

  const lenderAddr = clients.lender.account.address;
  const amount = config.poolFundingAmount;

  // Step 1: Mint MockUSDC to lender
  log.step(1, 4, `Minting ${formatUsdc(amount)} to Lender (${shortAddr(lenderAddr)})`);
  const mintHash = await clients.lender.writeContract({
    address: config.mockUsdcAddress,
    abi: MockUSDCABI,
    functionName: "mint",
    args: [lenderAddr, amount],
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: mintHash });
  log.tx("mint", mintHash);

  // Step 2: Approve LendingPool
  log.step(2, 4, `Approving LendingPool for ${formatUsdc(amount)}`);
  const approveHash = await clients.lender.writeContract({
    address: config.mockUsdcAddress,
    abi: MockUSDCABI,
    functionName: "approve",
    args: [config.lendingPoolAddress, amount],
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: approveHash });
  log.tx("approve", approveHash);

  // Step 3: Deposit into LendingPool
  log.step(3, 4, `Depositing ${formatUsdc(amount)} into LendingPool`);
  const depositHash = await clients.lender.writeContract({
    address: config.lendingPoolAddress,
    abi: LendingPoolABI,
    functionName: "deposit",
    args: [amount],
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: depositHash });
  log.tx("deposit", depositHash);

  // Step 4: Verify
  log.step(4, 4, "Verifying pool state");
  const liquidity = (await clients.publicClient.readContract({
    address: config.lendingPoolAddress,
    abi: LendingPoolABI,
    functionName: "availableLiquidity",
  })) as bigint;
  log.verify("Pool liquidity", formatUsdc(liquidity));

  const clBalance = (await clients.publicClient.readContract({
    address: config.clUsdcAddress,
    abi: ClUSDCABI,
    functionName: "balanceOf",
    args: [lenderAddr],
  })) as bigint;
  log.verify("Lender clUSDC balance", formatUsdc(clBalance));

  checkpoint.phaseA = {
    depositTxHash: depositHash,
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success("Pool funded successfully");
}

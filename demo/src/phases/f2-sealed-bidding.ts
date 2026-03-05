import type { Config } from "../config.js";
import type { Clients } from "../clients.js";
import type { Checkpoint } from "../checkpoint.js";
import { saveCheckpoint } from "../checkpoint.js";
import { createLogger } from "../logger.js";
import { shortAddr, formatUsdc, waitForFinalization, sleep } from "../utils.js";
import { MockUSDCABI, LienFiAuctionABI } from "../abis.js";
import { runCREWorkflow } from "../cre.js";
import type { WalletClient } from "viem";

const BID_TYPES = {
  Bid: [
    { name: "auctionId", type: "bytes32" as const },
    { name: "bidder", type: "address" as const },
    { name: "amount", type: "uint256" as const },
    { name: "nonce", type: "uint256" as const },
  ],
} as const;

async function setupBidder(
  label: string,
  walletClient: WalletClient,
  config: Config,
  clients: Clients,
  depositAmount: bigint,
  lockUntil: bigint,
  nullifierHash: bigint,
  log: ReturnType<typeof createLogger>
): Promise<string> {
  const bidderAddr = walletClient.account!.address;
  log.info(`--- Setting up ${label} (${shortAddr(bidderAddr)}) ---`);

  // Mint MockUSDC
  log.info(`  Minting ${formatUsdc(depositAmount)} to ${label}`);
  const mintHash = await walletClient.writeContract({
    address: config.mockUsdcAddress,
    abi: MockUSDCABI,
    functionName: "mint",
    args: [bidderAddr, depositAmount],
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: mintHash });

  // Approve LienFiAuction
  log.info(`  Approving LienFiAuction for ${formatUsdc(depositAmount)}`);
  const approveHash = await walletClient.writeContract({
    address: config.mockUsdcAddress,
    abi: MockUSDCABI,
    functionName: "approve",
    args: [config.lienFiAuctionAddress, depositAmount],
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: approveHash });

  // Deposit to pool with World ID dummy proof
  log.info(`  Depositing ${formatUsdc(depositAmount)} to auction pool`);
  const depositHash = await walletClient.writeContract({
    address: config.lienFiAuctionAddress,
    abi: LienFiAuctionABI,
    functionName: "depositToPool",
    args: [
      config.mockUsdcAddress,
      lockUntil,
      depositAmount,
      1n, // root (dummy for MockWorldIDRouter)
      nullifierHash, // unique per bidder
      [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n] as readonly [
        bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint
      ],
    ],
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: depositHash });
  log.tx(`${label} deposit`, depositHash);

  // Verify pool balance
  const poolBal = (await clients.publicClient.readContract({
    address: config.lienFiAuctionAddress,
    abi: LienFiAuctionABI,
    functionName: "poolBalance",
    args: [bidderAddr, config.mockUsdcAddress],
  })) as bigint;
  log.verify(`${label} pool balance`, formatUsdc(poolBal));

  return depositHash;
}

async function signBid(
  walletClient: WalletClient,
  config: Config,
  auctionId: `0x${string}`,
  bidAmount: string,
  nonce: number,
  auctionDeadline: number
) {
  const bidder = walletClient.account!.address;

  const signature = await walletClient.signTypedData({
    domain: {
      name: "LienFi",
      version: "1",
      chainId: 11155111,
      verifyingContract: config.lienFiAuctionAddress,
    },
    types: BID_TYPES,
    primaryType: "Bid",
    message: {
      auctionId,
      bidder,
      amount: BigInt(bidAmount),
      nonce: BigInt(nonce),
    },
  });

  return {
    auctionId,
    bidder,
    amount: bidAmount,
    nonce,
    signature,
    auctionDeadline,
  };
}

export async function phaseF2(
  config: Config,
  clients: Clients,
  checkpoint: Checkpoint
): Promise<void> {
  const log = createLogger("F2");
  log.header();

  if (checkpoint.phaseF2?.completedAt) {
    log.info("Already completed, skipping.");
    return;
  }

  const auctionId = checkpoint.phaseF1?.auctionId as `0x${string}` | undefined;
  const auctionDeadline = checkpoint.phaseF1?.auctionDeadline;
  if (!auctionId) throw new Error("Phase F1 must complete first (need auctionId)");
  if (!auctionDeadline) throw new Error("Phase F1 must complete first (need auctionDeadline)");

  const deadlineNum = Number(auctionDeadline);
  const lockUntil = BigInt(deadlineNum + 86400); // deadline + 1 day

  // Step 1: Set up both bidders
  log.step(1, 4, "Setting up Bidder A and Bidder B");

  const depositHashA = await setupBidder(
    "Bidder A",
    clients.bidderA,
    config,
    clients,
    config.bidderDepositAmount,
    lockUntil,
    BigInt(Date.now()), // unique nullifierHash
    log
  );

  await sleep(3000); // brief pause to avoid nonce issues

  const depositHashB = await setupBidder(
    "Bidder B",
    clients.bidderB,
    config,
    clients,
    config.bidderDepositAmount,
    lockUntil,
    BigInt(Date.now() + 1), // different nullifierHash
    log
  );

  checkpoint.phaseF2 = {
    bidderADepositTxHash: depositHashA,
    bidderBDepositTxHash: depositHashB,
  };
  saveCheckpoint(checkpoint);

  // Step 2: Wait for finalization of deposits
  log.step(2, 4, "Waiting for finalization of bidder deposits");
  await waitForFinalization(
    clients.publicClient,
    depositHashB as `0x${string}`,
    "bidder deposits"
  );

  // Step 3: Generate and submit signed bids via CRE
  log.step(3, 4, "Generating EIP-712 signed bids and submitting via CRE");

  // Bidder A — higher bid
  log.info(`--- Bidder A bid: ${formatUsdc(config.bidAAmount)} ---`);
  const bidPayloadA = await signBid(
    clients.bidderA,
    config,
    auctionId,
    config.bidAAmount,
    1,
    deadlineNum
  );

  const creResultA = await runCREWorkflow({
    creDir: config.creWorkflowsDir,
    workflowDir: "bid-workflow",
    httpPayload: bidPayloadA,
    broadcast: true,
  });

  if (!creResultA.success) {
    log.error("Bidder A CRE workflow failed:");
    console.log(creResultA.stdout);
    console.error(creResultA.stderr);
    throw new Error("Bid CRE workflow failed for Bidder A");
  }
  log.info("Bidder A bid submitted");

  // Bidder B — lower bid
  log.info(`--- Bidder B bid: ${formatUsdc(config.bidBAmount)} ---`);
  const bidPayloadB = await signBid(
    clients.bidderB,
    config,
    auctionId,
    config.bidBAmount,
    1,
    deadlineNum
  );

  const creResultB = await runCREWorkflow({
    creDir: config.creWorkflowsDir,
    workflowDir: "bid-workflow",
    httpPayload: bidPayloadB,
    broadcast: true,
  });

  if (!creResultB.success) {
    log.error("Bidder B CRE workflow failed:");
    console.log(creResultB.stdout);
    console.error(creResultB.stderr);
    throw new Error("Bid CRE workflow failed for Bidder B");
  }
  log.info("Bidder B bid submitted");

  // Step 4: Verify bid count on-chain
  log.step(4, 4, "Verifying bids registered on-chain");
  const bidCount = (await clients.publicClient.readContract({
    address: config.lienFiAuctionAddress,
    abi: LienFiAuctionABI,
    functionName: "getBidCount",
    args: [auctionId],
  })) as bigint;
  log.verify("Bid count", String(bidCount));

  if (bidCount < 2n) {
    log.error(`Expected at least 2 bids, got ${bidCount}. CRE may not have written on-chain yet.`);
  }

  checkpoint.phaseF2 = {
    ...checkpoint.phaseF2,
    bidCount: Number(bidCount),
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success("Both sealed bids submitted");
}

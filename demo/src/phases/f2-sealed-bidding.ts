import type { Config } from "../config.js";
import type { Clients } from "../clients.js";
import type { Checkpoint } from "../checkpoint.js";
import { saveCheckpoint } from "../checkpoint.js";
import { createLogger } from "../logger.js";
import { shortAddr, formatUsdc, sleep } from "../utils.js";
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
  const lockUntil = BigInt(deadlineNum + 86400);
  const done = checkpoint.phaseF2?.step ?? 0;

  // Step 1: Set up Bidder A
  if (done < 1) {
    log.step(1, 5, "Setting up Bidder A");

    const depositHashA = await setupBidder(
      "Bidder A",
      clients.bidderA,
      config,
      clients,
      config.bidderDepositAmount,
      lockUntil,
      BigInt(Date.now()),
      log
    );

    checkpoint.phaseF2 = { ...checkpoint.phaseF2, step: 1, bidderADepositTxHash: depositHashA };
    saveCheckpoint(checkpoint);
  } else {
    log.step(1, 5, "Bidder A setup — already done, skipping");
  }

  // Step 2: Set up Bidder B
  if (done < 2) {
    log.step(2, 5, "Setting up Bidder B");

    await sleep(3000);

    const depositHashB = await setupBidder(
      "Bidder B",
      clients.bidderB,
      config,
      clients,
      config.bidderDepositAmount,
      lockUntil,
      BigInt(Date.now() + 1),
      log
    );

    checkpoint.phaseF2 = { ...checkpoint.phaseF2, step: 2, bidderBDepositTxHash: depositHashB };
    saveCheckpoint(checkpoint);
  } else {
    log.step(2, 5, "Bidder B setup — already done, skipping");
  }

  // Step 3: Submit Bidder A's signed bid via CRE
  if (done < 3) {
    log.step(3, 5, `Submitting Bidder A bid: ${formatUsdc(config.bidAAmount)}`);

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

    checkpoint.phaseF2 = { ...checkpoint.phaseF2, step: 3, bidderABidSubmitted: true };
    saveCheckpoint(checkpoint);
  } else {
    log.step(3, 5, "Bidder A bid — already done, skipping");
  }

  // Step 4: Submit Bidder B's signed bid via CRE
  if (done < 4) {
    log.step(4, 5, `Submitting Bidder B bid: ${formatUsdc(config.bidBAmount)}`);

    await sleep(10_000);

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

    checkpoint.phaseF2 = { ...checkpoint.phaseF2, step: 4, bidderBBidSubmitted: true };
    saveCheckpoint(checkpoint);
  } else {
    log.step(4, 5, "Bidder B bid — already done, skipping");
  }

  // Step 5: Verify bid count on-chain
  log.step(5, 5, "Verifying bids registered on-chain");
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
    step: 5,
    bidCount: Number(bidCount),
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success("Both sealed bids submitted");
}

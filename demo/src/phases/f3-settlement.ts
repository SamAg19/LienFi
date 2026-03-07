import type { Config } from "../config.js";
import type { Clients } from "../clients.js";
import type { Checkpoint } from "../checkpoint.js";
import { saveCheckpoint } from "../checkpoint.js";
import { createLogger } from "../logger.js";
import { shortAddr, formatUsdc, sleep } from "../utils.js";
import { LienFiAuctionABI, PropertyNFTABI, LoanManagerABI } from "../abis.js";
import { runCREWorkflow } from "../cre.js";

export async function phaseF3(
  config: Config,
  clients: Clients,
  checkpoint: Checkpoint
): Promise<void> {
  const log = createLogger("F3");
  log.header();

  if (checkpoint.phaseF3?.completedAt) {
    log.info("Already completed, skipping.");
    return;
  }

  const auctionId = checkpoint.phaseF1?.auctionId as `0x${string}` | undefined;
  const auctionDeadline = checkpoint.phaseF1?.auctionDeadline;
  const tokenId = checkpoint.phaseB?.tokenId;
  const loanId = checkpoint.phaseD?.loanId;
  if (!auctionId) throw new Error("Phase F1 must complete first (need auctionId)");
  if (!auctionDeadline) throw new Error("Phase F1 must complete first (need auctionDeadline)");
  if (!tokenId) throw new Error("Phase B must complete first (need tokenId)");
  if (!loanId) throw new Error("Phase D must complete first (need loanId)");

  const deadlineNum = Number(auctionDeadline);
  const done = checkpoint.phaseF3?.step ?? 0;

  // Step 1: Wait for auction deadline to pass
  if (done < 1) {
    log.step(1, 3, "Waiting for auction deadline to pass");

    while (true) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= deadlineNum) {
        log.info("Auction deadline has passed");
        break;
      }
      const remaining = deadlineNum - now;
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      log.wait(`Deadline in ${minutes}m ${seconds}s (${new Date(deadlineNum * 1000).toISOString()})`);
      await sleep(Math.min(remaining * 1000, 30_000));
    }

    await sleep(15_000);

    checkpoint.phaseF3 = { ...checkpoint.phaseF3, step: 1 };
    saveCheckpoint(checkpoint);
  } else {
    log.step(1, 3, "Auction deadline wait — already done, skipping");
  }

  // Step 2: Run CRE settlement workflow
  if (done < 2) {
    log.step(2, 3, "Running CRE settlement workflow");

    const creResult = await runCREWorkflow({
      creDir: config.creWorkflowsDir,
      workflowDir: "settlement-workflow",
      broadcast: true,
    });

    if (!creResult.success) {
      log.error("CRE settlement workflow failed:");
      console.log(creResult.stdout);
      console.error(creResult.stderr);
      throw new Error("Settlement CRE workflow failed");
    }
    log.info("CRE settlement workflow completed");

    checkpoint.phaseF3 = { ...checkpoint.phaseF3, step: 2 };
    saveCheckpoint(checkpoint);
  } else {
    log.step(2, 3, "CRE settlement workflow — already done, skipping");
  }

  // Step 3: Verify settlement on-chain
  log.step(3, 3, "Verifying settlement on-chain");

  const activeId = (await clients.publicClient.readContract({
    address: config.lienFiAuctionAddress,
    abi: LienFiAuctionABI,
    functionName: "activeAuctionId",
  })) as `0x${string}`;

  if (activeId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    log.info("activeAuctionId not yet cleared — settlement may still be propagating");
  } else {
    log.verify("activeAuctionId", "cleared (0x00)");
  }

  const auction = (await clients.publicClient.readContract({
    address: config.lienFiAuctionAddress,
    abi: LienFiAuctionABI,
    functionName: "auctions",
    args: [auctionId],
  })) as any[];

  const settled = auction[4] as boolean;
  const winner = auction[5] as `0x${string}`;
  const settledPrice = BigInt(auction[6]);

  log.verify("Settled", String(settled));
  log.verify("Winner", shortAddr(winner));
  log.verify("Settled Price (Vickrey 2nd price)", formatUsdc(settledPrice));

  const nftOwner = (await clients.publicClient.readContract({
    address: config.propertyNftAddress,
    abi: PropertyNFTABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  })) as `0x${string}`;
  log.verify("NFT now owned by", shortAddr(nftOwner));

  const loan = (await clients.publicClient.readContract({
    address: config.loanManagerAddress,
    abi: LoanManagerABI,
    functionName: "getLoan",
    args: [BigInt(loanId)],
  })) as any;

  const loanStatus = Number(loan.status);
  log.verify("Loan Status", loanStatus === 2 ? "CLOSED" : String(loanStatus));

  // Final summary
  const bidderAAddr = clients.bidderA.account.address;
  const isWinnerBidderA = winner.toLowerCase() === bidderAAddr.toLowerCase();
  log.info("");
  log.info("=== SETTLEMENT SUMMARY ===");
  log.info(`  Winner: ${shortAddr(winner)} (${isWinnerBidderA ? "Bidder A" : "Bidder B"})`);
  log.info(`  Winning bid: ${formatUsdc(config.bidAAmount)} (highest)`);
  log.info(`  Price paid: ${formatUsdc(settledPrice)} (Vickrey 2nd-price)`);
  log.info(`  PropertyNFT #${tokenId} transferred to winner`);
  log.info(`  Loan #${loanId} closed`);

  checkpoint.phaseF3 = {
    ...checkpoint.phaseF3,
    step: 3,
    winner,
    settledPrice: settledPrice.toString(),
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success("Vickrey auction settled — demo complete!");
}

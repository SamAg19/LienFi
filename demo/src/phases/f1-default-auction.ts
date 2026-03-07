import type { Config } from "../config.js";
import type { Clients } from "../clients.js";
import type { Checkpoint } from "../checkpoint.js";
import { saveCheckpoint } from "../checkpoint.js";
import { createLogger } from "../logger.js";
import { shortAddr, formatUsdc } from "../utils.js";
import { LoanManagerABI, LienFiAuctionABI, PropertyNFTABI } from "../abis.js";
import { runCREWorkflow } from "../cre.js";

export async function phaseF1(
  config: Config,
  clients: Clients,
  checkpoint: Checkpoint
): Promise<void> {
  const log = createLogger("F1");
  log.header();

  if (checkpoint.phaseF1?.completedAt) {
    log.info("Already completed, skipping.");
    return;
  }

  const loanId = checkpoint.phaseD?.loanId;
  const tokenId = checkpoint.phaseB?.tokenId;
  if (!loanId) throw new Error("Phase D must complete first (need loanId)");
  if (!tokenId) throw new Error("Phase B must complete first (need tokenId)");

  const done = checkpoint.phaseF1?.step ?? 0;

  // Step 1: Run CRE create-auction workflow
  if (done < 1) {
    log.step(1, 3, "Running CRE create-auction workflow");
    log.info(
      "NOTE: create-auction-workflow/main.ts must have the testing override applied (defaultThreshold = 0n)"
    );

    const creResult = await runCREWorkflow({
      creDir: config.creWorkflowsDir,
      workflowDir: "create-auction-workflow",
      broadcast: true,
    });

    if (!creResult.success) {
      log.error("CRE workflow failed:");
      console.log(creResult.stdout);
      console.error(creResult.stderr);
      throw new Error("Create-auction CRE workflow failed");
    }
    log.info("CRE workflow completed");

    checkpoint.phaseF1 = { ...checkpoint.phaseF1, step: 1 };
    saveCheckpoint(checkpoint);
  } else {
    log.step(1, 3, "CRE create-auction workflow — already done, skipping");
  }

  // Step 2: Verify auction created on-chain
  log.step(2, 3, "Verifying auction on-chain");

  const auctionId = (await clients.publicClient.readContract({
    address: config.lienFiAuctionAddress,
    abi: LienFiAuctionABI,
    functionName: "activeAuctionId",
  })) as `0x${string}`;

  if (auctionId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("No active auction found — create-auction workflow may not have written on-chain yet");
  }
  log.verify("Auction ID", auctionId);

  const auction = (await clients.publicClient.readContract({
    address: config.lienFiAuctionAddress,
    abi: LienFiAuctionABI,
    functionName: "auctions",
    args: [auctionId],
  })) as any[];

  const deadline = BigInt(auction[2]);
  const reservePrice = BigInt(auction[3]);

  log.verify("Seller", shortAddr(auction[0]));
  log.verify("Token ID", String(auction[1]));
  log.verify("Deadline", new Date(Number(deadline) * 1000).toISOString());
  log.verify("Reserve Price", formatUsdc(reservePrice));
  log.verify("Settled", String(auction[4]));

  // Step 3: Verify loan is defaulted and NFT transferred
  log.step(3, 3, "Verifying loan default state");

  const loan = (await clients.publicClient.readContract({
    address: config.loanManagerAddress,
    abi: LoanManagerABI,
    functionName: "getLoan",
    args: [BigInt(loanId)],
  })) as any;

  const loanStatus = Number(loan.status);
  log.verify("Loan Status", loanStatus === 1 ? "DEFAULTED" : String(loanStatus));

  const nftOwner = (await clients.publicClient.readContract({
    address: config.propertyNftAddress,
    abi: PropertyNFTABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  })) as `0x${string}`;
  log.verify("NFT held by", `${shortAddr(nftOwner)} (LienFiAuction)`);

  checkpoint.phaseF1 = {
    ...checkpoint.phaseF1,
    step: 3,
    auctionId,
    auctionDeadline: deadline.toString(),
    reservePrice: reservePrice.toString(),
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success("Default detected — sealed-bid auction created");
}

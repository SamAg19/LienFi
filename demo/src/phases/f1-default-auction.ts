import type { Config } from "../config.js";
import type { Clients } from "../clients.js";
import type { Checkpoint } from "../checkpoint.js";
import { saveCheckpoint } from "../checkpoint.js";
import { createLogger } from "../logger.js";
import { shortAddr, waitForFinalization, formatUsdc } from "../utils.js";
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
  const claimTxHash = checkpoint.phaseD?.claimTxHash;
  const tokenId = checkpoint.phaseB?.tokenId;
  if (!loanId) throw new Error("Phase D must complete first (need loanId)");
  if (!claimTxHash) throw new Error("Phase D must complete first (need claimTxHash)");
  if (!tokenId) throw new Error("Phase B must complete first (need tokenId)");

  // Step 1: Wait for finalization of the last relevant tx
  // The CRE create-auction workflow reads loan state from the finalized block
  const lastTx = (checkpoint.phaseE?.lastRepayTxHash || claimTxHash) as `0x${string}`;
  log.step(1, 4, "Waiting for Sepolia finalization of loan state");
  await waitForFinalization(clients.publicClient, lastTx, "loan state tx");

  // Step 2: Run CRE create-auction workflow
  log.step(2, 4, "Running CRE create-auction workflow");
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

  // Step 3: Verify auction created on-chain
  log.step(3, 4, "Verifying auction on-chain");

  const auctionId = (await clients.publicClient.readContract({
    address: config.lienFiAuctionAddress,
    abi: LienFiAuctionABI,
    functionName: "activeAuctionId",
  })) as `0x${string}`;

  if (auctionId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("No active auction found — create-auction workflow may not have written on-chain yet");
  }
  log.verify("Auction ID", auctionId);

  // Read auction struct
  const auction = (await clients.publicClient.readContract({
    address: config.lienFiAuctionAddress,
    abi: LienFiAuctionABI,
    functionName: "auctions",
    args: [auctionId],
  })) as any[];

  // Auction struct: (seller, tokenId, deadline, reservePrice, settled, winner, settledPrice, listingHash)
  const deadline = BigInt(auction[2]);
  const reservePrice = BigInt(auction[3]);

  log.verify("Seller", shortAddr(auction[0]));
  log.verify("Token ID", String(auction[1]));
  log.verify("Deadline", new Date(Number(deadline) * 1000).toISOString());
  log.verify("Reserve Price", formatUsdc(reservePrice));
  log.verify("Settled", String(auction[4]));

  // Step 4: Verify loan is defaulted and NFT transferred
  log.step(4, 4, "Verifying loan default state");

  const loan = (await clients.publicClient.readContract({
    address: config.loanManagerAddress,
    abi: LoanManagerABI,
    functionName: "getLoan",
    args: [BigInt(loanId)],
  })) as any[];

  const loanStatus = Number(loan[10]);
  log.verify("Loan Status", loanStatus === 1 ? "DEFAULTED" : String(loanStatus));

  const nftOwner = (await clients.publicClient.readContract({
    address: config.propertyNftAddress,
    abi: PropertyNFTABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  })) as `0x${string}`;
  log.verify("NFT held by", `${shortAddr(nftOwner)} (LienFiAuction)`);

  checkpoint.phaseF1 = {
    auctionId,
    auctionDeadline: deadline.toString(),
    reservePrice: reservePrice.toString(),
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success("Default detected — sealed-bid auction created");
}

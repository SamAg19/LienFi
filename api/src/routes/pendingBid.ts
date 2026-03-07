import { Router, Request, Response } from "express";
import { getOldestPendingBid } from "../lib/store";
import { getAuctionOnChain } from "../lib/chain";

const router = Router();

/**
 * GET /pending-bid
 *
 * Returns the oldest bid with registered: false, formatted as the CRE
 * bid workflow expects:
 * { auctionId, bidder, amount, nonce, signature, auctionDeadline }
 *
 * Returns 204 No Content if no pending bids exist.
 */
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const bid = await getOldestPendingBid();
    if (!bid) {
      res.status(204).send();
      return;
    }

    // Fetch auction deadline from chain
    let auctionDeadline: number;
    try {
      const onChain = await getAuctionOnChain(bid.auctionId);
      auctionDeadline = Number(onChain.deadline);
    } catch {
      // Auction not found on-chain — skip
      res.status(204).send();
      return;
    }

    console.log(
      `[PENDING-BID] Returning bid: auction=${bid.auctionId.slice(0, 10)}... bidder=${bid.bidder.slice(0, 10)}...`
    );

    res.status(200).json({
      auctionId: bid.auctionId,
      bidder: bid.bidder,
      amount: bid.amount,
      nonce: bid.nonce,
      signature: bid.signature,
      auctionDeadline,
    });
  } catch (err) {
    console.error("[PENDING-BID] Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

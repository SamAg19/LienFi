import { Router, Request, Response } from "express";
import { markBidRegistered } from "../lib/store";

const router = Router();

/**
 * POST /bid-hash
 *
 * Called by CRE bid workflow (replaces POST /bid in CRE context).
 * Looks up the stored bid by (auctionId, bidder), returns the bidHash,
 * and marks the bid as registered: true.
 *
 * Body: { auctionId: string, bidder: string }
 * Returns: { auctionId: string, bidHash: string }
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { auctionId, bidder } = req.body;

    if (!auctionId || !bidder) {
      res.status(400).json({
        error: "Missing required fields: auctionId, bidder",
      });
      return;
    }

    const bidHash = await markBidRegistered(auctionId, bidder);
    if (!bidHash) {
      res.status(404).json({
        error: "Bid not found for this auctionId + bidder",
      });
      return;
    }

    console.log(
      `[BID-HASH] auction=${auctionId.slice(0, 10)}... bidder=${bidder.slice(0, 10)}... hash=${bidHash.slice(0, 10)}...`
    );

    res.status(200).json({ auctionId, bidHash });
  } catch (err) {
    console.error("[BID-HASH] Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

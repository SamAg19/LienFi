import { Router, Request, Response } from "express";
import { getAuction, getBids, settleAuctionInStore } from "../lib/store";
import { settleVickrey } from "../lib/vickrey";
import { getAuctionOnChain } from "../lib/chain";

const router = Router();

/**
 * POST /settle
 *
 * Runs Vickrey settlement for an auction.
 * Called via Confidential HTTP from CRE Workflow 2 with encryptOutput: true.
 *
 * Body: {
 *   auctionId: string,
 *   onChainHashes?: string[]  — optional array of bid hashes read from on-chain.
 *                                If provided, only bids matching these hashes are considered.
 * }
 *
 * Returns: {
 *   auctionId: string,
 *   winner: string (address),
 *   price: string (uint256 decimal string)
 * }
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { auctionId, onChainHashes } = req.body;

    if (!auctionId) {
      res.status(400).json({ error: "Missing auctionId" });
      return;
    }

    // --- Check auction exists ---
    const auction = await getAuction(auctionId);
    if (!auction) {
      res.status(400).json({ error: "Auction not found" });
      return;
    }

    if (auction.settled) {
      res.status(400).json({ error: "Auction already settled" });
      return;
    }

    // --- Get bids ---
    let bids = await getBids(auctionId);
    if (bids.length === 0) {
      res.status(400).json({ error: "No bids to settle" });
      return;
    }

    // --- Filter by on-chain hashes if provided ---
    if (onChainHashes && Array.isArray(onChainHashes) && onChainHashes.length > 0) {
      const hashSet = new Set(
        onChainHashes.map((h: string) => h.toLowerCase())
      );
      bids = bids.filter((b) => hashSet.has(b.bidHash.toLowerCase()));

      if (bids.length === 0) {
        res.status(400).json({
          error: "No stored bids match the on-chain bid hashes",
        });
        return;
      }
      console.log(
        `[SETTLE] Filtered to ${bids.length} bid(s) matching ${onChainHashes.length} on-chain hash(es)`
      );
    }

    // --- Fetch reserve price from chain ---
    let reservePrice: bigint;
    try {
      const onChainAuction = await getAuctionOnChain(auctionId);
      reservePrice = onChainAuction.reservePrice;
    } catch (err) {
      res.status(400).json({ error: "Auction not found on-chain" });
      return;
    }

    // --- Run Vickrey settlement ---
    const result = settleVickrey(bids, reservePrice);

    // --- Update store ---
    await settleAuctionInStore(auctionId, result.winner, result.price);

    console.log(
      `[SETTLE] auction=${auctionId.slice(0, 10)}... winner=${result.winner.slice(0, 10)}... price=${result.price}`
    );

    res.status(200).json(result);
  } catch (err) {
    console.error("[SETTLE] Unexpected error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

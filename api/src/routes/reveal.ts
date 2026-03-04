import { Router, Request, Response } from "express";
import { verifyMessage } from "ethers";
import { getProperty, markRevealed, isRevealed } from "../lib/store";
import { getAuctionOnChain } from "../lib/chain";

const router = Router();

/**
 * POST /reveal/:auctionId
 *
 * Reveals full property details (street address, ownership documents)
 * to the verified auction winner ONLY, post-settlement.
 *
 * Caller must provide a wallet signature proving they are the winner.
 * One-time per auction — logged and enforced.
 *
 * Body: {
 *   signature: string  // EIP-191 personal sign of: "Reveal property details for auction: <auctionId>"
 * }
 */
router.post(
  "/:auctionId",
  async (req: Request<{ auctionId: string }>, res: Response): Promise<void> => {
    try {
      const { auctionId } = req.params;
      const { signature } = req.body;

      if (!auctionId || !auctionId.startsWith("0x")) {
        res.status(400).json({ error: "auctionId must be a hex string" });
        return;
      }

      if (!signature) {
        res.status(400).json({ error: "Missing required field: signature" });
        return;
      }

      // Check one-time reveal
      if (await isRevealed(auctionId)) {
        res.status(403).json({
          error: "Property details already revealed for this auction",
        });
        return;
      }

      // Fetch auction from chain
      let onChainAuction;
      try {
        onChainAuction = await getAuctionOnChain(auctionId);
      } catch {
        res.status(404).json({ error: "Auction not found on-chain" });
        return;
      }

      // Verify auction is settled
      if (!onChainAuction.settled) {
        res.status(400).json({ error: "Auction not yet settled" });
        return;
      }

      // Verify caller is the winner via EIP-191 signature
      const message = `Reveal property details for auction: ${auctionId}`;
      let recoveredAddress: string;
      try {
        recoveredAddress = verifyMessage(message, signature);
      } catch {
        res.status(403).json({ error: "Invalid signature" });
        return;
      }

      if (
        recoveredAddress.toLowerCase() !==
        onChainAuction.winner.toLowerCase()
      ) {
        res.status(403).json({
          error: "Signature does not match auction winner",
        });
        return;
      }

      // Fetch full property details
      const tokenId = Number(onChainAuction.tokenId);
      const property = await getProperty(tokenId);
      if (!property) {
        res.status(404).json({ error: "Property details not found" });
        return;
      }

      // Mark as revealed (one-time)
      const marked = await markRevealed(auctionId);
      if (!marked) {
        res.status(403).json({
          error: "Property details already revealed for this auction",
        });
        return;
      }

      console.log(
        `[REVEAL] auctionId=${auctionId.slice(0, 10)}... winner=${recoveredAddress.slice(0, 10)}... tokenId=${tokenId}`
      );

      // Return FULL property details — street address, owner, everything
      res.status(200).json({
        address: property.address,
        ownerAddress: property.ownerAddress,
        propertyId: property.propertyId,
        appraisedValueUsd: property.appraisedValueUsd,
        metadataHash: property.metadataHash,
      });
    } catch (err) {
      console.error("[REVEAL] Unexpected error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;

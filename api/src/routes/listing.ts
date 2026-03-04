import { Router, Request, Response } from "express";
import { keccak256, toUtf8Bytes } from "ethers";
import { getProperty, storeListingHash } from "../lib/store";
import { getAuctionOnChain } from "../lib/chain";

const router = Router();

/**
 * GET /listing/:auctionId
 *
 * Generates a sanitized public listing for an auction.
 * Includes property details that don't reveal the borrower or default reason.
 * Computes listingHash = keccak256(JSON.stringify(sanitizedListing))
 * for on-chain integrity verification.
 *
 * Publicly accessible (no auth) — bidders need to view listings.
 *
 * Included: property type, city/state, neighborhood, sqft, year built,
 *           beds/baths, appraised value, reserve price, deadline
 * Excluded: street address, owner identity, reason for auction
 */
router.get(
  "/:auctionId",
  async (req: Request<{ auctionId: string }>, res: Response): Promise<void> => {
    try {
      const { auctionId } = req.params;

      if (!auctionId || !auctionId.startsWith("0x")) {
        res.status(400).json({ error: "auctionId must be a hex string" });
        return;
      }

      // Fetch auction from chain to get tokenId, reservePrice, deadline
      let onChainAuction;
      try {
        onChainAuction = await getAuctionOnChain(auctionId);
      } catch {
        res.status(404).json({ error: "Auction not found on-chain" });
        return;
      }

      if (onChainAuction.deadline === 0n) {
        res.status(404).json({ error: "Auction not found on-chain" });
        return;
      }

      const tokenId = Number(onChainAuction.tokenId);

      // Fetch full property details from store
      const property = await getProperty(tokenId);
      if (!property) {
        res.status(404).json({
          error: "Property details not found for this auction",
        });
        return;
      }

      // Extract city/state from address string (e.g. "123 Main St, Austin TX" → "Austin", "TX")
      const addressParts = property.address.split(",").map((s) => s.trim());
      const cityState = addressParts.length > 1 ? addressParts[1] : "";
      const cityStateParts = cityState.split(" ").filter(Boolean);
      const state = cityStateParts.length > 1 ? cityStateParts.pop()! : "Unknown";
      const city = cityStateParts.join(" ") || "Unknown";

      // Build sanitized listing — EXCLUDES: street address, owner identity, default reason
      const sanitizedListing = {
        appraisedValueUsd: property.appraisedValueUsd,
        city,
        deadline: Number(onChainAuction.deadline),
        reservePrice: onChainAuction.reservePrice.toString(),
        state,
        tokenId,
      };

      // Deterministic hash: keys already alphabetically ordered above
      const listingJson = JSON.stringify(sanitizedListing);
      const listingHash = keccak256(toUtf8Bytes(listingJson));

      // Cache for reference
      await storeListingHash(auctionId, listingHash);

      console.log(
        `[LISTING] auctionId=${auctionId.slice(0, 10)}... tokenId=${tokenId} listingHash=${listingHash.slice(0, 10)}...`
      );

      res.status(200).json({ sanitizedListing, listingHash });
    } catch (err) {
      console.error("[LISTING] Unexpected error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;

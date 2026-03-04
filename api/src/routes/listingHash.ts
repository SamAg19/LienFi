import { Router, Request, Response } from "express";
import { keccak256, toUtf8Bytes } from "ethers";
import { getProperty } from "../lib/store";

const router = Router();

/**
 * GET /listing-hash/:tokenId
 *
 * Computes the sanitized listing hash for a property by tokenId.
 * Called by the CRE create-auction-workflow via Confidential HTTP
 * BEFORE the auction exists on-chain, so it's keyed by tokenId (not auctionId).
 *
 * The returned listingHash is included in the DON report and set at auction creation time.
 * Bidders later compare the /listing/:auctionId response hash against the on-chain value.
 *
 * Protected by authMiddleware (CRE workflow only).
 */
router.get(
  "/:tokenId",
  async (req: Request<{ tokenId: string }>, res: Response): Promise<void> => {
    try {
      const tokenId = Number(req.params.tokenId);

      if (!Number.isFinite(tokenId) || tokenId <= 0) {
        res.status(400).json({ error: "tokenId must be a positive integer" });
        return;
      }

      const property = getProperty(tokenId);
      if (!property) {
        res
          .status(404)
          .json({ error: "Property details not found for this tokenId" });
        return;
      }

      // Extract city/state from address — same logic as listing.ts
      const addressParts = property.address.split(",").map((s) => s.trim());
      const cityState = addressParts.length > 1 ? addressParts[1] : "";
      const cityStateParts = cityState.split(" ").filter(Boolean);
      const state =
        cityStateParts.length > 1 ? cityStateParts.pop()! : "Unknown";
      const city = cityStateParts.join(" ") || "Unknown";

      // Build sanitized listing — keys alphabetically ordered for deterministic hash
      // NOTE: deadline and reservePrice are omitted here because they don't exist yet.
      // The /listing/:auctionId route includes them, but listing hash only covers
      // the property-intrinsic fields that are known before auction creation.
      const sanitizedListing = {
        appraisedValueUsd: property.appraisedValueUsd,
        city,
        state,
        tokenId,
      };

      const listingJson = JSON.stringify(sanitizedListing);
      const listingHash = keccak256(toUtf8Bytes(listingJson));

      console.log(
        `[LISTING-HASH] tokenId=${tokenId} listingHash=${listingHash.slice(0, 10)}...`
      );

      res.status(200).json({ listingHash });
    } catch (err) {
      console.error("[LISTING-HASH] Unexpected error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;

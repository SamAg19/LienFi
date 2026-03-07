/**
 * Stores:
 * - Bid data for sealed-bid auctions (keyed by auctionId)
 * - Verified property details (keyed by tokenId) — full details stored here,
 *   only the metadataHash lives on-chain in the PropertyNFT
 * - Loan request details (keyed by requestHash)
 * - Listing hash cache (keyed by auctionId)
 * - Reveal tracking (keyed by auctionId)
 */

import { getDb } from "./db";

export interface StoredBid {
  auctionId: string;
  bidder: string;
  amount: string; // uint256 decimal string — token-agnostic
  nonce: number;
  signature: string;
  bidHash: string;
  timestamp: number;
  registered: boolean;
}

export interface AuctionState {
  auctionId: string;
  bids: StoredBid[];
  deadline: number;
  settled: boolean;
  winner?: string;
  price?: string;
}

/**
 * Get or auto-create an auction state.
 * Auto-creates on first bid for dev convenience.
 */
export async function getOrCreateAuction(
  auctionId: string,
  deadline?: number
): Promise<AuctionState> {
  const col = getDb().collection("auctions");
  const result = await col.findOneAndUpdate(
    { auctionId },
    {
      $setOnInsert: {
        auctionId,
        deadline: deadline || Math.floor(Date.now() / 1000) + 3600,
        settled: false,
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  const doc = result!;
  // Fetch bids separately
  const bids = await getBids(auctionId);

  return {
    auctionId: doc.auctionId as string,
    bids,
    deadline: doc.deadline as number,
    settled: doc.settled as boolean,
    winner: doc.winner as string | undefined,
    price: doc.price as string | undefined,
  };
}

/**
 * Get an existing auction or return null.
 */
export async function getAuction(auctionId: string): Promise<AuctionState | null> {
  const doc = await getDb().collection("auctions").findOne({ auctionId });
  if (!doc) return null;

  const bids = await getBids(auctionId);

  return {
    auctionId: doc.auctionId as string,
    bids,
    deadline: doc.deadline as number,
    settled: doc.settled as boolean,
    winner: doc.winner as string | undefined,
    price: doc.price as string | undefined,
  };
}

/**
 * Store a bid in the bids collection.
 * Returns false if duplicate (same bidder + auctionId).
 */
export async function storeBid(bid: StoredBid): Promise<boolean> {
  try {
    await getDb().collection("bids").insertOne({
      auctionId: bid.auctionId,
      bidder: bid.bidder.toLowerCase(),
      amount: bid.amount,
      nonce: bid.nonce,
      signature: bid.signature,
      bidHash: bid.bidHash,
      timestamp: bid.timestamp,
      registered: false,
    });
    return true;
  } catch (err: any) {
    // Duplicate key error (code 11000) = same bidder in same auction
    if (err.code === 11000) return false;
    throw err;
  }
}

/**
 * Get all bids for an auction.
 */
export async function getBids(auctionId: string): Promise<StoredBid[]> {
  const docs = await getDb()
    .collection("bids")
    .find({ auctionId })
    .toArray();

  return docs.map((d) => ({
    auctionId: d.auctionId as string,
    bidder: d.bidder as string,
    amount: d.amount as string,
    nonce: d.nonce as number,
    signature: d.signature as string,
    bidHash: d.bidHash as string,
    timestamp: d.timestamp as number,
    registered: (d.registered as boolean) ?? false,
  }));
}

/**
 * Get the oldest bid that hasn't been registered on-chain yet.
 */
export async function getOldestPendingBid(): Promise<StoredBid | null> {
  const doc = await getDb()
    .collection("bids")
    .findOne({ registered: false }, { sort: { timestamp: 1 } });

  if (!doc) return null;
  return {
    auctionId: doc.auctionId as string,
    bidder: doc.bidder as string,
    amount: doc.amount as string,
    nonce: doc.nonce as number,
    signature: doc.signature as string,
    bidHash: doc.bidHash as string,
    timestamp: doc.timestamp as number,
    registered: false,
  };
}

/**
 * Mark a bid as registered on-chain. Returns the bidHash, or null if not found.
 */
export async function markBidRegistered(
  auctionId: string,
  bidder: string
): Promise<string | null> {
  const result = await getDb()
    .collection("bids")
    .findOneAndUpdate(
      { auctionId, bidder: bidder.toLowerCase() },
      { $set: { registered: true } },
      { returnDocument: "after" }
    );

  if (!result) return null;
  return result.bidHash as string;
}

/**
 * Mark an auction as settled with winner and price.
 */
export async function settleAuctionInStore(
  auctionId: string,
  winner: string,
  price: string
): Promise<void> {
  await getDb()
    .collection("auctions")
    .updateOne({ auctionId }, { $set: { settled: true, winner, price } });
}

// ─── Property Storage ─────────────────────────────────────────────────────────

export interface StoredProperty {
  tokenId: number;
  propertyId: string;
  address: string;
  appraisedValueUsd: number;
  ownerAddress: string;
  metadataHash: string; // keccak256 of property details — matches on-chain NFT metadata
}

/**
 * Get the next tokenId using an atomic counter in MongoDB.
 */
export async function getNextTokenId(): Promise<number> {
  const result = await getDb()
    .collection("counters")
    .findOneAndUpdate(
      { _id: "tokenId" as any },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
  return result!.seq as number;
}

export async function storeProperty(property: StoredProperty): Promise<void> {
  await getDb()
    .collection("properties")
    .replaceOne({ tokenId: property.tokenId }, property, { upsert: true });
}

export async function getProperty(tokenId: number): Promise<StoredProperty | null> {
  const doc = await getDb().collection("properties").findOne({ tokenId });
  if (!doc) return null;
  return {
    tokenId: doc.tokenId as number,
    propertyId: doc.propertyId as string,
    address: doc.address as string,
    appraisedValueUsd: doc.appraisedValueUsd as number,
    ownerAddress: doc.ownerAddress as string,
    metadataHash: doc.metadataHash as string,
  };
}

// ─── Loan Request Storage ────────────────────────────────────────────────────

export interface StoredLoanRequest {
  requestHash: string;
  borrowerAddress: string;
  plaidToken: string;
  tokenId: number;
  requestedAmount: string; // uint256 decimal string (USDC 6 decimals)
  tenureMonths: number;
  nonce: number; // provided by borrower, tracked on-chain in LoanManager
  timestamp: number;
}

export async function storeLoanRequest(request: StoredLoanRequest): Promise<boolean> {
  try {
    await getDb().collection("loanRequests").insertOne({ ...request });
    return true;
  } catch (err: any) {
    if (err.code === 11000) return false;
    throw err;
  }
}

export async function getLoanRequest(requestHash: string): Promise<StoredLoanRequest | null> {
  const doc = await getDb().collection("loanRequests").findOne({ requestHash });
  if (!doc) return null;
  return {
    requestHash: doc.requestHash as string,
    borrowerAddress: doc.borrowerAddress as string,
    plaidToken: doc.plaidToken as string,
    tokenId: doc.tokenId as number,
    requestedAmount: doc.requestedAmount as string,
    tenureMonths: doc.tenureMonths as number,
    nonce: doc.nonce as number,
    timestamp: doc.timestamp as number,
  };
}

// ─── Listing Hash Cache ─────────────────────────────────────────────────────

export async function storeListingHash(auctionId: string, hash: string): Promise<void> {
  await getDb()
    .collection("listingHashes")
    .updateOne({ auctionId }, { $set: { auctionId, hash } }, { upsert: true });
}

export async function getListingHash(auctionId: string): Promise<string | null> {
  const doc = await getDb().collection("listingHashes").findOne({ auctionId });
  return doc ? (doc.hash as string) : null;
}

// ─── Reveal Tracking ────────────────────────────────────────────────────────

export async function markRevealed(auctionId: string): Promise<boolean> {
  try {
    await getDb()
      .collection("reveals")
      .insertOne({ auctionId, revealedAt: Date.now() });
    return true;
  } catch (err: any) {
    if (err.code === 11000) return false;
    throw err;
  }
}

export async function isRevealed(auctionId: string): Promise<boolean> {
  const doc = await getDb().collection("reveals").findOne({ auctionId });
  return doc !== null;
}

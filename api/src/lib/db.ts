import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDB(uri: string): Promise<Db> {
  if (db) return db;

  client = new MongoClient(uri);
  await client.connect();
  db = client.db();

  // Create indexes
  await db.collection("auctions").createIndex({ auctionId: 1 }, { unique: true });
  await db.collection("bids").createIndex({ auctionId: 1, bidder: 1 }, { unique: true });
  await db.collection("properties").createIndex({ tokenId: 1 }, { unique: true });
  await db.collection("loanRequests").createIndex({ requestHash: 1 }, { unique: true });
  await db.collection("listingHashes").createIndex({ auctionId: 1 }, { unique: true });
  await db.collection("reveals").createIndex({ auctionId: 1 }, { unique: true });

  console.log("Connected to MongoDB");
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("MongoDB not connected — call connectDB() first");
  return db;
}

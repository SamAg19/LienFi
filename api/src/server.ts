import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./lib/db";
import { authMiddleware } from "./lib/auth";
import bidRouter from "./routes/bid";
import settleRouter from "./routes/settle";
import statusRouter from "./routes/status";
import verifyPropertyRouter from "./routes/verifyProperty";
import loanRequestRouter from "./routes/loanRequest";
import listingRouter from "./routes/listing";
import listingHashRouter from "./routes/listingHash";
import revealRouter from "./routes/reveal";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Health check (no auth) ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// --- Protected routes (API key required) ---
app.use("/bid", authMiddleware, bidRouter);
app.use("/settle", authMiddleware, settleRouter);
app.use("/status", authMiddleware, statusRouter);
app.use("/verify-property", authMiddleware, verifyPropertyRouter);
app.use("/loan-request", authMiddleware, loanRequestRouter);
app.use("/listing-hash", authMiddleware, listingHashRouter);

// --- Public routes (no auth — bidder-facing) ---
app.use("/listing", listingRouter);
app.use("/reveal", revealRouter);

// --- Connect to MongoDB then start server ---
(async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI environment variable is required");
    process.exit(1);
  }

  await connectDB(mongoUri);

  app.listen(PORT, () => {
    console.log(`\n LienFi API running on port ${PORT}`);
    console.log(`   POST /bid              — Submit a signed bid`);
    console.log(`   POST /settle           — Run Vickrey settlement`);
    console.log(`   GET  /status/:id       — Auction status`);
    console.log(`   POST /verify-property  — Verify property for tokenization`);
    console.log(`   POST /loan-request     — Submit loan request details`);
    console.log(`   GET  /loan-request/:h  — Fetch loan request by hash`);
    console.log(`   GET  /listing-hash/:id  — Listing hash by tokenId`);
    console.log(`   GET  /listing/:id      — Sanitized property listing`);
    console.log(`   POST /reveal/:id       — Reveal full details to winner`);
    console.log(`   GET  /health           — Health check\n`);
  });
})();

export default app;

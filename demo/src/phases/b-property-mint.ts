import type { Config } from "../config.js";
import type { Clients } from "../clients.js";
import type { Checkpoint } from "../checkpoint.js";
import { saveCheckpoint } from "../checkpoint.js";
import { createLogger } from "../logger.js";
import { shortAddr, retry } from "../utils.js";
import { PropertyNFTABI } from "../abis.js";

export async function phaseB(
  config: Config,
  clients: Clients,
  checkpoint: Checkpoint
): Promise<void> {
  const log = createLogger("B");
  log.header();

  if (checkpoint.phaseB?.completedAt) {
    log.info("Already completed, skipping.");
    return;
  }

  const borrowerAddr = clients.borrower.account.address;

  // Step 1: Verify property via API
  log.step(1, 3, `Verifying property ${config.propertyId} for borrower ${shortAddr(borrowerAddr)}`);

  const verifyRes = await retry(
    async () => {
      const res = await fetch(`${config.apiUrl}/verify-property`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: config.propertyId,
          sellerAddress: borrowerAddr,
        }),
      });
      if (!res.ok) throw new Error(`API returned ${res.status}: ${await res.text()}`);
      return res.json();
    },
    { label: "verify-property", maxAttempts: 3, delayMs: 10000 }
  );

  if (!verifyRes.valid) {
    throw new Error(`Property verification failed: ${verifyRes.message}`);
  }

  const tokenId: number = verifyRes.tokenId;
  const metadataHash: string = verifyRes.metadataHash;
  log.verify("Token ID", String(tokenId));
  log.verify("Metadata Hash", metadataHash);
  log.verify("Appraised Value", `$${Number(verifyRes.appraisedValue).toLocaleString()}`);

  // Step 2: Mint PropertyNFT on-chain
  log.step(2, 3, `Minting PropertyNFT with metadataHash`);
  const mintHash = await clients.borrower.writeContract({
    address: config.propertyNftAddress,
    abi: PropertyNFTABI,
    functionName: "mint",
    args: [metadataHash as `0x${string}`],
  });
  await clients.publicClient.waitForTransactionReceipt({ hash: mintHash });
  log.tx("mint", mintHash);

  // Step 3: Verify NFT ownership
  log.step(3, 3, "Verifying NFT ownership");
  const owner = (await clients.publicClient.readContract({
    address: config.propertyNftAddress,
    abi: PropertyNFTABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  })) as `0x${string}`;
  log.verify("NFT owner", shortAddr(owner));

  if (owner.toLowerCase() !== borrowerAddr.toLowerCase()) {
    throw new Error(`NFT owner mismatch: expected ${borrowerAddr}, got ${owner}`);
  }

  checkpoint.phaseB = {
    tokenId,
    metadataHash,
    mintTxHash: mintHash,
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success(`PropertyNFT #${tokenId} minted to borrower`);
}

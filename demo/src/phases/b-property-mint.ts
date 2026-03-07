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
  const done = checkpoint.phaseB?.step ?? 0;

  // Step 1: Verify property via API
  let tokenId = checkpoint.phaseB?.tokenId;
  let metadataHash = checkpoint.phaseB?.metadataHash;

  if (done < 1) {
    log.step(1, 3, `Verifying property ${config.propertyId} for borrower ${shortAddr(borrowerAddr)}`);

    const verifyRes = await retry(
      async () => {
        const res = await fetch(`${config.apiUrl}/verify-property`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": config.apiKey },
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

    tokenId = verifyRes.tokenId;
    metadataHash = verifyRes.metadataHash;
    log.verify("Token ID", String(tokenId));
    log.verify("Metadata Hash", metadataHash!);
    log.verify("Appraised Value", `$${Number(verifyRes.appraisedValue).toLocaleString()}`);

    checkpoint.phaseB = { ...checkpoint.phaseB, step: 1, tokenId, metadataHash };
    saveCheckpoint(checkpoint);
  } else {
    log.step(1, 3, "Verify property — already done, skipping");
  }

  // Step 2: Mint PropertyNFT on-chain
  if (done < 2) {
    log.step(2, 3, `Minting PropertyNFT with metadataHash`);
    const mintHash = await clients.borrower.writeContract({
      address: config.propertyNftAddress,
      abi: PropertyNFTABI,
      functionName: "mint",
      args: [metadataHash as `0x${string}`],
    });
    await clients.publicClient.waitForTransactionReceipt({ hash: mintHash });
    log.tx("mint", mintHash);

    checkpoint.phaseB = { ...checkpoint.phaseB, step: 2, mintTxHash: mintHash };
    saveCheckpoint(checkpoint);
  } else {
    log.step(2, 3, "Mint PropertyNFT — already done, skipping");
  }

  // Step 3: Verify NFT ownership
  log.step(3, 3, "Verifying NFT ownership");
  const owner = (await clients.publicClient.readContract({
    address: config.propertyNftAddress,
    abi: PropertyNFTABI,
    functionName: "ownerOf",
    args: [BigInt(tokenId!)],
  })) as `0x${string}`;
  log.verify("NFT owner", shortAddr(owner));

  if (owner.toLowerCase() !== borrowerAddr.toLowerCase()) {
    throw new Error(`NFT owner mismatch: expected ${borrowerAddr}, got ${owner}`);
  }

  checkpoint.phaseB = {
    ...checkpoint.phaseB,
    step: 3,
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success(`PropertyNFT #${tokenId} minted to borrower`);
}

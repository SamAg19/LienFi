import type { PublicClient } from "viem";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForFinalization(
  publicClient: PublicClient,
  txHash: `0x${string}`,
  label: string
): Promise<void> {
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  const targetBlock = receipt.blockNumber;

  console.log(
    `  FINALIZATION: ${label} is in block ${targetBlock}. Waiting...`
  );

  const pollIntervalMs = 30_000;
  const maxWaitMs = 25 * 60 * 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const finalizedBlock = await publicClient.getBlock({
      blockTag: "finalized",
    });

    if (finalizedBlock.number >= targetBlock) {
      console.log(
        `  FINALIZATION: Block ${targetBlock} finalized (current finalized: ${finalizedBlock.number})`
      );
      return;
    }

    const remaining = Number(targetBlock - finalizedBlock.number);
    const estimatedMin = ((remaining * 12) / 60).toFixed(1);
    console.log(
      `  FINALIZATION: finalized=${finalizedBlock.number}, need=${targetBlock}, ~${estimatedMin} min remaining`
    );

    await sleep(pollIntervalMs);
  }

  throw new Error(
    `Finalization timeout after 25 minutes for block ${targetBlock}`
  );
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; delayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 5000, label = "operation" } = opts;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === maxAttempts) {
        throw new Error(`${label} failed after ${maxAttempts} attempts: ${msg}`);
      }
      console.log(
        `  Attempt ${attempt}/${maxAttempts} failed: ${msg}. Retrying in ${delayMs / 1000}s...`
      );
      await sleep(delayMs);
    }
  }
  throw new Error("Unreachable");
}

export function formatUsdc(amount: bigint | string): string {
  const val = typeof amount === "string" ? BigInt(amount) : amount;
  const whole = val / 1_000_000n;
  const frac = val % 1_000_000n;
  if (frac === 0n) return `${whole.toLocaleString()} USDC`;
  return `${whole}.${frac.toString().padStart(6, "0")} USDC`;
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

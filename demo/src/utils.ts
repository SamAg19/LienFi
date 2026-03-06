export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

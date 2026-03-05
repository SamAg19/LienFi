import { loadConfig } from "./config.js";
import { createClients } from "./clients.js";
import { loadCheckpoint, clearCheckpoint } from "./checkpoint.js";
import { logBanner } from "./logger.js";
import { retry, shortAddr } from "./utils.js";
import { MockUSDCABI } from "./abis.js";
import { phaseA } from "./phases/a-pool-funding.js";
import { phaseB } from "./phases/b-property-mint.js";
import { phaseC } from "./phases/c-credit-assessment.js";
import { phaseD } from "./phases/d-loan-disbursement.js";
import { phaseE } from "./phases/e-repayment.js";
import { phaseF1 } from "./phases/f1-default-auction.js";
import { phaseF2 } from "./phases/f2-sealed-bidding.js";
import { phaseF3 } from "./phases/f3-settlement.js";
import { formatEther } from "viem";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const PHASES: Record<string, (config: any, clients: any, checkpoint: any) => Promise<void>> = {
  a: phaseA,
  b: phaseB,
  c: phaseC,
  d: phaseD,
  e: phaseE,
  f1: phaseF1,
  f2: phaseF2,
  f3: phaseF3,
};

const PHASE_ORDER = ["a", "b", "c", "d", "e", "f1", "f2", "f3"];

function parseArgs() {
  const args = process.argv.slice(2);
  let fresh = false;
  let from: string | null = null;
  let phase: string | null = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--fresh":
        fresh = true;
        break;
      case "--from":
        from = args[++i]?.toLowerCase() ?? null;
        break;
      case "--phase":
        phase = args[++i]?.toLowerCase() ?? null;
        break;
      case "--help":
        console.log(`
Usage: npx tsx src/main.ts [options]

Options:
  --fresh       Clear checkpoint and start from scratch
  --from <X>    Start from phase X (a, b, c, d, e, f1, f2, f3)
  --phase <X>   Run only phase X
  --help        Show this help
`);
        process.exit(0);
    }
  }

  return { fresh, from, phase };
}

async function checkPrerequisites(config: any, clients: any) {
  console.log("Checking prerequisites...\n");

  // Check ETH balances
  const actors = [
    { name: "Lender", client: clients.lender },
    { name: "Borrower", client: clients.borrower },
    { name: "Bidder A", client: clients.bidderA },
    { name: "Bidder B", client: clients.bidderB },
  ];

  for (const { name, client } of actors) {
    const balance = await clients.publicClient.getBalance({
      address: client.account.address,
    });
    const ethBalance = formatEther(balance);
    const low = balance < 10_000_000_000_000_000n; // 0.01 ETH
    console.log(
      `  ${name} (${shortAddr(client.account.address)}): ${ethBalance} ETH${low ? " ⚠ LOW" : ""}`
    );
    if (low) {
      console.warn(`  WARNING: ${name} has low ETH balance. Transactions may fail.`);
    }
  }

  // Check contract connectivity
  try {
    const decimals = await clients.publicClient.readContract({
      address: config.mockUsdcAddress,
      abi: MockUSDCABI,
      functionName: "decimals",
    });
    console.log(`  MockUSDC decimals: ${decimals}`);
  } catch {
    throw new Error("Cannot read MockUSDC contract — check MOCK_USDC_ADDRESS and RPC_URL");
  }

  // Check CRE auth
  try {
    await execAsync("cre auth status", { timeout: 10_000 });
    console.log("  CRE auth: OK");
  } catch {
    console.warn("  WARNING: CRE auth check failed. Run 'cre auth login' if workflows fail.");
  }

  // Warm API server
  console.log("  Warming API server...");
  try {
    await retry(
      async () => {
        const res = await fetch(`${config.apiUrl}/health`, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) throw new Error(`API returned ${res.status}`);
      },
      { label: "API health", maxAttempts: 3, delayMs: 10_000 }
    );
    console.log("  API server: OK");
  } catch {
    console.warn("  WARNING: API server not reachable. Phases B and C will fail.");
  }

  console.log("");
}

async function main() {
  const { fresh, from, phase } = parseArgs();

  logBanner();

  const config = loadConfig();
  const clients = createClients(config);

  if (fresh) {
    console.log("Clearing checkpoint (--fresh)...\n");
    clearCheckpoint();
  }

  const checkpoint = loadCheckpoint();

  await checkPrerequisites(config, clients);

  // Determine which phases to run
  let phasesToRun: string[];

  if (phase) {
    if (!PHASES[phase]) {
      console.error(`Unknown phase: ${phase}. Valid: ${PHASE_ORDER.join(", ")}`);
      process.exit(1);
    }
    phasesToRun = [phase];
  } else if (from) {
    const startIdx = PHASE_ORDER.indexOf(from);
    if (startIdx === -1) {
      console.error(`Unknown phase: ${from}. Valid: ${PHASE_ORDER.join(", ")}`);
      process.exit(1);
    }
    phasesToRun = PHASE_ORDER.slice(startIdx);
  } else {
    phasesToRun = PHASE_ORDER;
  }

  console.log(`Running phases: ${phasesToRun.join(", ").toUpperCase()}\n`);

  for (const p of phasesToRun) {
    try {
      await PHASES[p](config, clients, checkpoint);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\nFATAL: Phase ${p.toUpperCase()} failed: ${msg}`);
      console.error("Checkpoint saved. Resume with: npx tsx src/main.ts --from", p);
      process.exit(1);
    }
  }

  console.log(`
${"=".repeat(60)}
  DEMO COMPLETE
${"=".repeat(60)}
`);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});

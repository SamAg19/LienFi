const PHASE_NAMES: Record<string, string> = {
  A: "Pool Funding",
  B: "Property NFT Minting",
  C: "Credit Assessment",
  D: "Loan Disbursement",
  E: "Monthly Repayment",
  F1: "Default Detection + Auction Creation",
  F2: "Sealed Bidding",
  F3: "Vickrey Settlement",
};

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export function createLogger(phase: string) {
  const name = PHASE_NAMES[phase] || phase;
  const prefix = `[Phase ${phase}]`;

  return {
    header: () =>
      console.log(
        `\n${"=".repeat(60)}\n  Phase ${phase}: ${name}\n${"=".repeat(60)}`
      ),
    step: (n: number, total: number, msg: string) =>
      console.log(`${timestamp()} ${prefix} [${n}/${total}] ${msg}`),
    tx: (label: string, hash: string) =>
      console.log(`${timestamp()} ${prefix}   TX ${label}: ${hash}`),
    info: (msg: string) => console.log(`${timestamp()} ${prefix} ${msg}`),
    wait: (msg: string) =>
      console.log(`${timestamp()} ${prefix} WAITING: ${msg}`),
    success: (msg: string) =>
      console.log(`${timestamp()} ${prefix} OK: ${msg}`),
    error: (msg: string) =>
      console.error(`${timestamp()} ${prefix} ERROR: ${msg}`),
    verify: (label: string, value: string) =>
      console.log(`${timestamp()} ${prefix}   ${label}: ${value}`),
  };
}

export function logBanner() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║            LienFi  End-to-End Demo                      ║
║            Network: Sepolia (chainId: 11155111)         ║
║            ${new Date().toISOString().slice(0, 19).replace("T", " ")}                       ║
╚══════════════════════════════════════════════════════════╝
`);
}

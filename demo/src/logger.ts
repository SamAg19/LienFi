import chalk, { type ChalkInstance } from "chalk";

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

const PHASE_COLORS: Record<string, ChalkInstance> = {
  A: chalk.cyan,
  B: chalk.magenta,
  C: chalk.blue,
  D: chalk.yellow,
  E: chalk.green,
  F1: chalk.red,
  F2: chalk.redBright,
  F3: chalk.hex("#FF8C00"),
};

function timestamp(): string {
  return chalk.gray(new Date().toISOString().slice(11, 19));
}

export function createLogger(phase: string) {
  const name = PHASE_NAMES[phase] || phase;
  const color = PHASE_COLORS[phase] || chalk.white;
  const prefix = color.bold(`[Phase ${phase}]`);

  return {
    header: () =>
      console.log(
        color.bold(
          `\n${"=".repeat(60)}\n  Phase ${phase}: ${name}\n${"=".repeat(60)}`
        )
      ),
    step: (n: number, total: number, msg: string) =>
      console.log(
        `${timestamp()} ${prefix} ${chalk.dim(`[${n}/${total}]`)} ${msg}`
      ),
    tx: (label: string, hash: string) => {
      console.log(
        `${timestamp()} ${prefix}   ${chalk.dim("TX")} ${chalk.white(label)}: ${chalk.underline.cyan(hash)}`
      );
      console.log(
        `${timestamp()} ${prefix}   ${chalk.dim("Explorer")}: ${chalk.underline.cyan(`https://sepolia.etherscan.io/tx/${hash}`)}`
      );
    },
    info: (msg: string) =>
      console.log(`${timestamp()} ${prefix} ${chalk.white(msg)}`),
    wait: (msg: string) =>
      console.log(
        `${timestamp()} ${prefix} ${chalk.yellow("WAITING:")} ${chalk.yellow(msg)}`
      ),
    success: (msg: string) =>
      console.log(
        `${timestamp()} ${prefix} ${chalk.green("OK:")} ${chalk.green(msg)}`
      ),
    error: (msg: string) =>
      console.error(
        `${timestamp()} ${prefix} ${chalk.red.bold("ERROR:")} ${chalk.red(msg)}`
      ),
    verify: (label: string, value: string) =>
      console.log(
        `${timestamp()} ${prefix}   ${chalk.dim(label)}: ${chalk.whiteBright(value)}`
      ),
  };
}

export function logBanner() {
  const dt = new Date().toISOString().slice(0, 19).replace("T", " ");
  console.log(
    chalk.cyan.bold(`
╔══════════════════════════════════════════════════════════╗
║            LienFi  End-to-End Demo                       ║
║            Network: Sepolia (chainId: 11155111)          ║
║            ${dt}                           ║
╚══════════════════════════════════════════════════════════╝
`)
  );
}

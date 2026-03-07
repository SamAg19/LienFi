import { spawn } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";

export interface CREResult {
  stdout: string;
  stderr: string;
  success: boolean;
}

export async function runCREWorkflow(opts: {
  creDir: string;
  workflowDir: string;
  target?: string;
  triggerIndex?: number;
  evmTxHash?: string;
  evmEventIndex?: number;
  httpPayload?: object;
  broadcast?: boolean;
  timeoutMs?: number;
}): Promise<CREResult> {
  const args: string[] = [
    "cre",
    "workflow",
    "simulate",
    `./${opts.workflowDir}`,
    "--target",
    opts.target || "staging-settings",
    "--non-interactive",
    "--trigger-index",
    String(opts.triggerIndex ?? 0),
  ];

  if (opts.evmTxHash) {
    args.push("--evm-tx-hash", opts.evmTxHash);
  }
  if (opts.evmEventIndex !== undefined) {
    args.push("--evm-event-index", String(opts.evmEventIndex));
  }

  let tempPayloadPath: string | null = null;
  if (opts.httpPayload) {
    tempPayloadPath = join(
      opts.creDir,
      `.tmp-payload-${Date.now()}.json`
    );
    writeFileSync(tempPayloadPath, JSON.stringify(opts.httpPayload, null, 2));
    args.push("--http-payload", `@${tempPayloadPath}`);
  }

  if (opts.broadcast) {
    args.push("--broadcast");
  }

  args.push("--verbose");

  console.log(`  CRE CMD: ${args.join(" ")}`);

  return new Promise<CREResult>((resolve) => {
    const child = spawn(args[0], args.slice(1), {
      cwd: opts.creDir,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, opts.timeoutMs || 5 * 60 * 1000);

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (tempPayloadPath) {
        try { unlinkSync(tempPayloadPath); } catch { /* ignore */ }
      }
      resolve({ stdout, stderr, success: code === 0 });
    });
  });
}

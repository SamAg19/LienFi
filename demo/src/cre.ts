import { exec } from "child_process";
import { promisify } from "util";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

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

  const cmd = args.join(" ");
  console.log(`  CRE CMD: ${cmd}`);

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: opts.creDir,
      timeout: opts.timeoutMs || 5 * 60 * 1000,
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024,
    });

    return { stdout, stderr, success: true };
  } catch (err: any) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || "",
      success: false,
    };
  } finally {
    if (tempPayloadPath) {
      try {
        unlinkSync(tempPayloadPath);
      } catch {
        /* ignore */
      }
    }
  }
}

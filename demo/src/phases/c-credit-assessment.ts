import type { Config } from "../config.js";
import type { Clients } from "../clients.js";
import type { Checkpoint } from "../checkpoint.js";
import { saveCheckpoint } from "../checkpoint.js";
import { createLogger } from "../logger.js";
import { shortAddr, retry, sleep, formatUsdc } from "../utils.js";
import { LoanManagerABI } from "../abis.js";
import { runCREWorkflow } from "../cre.js";

export async function phaseC(
  config: Config,
  clients: Clients,
  checkpoint: Checkpoint
): Promise<void> {
  const log = createLogger("C");
  log.header();

  if (checkpoint.phaseC?.completedAt) {
    log.info("Already completed, skipping.");
    return;
  }

  const borrowerAddr = clients.borrower.account.address;
  const tokenId = checkpoint.phaseB?.tokenId;
  if (!tokenId) throw new Error("Phase B must complete first (need tokenId)");

  const done = checkpoint.phaseC?.step ?? 0;

  // Step 1: Generate Plaid sandbox access token
  let plaidAccessToken = checkpoint.phaseC?.plaidAccessToken;

  if (done < 1) {
    log.step(1, 5, "Generating Plaid sandbox access token");

    const publicTokenRes = await retry(
      async () => {
        const res = await fetch("https://sandbox.plaid.com/sandbox/public_token/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: config.plaidClientId,
            secret: config.plaidSecret,
            institution_id: "ins_109508",
            initial_products: ["transactions"],
          }),
        });
        if (!res.ok) throw new Error(`Plaid error: ${res.status} ${await res.text()}`);
        return res.json();
      },
      { label: "plaid-public-token" }
    );

    const exchangeRes = await retry(
      async () => {
        const res = await fetch("https://sandbox.plaid.com/item/public_token/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: config.plaidClientId,
            secret: config.plaidSecret,
            public_token: publicTokenRes.public_token,
          }),
        });
        if (!res.ok) throw new Error(`Plaid exchange error: ${res.status} ${await res.text()}`);
        return res.json();
      },
      { label: "plaid-exchange" }
    );

    plaidAccessToken = exchangeRes.access_token;
    log.verify("Plaid access token", `${plaidAccessToken!.slice(0, 20)}...`);

    checkpoint.phaseC = { ...checkpoint.phaseC, step: 1, plaidAccessToken };
    saveCheckpoint(checkpoint);
  } else {
    log.step(1, 5, "Plaid access token — already done, skipping");
    plaidAccessToken = checkpoint.phaseC?.plaidAccessToken;
  }

  // Step 2: Submit loan request to API
  let requestHash = checkpoint.phaseC?.requestHash;

  if (done < 2) {
    log.step(2, 5, "Submitting loan request to API");

    const loanReqRes = await retry(
      async () => {
        const res = await fetch(`${config.apiUrl}/loan-request`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": config.apiKey },
          body: JSON.stringify({
            borrowerAddress: borrowerAddr,
            plaidToken: plaidAccessToken,
            tokenId,
            requestedAmount: config.loanRequestAmount,
            tenureMonths: config.loanTenureMonths,
            nonce: config.loanNonce,
          }),
        });
        if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
        return res.json();
      },
      { label: "loan-request", maxAttempts: 3, delayMs: 10000 }
    );

    requestHash = loanReqRes.requestHash;
    log.verify("Request Hash", requestHash!);

    checkpoint.phaseC = { ...checkpoint.phaseC, step: 2, requestHash };
    saveCheckpoint(checkpoint);
  } else {
    log.step(2, 5, "Loan request to API — already done, skipping");
    requestHash = checkpoint.phaseC?.requestHash;
  }

  // Step 3: Submit requestHash on-chain
  let submitTxHash = checkpoint.phaseC?.submitTxHash;

  if (done < 3) {
    log.step(3, 5, `Submitting requestHash on-chain as borrower ${shortAddr(borrowerAddr)}`);
    submitTxHash = await clients.borrower.writeContract({
      address: config.loanManagerAddress,
      abi: LoanManagerABI,
      functionName: "submitRequest",
      args: [requestHash as `0x${string}`],
    });
    const submitReceipt = await clients.publicClient.waitForTransactionReceipt({
      hash: submitTxHash!,
    });
    log.tx("submitRequest", submitTxHash!);
    log.verify("Block", submitReceipt.blockNumber.toString());

    checkpoint.phaseC = { ...checkpoint.phaseC, step: 3, submitTxHash };
    saveCheckpoint(checkpoint);
  } else {
    log.step(3, 5, "Submit requestHash on-chain — already done, skipping");
    submitTxHash = checkpoint.phaseC?.submitTxHash;
  }

  // Step 4: Run CRE credit-assessment workflow
  if (done < 4) {
    log.step(4, 5, "Running CRE credit-assessment workflow");

    const creResult = await runCREWorkflow({
      creDir: config.creWorkflowsDir,
      workflowDir: "credit-assessment-workflow",
      evmTxHash: submitTxHash!,
      evmEventIndex: 0,
      broadcast: true,
    });

    if (!creResult.success) {
      log.error("CRE workflow failed:");
      console.log(creResult.stdout);
      console.error(creResult.stderr);
      throw new Error("Credit assessment CRE workflow failed");
    }
    log.info("CRE workflow completed");

    checkpoint.phaseC = { ...checkpoint.phaseC, step: 4 };
    saveCheckpoint(checkpoint);
  } else {
    log.step(4, 5, "CRE credit-assessment workflow — already done, skipping");
  }

  // Step 5: Poll for verdict on-chain
  log.step(5, 5, "Polling for credit verdict on-chain");

  let approved = false;
  for (let i = 0; i < 20; i++) {
    try {
      const approval = (await clients.publicClient.readContract({
        address: config.loanManagerAddress,
        abi: LoanManagerABI,
        functionName: "pendingApprovals",
        args: [borrowerAddr],
      })) as any[];

      const exists = approval[6];
      if (exists) {
        approved = true;
        log.verify("Approved Limit", formatUsdc(BigInt(approval[2])));
        log.verify("Computed EMI", formatUsdc(BigInt(approval[4])));
        log.verify("Expires At", new Date(Number(approval[5]) * 1000).toISOString());
        break;
      }
    } catch {
      // mapping might not exist yet
    }
    log.wait(`Verdict not yet on-chain, polling... (${i + 1}/20)`);
    await sleep(30_000);
  }

  if (!approved) {
    throw new Error("Credit assessment verdict not found on-chain after polling");
  }

  checkpoint.phaseC = {
    ...checkpoint.phaseC,
    step: 5,
    completedAt: new Date().toISOString(),
  };
  saveCheckpoint(checkpoint);
  log.success("Credit assessment approved");
}

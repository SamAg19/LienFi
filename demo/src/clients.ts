import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import type { Config } from "./config.js";

export function createClients(config: Config) {
  const transport = http(config.rpcUrl);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport,
  });

  const lenderAccount = privateKeyToAccount(config.lenderPrivateKey);
  const borrowerAccount = privateKeyToAccount(config.borrowerPrivateKey);
  const bidderAAccount = privateKeyToAccount(config.bidderAPrivateKey);
  const bidderBAccount = privateKeyToAccount(config.bidderBPrivateKey);

  const lender = createWalletClient({
    account: lenderAccount,
    chain: sepolia,
    transport,
  });

  const borrower = createWalletClient({
    account: borrowerAccount,
    chain: sepolia,
    transport,
  });

  const bidderA = createWalletClient({
    account: bidderAAccount,
    chain: sepolia,
    transport,
  });

  const bidderB = createWalletClient({
    account: bidderBAccount,
    chain: sepolia,
    transport,
  });

  return { publicClient, lender, borrower, bidderA, bidderB };
}

export type Clients = ReturnType<typeof createClients>;

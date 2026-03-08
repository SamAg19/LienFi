"use client"

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { useNotification } from "@blockscout/app-sdk"
import { useEffect, useRef } from "react"
import { CHAIN_ID, CONTRACTS } from "@/config/contracts"
import { addTxRecord, updateTxStatus } from "@/lib/txHistory"

const CONTRACT_NAMES: Record<string, string> = {
  [CONTRACTS.MockUSDC.address.toLowerCase()]: "MockUSDC",
  [CONTRACTS.clUSDC.address.toLowerCase()]: "clUSDC",
  [CONTRACTS.LendingPool.address.toLowerCase()]: "LendingPool",
  [CONTRACTS.LoanManager.address.toLowerCase()]: "LoanManager",
  [CONTRACTS.PropertyNFT.address.toLowerCase()]: "PropertyNFT",
  [CONTRACTS.LienFiAuction.address.toLowerCase()]: "LienFiAuction",
}

/**
 * Wraps useWriteContract with Blockscout tx toast notifications.
 * Automatically injects chainId: CHAIN_ID (Sepolia) into every writeContract call.
 * Tracks all transactions in localStorage for the Activity page.
 */
export function useBlockscoutTx() {
  const result = useWriteContract({
    mutation: {
      onError: (error) => {
        console.error("[useBlockscoutTx] writeContract error:", error)
      },
    },
  })
  const { openTxToast } = useNotification()
  const toastedHashes = useRef<Set<string>>(new Set())
  const lastCallRef = useRef<{ functionName: string; contractName: string } | null>(null)

  // Track confirmed/failed status — wait for 1 confirmation before showing Blockscout toast
  const { isSuccess, isError } = useWaitForTransactionReceipt({ hash: result.data, confirmations: 1 })

  // Save to tx history immediately when hash is available
  useEffect(() => {
    if (result.data && !toastedHashes.current.has(result.data)) {
      toastedHashes.current.add(result.data)
      addTxRecord({
        hash: result.data,
        functionName: lastCallRef.current?.functionName || "unknown",
        contractName: lastCallRef.current?.contractName || "unknown",
        timestamp: Date.now(),
        status: "pending",
      })
    }
  }, [result.data])

  // Show Blockscout toast only after 1 block confirmation (so indexer has it)
  useEffect(() => {
    if (result.data && isSuccess) {
      openTxToast(String(CHAIN_ID), result.data)
    }
  }, [result.data, isSuccess, openTxToast])

  useEffect(() => {
    if (result.data && isSuccess) updateTxStatus(result.data, "confirmed")
  }, [result.data, isSuccess])

  useEffect(() => {
    if (result.data && isError) updateTxStatus(result.data, "failed")
  }, [result.data, isError])

  // Wrap writeContract to always inject chainId + track call metadata
  const originalWriteContract = result.writeContract
  const writeContract: typeof originalWriteContract = (variables, options) => {
    const addr = (variables.address || "").toLowerCase()
    lastCallRef.current = {
      functionName: (variables.functionName as string) || "unknown",
      contractName: CONTRACT_NAMES[addr] || "Contract",
    }
    // @ts-expect-error — wagmi's complex union types don't support spread + chainId injection
    return originalWriteContract({ ...variables, chainId: CHAIN_ID }, options)
  }

  // Also wrap writeContractAsync for promise-based two-step flows (approve → deposit)
  const originalWriteContractAsync = result.writeContractAsync
  const writeContractAsync: typeof originalWriteContractAsync = (variables, options) => {
    const addr = (variables.address || "").toLowerCase()
    lastCallRef.current = {
      functionName: (variables.functionName as string) || "unknown",
      contractName: CONTRACT_NAMES[addr] || "Contract",
    }
    // @ts-expect-error — wagmi's complex union types don't support spread + chainId injection
    return originalWriteContractAsync({ ...variables, chainId: CHAIN_ID }, options)
  }

  return { ...result, writeContract, writeContractAsync }
}

"use client"

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { useNotification } from "@blockscout/app-sdk"
import { useEffect, useCallback, useRef } from "react"
import { CHAIN_ID } from "@/config/contracts"

/**
 * Wraps useWriteContract with Blockscout tx toast notifications.
 * Automatically shows a Blockscout toast when a tx hash is available.
 */
export function useBlockscoutTx() {
  const writeResult = useWriteContract()
  const { openTxToast } = useNotification()
  const toastedHashes = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (writeResult.data && !toastedHashes.current.has(writeResult.data)) {
      toastedHashes.current.add(writeResult.data)
      openTxToast(String(CHAIN_ID), writeResult.data)
    }
  }, [writeResult.data, openTxToast])

  return writeResult
}

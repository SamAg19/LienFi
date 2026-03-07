"use client"

import { useReadContracts } from "wagmi"
import { CONTRACTS } from "@/config/contracts"

export function usePoolStats() {
  const results = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.LendingPool.address,
        abi: CONTRACTS.LendingPool.abi,
        functionName: "availableLiquidity",
      },
      {
        address: CONTRACTS.LendingPool.address,
        abi: CONTRACTS.LendingPool.abi,
        functionName: "exchangeRate",
      },
      {
        address: CONTRACTS.LendingPool.address,
        abi: CONTRACTS.LendingPool.abi,
        functionName: "totalPoolValue",
      },
      {
        address: CONTRACTS.LendingPool.address,
        abi: CONTRACTS.LendingPool.abi,
        functionName: "totalLoaned",
      },
    ],
  })

  return {
    availableLiquidity: results.data?.[0]?.result as bigint | undefined,
    exchangeRate: results.data?.[1]?.result as bigint | undefined,
    totalPoolValue: results.data?.[2]?.result as bigint | undefined,
    totalLoaned: results.data?.[3]?.result as bigint | undefined,
    isLoading: results.isLoading,
    refetch: results.refetch,
  }
}

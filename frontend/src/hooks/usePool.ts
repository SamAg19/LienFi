"use client"

import { useReadContracts } from "wagmi"
import { CONTRACTS } from "@/config/contracts"

export function usePoolStats() {
  const results = useReadContracts({
    query: { refetchInterval: 8000 },
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
      {
        address: CONTRACTS.clUSDC.address,
        abi: CONTRACTS.clUSDC.abi,
        functionName: "totalSupply",
      },
      {
        address: CONTRACTS.LoanManager.address,
        abi: CONTRACTS.LoanManager.abi,
        functionName: "loanCounter",
      },
    ],
  })

  return {
    availableLiquidity: results.data?.[0]?.result as bigint | undefined,
    exchangeRate: results.data?.[1]?.result as bigint | undefined,
    totalPoolValue: results.data?.[2]?.result as bigint | undefined,
    totalLoaned: results.data?.[3]?.result as bigint | undefined,
    clUsdcTotalSupply: results.data?.[4]?.result as bigint | undefined,
    loanCounter: results.data?.[5]?.result as bigint | undefined,
    isLoading: results.isLoading,
    refetch: results.refetch,
  }
}

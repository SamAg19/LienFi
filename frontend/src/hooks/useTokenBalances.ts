"use client"

import { useReadContracts, useAccount } from "wagmi"
import { CONTRACTS } from "@/config/contracts"

export function useTokenBalances() {
  const { address } = useAccount()

  const results = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.MockUSDC.address,
        abi: CONTRACTS.MockUSDC.abi,
        functionName: "balanceOf",
        args: [address!],
      },
      {
        address: CONTRACTS.clUSDC.address,
        abi: CONTRACTS.clUSDC.abi,
        functionName: "balanceOf",
        args: [address!],
      },
      {
        address: CONTRACTS.MockUSDC.address,
        abi: CONTRACTS.MockUSDC.abi,
        functionName: "allowance",
        args: [address!, CONTRACTS.LendingPool.address],
      },
      {
        address: CONTRACTS.MockUSDC.address,
        abi: CONTRACTS.MockUSDC.abi,
        functionName: "allowance",
        args: [address!, CONTRACTS.LienFiAuction.address],
      },
    ],
    query: { enabled: !!address, refetchInterval: 8000 },
  })

  return {
    usdcBalance: results.data?.[0]?.result as bigint | undefined,
    clUsdcBalance: results.data?.[1]?.result as bigint | undefined,
    usdcAllowanceLendingPool: results.data?.[2]?.result as bigint | undefined,
    usdcAllowanceAuction: results.data?.[3]?.result as bigint | undefined,
    isLoading: results.isLoading,
    refetch: results.refetch,
  }
}

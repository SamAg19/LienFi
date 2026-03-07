"use client"

import { useReadContract, useReadContracts, useAccount } from "wagmi"
import { CONTRACTS, ZERO_BYTES32 } from "@/config/contracts"

export function useBorrowerState() {
  const { address } = useAccount()

  const results = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.LoanManager.address,
        abi: CONTRACTS.LoanManager.abi,
        functionName: "pendingRequests",
        args: [address!],
      },
      {
        address: CONTRACTS.LoanManager.address,
        abi: CONTRACTS.LoanManager.abi,
        functionName: "borrowerActiveLoan",
        args: [address!],
      },
      {
        address: CONTRACTS.LoanManager.address,
        abi: CONTRACTS.LoanManager.abi,
        functionName: "pendingApprovals",
        args: [address!],
      },
    ],
    query: { enabled: !!address },
  })

  const pendingRequestHash = results.data?.[0]?.result as `0x${string}` | undefined
  const activeLoanId = results.data?.[1]?.result as bigint | undefined
  const approvalData = results.data?.[2]?.result as
    | readonly [
        `0x${string}`,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        boolean
      ]
    | undefined

  return {
    pendingRequestHash,
    hasPendingRequest: !!pendingRequestHash && pendingRequestHash !== ZERO_BYTES32,
    activeLoanId,
    hasActiveLoan: !!activeLoanId && activeLoanId > 0n,
    approval: approvalData
      ? {
          requestHash: approvalData[0],
          tokenId: approvalData[1],
          approvedLimit: approvalData[2],
          tenureMonths: approvalData[3],
          computedEMI: approvalData[4],
          expiresAt: approvalData[5],
          exists: approvalData[6],
        }
      : undefined,
    isLoading: results.isLoading,
    refetch: results.refetch,
  }
}

export function useLoan(loanId: bigint | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACTS.LoanManager.address,
    abi: CONTRACTS.LoanManager.abi,
    functionName: "getLoan",
    args: [loanId!],
    query: { enabled: !!loanId && loanId > 0n },
  })

  const loan = data as
    | {
        loanId: bigint
        borrower: string
        tokenId: bigint
        principal: bigint
        interestRateBps: bigint
        tenureMonths: bigint
        emiAmount: bigint
        nextDueDate: bigint
        missedPayments: bigint
        remainingPrincipal: bigint
        status: number
      }
    | undefined

  return { loan, isLoading, refetch }
}

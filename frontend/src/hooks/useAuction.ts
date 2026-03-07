"use client"

import { useReadContract, useAccount } from "wagmi"
import { CONTRACTS, ZERO_BYTES32 } from "@/config/contracts"

export function useActiveAuction() {
  const { data: activeAuctionId, isLoading: idLoading } = useReadContract({
    address: CONTRACTS.LienFiAuction.address,
    abi: CONTRACTS.LienFiAuction.abi,
    functionName: "activeAuctionId",
  })

  const hasAuction = !!activeAuctionId && activeAuctionId !== ZERO_BYTES32

  const { data: auctionData, isLoading: auctionLoading } = useReadContract({
    address: CONTRACTS.LienFiAuction.address,
    abi: CONTRACTS.LienFiAuction.abi,
    functionName: "auctions",
    args: [activeAuctionId!],
    query: { enabled: hasAuction },
  })

  const { data: bidCount } = useReadContract({
    address: CONTRACTS.LienFiAuction.address,
    abi: CONTRACTS.LienFiAuction.abi,
    functionName: "getBidCount",
    args: [activeAuctionId!],
    query: { enabled: hasAuction },
  })

  return {
    activeAuctionId: hasAuction ? activeAuctionId : undefined,
    auction: auctionData
      ? {
          seller: auctionData[0],
          tokenId: auctionData[1],
          deadline: auctionData[2],
          reservePrice: auctionData[3],
          settled: auctionData[4],
          winner: auctionData[5],
          settledPrice: auctionData[6],
          listingHash: auctionData[7],
        }
      : undefined,
    bidCount: bidCount as bigint | undefined,
    isLoading: idLoading || auctionLoading,
  }
}

export function useAuctionBidStatus(auctionId?: `0x${string}`) {
  const { address } = useAccount()

  const { data: canBid } = useReadContract({
    address: CONTRACTS.LienFiAuction.address,
    abi: CONTRACTS.LienFiAuction.abi,
    functionName: "canBid",
    args: [address!, auctionId!],
    query: { enabled: !!address && !!auctionId },
  })

  const { data: poolBalance } = useReadContract({
    address: CONTRACTS.LienFiAuction.address,
    abi: CONTRACTS.LienFiAuction.abi,
    functionName: "poolBalance",
    args: [address!, CONTRACTS.MockUSDC.address],
    query: { enabled: !!address },
  })

  const { data: lockExpiry } = useReadContract({
    address: CONTRACTS.LienFiAuction.address,
    abi: CONTRACTS.LienFiAuction.abi,
    functionName: "lockExpiry",
    args: [address!],
    query: { enabled: !!address },
  })

  return {
    canBid: canBid as boolean | undefined,
    poolBalance: poolBalance as bigint | undefined,
    lockExpiry: lockExpiry as bigint | undefined,
  }
}

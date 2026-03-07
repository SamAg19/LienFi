"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useAccount, useReadContract, useSignTypedData, useSignMessage } from "wagmi"
import { useBlockscoutTx } from "@/hooks/useBlockscoutTx"
import { CONTRACTS, ZERO_BYTES32, CHAIN_ID } from "@/config/contracts"
import { useAuctionBidStatus } from "@/hooks/useAuction"
import { useTokenBalances } from "@/hooks/useTokenBalances"
import { formatUSDC, parseUSDC } from "@/lib/utils"
import { submitBid, revealProperty } from "@/lib/api"
import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card"
import { CountdownTimer } from "@/components/ui/countdown-timer"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export default function AuctionDetailPage() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const { address } = useAccount()
  const bidStatus = useAuctionBidStatus(auctionId as `0x${string}`)
  const balances = useTokenBalances()

  const { data: auctionData, isLoading, refetch: refetchAuction } = useReadContract({ address: CONTRACTS.LienFiAuction.address, abi: CONTRACTS.LienFiAuction.abi, functionName: "auctions", args: [auctionId as `0x${string}`], query: { enabled: !!auctionId } })
  const { data: bidCount, refetch: refetchBidCount } = useReadContract({ address: CONTRACTS.LienFiAuction.address, abi: CONTRACTS.LienFiAuction.abi, functionName: "getBidCount", args: [auctionId as `0x${string}`], query: { enabled: !!auctionId } })

  const auction = auctionData ? { seller: auctionData[0], tokenId: auctionData[1], deadline: auctionData[2], reservePrice: auctionData[3], settled: auctionData[4], winner: auctionData[5], settledPrice: auctionData[6], listingHash: auctionData[7] } : undefined

  if (isLoading) return (
    <div className="h-64" style={{ background: '#E6E2D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '4px 4px 0px #0D0D0D' }} />
  )
  if (!auction) return <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#3D3D3D' }}>Auction not found.</p>

  const isExpired = Number(auction.deadline) * 1000 < Date.now()
  const isWinner = address && auction.winner.toLowerCase() === address.toLowerCase()

  return (
    <div className="space-y-6">
      <h1 className="display-title" style={{ marginTop: '16px' }}>Auction Detail</h1>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#888880', wordBreak: 'break-all' }}>{auctionId}</p>

      <GlassCard hover={false}>
        <GlassCardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="stat-label" style={{ marginBottom: '8px' }}>Status</p>
              <span className={`nb-tag ${auction.settled ? 'settled' : isExpired ? 'sealed' : 'live'}`}>
                {auction.settled ? "Settled" : isExpired ? "Awaiting Settlement" : "Live"}
              </span>
            </div>
            <div>
              <p className="stat-label" style={{ marginBottom: '8px' }}>Token ID</p>
              <p className="stat-number" style={{ fontSize: '24px' }}>#{auction.tokenId.toString()}</p>
            </div>
            <div>
              <p className="stat-label" style={{ marginBottom: '8px' }}>Reserve Price</p>
              <p className="stat-number" style={{ fontSize: '24px' }}>{formatUSDC(auction.reservePrice)} <span className="stat-label">USDC</span></p>
            </div>
            <div>
              <p className="stat-label" style={{ marginBottom: '8px' }}>Sealed Bids</p>
              <p className="stat-number" style={{ fontSize: '24px' }}>{bidCount?.toString() ?? "0"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 pt-6" style={{ borderTop: '2px solid #0D0D0D' }}>
            <div>
              <p className="stat-label" style={{ marginBottom: '8px' }}>Seller</p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#3D3D3D', wordBreak: 'break-all' }}>
                {auction.seller.slice(0, 10)}...{auction.seller.slice(-8)}
              </p>
            </div>
            <div>
              <p className="stat-label" style={{ marginBottom: '8px' }}>Deadline</p>
              {!auction.settled && !isExpired ? (
                <CountdownTimer deadline={Number(auction.deadline)} compact className="text-sm" />
              ) : (
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D' }}>
                  {new Date(Number(auction.deadline) * 1000).toLocaleString()}
                </p>
              )}
            </div>
            {auction.settled && (
              <>
                <div>
                  <p className="stat-label" style={{ marginBottom: '8px' }}>Winner</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#0D0D0D', fontWeight: 700, wordBreak: 'break-all' }}>
                    {auction.winner.slice(0, 10)}...{auction.winner.slice(-8)}
                  </p>
                </div>
                <div>
                  <p className="stat-label" style={{ marginBottom: '8px' }}>Settled Price</p>
                  <p className="stat-number" style={{ fontSize: '24px', color: '#0D0D0D' }}>
                    {formatUSDC(auction.settledPrice)} <span className="stat-label">USDC</span>
                  </p>
                </div>
              </>
            )}
          </div>
        </GlassCardContent>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {!auction.settled && !isExpired && <DepositToPoolPanel auctionId={auctionId} deadline={Number(auction.deadline)} bidStatus={bidStatus} balances={balances} address={address} />}
        {!auction.settled && !isExpired && <BidPanel auctionId={auctionId} deadline={Number(auction.deadline)} canBid={bidStatus.canBid} address={address} onBidSubmitted={() => refetchBidCount()} />}
        {auction.settled && isWinner && <RevealPanel auctionId={auctionId} />}
      </div>
    </div>
  )
}

function DepositToPoolPanel({ auctionId, deadline, bidStatus, balances, address }: { auctionId: string; deadline: number; bidStatus: ReturnType<typeof useAuctionBidStatus>; balances: ReturnType<typeof useTokenBalances>; address: `0x${string}` | undefined }) {
  const [amount, setAmount] = useState("")
  const [step, setStep] = useState<"idle" | "approving" | "depositing">("idle")
  const { writeContract, isPending } = useBlockscoutTx()

  const handleDeposit = () => {
    if (!address || !amount) return
    const parsedAmount = parseUSDC(amount)
    const lockUntil = BigInt(deadline + 86400)
    const root = 1n; const nullifierHash = BigInt(Date.now())
    const proof: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]
    const allowance = balances.usdcAllowanceLendingPool ?? 0n
    if (allowance < parsedAmount) {
      setStep("approving")
      writeContract({ address: CONTRACTS.MockUSDC.address, abi: CONTRACTS.MockUSDC.abi, functionName: "approve", args: [CONTRACTS.LienFiAuction.address, parsedAmount] }, {
        onSuccess: () => { toast.success("USDC approved, depositing..."); setStep("depositing"); writeContract({ address: CONTRACTS.LienFiAuction.address, abi: CONTRACTS.LienFiAuction.abi, functionName: "depositToPool", args: [CONTRACTS.MockUSDC.address, lockUntil, parsedAmount, root, nullifierHash, proof] }, { onSuccess: () => { toast.success("Deposit successful!"); setAmount(""); setStep("idle"); balances.refetch() }, onError: (e) => { toast.error(`Deposit failed: ${e.message.slice(0, 80)}`); setStep("idle") } }) },
        onError: (e) => { toast.error(`Approval failed: ${e.message.slice(0, 80)}`); setStep("idle") },
      })
    } else {
      setStep("depositing")
      writeContract({ address: CONTRACTS.LienFiAuction.address, abi: CONTRACTS.LienFiAuction.abi, functionName: "depositToPool", args: [CONTRACTS.MockUSDC.address, lockUntil, parsedAmount, root, nullifierHash, proof] }, { onSuccess: () => { toast.success("Deposit successful!"); setAmount(""); setStep("idle"); balances.refetch() }, onError: (e) => { toast.error(`Deposit failed: ${e.message.slice(0, 80)}`); setStep("idle") } })
    }
  }

  const busy = isPending || step !== "idle"

  return (
    <GlassCard hover={false}>
      <GlassCardHeader>
        <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>1. Deposit to Auction Pool</h2>
      </GlassCardHeader>
      <GlassCardContent>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D', marginBottom: '16px' }}>
          Deposit USDC with World ID verification to become eligible to bid. Funds locked until settlement.
        </p>
        {bidStatus.poolBalance !== undefined && bidStatus.poolBalance > 0n && (
          <div className="mb-4 p-3" style={{ background: '#A8F0D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#0D0D0D', fontWeight: 600 }}>
              Pool balance: {formatUSDC(bidStatus.poolBalance)} USDC
            </p>
          </div>
        )}
        <div className="space-y-3">
          <div className="relative">
            <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="nb-input" style={{ paddingRight: '60px', height: '44px' }} />
            <button onClick={() => { if (balances.usdcBalance) setAmount((Number(balances.usdcBalance) / 1e6).toString()) }} className="absolute right-3 top-1/2 -translate-y-1/2 nb-tag" style={{ background: '#C8F135', cursor: 'pointer' }}>MAX</button>
          </div>
          <button onClick={handleDeposit} disabled={!address || !amount || busy} className="nb-btn lime w-full" style={{ height: '44px' }}>
            {busy ? step === "approving" ? "Approving..." : "Depositing..." : "Deposit to Pool"}
          </button>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}

function BidPanel({ auctionId, deadline, canBid, address, onBidSubmitted }: { auctionId: string; deadline: number; canBid?: boolean; address: `0x${string}` | undefined; onBidSubmitted: () => void }) {
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { signTypedDataAsync } = useSignTypedData()

  const handleBid = async () => {
    if (!address || !amount) return
    setSubmitting(true)
    try {
      const parsedAmount = parseUSDC(amount)
      const nonce = Math.floor(Math.random() * 1e9)
      const signature = await signTypedDataAsync({ domain: { name: "LienFi", version: "1", chainId: BigInt(CHAIN_ID), verifyingContract: CONTRACTS.LienFiAuction.address }, types: { Bid: [{ name: "auctionId", type: "bytes32" }, { name: "bidder", type: "address" }, { name: "amount", type: "uint256" }, { name: "nonce", type: "uint256" }] }, primaryType: "Bid", message: { auctionId: auctionId as `0x${string}`, bidder: address, amount: parsedAmount, nonce: BigInt(nonce) } })
      const res = await submitBid({ auctionId, bidder: address, amount: parsedAmount.toString(), nonce, signature, auctionDeadline: deadline })
      if (res.error) { toast.error(`Bid failed: ${res.error}`) } else { toast.success("Sealed bid submitted!"); setAmount(""); onBidSubmitted() }
    } catch (e: any) { toast.error(`Bid error: ${e.message?.slice(0, 80) || "Unknown error"}`) } finally { setSubmitting(false) }
  }

  return (
    <GlassCard accent="lavender" hover={false}>
      <GlassCardHeader>
        <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>2. Submit Sealed Bid</h2>
      </GlassCardHeader>
      <GlassCardContent>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D', marginBottom: '16px' }}>
          Sign with EIP-712 — amount stays off-chain. Only a hash is stored until CRE reveals the winner.
        </p>
        {canBid === false && (
          <div className="mb-4 p-3" style={{ background: '#FF8A80', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#0D0D0D', fontWeight: 600 }}>
              Deposit to auction pool first.
            </p>
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="stat-label" style={{ marginBottom: '8px', display: 'block' }}>Bid Amount (USDC)</label>
            <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="nb-input" style={{ height: '44px' }} />
          </div>
          <button onClick={handleBid} disabled={!address || !amount || submitting || canBid === false} className="nb-btn w-full" style={{ height: '44px' }}>
            {submitting ? "Signing & Submitting..." : "Place Sealed Bid"}
          </button>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}

function RevealPanel({ auctionId }: { auctionId: string }) {
  const [revealing, setRevealing] = useState(false)
  const [propertyData, setPropertyData] = useState<any>(null)
  const { signMessageAsync } = useSignMessage()

  const handleReveal = async () => {
    setRevealing(true)
    try {
      const message = `Reveal property details for auction: ${auctionId}`
      const signature = await signMessageAsync({ message })
      const res = await revealProperty(auctionId, signature)
      if (res.error) { toast.error(`Reveal failed: ${res.error}`) } else { setPropertyData(res); toast.success("Property details revealed!") }
    } catch (e: any) { toast.error(`Reveal error: ${e.message?.slice(0, 80) || "Unknown error"}`) } finally { setRevealing(false) }
  }

  return (
    <GlassCard className="lg:col-span-2" accent="gold" hover={false}>
      <GlassCardHeader>
        <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Winner — Reveal Property</h2>
      </GlassCardHeader>
      <GlassCardContent>
        {!propertyData ? (
          <div className="text-center py-6">
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3D3D3D', marginBottom: '16px' }}>
              Congratulations! Sign to reveal the full property details.
            </p>
            <button onClick={handleReveal} disabled={revealing} className="nb-btn lime" style={{ padding: '12px 32px', height: '44px' }}>
              {revealing ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing...</> : "Reveal Property Details"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="nb-tag settled" style={{ marginBottom: '8px' }}>Property details decrypted</p>
            <pre
              className="p-4 overflow-x-auto whitespace-pre-wrap"
              style={{
                background: '#1A1A1A',
                color: '#C8F135',
                border: '2px solid #0D0D0D',
                borderRadius: '4px',
                boxShadow: '4px 4px 0px #0D0D0D',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
              }}
            >
              {JSON.stringify(propertyData, null, 2)}
            </pre>
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  )
}

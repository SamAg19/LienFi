"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
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
import {
  Loader2,
  ArrowLeft,
  Gavel,
  Lock,
  Eye,
  EyeOff,
  Shield,
  DollarSign,
  Users,
  Timer,
  Award,
  ChevronRight,
  Wallet,
  FileText,
} from "lucide-react"

export default function AuctionDetailPage() {
  const { auctionId } = useParams<{ auctionId: string }>()
  const { address } = useAccount()
  const bidStatus = useAuctionBidStatus(auctionId as `0x${string}`)
  const balances = useTokenBalances()

  const { data: auctionData, isLoading, refetch: refetchAuction } = useReadContract({
    address: CONTRACTS.LienFiAuction.address,
    abi: CONTRACTS.LienFiAuction.abi,
    functionName: "auctions",
    args: [auctionId as `0x${string}`],
    query: { enabled: !!auctionId, refetchInterval: 10000 },
  })
  const { data: bidCount, refetch: refetchBidCount } = useReadContract({
    address: CONTRACTS.LienFiAuction.address,
    abi: CONTRACTS.LienFiAuction.abi,
    functionName: "getBidCount",
    args: [auctionId as `0x${string}`],
    query: { enabled: !!auctionId, refetchInterval: 10000 },
  })

  const auction = auctionData
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
    : undefined

  // Notify user when auction settles
  const settledNotified = useRef(false)
  useEffect(() => {
    if (!auction?.settled || settledNotified.current || !address) return
    settledNotified.current = true
    const won = auction.winner.toLowerCase() === address.toLowerCase()
    if (won) {
      toast.success(
        `You won the auction! Settlement price: $${formatUSDC(auction.settledPrice)} USDC (Vickrey)`,
        { duration: 10000 }
      )
    } else {
      toast("Auction has been settled.", {
        description: `Winner: ${auction.winner.slice(0, 6)}...${auction.winner.slice(-4)}`,
        duration: 8000,
      })
    }
  }, [auction?.settled, auction?.winner, auction?.settledPrice, address])

  if (isLoading) return (
    <div className="space-y-4">
      <div className="h-12" style={{ background: '#E6E2D8', borderRadius: '4px', width: '200px' }} />
      <div className="h-64" style={{ background: '#E6E2D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '4px 4px 0px #0D0D0D' }} />
    </div>
  )
  if (!auction) return (
    <div className="space-y-4">
      <Link href="/auctions" className="flex items-center gap-1" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#888880' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Auctions
      </Link>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3D3D3D' }}>Auction not found.</p>
    </div>
  )

  const isExpired = Number(auction.deadline) * 1000 < Date.now()
  const isWinner = address && auction.winner.toLowerCase() === address.toLowerCase()
  const isSeller = address && auction.seller.toLowerCase() === address.toLowerCase()

  return (
    <div className="space-y-6">
      {/* Breadcrumb + title */}
      <div style={{ marginTop: '16px' }}>
        <Link href="/auctions" className="flex items-center gap-1 mb-3" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#888880' }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Auctions
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="display-title">Auction Detail</h1>
          <span className={`nb-tag ${auction.settled ? 'settled' : isExpired ? 'sealed' : 'live'}`} style={{ fontSize: '11px' }}>
            {auction.settled ? "Settled" : isExpired ? "Awaiting Settlement" : "Live"}
          </span>
        </div>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#888880', marginTop: '4px', wordBreak: 'break-all' }}>
          {auctionId}
        </p>
      </div>

      {/* Main info card */}
      <GlassCard hover={false} accent={auction.settled ? "mint" : undefined}>
        <GlassCardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatBlock label="Reserve Price" value={`$${formatUSDC(auction.reservePrice)}`} sub="USDC minimum" />
            <StatBlock
              label="Sealed Bids"
              value={bidCount?.toString() ?? "0"}
              sub={Number(bidCount ?? 0) === 0 ? 'none yet' : 'bids received'}
            />
            <StatBlock label="Property" value={`#${auction.tokenId.toString()}`} sub="Token ID" />
            <div>
              <p className="stat-label" style={{ marginBottom: '6px' }}>
                {auction.settled ? 'Settled Price' : isExpired ? 'Status' : 'Time Left'}
              </p>
              {auction.settled ? (
                <>
                  <p className="stat-number" style={{ fontSize: '24px', color: '#2E7D32' }}>
                    ${formatUSDC(auction.settledPrice)}
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#888880', marginTop: '2px' }}>Vickrey price</p>
                </>
              ) : !isExpired ? (
                <CountdownTimer deadline={Number(auction.deadline)} compact className="text-sm" />
              ) : (
                <>
                  <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '18px', color: '#FF8A80' }}>Expired</p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#888880', marginTop: '2px' }}>awaiting CRE</p>
                </>
              )}
            </div>
          </div>

          {/* Addresses row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-5" style={{ borderTop: '2px solid #0D0D0D' }}>
            <div>
              <p className="stat-label" style={{ marginBottom: '6px' }}>Seller (Defaulted Borrower)</p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#3D3D3D', wordBreak: 'break-all' }}>
                {auction.seller}
              </p>
              {isSeller && (
                <span className="nb-tag" style={{ background: '#FFD97D', fontSize: '10px', marginTop: '6px', display: 'inline-block' }}>You</span>
              )}
            </div>
            <div>
              <p className="stat-label" style={{ marginBottom: '6px' }}>Deadline</p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D' }}>
                {new Date(Number(auction.deadline) * 1000).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="stat-label" style={{ marginBottom: '6px' }}>Listing Hash</p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#3D3D3D', wordBreak: 'break-all' }}>
                {auction.listingHash.slice(0, 18)}...{auction.listingHash.slice(-8)}
              </p>
            </div>
          </div>

          {/* Settlement results */}
          {auction.settled && (
            <div className="mt-6 pt-5" style={{ borderTop: '2px solid #0D0D0D' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className="px-4 py-4 flex items-center gap-3"
                  style={{ background: '#A8F0D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}
                >
                  <Award className="w-5 h-5" style={{ color: '#0D0D0D' }} />
                  <div>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 700, color: '#0D0D0D' }}>Winner</p>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#0D0D0D', wordBreak: 'break-all' }}>
                      {auction.winner}
                    </p>
                    {isWinner && (
                      <span className="nb-tag" style={{ background: '#C8F135', fontSize: '10px', marginTop: '4px', display: 'inline-block' }}>That's you!</span>
                    )}
                  </div>
                </div>
                <div
                  className="px-4 py-4 flex items-center gap-3"
                  style={{ background: '#FFD97D', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}
                >
                  <DollarSign className="w-5 h-5" style={{ color: '#0D0D0D' }} />
                  <div>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 700, color: '#0D0D0D' }}>Settlement</p>
                    <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '20px', color: '#0D0D0D' }}>
                      ${formatUSDC(auction.settledPrice)} USDC
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D', marginTop: '2px' }}>
                      Second-highest price (Vickrey)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Countdown card (live only) */}
      {!auction.settled && !isExpired && (
        <GlassCard hover={false}>
          <GlassCardContent>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 flex items-center justify-center"
                  style={{ background: '#FFD97D', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}
                >
                  <Timer className="w-5 h-5" style={{ color: '#0D0D0D' }} />
                </div>
                <div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Bidding Closes In</p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#888880' }}>
                    Place your sealed bid before the deadline
                  </p>
                </div>
              </div>
              <CountdownTimer deadline={Number(auction.deadline)} />
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Action panels */}
      {!auction.settled && !isExpired && (
        <AuctionActionPanel
          auctionId={auctionId}
          deadline={Number(auction.deadline)}
          bidStatus={bidStatus}
          balances={balances}
          address={address}
          onBidSubmitted={() => refetchBidCount()}
        />
      )}
      {auction.settled && isWinner && (
        <div className="grid grid-cols-1 gap-4">
          <RevealPanel auctionId={auctionId} />
        </div>
      )}

      {/* Your bid status (if connected) */}
      {address && !auction.settled && (
        <GlassCard hover={false}>
          <GlassCardHeader>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Your Status</h2>
            <Wallet className="w-4 h-4" style={{ color: '#0D0D0D' }} />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatusItem
                label="Pool Deposit"
                value={bidStatus.poolBalance !== undefined && bidStatus.poolBalance > 0n ? `${formatUSDC(bidStatus.poolBalance)} USDC` : 'None'}
                ok={bidStatus.poolBalance !== undefined && bidStatus.poolBalance > 0n}
              />
              <StatusItem
                label="Bid Eligibility"
                value={bidStatus.canBid ? 'Eligible' : 'Not eligible'}
                ok={bidStatus.canBid === true}
              />
              <StatusItem
                label="Lock Expiry"
                value={bidStatus.lockExpiry && bidStatus.lockExpiry > 0n ? new Date(Number(bidStatus.lockExpiry) * 1000).toLocaleDateString() : 'N/A'}
                ok={bidStatus.lockExpiry !== undefined && bidStatus.lockExpiry > 0n}
              />
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Auction phase tracker */}
      <GlassCard hover={false}>
        <GlassCardHeader>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Auction Lifecycle</h2>
          <FileText className="w-4 h-4" style={{ color: '#0D0D0D' }} />
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-0">
            <LifecycleStep
              num="1"
              title="Auction Created"
              description="CRE detected a defaulted loan and created a sealed-bid auction on-chain."
              done
              accent="#C8F135"
            />
            <LifecycleConnector done={!isExpired || auction.settled} />
            <LifecycleStep
              num="2"
              title="Sealed Bidding Phase"
              description="Bidders deposit USDC to the pool then submit EIP-712 signed bids. Amounts are hidden."
              done={isExpired || auction.settled}
              active={!isExpired && !auction.settled}
              accent="#C4B5FF"
            />
            <LifecycleConnector done={auction.settled} />
            <LifecycleStep
              num="3"
              title="Deadline & Reveal"
              description="After deadline, CRE settlement workflow reveals bids inside the enclave and verifies signatures."
              done={auction.settled}
              active={isExpired && !auction.settled}
              accent="#FFD97D"
            />
            <LifecycleConnector done={auction.settled} />
            <LifecycleStep
              num="4"
              title="Vickrey Settlement"
              description="Highest bidder wins at the second-highest price. Winner gets property NFT, seller gets USDC."
              done={auction.settled}
              accent="#A8F0D8"
            />
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  )
}

/* --- Stat block helper --- */

function StatBlock({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="stat-label" style={{ marginBottom: '6px' }}>{label}</p>
      <p className="stat-number" style={{ fontSize: '24px' }}>{value}</p>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#888880', marginTop: '2px' }}>{sub}</p>
    </div>
  )
}

/* --- Status item --- */

function StatusItem({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div
      className="px-4 py-3 flex items-center gap-3"
      style={{
        background: ok ? 'rgba(168,240,216,0.3)' : 'rgba(230,226,216,0.5)',
        border: `1.5px solid ${ok ? '#2E7D32' : '#D4D0C8'}`,
        borderRadius: '4px',
      }}
    >
      <div
        className="w-6 h-6 flex items-center justify-center shrink-0"
        style={{
          border: '2px solid #0D0D0D',
          borderRadius: '50%',
          background: ok ? '#A8F0D8' : '#E6E2D8',
          fontSize: '10px',
          fontWeight: 900,
        }}
      >
        {ok ? '✓' : '—'}
      </div>
      <div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#888880' }}>{label}</p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 600, color: '#0D0D0D' }}>{value}</p>
      </div>
    </div>
  )
}

/* --- Lifecycle step --- */

function LifecycleStep({ num, title, description, done, active, accent }: { num: string; title: string; description: string; done: boolean; active?: boolean; accent: string }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 flex items-center justify-center shrink-0"
        style={{
          background: done ? '#C8F135' : active ? accent : '#E6E2D8',
          border: '2px solid #0D0D0D',
          borderRadius: '50%',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px',
          fontWeight: 900,
          boxShadow: active ? '2px 2px 0px #0D0D0D' : undefined,
        }}
      >
        {done ? '✓' : num}
      </div>
      <div className="pt-1">
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 700, color: done || active ? '#0D0D0D' : '#888880' }}>{title}</p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D', lineHeight: 1.5, marginTop: '2px' }}>{description}</p>
      </div>
    </div>
  )
}

function LifecycleConnector({ done }: { done: boolean }) {
  return (
    <div className="ml-[15px] h-6" style={{ width: '2px', background: done ? '#C8F135' : '#E6E2D8' }} />
  )
}

/* --- Single Smart Action Panel --- */

function AuctionActionPanel({
  auctionId,
  deadline,
  bidStatus,
  balances,
  address,
  onBidSubmitted,
}: {
  auctionId: string
  deadline: number
  bidStatus: ReturnType<typeof useAuctionBidStatus>
  balances: ReturnType<typeof useTokenBalances>
  address: `0x${string}` | undefined
  onBidSubmitted: () => void
}) {
  const [depositAmount, setDepositAmount] = useState("")
  const [bidAmount, setBidAmount] = useState("")
  const [submittingBid, setSubmittingBid] = useState(false)
  const [bidHash, setBidHash] = useState<string | null>(null)
  const { writeContractAsync, isPending } = useBlockscoutTx()
  const { signTypedDataAsync } = useSignTypedData()

  // Track deposit locally so UI updates immediately
  const [depositedLocally, setDepositedLocally] = useState(false)

  // On-chain state
  const poolBal = bidStatus.poolBalance
  const hasDeposited = depositedLocally || (poolBal !== undefined && poolBal > 0n)
  const canBid = bidStatus.canBid === true

  // Allowance check for deposit amount
  const parsedDeposit = depositAmount ? parseUSDC(depositAmount) : 0n
  const hasEnoughAllowance = balances.usdcAllowanceAuction !== undefined
    && parsedDeposit > 0n
    && balances.usdcAllowanceAuction >= parsedDeposit

  // Local state to track approval within session
  const [approvedInSession, setApprovedInSession] = useState(false)
  const effectiveAllowance = approvedInSession || hasEnoughAllowance

  // --- Handlers ---
  const handleApprove = async () => {
    if (!depositAmount) return
    console.log("[Approve] amount:", depositAmount, "parsed:", parsedDeposit.toString())
    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.MockUSDC.address,
        abi: CONTRACTS.MockUSDC.abi,
        functionName: "approve",
        args: [CONTRACTS.LienFiAuction.address, parsedDeposit],
      })
      console.log("[Approve] tx hash:", hash)
      toast.success("USDC approved! Now click Deposit.")
      setApprovedInSession(true)
      balances.refetch()
    } catch (e: any) {
      console.error("[Approve] Error:", e)
      toast.error(`Approval failed: ${e.shortMessage || e.message?.slice(0, 100)}`)
    }
  }

  const handleDeposit = async () => {
    if (!depositAmount) return
    const lockUntil = BigInt(deadline + 86400)
    console.log("[Deposit] amount:", parsedDeposit.toString(), "lockUntil:", lockUntil.toString(), "token:", CONTRACTS.MockUSDC.address)
    try {
      const hash = await writeContractAsync({
        address: CONTRACTS.LienFiAuction.address,
        abi: CONTRACTS.LienFiAuction.abi,
        functionName: "depositToPool",
        args: [CONTRACTS.MockUSDC.address, lockUntil, parsedDeposit],
      })
      console.log("[Deposit] tx hash:", hash)
      toast.success("Deposit successful! You can now place a sealed bid.")
      setDepositedLocally(true)
      setDepositAmount("")
      setApprovedInSession(false)
      balances.refetch()
      bidStatus.refetch()
    } catch (e: any) {
      console.error("[Deposit] Error:", e)
      toast.error(`Deposit failed: ${e.shortMessage || e.message?.slice(0, 100)}`)
    }
  }

  const handleBid = async () => {
    if (!address || !bidAmount) return
    setSubmittingBid(true)
    try {
      const parsedAmount = parseUSDC(bidAmount)
      const nonce = Math.floor(Math.random() * 1e9)
      const signature = await signTypedDataAsync({
        domain: {
          name: "LienFi",
          version: "1",
          chainId: BigInt(CHAIN_ID),
          verifyingContract: CONTRACTS.LienFiAuction.address,
        },
        types: {
          Bid: [
            { name: "auctionId", type: "bytes32" },
            { name: "bidder", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "nonce", type: "uint256" },
          ],
        },
        primaryType: "Bid",
        message: {
          auctionId: auctionId as `0x${string}`,
          bidder: address,
          amount: parsedAmount,
          nonce: BigInt(nonce),
        },
      })
      const res = await submitBid({
        auctionId,
        bidder: address,
        amount: parsedAmount.toString(),
        nonce,
        signature,
        auctionDeadline: deadline,
      })
      if (res.error) {
        toast.error(`Bid failed: ${res.error}`)
      } else {
        toast.success("Sealed bid submitted!")
        setBidHash(res.bidHash || res.hash || signature.slice(0, 18))
        setBidAmount("")
        onBidSubmitted()
      }
    } catch (e: any) {
      toast.error(`Bid error: ${e.message?.slice(0, 80) || "Unknown error"}`)
    } finally {
      setSubmittingBid(false)
    }
  }

  // ─── DEPOSITED → Show bid UI ───
  if (hasDeposited) {
    return (
      <GlassCard hover={false}>
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 flex items-center justify-center"
              style={{ border: '2px solid #0D0D0D', borderRadius: '4px', background: '#C4B5FF' }}
            >
              <Lock className="w-3.5 h-3.5" style={{ color: '#0D0D0D' }} />
            </div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>
              Place Sealed Bid
            </h2>
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          {/* Pool balance badge */}
          <div
            className="mb-4 px-4 py-3 flex items-center gap-2"
            style={{ background: '#A8F0D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}
          >
            <DollarSign className="w-4 h-4" style={{ color: '#0D0D0D' }} />
            <div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 700, color: '#0D0D0D' }}>
                Pool Balance: {formatUSDC(poolBal!)} USDC
              </p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>
                {canBid ? 'Eligible to bid' : 'Deposit below reserve price'}
              </p>
            </div>
          </div>

          {bidHash ? (
            <div className="space-y-4">
              <div
                className="px-4 py-4 text-center"
                style={{ background: '#A8F0D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}
              >
                <Shield className="w-6 h-6 mx-auto mb-2" style={{ color: '#0D0D0D' }} />
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D', marginBottom: '4px' }}>
                  Sealed Bid Submitted
                </p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D' }}>
                  Your bid is sealed in the CRE enclave. The winner will be revealed after the auction deadline.
                </p>
              </div>
              <div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D', marginBottom: '4px' }}>Bid Hash:</p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#0D0D0D', wordBreak: 'break-all', background: 'rgba(230,226,216,0.5)', padding: '8px 10px', borderRadius: '3px', border: '1.5px solid #D4D0C8' }}>
                  {bidHash}
                </p>
              </div>
              <div
                className="px-3 py-2 flex items-center gap-2"
                style={{ background: 'rgba(196,181,255,0.3)', border: '1.5px solid #C4B5FF', borderRadius: '4px' }}
              >
                <EyeOff className="w-3.5 h-3.5" style={{ color: '#0D0D0D' }} />
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>
                  Bid amounts stay private until settlement
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D', marginBottom: '4px', lineHeight: 1.6 }}>
                Sign an EIP-712 typed message with your bid amount. The amount stays off-chain in the CRE enclave — only the bid count is public.
              </p>
              <div>
                <label className="stat-label" style={{ marginBottom: '8px', display: 'block' }}>Bid Amount (USDC)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="nb-input"
                  style={{ height: '44px' }}
                />
              </div>

              <div
                className="px-3 py-2 flex items-center gap-2"
                style={{ background: 'rgba(196,181,255,0.3)', border: '1.5px solid #C4B5FF', borderRadius: '4px' }}
              >
                <EyeOff className="w-3.5 h-3.5" style={{ color: '#0D0D0D' }} />
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>
                  Your bid amount is private — sealed in CRE enclave
                </span>
              </div>

              <button
                onClick={handleBid}
                disabled={!address || !bidAmount || submittingBid || !canBid}
                className="nb-btn w-full"
                style={{ height: '44px' }}
              >
                {submittingBid ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Signing & Submitting...
                  </span>
                ) : (
                  "Place Sealed Bid"
                )}
              </button>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    )
  }

  // ─── NOT DEPOSITED → Show deposit UI ───
  // Decide button: approve or deposit
  const needsApproval = !effectiveAllowance

  return (
    <GlassCard hover={false}>
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 flex items-center justify-center"
            style={{ border: '2px solid #0D0D0D', borderRadius: '4px', background: '#A8D8FF' }}
          >
            <DollarSign className="w-3.5 h-3.5" style={{ color: '#0D0D0D' }} />
          </div>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>
            Deposit to Pool
          </h2>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D', marginBottom: '16px', lineHeight: 1.6 }}>
          Deposit USDC to become eligible to bid. Funds are locked until auction settlement. After depositing, you can place a sealed bid.
        </p>

        <div className="space-y-3">
          <div>
            <label className="stat-label" style={{ marginBottom: '8px', display: 'block' }}>Deposit Amount (USDC)</label>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => { setDepositAmount(e.target.value); setApprovedInSession(false) }}
                className="nb-input"
                style={{ paddingRight: '60px', height: '44px' }}
                disabled={isPending}
              />
              <button
                onClick={() => { if (balances.usdcBalance) setDepositAmount((Number(balances.usdcBalance) / 1e6).toString()) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 nb-tag"
                style={{ background: '#C8F135', cursor: 'pointer' }}
              >
                MAX
              </button>
            </div>
          </div>

          {balances.usdcBalance !== undefined && (
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#888880' }}>
              Wallet: {formatUSDC(balances.usdcBalance)} USDC available
            </p>
          )}

          {needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={!address || !depositAmount || isPending}
              className="nb-btn lime w-full"
              style={{ height: '44px' }}
            >
              {isPending ? "Approving..." : "Approve USDC"}
            </button>
          ) : (
            <button
              onClick={handleDeposit}
              disabled={!address || !depositAmount || isPending}
              className="nb-btn lime w-full"
              style={{ height: '44px' }}
            >
              {isPending ? "Depositing..." : "Deposit to Auction Pool"}
            </button>
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}

/* --- Reveal Panel --- */

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
      if (res.error) {
        toast.error(`Reveal failed: ${res.error}`)
      } else {
        setPropertyData(res)
        toast.success("Property details revealed!")
      }
    } catch (e: any) {
      toast.error(`Reveal error: ${e.message?.slice(0, 80) || "Unknown error"}`)
    } finally {
      setRevealing(false)
    }
  }

  return (
    <GlassCard className="lg:col-span-2" accent="gold" hover={false}>
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 flex items-center justify-center"
            style={{ border: '2px solid #0D0D0D', borderRadius: '4px', background: '#FFD97D' }}
          >
            <Award className="w-3.5 h-3.5" style={{ color: '#0D0D0D' }} />
          </div>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>
            Winner — Reveal Property Details
          </h2>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        {!propertyData ? (
          <div className="text-center py-8">
            <div
              className="w-16 h-16 flex items-center justify-center mx-auto mb-4"
              style={{ background: '#A8F0D8', border: '2px solid #0D0D0D', borderRadius: '50%', boxShadow: '4px 4px 0px #0D0D0D' }}
            >
              <Award className="w-7 h-7" style={{ color: '#0D0D0D' }} />
            </div>
            <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '20px', color: '#0D0D0D', marginBottom: '8px' }}>
              Congratulations!
            </p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3D3D3D', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>
              You won this auction. Sign with your wallet to reveal the full property details — address, title, and deed information.
            </p>
            <button onClick={handleReveal} disabled={revealing} className="nb-btn lime" style={{ padding: '12px 32px', height: '48px', fontSize: '14px' }}>
              {revealing ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Signing...</span>
              ) : (
                <span className="flex items-center gap-2"><Eye className="w-4 h-4" /> Reveal Property Details</span>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{ background: '#A8F0D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}
            >
              <Eye className="w-4 h-4" style={{ color: '#0D0D0D' }} />
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 700, color: '#0D0D0D' }}>
                Property details decrypted successfully
              </p>
            </div>
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

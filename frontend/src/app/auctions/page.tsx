"use client"

import Link from "next/link"
import { useActiveAuction } from "@/hooks/useAuction"
import { formatUSDC } from "@/lib/utils"
import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card"
import { CountdownTimer } from "@/components/ui/countdown-timer"
import { StatCard } from "@/components/ui/stat-card"
import {
  Gavel,
  Lock,
  Eye,
  EyeOff,
  Shield,
  ArrowRight,
  Timer,
  Users,
  DollarSign,
  Zap,
} from "lucide-react"

export default function AuctionsPage() {
  const { activeAuctionId, auction, bidCount, isLoading } = useActiveAuction()

  const hasAuction = !!activeAuctionId && !!auction
  const isExpired = hasAuction && Number(auction.deadline) * 1000 < Date.now()
  const isSettled = hasAuction && auction.settled

  return (
    <div className="space-y-6">
      <div style={{ marginTop: '16px' }}>
        <h1 className="display-title">Auctions</h1>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3D3D3D', marginTop: '4px' }}>
          Sealed-bid Vickrey auctions for defaulted loan collateral. Bid amounts stay private until settlement.
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Auctions"
          value={hasAuction && !isSettled ? "1" : "0"}
          icon={<Gavel className="w-4 h-4" style={{ color: '#0D0D0D' }} />}
          loading={isLoading}
          accent="lavender"
        />
        <StatCard
          label="Sealed Bids"
          value={bidCount?.toString() ?? "0"}
          icon={<Lock className="w-4 h-4" style={{ color: '#0D0D0D' }} />}
          loading={isLoading}
          accent="peach"
        />
        <StatCard
          label="Reserve Price"
          value={hasAuction ? `$${formatUSDC(auction.reservePrice)}` : "$0.00"}
          icon={<DollarSign className="w-4 h-4" style={{ color: '#0D0D0D' }} />}
          loading={isLoading}
          accent="lime"
        />
        <StatCard
          label="Auction Status"
          value={!hasAuction ? "None" : isSettled ? "Settled" : isExpired ? "Awaiting" : "Live"}
          icon={<Timer className="w-4 h-4" style={{ color: '#0D0D0D' }} />}
          loading={isLoading}
          accent="sky"
        />
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="h-64" style={{ background: '#E6E2D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '4px 4px 0px #0D0D0D' }} />
      ) : !hasAuction ? (
        /* Empty state */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlassCard hover={false}>
            <GlassCardContent>
              <div className="text-center py-8">
                <div
                  className="w-16 h-16 flex items-center justify-center mx-auto mb-5"
                  style={{ border: '2px solid #0D0D0D', borderRadius: '4px', background: '#C4B5FF', boxShadow: '4px 4px 0px #0D0D0D' }}
                >
                  <Gavel className="w-7 h-7" style={{ color: '#0D0D0D' }} />
                </div>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '16px', fontWeight: 700, color: '#0D0D0D', marginBottom: '8px' }}>
                  No Active Auctions
                </p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#888880', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
                  Auctions are created automatically when a borrower defaults on 3 consecutive EMI payments. The CRE workflow detects defaults and creates sealed-bid auctions on-chain.
                </p>
                <div
                  className="mt-6 px-4 py-3 inline-flex items-center gap-2"
                  style={{ background: '#A8F0D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}
                >
                  <Shield className="w-4 h-4" style={{ color: '#0D0D0D' }} />
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 600, color: '#0D0D0D' }}>
                    All loans are currently healthy
                  </span>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Default detection info */}
          <GlassCard hover={false}>
            <GlassCardHeader>
              <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Default Detection</h2>
              <Zap className="w-4 h-4" style={{ color: '#0D0D0D' }} />
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-4">
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D', lineHeight: 1.6 }}>
                  The CRE create-auction workflow runs on a cron schedule, scanning all active loans for default conditions.
                </p>
                <div className="space-y-3">
                  <DefaultStep num="1" text="CRE scans all active loans on-chain" />
                  <DefaultStep num="2" text="Detects loans with 3+ missed EMI payments" />
                  <DefaultStep num="3" text="Fetches property listing hash from API" />
                  <DefaultStep num="4" text="Creates sealed-bid auction on LienFiAuction contract" />
                </div>
                <div
                  className="px-3 py-2 flex items-center gap-2"
                  style={{ background: 'rgba(200,241,53,0.2)', border: '1.5px solid #C8F135', borderRadius: '4px' }}
                >
                  <Timer className="w-3.5 h-3.5" style={{ color: '#0D0D0D' }} />
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>
                    Only one auction can be active at a time
                  </span>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      ) : (
        /* Active auction */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Auction card — span 2 cols */}
          <div className="lg:col-span-2">
            <Link href={`/auctions/${activeAuctionId}`}>
              <GlassCard accent={isSettled ? "mint" : "lavender"}>
                <GlassCardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 flex items-center justify-center"
                      style={{
                        border: '2px solid #0D0D0D',
                        borderRadius: '4px',
                        background: isSettled ? '#A8F0D8' : isExpired ? '#FFD97D' : '#FF8A80',
                        boxShadow: '2px 2px 0px #0D0D0D',
                      }}
                    >
                      <Gavel className="w-4 h-4" style={{ color: '#0D0D0D' }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`nb-tag ${isSettled ? 'settled' : 'live'}`}>
                        {isSettled ? "Settled" : isExpired ? "Awaiting Settlement" : "Live Auction"}
                      </span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#888880' }}>
                        Property #{auction.tokenId.toString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" style={{ color: '#0D0D0D' }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 700 }}>View Details</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </GlassCardHeader>
                <GlassCardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="stat-label" style={{ marginBottom: '6px' }}>Reserve Price</p>
                      <p className="stat-number" style={{ fontSize: '22px' }}>
                        ${formatUSDC(auction.reservePrice)}
                      </p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#888880', marginTop: '2px' }}>USDC</p>
                    </div>
                    <div>
                      <p className="stat-label" style={{ marginBottom: '6px' }}>Sealed Bids</p>
                      <p className="stat-number" style={{ fontSize: '22px' }}>{bidCount?.toString() ?? "0"}</p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#888880', marginTop: '2px' }}>
                        {Number(bidCount ?? 0) === 0 ? 'no bids yet' : 'bids received'}
                      </p>
                    </div>
                    <div>
                      <p className="stat-label" style={{ marginBottom: '6px' }}>Seller</p>
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#0D0D0D' }}>
                        {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                      </p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#888880', marginTop: '2px' }}>defaulted borrower</p>
                    </div>
                    <div>
                      <p className="stat-label" style={{ marginBottom: '6px' }}>
                        {isSettled ? 'Settled Price' : 'Time Remaining'}
                      </p>
                      {isSettled ? (
                        <p className="stat-number" style={{ fontSize: '22px', color: '#2E7D32' }}>
                          ${formatUSDC(auction.settledPrice)}
                        </p>
                      ) : !isExpired ? (
                        <CountdownTimer deadline={Number(auction.deadline)} compact className="text-sm" />
                      ) : (
                        <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '16px', color: '#FF8A80' }}>Expired</p>
                      )}
                    </div>
                  </div>

                  {/* Progress bar showing auction phase */}
                  <div className="mt-6 pt-4" style={{ borderTop: '2px solid #0D0D0D' }}>
                    <div className="flex items-center gap-0">
                      <AuctionPhase label="Created" active done />
                      <PhaseConnector done={!isExpired || isSettled} />
                      <AuctionPhase label="Bidding" active={!isExpired && !isSettled} done={isExpired || isSettled} />
                      <PhaseConnector done={isExpired || isSettled} />
                      <AuctionPhase label="Deadline" active={isExpired && !isSettled} done={isSettled} />
                      <PhaseConnector done={isSettled} />
                      <AuctionPhase label="Settled" active={isSettled} done={isSettled} />
                    </div>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </Link>
          </div>

          {/* Countdown / Settlement info */}
          <GlassCard hover={false}>
            <GlassCardHeader>
              <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>
                {isSettled ? 'Settlement' : 'Countdown'}
              </h2>
              <Timer className="w-4 h-4" style={{ color: '#0D0D0D' }} />
            </GlassCardHeader>
            <GlassCardContent>
              {isSettled ? (
                <div className="space-y-4">
                  <div
                    className="text-center py-4 px-3"
                    style={{ background: '#A8F0D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}
                  >
                    <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '24px', color: '#0D0D0D' }}>
                      ${formatUSDC(auction.settledPrice)}
                    </p>
                    <p className="stat-label" style={{ marginTop: '4px' }}>Vickrey Price</p>
                  </div>
                  <InfoRow label="Winner" value={`${auction.winner.slice(0, 6)}...${auction.winner.slice(-4)}`} />
                  <InfoRow label="Method" value="Second-price (Vickrey)" />
                </div>
              ) : !isExpired ? (
                <div className="space-y-4">
                  <div className="flex justify-center py-2">
                    <CountdownTimer deadline={Number(auction.deadline)} />
                  </div>
                  <div
                    className="px-3 py-2 flex items-center gap-2"
                    style={{ background: 'rgba(200,241,53,0.2)', border: '1.5px solid #C8F135', borderRadius: '4px' }}
                  >
                    <Lock className="w-3.5 h-3.5" style={{ color: '#0D0D0D' }} />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>
                      Bids are sealed until deadline
                    </span>
                  </div>
                  <InfoRow label="Auction ID" value={`${activeAuctionId!.slice(0, 10)}...`} mono />
                  <InfoRow label="Deadline" value={new Date(Number(auction.deadline) * 1000).toLocaleString()} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    className="text-center py-4 px-3"
                    style={{ background: '#FFD97D', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}
                  >
                    <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '16px', color: '#0D0D0D' }}>
                      Awaiting CRE Settlement
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D', marginTop: '4px' }}>
                      The settlement workflow will reveal bids and determine the winner
                    </p>
                  </div>
                  <InfoRow label="Total Bids" value={bidCount?.toString() ?? "0"} />
                  <InfoRow label="Expired" value={new Date(Number(auction.deadline) * 1000).toLocaleString()} />
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </div>
      )}

      {/* How Vickrey Auctions Work */}
      <GlassCard hover={false}>
        <GlassCardHeader>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>How Sealed-Bid Auctions Work</h2>
          <EyeOff className="w-4 h-4" style={{ color: '#0D0D0D' }} />
        </GlassCardHeader>
        <GlassCardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <AuctionStep
              step="1"
              title="Deposit to Pool"
              description="Deposit USDC with World ID verification. Funds are locked until auction settles. This proves solvency without revealing intent."
              icon={<DollarSign className="w-4 h-4" style={{ color: '#0D0D0D' }} />}
              accent="#A8D8FF"
            />
            <AuctionStep
              step="2"
              title="Place Sealed Bid"
              description="Sign an EIP-712 typed message with your bid amount. The bid is stored off-chain in the CRE enclave — nobody sees amounts."
              icon={<Lock className="w-4 h-4" style={{ color: '#0D0D0D' }} />}
              accent="#C4B5FF"
            />
            <AuctionStep
              step="3"
              title="CRE Reveals Bids"
              description="After the deadline, the CRE settlement workflow reveals all bids, verifies signatures, and determines the winner inside a secure enclave."
              icon={<Eye className="w-4 h-4" style={{ color: '#0D0D0D' }} />}
              accent="#FFD97D"
            />
            <AuctionStep
              step="4"
              title="Vickrey Settlement"
              description="The highest bidder wins but pays the second-highest price. This incentivizes truthful bidding. Settlement is written on-chain."
              icon={<Gavel className="w-4 h-4" style={{ color: '#0D0D0D' }} />}
              accent="#A8F0D8"
            />
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Privacy features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PrivacyFeature
          icon={<EyeOff className="w-4 h-4" style={{ color: '#0D0D0D' }} />}
          title="Bid Privacy"
          description="Bid amounts are never visible on-chain. Only an opaque bid count is public. Amounts stay in the CRE enclave."
          accent="#C4B5FF"
        />
        <PrivacyFeature
          icon={<Shield className="w-4 h-4" style={{ color: '#0D0D0D' }} />}
          title="World ID Verified"
          description="Each bidder must verify uniqueness via World ID before depositing. One person, one deposit — prevents sybil attacks."
          accent="#A8F0D8"
        />
        <PrivacyFeature
          icon={<Users className="w-4 h-4" style={{ color: '#0D0D0D' }} />}
          title="Fair Price Discovery"
          description="Vickrey (second-price) auctions mean the dominant strategy is to bid your true valuation. No gaming, no bid sniping."
          accent="#FFD97D"
        />
      </div>
    </div>
  )
}

/* --- Helper components --- */

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D' }}>{label}</span>
      <span style={{ fontFamily: mono ? "'JetBrains Mono', monospace" : "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 600, color: '#0D0D0D' }}>{value}</span>
    </div>
  )
}

function AuctionPhase({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div
        className="w-6 h-6 flex items-center justify-center"
        style={{
          border: '2px solid #0D0D0D',
          borderRadius: '50%',
          background: done ? '#C8F135' : active ? '#FFD97D' : '#E6E2D8',
          fontSize: '10px',
          fontWeight: 900,
        }}
      >
        {done ? '✓' : ''}
      </div>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', fontWeight: active || done ? 700 : 400, color: active || done ? '#0D0D0D' : '#888880' }}>
        {label}
      </span>
    </div>
  )
}

function PhaseConnector({ done }: { done: boolean }) {
  return (
    <div
      className="flex-1"
      style={{ height: '2px', background: done ? '#C8F135' : '#E6E2D8', marginTop: '-14px' }}
    />
  )
}

function AuctionStep({ step, title, description, icon, accent }: { step: string; title: string; description: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: '28px',
            height: '28px',
            background: accent,
            border: '2px solid #0D0D0D',
            borderRadius: '4px',
            boxShadow: '2px 2px 0px #0D0D0D',
          }}
        >
          {icon}
        </div>
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: '20px',
            height: '20px',
            background: '#FAFAF7',
            border: '2px solid #0D0D0D',
            borderRadius: '50%',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 900,
          }}
        >
          {step}
        </div>
      </div>
      <div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 700, color: '#0D0D0D', marginBottom: '4px' }}>{title}</p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D', lineHeight: 1.6 }}>{description}</p>
      </div>
    </div>
  )
}

function DefaultStep({ num, text }: { num: string; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: '20px',
          height: '20px',
          background: '#C4B5FF',
          border: '1.5px solid #0D0D0D',
          borderRadius: '50%',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          fontWeight: 900,
        }}
      >
        {num}
      </div>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D' }}>{text}</span>
    </div>
  )
}

function PrivacyFeature({ icon, title, description, accent }: { icon: React.ReactNode; title: string; description: string; accent: string }) {
  return (
    <GlassCard hover={false}>
      <GlassCardContent>
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 flex items-center justify-center shrink-0"
            style={{ background: accent, border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}
          >
            {icon}
          </div>
          <div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 700, color: '#0D0D0D', marginBottom: '4px' }}>{title}</p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D', lineHeight: 1.6 }}>{description}</p>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}

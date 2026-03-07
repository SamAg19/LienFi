"use client"

import { usePrivy } from "@privy-io/react-auth"
import { usePoolStats } from "@/hooks/usePool"
import { useActiveAuction } from "@/hooks/useAuction"
import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card"
import { StatCard } from "@/components/ui/stat-card"
import { PoolCompositionChart } from "@/components/charts/PoolCompositionChart"
import { ExchangeRateChart } from "@/components/charts/ExchangeRateChart"
import { CountdownTimer } from "@/components/ui/countdown-timer"
import { formatUSDC } from "@/lib/utils"
import Link from "next/link"
import {
  TrendingUp,
  ArrowRight,
  Shield,
  Lock,
  Gavel,
  DollarSign,
  Activity,
  Layers,
  Landmark,
} from "lucide-react"

export default function DashboardPage() {
  const { login, authenticated } = usePrivy()
  const { totalPoolValue, exchangeRate, totalLoaned, availableLiquidity, isLoading } = usePoolStats()
  const { activeAuctionId, auction, bidCount } = useActiveAuction()

  const tvl = totalPoolValue ? Number(totalPoolValue) / 1e6 : 0
  const rate = exchangeRate ? Number(exchangeRate) / 1e18 : 1
  const loaned = totalLoaned ? Number(totalLoaned) / 1e6 : 0
  const available = availableLiquidity ? Number(availableLiquidity) / 1e6 : 0

  const fmt = (n: number, d: number) => n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

  return (
    <div className="space-y-6">
      {/* Stats row — 4 colored cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Pool TVL" value={`$${fmt(tvl, 2)}`} icon={<DollarSign className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={isLoading} accent="lime" />
        <StatCard label="Exchange Rate" value={fmt(rate, 4)} icon={<TrendingUp className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={isLoading} accent="peach" />
        <StatCard label="Available Liquidity" value={`$${fmt(available, 2)}`} icon={<Layers className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={isLoading} accent="sky" />
        <StatCard label="Active Auctions" value={activeAuctionId ? "1" : "0"} icon={<Activity className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={isLoading} accent="lavender" />
      </div>

      {/* Hero section */}
      <div
        className="nb-card no-hover"
        style={{ background: '#F5E6C4', padding: 0, overflow: 'hidden' }}
      >
        {/* Top accent strip — 4 color bands */}
        <div className="flex" style={{ height: '6px' }}>
          <div style={{ flex: 1, background: '#E8F0D8' }} />
          <div style={{ flex: 1, background: '#D8ECFA' }} />
          <div style={{ flex: 1, background: '#E4DDF5' }} />
          <div style={{ flex: 1, background: '#F5E0D8' }} />
        </div>

        <div className="p-8 md:px-10 md:py-9">
          {/* Tag row */}
          <div className="flex items-center gap-3 mb-6">
            <span className="nb-tag" style={{ background: '#E4DDF5', fontSize: '9px' }}>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full inline-block anim-dot" style={{ background: '#0D0D0D' }} />
                Live on Sepolia
              </span>
            </span>
            <span className="nb-tag" style={{ background: '#E8F0D8', fontSize: '9px' }}>Chainlink CRE</span>
            <span className="nb-tag" style={{ background: '#D8ECFA', fontSize: '9px' }}>Vickrey Auction</span>
          </div>

          {/* Title block */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h2 style={{
                fontFamily: "'Fraunces', serif",
                fontWeight: 900,
                fontOpticalSizing: 'auto',
                fontStyle: 'italic',
                fontSize: '52px',
                color: '#0D0D0D',
                lineHeight: 1.05,
                letterSpacing: '-2.5px',
              }}>
                Private Credit<br />
                <span className="highlight-sweep">
                  + Sealed Auctions
                </span>
              </h2>
              <p style={{
                fontFamily: "'Fraunces', serif",
                fontWeight: 400,
                fontStyle: 'italic',
                fontSize: '15px',
                color: '#6B6B6B',
                maxWidth: '440px',
                marginTop: '14px',
                lineHeight: 1.75,
              }}>
                DeFi lending with confidential credit scoring and privacy-preserving
                Vickrey auctions — powered by Chainlink CRE.
              </p>
            </div>

            {/* Right side — key stats */}
            <div className="flex gap-3 shrink-0 mb-1">
              {[
                { label: 'TVL', value: `$${fmt(tvl, 0)}`, bg: '#E8F0D8' },
                { label: 'Rate', value: fmt(rate, 4), bg: '#D8ECFA' },
                { label: 'Auctions', value: activeAuctionId ? '1' : '0', bg: '#E4DDF5' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="px-4 py-3 text-center"
                  style={{ background: s.bg, border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D', minWidth: '80px' }}
                >
                  <span className="stat-number" style={{ fontSize: '20px', display: 'block' }}>{s.value}</span>
                  <span className="stat-label" style={{ fontSize: '9px', marginTop: '2px', display: 'block' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA row */}
          <div className="flex gap-3 mt-7" style={{ borderTop: '2px solid #0D0D0D', paddingTop: '20px' }}>
            {!authenticated ? (
              <button onClick={login} className="nb-btn" style={{ background: '#FAFAF7', color: '#0D0D0D' }}>
                Connect Wallet
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <Link href="/pool">
                  <button className="nb-btn" style={{ background: '#FAFAF7', color: '#0D0D0D' }}>
                    Deposit to Pool
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
                <Link href="/borrow">
                  <button className="nb-btn ghost">
                    Borrow
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Pool Composition */}
        <GlassCard className="lg:col-span-3 flex flex-col" hover={false}>
          <GlassCardHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 flex items-center justify-center" style={{ border: '2px solid #0D0D0D', borderRadius: '4px' }}>
                <Layers className="w-3.5 h-3.5" style={{ color: '#0D0D0D' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 700, color: '#0D0D0D' }}>Pool Composition</h2>
                <p className="stat-label" style={{ fontSize: '10px' }}>Current allocation</p>
              </div>
            </div>
          </GlassCardHeader>
          <div className="flex-1 flex items-center px-5 py-5">
            <div className="w-full">
              {isLoading ? (
                <div className="flex items-center justify-center" style={{ minHeight: '100px' }}>
                  <div className="w-full h-8" style={{ background: '#E6E2D8', border: '2px solid #0D0D0D', borderRadius: '4px' }} />
                </div>
              ) : (
                <PoolCompositionChart availableLiquidity={available} totalLoaned={loaned} />
              )}
            </div>
          </div>
        </GlassCard>

        <div className="lg:col-span-2 space-y-4">
          {/* Exchange Rate chart */}
          <GlassCard hover={false}>
            <GlassCardHeader>
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 flex items-center justify-center" style={{ border: '2px solid #0D0D0D', borderRadius: '4px' }}>
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: '#0D0D0D' }} />
                </div>
                <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 700, color: '#0D0D0D' }}>Exchange Rate</h2>
              </div>
              <span className="stat-number" style={{ fontSize: '20px' }}>{rate.toFixed(4)}</span>
            </GlassCardHeader>
            <GlassCardContent className="pb-2">
              {isLoading ? (
                <div className="h-[200px]" style={{ background: '#E6E2D8', borderRadius: '3px' }} />
              ) : (
                <ExchangeRateChart currentRate={rate} />
              )}
            </GlassCardContent>
          </GlassCard>

          {/* Live Auction card */}
          {activeAuctionId && auction && (
            <Link href={`/auctions/${activeAuctionId}`}>
              <div
                className="nb-card"
                style={{ background: '#E4DDF5' }}
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 flex items-center justify-center"
                        style={{ border: '2px solid #0D0D0D', borderRadius: '4px', background: 'rgba(255,255,255,0.5)' }}
                      >
                        <Gavel className="w-3.5 h-3.5" style={{ color: '#0D0D0D' }} />
                      </div>
                      <span
                        className="nb-tag"
                        style={{ background: '#F5CFC7', fontSize: '9px' }}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full inline-block anim-dot" style={{ background: '#0D0D0D' }} />
                          Live
                        </span>
                      </span>
                    </div>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', fontWeight: 700, color: '#0D0D0D' }}>View →</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="stat-label" style={{ marginBottom: '4px' }}>Token #{auction.tokenId.toString()}</p>
                      <p className="stat-number" style={{ fontSize: '22px' }}>
                        {formatUSDC(auction.reservePrice)} <span className="stat-label">USDC</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="stat-label" style={{ marginBottom: '4px' }}>{bidCount?.toString() ?? "0"} sealed bids</p>
                      <CountdownTimer deadline={Number(auction.deadline)} compact className="text-[13px]" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* How it works */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div style={{ height: '2px', flex: 1, background: '#0D0D0D' }} />
          <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontStyle: 'italic', fontSize: '28px', color: '#0D0D0D', letterSpacing: '-1px', whiteSpace: 'nowrap' }}>
            How It Works
          </h2>
          <div style={{ height: '2px', flex: 1, background: '#0D0D0D' }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Landmark, title: "Lend & Earn", desc: "Deposit USDC into the lending pool. Earn yield passively as borrowers repay — your clUSDC exchange rate rises.", accent: "#E8F0D8", num: "01" },
            { icon: Shield, title: "Borrow Privately", desc: "Lock property as collateral. Credit assessed inside CRE enclave — financial data never touches the chain.", accent: "#D8ECFA", num: "02" },
            { icon: Lock, title: "Sealed Auctions", desc: "On default, property goes to auction. Bids are sealed. Winner pays second-highest price (Vickrey).", accent: "#E4DDF5", num: "03" },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className="nb-card p-6 flex flex-col"
                style={{ background: item.accent }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-11 h-11 flex items-center justify-center"
                    style={{ border: '2px solid #0D0D0D', borderRadius: '4px', background: 'rgba(255,255,255,0.6)' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: '#0D0D0D' }} />
                  </div>
                  <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '32px', color: 'rgba(13,13,13,0.1)', lineHeight: 1 }}>
                    {item.num}
                  </span>
                </div>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: '18px', color: '#0D0D0D', marginBottom: '8px', letterSpacing: '-0.3px' }}>
                  {item.title}
                </h3>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3D3D3D', lineHeight: 1.7 }}>
                  {item.desc}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

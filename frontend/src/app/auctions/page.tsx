"use client"

import Link from "next/link"
import { useActiveAuction } from "@/hooks/useAuction"
import { formatUSDC } from "@/lib/utils"
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card"
import { CountdownTimer } from "@/components/ui/countdown-timer"
import { Gavel } from "lucide-react"

export default function AuctionsPage() {
  const { activeAuctionId, auction, bidCount, isLoading } = useActiveAuction()

  return (
    <div className="space-y-6">
      <h1 className="display-title" style={{ marginTop: '16px' }}>Auctions</h1>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3D3D3D', marginTop: '-8px' }}>
        Sealed-bid Vickrey auctions for defaulted properties. Bid amounts stay private.
      </p>

      {isLoading ? (
        <div className="h-48" style={{ background: '#E6E2D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '4px 4px 0px #0D0D0D' }} />
      ) : !activeAuctionId || !auction ? (
        <GlassCard className="max-w-lg" hover={false}>
          <GlassCardContent>
            <div className="text-center py-10">
              <div
                className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
                style={{ border: '2px solid #0D0D0D', borderRadius: '4px', background: '#C4B5FF', boxShadow: '4px 4px 0px #0D0D0D' }}
              >
                <Gavel className="w-6 h-6" style={{ color: '#0D0D0D' }} />
              </div>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>No active auctions</p>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#888880', marginTop: '4px' }}>
                Auctions are created when loans default (3 missed payments).
              </p>
            </div>
          </GlassCardContent>
        </GlassCard>
      ) : (
        <Link href={`/auctions/${activeAuctionId}`}>
          <GlassCard accent="lavender" className="max-w-2xl">
            <GlassCardContent>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 flex items-center justify-center"
                    style={{ border: '2px solid #0D0D0D', borderRadius: '4px', background: auction.settled ? '#A8F0D8' : '#FF8A80', boxShadow: '2px 2px 0px #0D0D0D' }}
                  >
                    <span style={{ fontSize: '18px' }}>{auction.settled ? "✓" : "⚡"}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`nb-tag ${auction.settled ? 'settled' : 'live'}`}>
                        {auction.settled ? "Settled" : "Live"}
                      </span>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#888880' }}>Token #{auction.tokenId.toString()}</span>
                    </div>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#888880', marginTop: '4px' }}>
                      {activeAuctionId.slice(0, 14)}...{activeAuctionId.slice(-8)}
                    </p>
                  </div>
                </div>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 700, color: '#0D0D0D' }}>View Details →</span>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4" style={{ borderTop: '2px solid #0D0D0D' }}>
                <div>
                  <p className="stat-label" style={{ marginBottom: '4px' }}>Reserve</p>
                  <p className="stat-number" style={{ fontSize: '18px' }}>{formatUSDC(auction.reservePrice)} <span className="stat-label">USDC</span></p>
                </div>
                <div>
                  <p className="stat-label" style={{ marginBottom: '4px' }}>Sealed Bids</p>
                  <p className="stat-number" style={{ fontSize: '18px' }}>{bidCount?.toString() ?? "0"}</p>
                </div>
                <div>
                  <p className="stat-label" style={{ marginBottom: '4px' }}>Deadline</p>
                  <CountdownTimer deadline={Number(auction.deadline)} compact className="text-sm" />
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </Link>
      )}
    </div>
  )
}

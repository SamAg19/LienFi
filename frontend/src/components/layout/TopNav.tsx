'use client'

import Link from 'next/link'
/* eslint-disable @next/next/no-img-element */
import { usePathname } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { useTransactionPopup } from '@blockscout/app-sdk'
import { CONTRACTS, CHAIN_ID } from '@/config/contracts'
import { truncateAddress } from '@/lib/utils'
import { useBlockscoutTx } from '@/hooks/useBlockscoutTx'
import { Droplets } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/pool', label: 'Pool' },
  { href: '/borrow', label: 'Borrow' },
  { href: '/auctions', label: 'Auctions' },
  { href: '/workflows', label: 'Workflows' },
]

export function TopNav() {
  const pathname = usePathname()
  const { login, logout, authenticated, user } = usePrivy()
  const { address } = useAccount()
  const { openPopup } = useTransactionPopup()
  const { writeContract, data: faucetHash, isPending: faucetPending } = useBlockscoutTx()
  const { isLoading: faucetConfirming } = useWaitForTransactionReceipt({ hash: faucetHash })

  const handleFaucet = () => {
    if (!address) return
    writeContract({
      address: CONTRACTS.MockUSDC.address,
      abi: CONTRACTS.MockUSDC.abi,
      functionName: 'mint',
      args: [address, 10000_000000n],
    })
  }

  return (
    <div className="sticky top-0 z-50" style={{ background: '#EEEBE3' }}>
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="flex items-center justify-between h-16" style={{ borderBottom: '2px solid #0D0D0D' }}>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt="LienFi" style={{ objectFit: 'contain', height: '32px', width: 'auto' }} />
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontStyle: 'italic', fontSize: '18px', color: '#0D0D0D', letterSpacing: '-0.5px' }}>
              LienFi
            </span>
          </Link>

          {/* Center nav */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)

              return (
                <Link key={item.href} href={item.href}>
                  <span
                    className="px-4 py-2 text-[13px] transition-colors inline-block"
                    style={{
                      fontFamily: "'DM Sans', sans-serif",
                      color: '#0D0D0D',
                      fontWeight: isActive ? 700 : 500,
                      borderBottom: isActive ? '3px solid #0D0D0D' : '3px solid transparent',
                    }}
                  >
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {address && (
              <button
                onClick={handleFaucet}
                disabled={faucetPending || faucetConfirming}
                className="nb-btn ghost"
                style={{ padding: '6px 12px', fontSize: '11px', boxShadow: '2px 2px 0px #0D0D0D' }}
              >
                <Droplets className="w-3 h-3" />
                {faucetPending || faucetConfirming ? '...' : 'Faucet'}
              </button>
            )}

            <div
              className="nb-tag"
              style={{ background: '#A8F0D8' }}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full inline-block anim-dot" style={{ background: '#0D0D0D' }} />
                Sepolia
              </span>
            </div>

            {authenticated ? (
              <button
                onClick={logout}
                className="nb-btn ghost"
                style={{ padding: '6px 14px', fontSize: '11px', boxShadow: '2px 2px 0px #0D0D0D' }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>
                  {address ? truncateAddress(address) : user?.email?.address || 'Connected'}
                </span>
              </button>
            ) : (
              <button
                onClick={login}
                className="nb-btn lime"
                style={{ padding: '8px 18px', fontSize: '12px' }}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

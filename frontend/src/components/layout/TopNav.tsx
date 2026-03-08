'use client'

import Link from 'next/link'
/* eslint-disable @next/next/no-img-element */
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useAccount, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { useTransactionPopup } from '@blockscout/app-sdk'
import { CONTRACTS, CHAIN_ID } from '@/config/contracts'
import { truncateAddress } from '@/lib/utils'
import { useBlockscoutTx } from '@/hooks/useBlockscoutTx'
import { getNotifications, markAllRead, getUnreadCount, type AppNotification } from '@/lib/notifications'
import { Droplets, History, Bell, Copy, Check } from 'lucide-react'

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
  const { address, chainId } = useAccount()
  const { openPopup } = useTransactionPopup()
  const { switchChain } = useSwitchChain()
  const { writeContract, data: faucetHash, isPending: faucetPending } = useBlockscoutTx()
  const { isLoading: faucetConfirming } = useWaitForTransactionReceipt({ hash: faucetHash })

  const handleFaucet = async () => {
    if (!address) return
    if (chainId !== CHAIN_ID) {
      switchChain({ chainId: CHAIN_ID })
      return
    }
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
              <>
                <NotificationBell />
                <button
                  onClick={() => openPopup({ chainId: String(CHAIN_ID), address })}
                  className="nb-btn ghost"
                  style={{ padding: '6px 12px', fontSize: '11px', boxShadow: '2px 2px 0px #0D0D0D' }}
                >
                  <History className="w-3 h-3" />
                  Activity
                </button>
                <button
                  onClick={handleFaucet}
                  disabled={faucetPending || faucetConfirming}
                  className="nb-btn ghost"
                  style={{ padding: '6px 12px', fontSize: '11px', boxShadow: '2px 2px 0px #0D0D0D' }}
                >
                  <Droplets className="w-3 h-3" />
                  {faucetPending || faucetConfirming ? '...' : 'Faucet'}
                </button>
              </>
            )}

            <div
              className="nb-tag"
              style={{ background: '#A8F0D8' }}
            >
              <span className="flex items-center gap-1.5 py-1">
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

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Refresh notifications periodically
  useEffect(() => {
    const refresh = () => {
      setNotifications(getNotifications())
      setUnread(getUnreadCount())
    }
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    setOpen(!open)
    if (!open) {
      markAllRead()
      setUnread(0)
    }
  }

  const copyHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="nb-btn ghost relative"
        style={{ padding: '6px 10px', fontSize: '11px', boxShadow: '2px 2px 0px #0D0D0D' }}
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center"
            style={{
              width: '16px',
              height: '16px',
              background: '#FF8A80',
              border: '2px solid #0D0D0D',
              borderRadius: '50%',
              fontSize: '9px',
              fontWeight: 900,
              fontFamily: "'DM Sans', sans-serif",
              color: '#0D0D0D',
            }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 z-50"
          style={{
            width: '340px',
            background: '#FAFAF7',
            border: '2px solid #0D0D0D',
            borderRadius: '4px',
            boxShadow: '4px 4px 0px #0D0D0D',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '2px solid #0D0D0D' }}
          >
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 700, color: '#0D0D0D' }}>
              Notifications
            </span>
            <span className="stat-label">{notifications.length}</span>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#888880' }}>
                No notifications yet
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="px-4 py-3"
                style={{ borderBottom: '1px solid #E6E2D8' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 700, color: '#0D0D0D' }}>
                      {n.title}
                    </p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D', marginTop: '2px' }}>
                      {n.description}
                    </p>
                    {n.hash && (
                      <div className="flex items-center gap-1 mt-1">
                        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#888880' }}>
                          {n.hash.slice(0, 14)}...{n.hash.slice(-6)}
                        </p>
                        <button onClick={() => copyHash(n.hash!, n.id)} style={{ color: '#888880' }}>
                          {copiedId === n.id ? <Check className="w-3 h-3" style={{ color: '#C8F135' }} /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    )}
                  </div>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#888880', whiteSpace: 'nowrap' }}>
                    {formatTimeAgo(n.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { useTransactionPopup } from '@blockscout/app-sdk'
import { CONTRACTS, CHAIN_ID } from '@/config/contracts'
import { truncateAddress } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useBlockscoutTx } from '@/hooks/useBlockscoutTx'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '⬡' },
  { href: '/pool', label: 'Pool', icon: '🏦' },
  { href: '/borrow', label: 'Borrow', icon: '📋' },
  { href: '/auctions', label: 'Auctions', icon: '🏛' },
  { href: '/workflows', label: 'Workflows', icon: '⚡' },
]

export function Sidebar() {
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
    <aside className="fixed left-0 top-0 bottom-0 w-[200px] bg-surface border-r border-card-border flex flex-col z-10">
      {/* Logo */}
      <div className="px-5 py-5">
        <h1 className="text-lg font-semibold tracking-tight">
          <span className="text-green">Lien</span><span className="text-text">Fi</span>
        </h1>
        <p className="text-[9px] font-mono text-text-dim uppercase tracking-[0.15em] mt-0.5">
          Private Credit
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-green-dim text-green'
                  : 'text-text-muted hover:text-text hover:bg-card-hover'
              )}
            >
              <span className="text-sm">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Faucet */}
      <div className="px-2 mb-1.5">
        <button
          onClick={handleFaucet}
          disabled={!address || faucetPending || faucetConfirming}
          className="w-full py-1.5 px-3 rounded text-xs font-medium bg-green-dim text-green hover:bg-green-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {faucetPending || faucetConfirming ? 'Minting...' : 'Get Test USDC'}
        </button>
      </div>

      {/* Transaction History (Blockscout) */}
      <div className="px-2 mb-2">
        <button
          onClick={() => openPopup({ chainId: String(CHAIN_ID), address: address })}
          disabled={!address}
          className="w-full py-1.5 px-3 rounded text-xs font-medium bg-blue-dim text-blue hover:bg-blue/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Transaction History
        </button>
      </div>

      {/* Wallet */}
      <div className="px-2 pb-3">
        {authenticated ? (
          <div className="bg-card rounded border border-card-border p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-green" />
              <span className="text-[11px] font-mono text-text-muted">
                {address ? truncateAddress(address) : user?.email?.address || 'Connected'}
              </span>
            </div>
            <button
              onClick={logout}
              className="w-full text-[11px] text-text-dim hover:text-alert transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={login}
            className="w-full py-2.5 rounded text-sm font-semibold bg-green text-page hover:brightness-110 transition-all"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </aside>
  )
}

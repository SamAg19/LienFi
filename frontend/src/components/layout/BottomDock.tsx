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
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Landmark,
  FileText,
  Gavel,
  Workflow,
  Droplets,
  ArrowUpDown,
  Wallet,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pool', label: 'Pool', icon: Landmark },
  { href: '/borrow', label: 'Borrow', icon: FileText },
  { href: '/auctions', label: 'Auctions', icon: Gavel },
  { href: '/workflows', label: 'Workflows', icon: Workflow },
]

export function BottomDock() {
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
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
      <div className="max-w-[1360px] mx-auto">
        <div className="flex items-center justify-between h-[52px] px-2 rounded-2xl glass">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 px-2 group">
            <div className="w-7 h-7 rounded-lg bg-hl flex items-center justify-center">
              <span className="text-page text-[11px] font-bold">L</span>
            </div>
            <span className="text-[14px] font-semibold tracking-tight text-t1 hidden sm:inline">
              LienFi
            </span>
          </Link>

          {/* Center nav */}
          <nav className="flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2 p-[4px]">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
              const Icon = item.icon

              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    className={cn(
                      'relative flex items-center gap-1.5 px-3.5 py-[7px] rounded-xl text-[12px] font-medium transition-colors cursor-pointer',
                      isActive
                        ? 'text-t1'
                        : 'text-t3 hover:text-t2 hover:bg-white/[0.04]'
                    )}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="dock-active"
                        className="absolute inset-0 bg-white/[0.08] border border-white/[0.06] rounded-xl"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10 hidden md:inline font-medium">{item.label}</span>
                  </motion.div>
                </Link>
              )
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1.5">
            {address && (
              <motion.button
                onClick={handleFaucet}
                disabled={faucetPending || faucetConfirming}
                className="flex items-center gap-1 px-3 py-[6px] rounded-lg text-[11px] font-mono font-medium text-t3 border border-white/[0.06] hover:bg-hl/10 hover:text-hl hover:border-hl/20 transition-all disabled:opacity-40"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
              >
                <Droplets className="w-3 h-3" />
                {faucetPending || faucetConfirming ? '...' : 'Faucet'}
              </motion.button>
            )}

            {address && (
              <motion.button
                onClick={() => openPopup({ chainId: String(CHAIN_ID), address: address })}
                className="flex items-center gap-1 px-3 py-[6px] rounded-lg text-[11px] font-mono font-medium text-t3 border border-white/[0.06] hover:bg-hl/10 hover:text-hl hover:border-hl/20 transition-all"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
              >
                <ArrowUpDown className="w-3 h-3" />
                Txns
              </motion.button>
            )}

            <div className="hidden sm:flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-[6px]">
              <div className="w-1.5 h-1.5 rounded-full bg-pos anim-dot" />
              <span className="text-[11px] font-mono text-t3">Sepolia</span>
            </div>

            {authenticated ? (
              <motion.button
                onClick={logout}
                className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-[6px] hover:border-white/[0.12] transition-all"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
              >
                <Wallet className="w-3 h-3 text-t3" />
                <span className="text-[11px] font-mono text-t3">
                  {address ? truncateAddress(address) : user?.email?.address || 'Connected'}
                </span>
              </motion.button>
            ) : (
              <motion.button
                onClick={login}
                className="px-4 py-[6px] rounded-lg text-[12px] font-semibold bg-hl text-page shadow-[0_0_16px_rgba(229,165,48,0.2)] hover:brightness-110 transition-all"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
              >
                Connect
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

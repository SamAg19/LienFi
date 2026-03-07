"use client"

import { useState } from "react"
import { useAccount, useWaitForTransactionReceipt } from "wagmi"
import { useBlockscoutTx } from "@/hooks/useBlockscoutTx"
import { usePoolStats } from "@/hooks/usePool"
import { useTokenBalances } from "@/hooks/useTokenBalances"
import { CONTRACTS } from "@/config/contracts"
import { formatUSDC, parseUSDC } from "@/lib/utils"
import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card"
import { StatCard } from "@/components/ui/stat-card"
import { toast } from "sonner"
import { DollarSign, TrendingUp, Layers, BarChart3 } from "lucide-react"

export default function PoolPage() {
  const { address } = useAccount()
  const pool = usePoolStats()
  const balances = useTokenBalances()

  const fmt = (v: bigint | undefined) => v !== undefined ? formatUSDC(v) : "—"

  return (
    <div className="space-y-6">
      <h1 className="display-title" style={{ marginTop: '16px' }}>Pool</h1>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3D3D3D', marginTop: '-8px' }}>
        Deposit USDC to earn yield. Your clUSDC appreciates as borrowers repay.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Value Locked" value={pool.totalPoolValue ? `$${(Number(pool.totalPoolValue) / 1e6).toFixed(2)}` : "$0.00"} icon={<DollarSign className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={pool.isLoading} accent="lime" />
        <StatCard label="Exchange Rate" value={pool.exchangeRate ? (Number(pool.exchangeRate) / 1e18).toFixed(4) : "1.0000"} icon={<TrendingUp className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={pool.isLoading} accent="peach" />
        <StatCard label="Available Liquidity" value={pool.availableLiquidity ? `$${(Number(pool.availableLiquidity) / 1e6).toFixed(2)}` : "$0.00"} icon={<Layers className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={pool.isLoading} accent="sky" />
        <StatCard label="Total Loaned" value={pool.totalLoaned ? `$${(Number(pool.totalLoaned) / 1e6).toFixed(2)}` : "$0.00"} icon={<BarChart3 className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={pool.isLoading} accent="lavender" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard hover={false}>
          <GlassCardHeader>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Your Position</h2>
          </GlassCardHeader>
          <GlassCardContent>
            {!address ? (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3D3D3D' }}>Connect wallet to see position</p>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3D3D3D' }}>USDC Balance</span>
                  <span className="stat-number" style={{ fontSize: '18px' }}>{fmt(balances.usdcBalance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3D3D3D' }}>clUSDC Balance</span>
                  <span className="stat-number" style={{ fontSize: '18px' }}>{fmt(balances.clUsdcBalance)}</span>
                </div>
                <div style={{ borderTop: '2px solid #0D0D0D', paddingTop: '16px' }} className="flex justify-between items-center">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3D3D3D' }}>Value in USDC</span>
                  <span className="stat-number" style={{ fontSize: '22px', color: '#0D0D0D' }}>
                    ${balances.clUsdcBalance !== undefined && pool.exchangeRate !== undefined ? formatUSDC((balances.clUsdcBalance * pool.exchangeRate) / BigInt(1e18)) : "—"}
                  </span>
                </div>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>

        <DepositWithdrawForm pool={pool} balances={balances} address={address} />
      </div>
    </div>
  )
}

function DepositWithdrawForm({ pool, balances, address }: { pool: ReturnType<typeof usePoolStats>; balances: ReturnType<typeof useTokenBalances>; address: `0x${string}` | undefined }) {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit")
  const [amount, setAmount] = useState("")
  const [step, setStep] = useState<"idle" | "approving" | "executing">("idle")
  const { writeContract, data: txHash, isPending } = useBlockscoutTx()
  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash: txHash })

  const handleDeposit = async () => {
    if (!address || !amount) return
    const parsedAmount = parseUSDC(amount)
    const allowance = balances.usdcAllowanceLendingPool ?? 0n
    if (allowance < parsedAmount) {
      setStep("approving")
      writeContract({ address: CONTRACTS.MockUSDC.address, abi: CONTRACTS.MockUSDC.abi, functionName: "approve", args: [CONTRACTS.LendingPool.address, parsedAmount] }, {
        onSuccess: () => { toast.success("USDC approved, now depositing..."); setStep("executing"); writeContract({ address: CONTRACTS.LendingPool.address, abi: CONTRACTS.LendingPool.abi, functionName: "deposit", args: [parsedAmount] }, { onSuccess: () => { toast.success("Deposit successful!"); setAmount(""); setStep("idle"); pool.refetch(); balances.refetch() }, onError: (e) => { toast.error(`Deposit failed: ${e.message.slice(0, 80)}`); setStep("idle") } }) },
        onError: (e) => { toast.error(`Approval failed: ${e.message.slice(0, 80)}`); setStep("idle") },
      })
    } else {
      setStep("executing")
      writeContract({ address: CONTRACTS.LendingPool.address, abi: CONTRACTS.LendingPool.abi, functionName: "deposit", args: [parsedAmount] }, { onSuccess: () => { toast.success("Deposit successful!"); setAmount(""); setStep("idle"); pool.refetch(); balances.refetch() }, onError: (e) => { toast.error(`Deposit failed: ${e.message.slice(0, 80)}`); setStep("idle") } })
    }
  }

  const handleWithdraw = () => {
    if (!address || !amount) return
    setStep("executing")
    writeContract({ address: CONTRACTS.LendingPool.address, abi: CONTRACTS.LendingPool.abi, functionName: "withdraw", args: [parseUSDC(amount)] }, { onSuccess: () => { toast.success("Withdrawal successful!"); setAmount(""); setStep("idle"); pool.refetch(); balances.refetch() }, onError: (e) => { toast.error(`Withdrawal failed: ${e.message.slice(0, 80)}`); setStep("idle") } })
  }

  const busy = isPending || confirming || step !== "idle"

  return (
    <GlassCard hover={false}>
      <GlassCardHeader>
        <div className="flex gap-1">
          {(["deposit", "withdraw"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`nb-btn ${mode === m ? 'lime' : 'ghost'}`}
              style={{ padding: '6px 16px', fontSize: '12px', boxShadow: '2px 2px 0px #0D0D0D', textTransform: 'capitalize' }}
            >
              {m}
            </button>
          ))}
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-4">
          <div>
            <label className="stat-label" style={{ marginBottom: '8px', display: 'block' }}>
              {mode === "deposit" ? "USDC Amount" : "clUSDC Amount"}
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="nb-input"
                style={{ paddingRight: '60px', fontSize: '16px', height: '48px' }}
              />
              <button
                onClick={() => { const max = mode === "deposit" ? balances.usdcBalance : balances.clUsdcBalance; if (max) setAmount((Number(max) / 1e6).toString()) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 nb-tag"
                style={{ background: '#C8F135', cursor: 'pointer', fontSize: '10px' }}
              >
                MAX
              </button>
            </div>
          </div>
          {mode === "withdraw" && amount && pool.exchangeRate && (
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D' }}>
              &asymp; {(parseFloat(amount) * Number(pool.exchangeRate) / 1e18).toFixed(2)} USDC
            </p>
          )}
          <button
            onClick={mode === "deposit" ? handleDeposit : handleWithdraw}
            disabled={!address || !amount || busy}
            className="nb-btn lime w-full"
            style={{ height: '48px', fontSize: '14px' }}
          >
            {busy ? step === "approving" ? "Approving USDC..." : "Processing..." : mode === "deposit" ? "Deposit USDC" : "Withdraw clUSDC"}
          </button>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}

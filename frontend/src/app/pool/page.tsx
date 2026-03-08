"use client"

import { useState } from "react"
import { useAccount, useWaitForTransactionReceipt, useConfig } from "wagmi"
import { waitForTransactionReceipt } from "@wagmi/core"
import { useBlockscoutTx } from "@/hooks/useBlockscoutTx"
import { usePoolStats } from "@/hooks/usePool"
import { useTokenBalances } from "@/hooks/useTokenBalances"
import { CONTRACTS } from "@/config/contracts"
import { formatUSDC, parseUSDC } from "@/lib/utils"
import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card"
import { StatCard } from "@/components/ui/stat-card"
import { toast } from "sonner"
import { DollarSign, TrendingUp, Layers, BarChart3, PieChart, Shield, Activity, Wallet } from "lucide-react"

function usdcFmt(v: bigint | undefined): string {
  return v !== undefined ? `$${(Number(v) / 1e6).toFixed(2)}` : "$0.00"
}

function pctFmt(n: number): string {
  return `${n.toFixed(1)}%`
}

export default function PoolPage() {
  const { address } = useAccount()
  const pool = usePoolStats()
  const balances = useTokenBalances()

  const fmt = (v: bigint | undefined) => v !== undefined ? formatUSDC(v) : "—"

  // Derived stats
  const tvl = pool.totalPoolValue ? Number(pool.totalPoolValue) / 1e6 : 0
  const liquidity = pool.availableLiquidity ? Number(pool.availableLiquidity) / 1e6 : 0
  const loaned = pool.totalLoaned ? Number(pool.totalLoaned) / 1e6 : 0
  const utilization = tvl > 0 ? (loaned / tvl) * 100 : 0
  const exchangeRate = pool.exchangeRate ? Number(pool.exchangeRate) / 1e18 : 1
  const yieldEarned = exchangeRate > 1 ? ((exchangeRate - 1) * 100) : 0
  const clUsdcSupply = pool.clUsdcTotalSupply ? Number(pool.clUsdcTotalSupply) / 1e6 : 0
  const activeLoans = pool.loanCounter ? Number(pool.loanCounter) : 0

  // User position
  const userClUsdc = balances.clUsdcBalance ? Number(balances.clUsdcBalance) / 1e6 : 0
  const userValueUSDC = userClUsdc * exchangeRate
  const userSharePct = clUsdcSupply > 0 ? (userClUsdc / clUsdcSupply) * 100 : 0
  const userYieldEarned = userClUsdc > 0 ? (userValueUSDC - userClUsdc) : 0

  return (
    <div className="space-y-6">
      <div style={{ marginTop: '16px' }}>
        <h1 className="display-title">Lending Pool</h1>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3D3D3D', marginTop: '4px' }}>
          Deposit USDC to earn yield from borrower EMI payments. Your clUSDC appreciates over time.
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Value Locked" value={usdcFmt(pool.totalPoolValue)} icon={<DollarSign className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={pool.isLoading} accent="lime" />
        <StatCard label="Available Liquidity" value={usdcFmt(pool.availableLiquidity)} icon={<Layers className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={pool.isLoading} accent="sky" />
        <StatCard label="Total Loaned Out" value={usdcFmt(pool.totalLoaned)} icon={<BarChart3 className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={pool.isLoading} accent="peach" />
        <StatCard label="Exchange Rate" value={exchangeRate.toFixed(6)} icon={<TrendingUp className="w-4 h-4" style={{ color: '#0D0D0D' }} />} loading={pool.isLoading} accent="lavender" />
      </div>

      {/* Pool Health + Composition row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Utilization Gauge */}
        <GlassCard hover={false}>
          <GlassCardHeader>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Pool Utilization</h2>
            <span className="nb-tag" style={{ background: utilization > 80 ? '#FF8A80' : utilization > 50 ? '#FFD97D' : '#A8F0D8', fontSize: '11px' }}>
              {utilization > 80 ? 'High' : utilization > 50 ? 'Moderate' : 'Healthy'}
            </span>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="flex flex-col items-center gap-4">
              {/* Circular gauge */}
              <div className="relative" style={{ width: '140px', height: '140px' }}>
                <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#E6E2D8" strokeWidth="12" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke={utilization > 80 ? '#FF8A80' : utilization > 50 ? '#FFD97D' : '#C8F135'}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${(utilization / 100) * 314.16} 314.16`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="stat-number" style={{ fontSize: '28px' }}>{pctFmt(utilization)}</span>
                  <span className="stat-label" style={{ fontSize: '10px' }}>utilized</span>
                </div>
              </div>
              <div className="w-full space-y-2">
                <div className="flex justify-between">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D' }}>Idle USDC</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600 }}>${liquidity.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D' }}>Loaned USDC</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600 }}>${loaned.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Pool Metrics */}
        <GlassCard hover={false}>
          <GlassCardHeader>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Pool Metrics</h2>
            <Activity className="w-4 h-4" style={{ color: '#0D0D0D' }} />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-4">
              <MetricRow label="clUSDC Supply" value={`${clUsdcSupply.toFixed(2)} clUSDC`} />
              <MetricRow label="Active Loans" value={String(activeLoans)} />
              <MetricRow label="Pool Yield" value={yieldEarned > 0 ? `+${yieldEarned.toFixed(4)}%` : '0.00%'} valueColor={yieldEarned > 0 ? '#2E7D32' : undefined} />
              <MetricRow label="Interest Rate" value="8.00% APR" />
              <div style={{ borderTop: '2px solid #E6E2D8', paddingTop: '12px' }}>
                <MetricRow label="Backing Ratio" value={`1 clUSDC = ${exchangeRate.toFixed(6)} USDC`} />
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Pool Composition Bar */}
        <GlassCard hover={false}>
          <GlassCardHeader>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Pool Composition</h2>
            <PieChart className="w-4 h-4" style={{ color: '#0D0D0D' }} />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-4">
              {/* Stacked bar */}
              <div>
                <div className="flex w-full overflow-hidden" style={{ height: '32px', border: '2px solid #0D0D0D', borderRadius: '4px' }}>
                  <div
                    style={{
                      width: tvl > 0 ? `${(liquidity / tvl) * 100}%` : '100%',
                      background: '#C8F135',
                      transition: 'width 0.5s ease',
                      minWidth: tvl > 0 && liquidity > 0 ? '2px' : undefined,
                    }}
                  />
                  <div
                    style={{
                      width: tvl > 0 ? `${(loaned / tvl) * 100}%` : '0%',
                      background: '#FFB4A0',
                      transition: 'width 0.5s ease',
                      minWidth: tvl > 0 && loaned > 0 ? '2px' : undefined,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <span style={{ width: '10px', height: '10px', background: '#C8F135', border: '1.5px solid #0D0D0D', borderRadius: '2px', display: 'inline-block' }} />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>Liquid ({tvl > 0 ? pctFmt((liquidity / tvl) * 100) : '100%'})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span style={{ width: '10px', height: '10px', background: '#FFB4A0', border: '1.5px solid #0D0D0D', borderRadius: '2px', display: 'inline-block' }} />
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>Loaned ({tvl > 0 ? pctFmt((loaned / tvl) * 100) : '0%'})</span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '2px solid #E6E2D8', paddingTop: '12px' }} className="space-y-3">
                <MetricRow label="Total Deposits" value={`$${tvl.toFixed(2)}`} />
                <MetricRow label="Available to Borrow" value={`$${liquidity.toFixed(2)}`} />
                <MetricRow label="Outstanding Loans" value={`$${loaned.toFixed(2)}`} />
              </div>

              {/* Health indicator */}
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{
                  background: utilization < 80 ? 'rgba(168,240,216,0.4)' : 'rgba(255,138,128,0.3)',
                  border: `1.5px solid ${utilization < 80 ? '#2E7D32' : '#C62828'}`,
                  borderRadius: '4px',
                }}
              >
                <Shield className="w-3.5 h-3.5" style={{ color: utilization < 80 ? '#2E7D32' : '#C62828' }} />
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', fontWeight: 600, color: utilization < 80 ? '#2E7D32' : '#C62828' }}>
                  {utilization < 50 ? 'Pool is well-capitalized' : utilization < 80 ? 'Pool utilization is moderate' : 'High utilization — withdrawals may be limited'}
                </span>
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Your Position + Deposit/Withdraw */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard hover={false}>
          <GlassCardHeader>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Your Position</h2>
            <Wallet className="w-4 h-4" style={{ color: '#0D0D0D' }} />
          </GlassCardHeader>
          <GlassCardContent>
            {!address ? (
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3D3D3D' }}>Connect wallet to see your position</p>
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
                <div style={{ borderTop: '2px solid #0D0D0D', paddingTop: '16px' }} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3D3D3D' }}>Position Value</span>
                    <span className="stat-number" style={{ fontSize: '22px', color: '#0D0D0D' }}>
                      ${userValueUSDC.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3D3D3D' }}>Pool Share</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 600, color: '#0D0D0D' }}>
                      {userSharePct > 0 ? pctFmt(userSharePct) : '0.0%'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#3D3D3D' }}>Yield Earned</span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '14px',
                      fontWeight: 600,
                      color: userYieldEarned > 0 ? '#2E7D32' : '#0D0D0D',
                    }}>
                      {userYieldEarned > 0 ? `+$${userYieldEarned.toFixed(4)}` : '$0.00'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>

        <DepositWithdrawForm pool={pool} balances={balances} address={address} />
      </div>

      {/* How it works */}
      <GlassCard hover={false}>
        <GlassCardHeader>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>How the Pool Works</h2>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <HowItWorksStep
              step="1"
              title="Deposit USDC"
              description="Deposit USDC and receive clUSDC receipt tokens at the current exchange rate. Your clUSDC represents your share of the pool."
            />
            <HowItWorksStep
              step="2"
              title="Earn Yield"
              description="As borrowers repay EMIs (principal + 8% interest), the pool grows. The clUSDC exchange rate rises — your tokens are worth more USDC over time."
            />
            <HowItWorksStep
              step="3"
              title="Withdraw Anytime"
              description="Burn your clUSDC to withdraw USDC at the current (higher) exchange rate. You receive your original deposit plus earned yield."
            />
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  )
}

function MetricRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D' }}>{label}</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 600, color: valueColor || '#0D0D0D' }}>{value}</span>
    </div>
  )
}

function HowItWorksStep({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: '28px',
          height: '28px',
          background: '#C8F135',
          border: '2px solid #0D0D0D',
          borderRadius: '4px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '13px',
          fontWeight: 900,
        }}
      >
        {step}
      </div>
      <div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 700, color: '#0D0D0D', marginBottom: '4px' }}>{title}</p>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D', lineHeight: '1.5' }}>{description}</p>
      </div>
    </div>
  )
}

function DepositWithdrawForm({ pool, balances, address }: { pool: ReturnType<typeof usePoolStats>; balances: ReturnType<typeof useTokenBalances>; address: `0x${string}` | undefined }) {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit")
  const [amount, setAmount] = useState("")
  const [step, setStep] = useState<"idle" | "approving" | "executing">("idle")
  const { writeContract, writeContractAsync, data: txHash, isPending } = useBlockscoutTx()
  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash: txHash })
  const config = useConfig()

  const exchangeRate = pool.exchangeRate ? Number(pool.exchangeRate) / 1e18 : 1

  const handleDeposit = async () => {
    if (!address || !amount) return
    const parsedAmount = parseUSDC(amount)
    const allowance = balances.usdcAllowanceLendingPool ?? 0n
    try {
      if (allowance < parsedAmount) {
        setStep("approving")
        const approveHash = await writeContractAsync({
          address: CONTRACTS.MockUSDC.address,
          abi: CONTRACTS.MockUSDC.abi,
          functionName: "approve",
          args: [CONTRACTS.LendingPool.address, parsedAmount],
        })
        toast.success("Approval sent, waiting for confirmation...")
        await waitForTransactionReceipt(config, { hash: approveHash, confirmations: 1 })
        toast.success("USDC approved! Now depositing...")
      }
      setStep("executing")
      writeContract(
        { address: CONTRACTS.LendingPool.address, abi: CONTRACTS.LendingPool.abi, functionName: "deposit", args: [parsedAmount] },
        {
          onSuccess: () => { toast.success("Deposit successful!"); setAmount(""); setStep("idle"); pool.refetch(); balances.refetch() },
          onError: (e) => { toast.error(`Deposit failed: ${e.message.slice(0, 80)}`); setStep("idle") },
        }
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.slice(0, 80) : "Unknown error"
      toast.error(`Failed: ${msg}`)
      setStep("idle")
    }
  }

  const handleWithdraw = () => {
    if (!address || !amount) return
    setStep("executing")
    writeContract({ address: CONTRACTS.LendingPool.address, abi: CONTRACTS.LendingPool.abi, functionName: "withdraw", args: [parseUSDC(amount)] }, { onSuccess: () => { toast.success("Withdrawal successful!"); setAmount(""); setStep("idle"); pool.refetch(); balances.refetch() }, onError: (e) => { toast.error(`Withdrawal failed: ${e.message.slice(0, 80)}`); setStep("idle") } })
  }

  const busy = isPending || confirming || step !== "idle"
  const previewAmount = amount ? parseFloat(amount) : 0

  return (
    <GlassCard hover={false}>
      <GlassCardHeader>
        <div className="flex gap-1">
          {(["deposit", "withdraw"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setAmount("") }}
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

          {/* Preview section */}
          {previewAmount > 0 && (
            <div
              className="space-y-2 px-3 py-3"
              style={{ background: 'rgba(200,241,53,0.15)', border: '1.5px solid #C8F135', borderRadius: '4px' }}
            >
              {mode === "deposit" ? (
                <>
                  <div className="flex justify-between">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>You deposit</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600 }}>{previewAmount.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>You receive</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600 }}>{(previewAmount / exchangeRate).toFixed(4)} clUSDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>Rate</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600 }}>1 clUSDC = {exchangeRate.toFixed(6)} USDC</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>You burn</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600 }}>{previewAmount.toFixed(2)} clUSDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>You receive</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600 }}>{(previewAmount * exchangeRate).toFixed(4)} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#3D3D3D' }}>Rate</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 600 }}>1 clUSDC = {exchangeRate.toFixed(6)} USDC</span>
                  </div>
                </>
              )}
            </div>
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

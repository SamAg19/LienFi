"use client"

import { useState, useEffect } from "react"
import { useAccount, useWaitForTransactionReceipt } from "wagmi"
import { useBlockscoutTx } from "@/hooks/useBlockscoutTx"
import { useBorrowerState, useLoan } from "@/hooks/useLoan"
import { useTokenBalances } from "@/hooks/useTokenBalances"
import { CONTRACTS } from "@/config/contracts"
import { formatUSDC, parseUSDC, formatTimestamp } from "@/lib/utils"
import { verifyProperty, submitLoanRequest } from "@/lib/api"
import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card"
import { toast } from "sonner"
import {
  CheckCircle,
  Clock,
  FileCheck,
  Coins,
  CreditCard,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react"

type WizardStep = 1 | 2 | 3 | 4 | 5

const STEPS = [
  { num: 1, label: "Verify", icon: FileCheck },
  { num: 2, label: "Mint NFT", icon: Coins },
  { num: 3, label: "Request", icon: CreditCard },
  { num: 4, label: "Claim", icon: CheckCircle },
  { num: 5, label: "Repay", icon: Clock },
]

export default function BorrowPage() {
  const { address } = useAccount()
  const borrower = useBorrowerState()
  const { loan, refetch: refetchLoan } = useLoan(borrower.activeLoanId)
  const [step, setStep] = useState<WizardStep>(1)
  const [wizardData, setWizardData] = useState<{
    tokenId?: number
    metadataHash?: string
    appraisedValue?: string
    requestHash?: string
  }>({})

  useEffect(() => {
    if (borrower.isLoading) return
    if (borrower.hasActiveLoan) {
      setStep(5)
    } else if (borrower.approval?.exists) {
      setStep(4)
    } else if (borrower.hasPendingRequest) {
      setStep(3)
    }
  }, [borrower.isLoading, borrower.hasActiveLoan, borrower.approval?.exists, borrower.hasPendingRequest])

  if (!address) {
    return (
      <div>
        <h1 className="display-title" style={{ marginTop: '16px' }}>Borrow</h1>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3D3D3D', marginTop: '8px' }}>Connect your wallet to start borrowing.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="display-title" style={{ marginTop: '16px' }}>Borrow</h1>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3D3D3D', marginTop: '-8px' }}>
        Lock property NFT as collateral, get USDC. Credit assessed privately in CRE enclave.
      </p>

      {/* Step indicator — neubrutalism tab bar */}
      <div className="flex items-center gap-1">
        {STEPS.map((s) => {
          const Icon = s.icon
          const isActive = s.num === step
          const isDone = s.num < step
          return (
            <div
              key={s.num}
              className="flex-1 flex items-center justify-center gap-2 py-3"
              style={{
                border: '2px solid #0D0D0D',
                borderRadius: '4px',
                background: isActive ? '#C8F135' : isDone ? '#A8F0D8' : '#FAFAF7',
                boxShadow: isActive ? '4px 4px 0px #0D0D0D' : '2px 2px 0px #0D0D0D',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                fontWeight: isActive ? 700 : 500,
                color: '#0D0D0D',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          )
        })}
      </div>

      {step === 1 && <StepVerifyProperty onComplete={(data) => { setWizardData(data); setStep(2) }} />}
      {step === 2 && <StepMintNFT data={wizardData} onComplete={() => setStep(3)} />}
      {step === 3 && (
        <StepRequestLoan
          data={wizardData}
          address={address}
          hasPendingRequest={borrower.hasPendingRequest}
          approval={borrower.approval}
          onApproved={(requestHash) => { setWizardData({ ...wizardData, requestHash }); setStep(4) }}
          refetch={borrower.refetch}
        />
      )}
      {step === 4 && <StepClaimLoan approval={borrower.approval!} refetch={borrower.refetch} onComplete={() => setStep(5)} />}
      {step === 5 && <StepRepay loan={loan} loanId={borrower.activeLoanId!} refetchLoan={refetchLoan} />}
    </div>
  )
}

function StepVerifyProperty({ onComplete }: { onComplete: (data: { tokenId: number; metadataHash: string; appraisedValue: string }) => void }) {
  const [propertyId, setPropertyId] = useState("PROP-001")
  const { address } = useAccount()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ valid: boolean; tokenId: number; metadataHash: string; appraisedValue: string; message: string } | null>(null)

  const handleVerify = async () => {
    if (!address) return
    setLoading(true)
    try {
      const res = await verifyProperty(propertyId, address)
      setResult(res)
      if (res.valid) toast.success("Property verified!")
      else toast.error(res.message)
    } catch {
      toast.error("Failed to verify property")
    }
    setLoading(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <GlassCard hover={false}>
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4" style={{ color: '#0D0D0D' }} />
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Verify Property</h2>
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-4">
            <div>
              <label className="stat-label" style={{ marginBottom: '8px', display: 'block' }}>Property ID</label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="nb-input"
                style={{ height: '44px' }}
              >
                <option value="PROP-001">PROP-001 — 123 Main St, Austin TX ($1M)</option>
                <option value="PROP-002">PROP-002 — 456 Ocean Dr, Miami FL ($2.5M)</option>
                <option value="PROP-003">PROP-003 — 789 Sunset Blvd, LA CA ($800K)</option>
              </select>
            </div>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#888880', lineHeight: 1.6 }}>
              Property details verified in CRE enclave. Only a commitment hash goes on-chain.
            </p>
            <button onClick={handleVerify} disabled={loading} className="nb-btn lime w-full" style={{ height: '44px' }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : "Verify Property"}
            </button>
          </div>
        </GlassCardContent>
      </GlassCard>

      {result?.valid && (
        <GlassCard accent="mint" hover={false}>
          <GlassCardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" style={{ color: '#0D0D0D' }} />
              <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Property Verified</h2>
            </div>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ color: '#3D3D3D' }}>Token ID</span>
                <span style={{ fontWeight: 700 }}>{result.tokenId}</span>
              </div>
              <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ color: '#3D3D3D' }}>Hash</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#888880' }}>{result.metadataHash.slice(0, 18)}...</span>
              </div>
              <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ color: '#3D3D3D' }}>Appraised</span>
                <span className="stat-number" style={{ fontSize: '18px' }}>${Number(result.appraisedValue).toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => onComplete({ tokenId: result.tokenId, metadataHash: result.metadataHash, appraisedValue: result.appraisedValue })} className="nb-btn lime w-full" style={{ height: '44px' }}>
              Continue to Mint NFT <ArrowRight className="w-4 h-4" />
            </button>
          </GlassCardContent>
        </GlassCard>
      )}
    </div>
  )
}

function StepMintNFT({ data, onComplete }: { data: { metadataHash?: string; tokenId?: number }; onComplete: () => void }) {
  const { writeContract, data: txHash, isPending } = useBlockscoutTx()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => { if (isSuccess) { toast.success("PropertyNFT minted!"); onComplete() } }, [isSuccess, onComplete])

  return (
    <GlassCard className="max-w-lg" hover={false}>
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4" style={{ color: '#0D0D0D' }} />
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Mint Property NFT</h2>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-4">
          <div className="p-3" style={{ background: '#E6E2D8', border: '2px solid #0D0D0D', borderRadius: '4px', boxShadow: '2px 2px 0px #0D0D0D' }}>
            <p className="stat-label" style={{ marginBottom: '4px' }}>Commitment Hash</p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#3D3D3D', wordBreak: 'break-all' }}>{data.metadataHash}</p>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#888880', lineHeight: 1.6 }}>
            Creates an ERC-721 token with only a hash on-chain. No metadata, no personal data visible.
          </p>
          <button
            onClick={() => { writeContract({ address: CONTRACTS.PropertyNFT.address, abi: CONTRACTS.PropertyNFT.abi, functionName: "mint", args: [data.metadataHash as `0x${string}`] }) }}
            disabled={isPending || confirming}
            className="nb-btn lime w-full"
            style={{ height: '44px' }}
          >
            {isPending ? "Confirm in wallet..." : confirming ? <><Loader2 className="w-4 h-4 animate-spin" /> Minting...</> : "Mint PropertyNFT"}
          </button>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}

function StepRequestLoan({ data, address, hasPendingRequest, approval, onApproved, refetch }: { data: { tokenId?: number; requestHash?: string }; address: `0x${string}`; hasPendingRequest: boolean; approval: { exists: boolean; requestHash: `0x${string}` } | undefined; onApproved: (requestHash: string) => void; refetch: () => void }) {
  const [amount, setAmount] = useState("")
  const [tenure, setTenure] = useState("12")
  const [plaidToken, setPlaidToken] = useState("access-sandbox-demo-token")
  const [loading, setLoading] = useState(false)
  const [requestHash, setRequestHash] = useState(data.requestHash || "")
  const { writeContract, data: txHash, isPending } = useBlockscoutTx()
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => { if (!hasPendingRequest) return; const interval = setInterval(() => refetch(), 10000); return () => clearInterval(interval) }, [hasPendingRequest, refetch])
  useEffect(() => { if (approval?.exists) onApproved(requestHash) }, [approval?.exists, onApproved, requestHash])

  const handleSubmit = async () => {
    if (!data.tokenId || !amount) return
    setLoading(true)
    try {
      const nonce = Date.now()
      const res = await submitLoanRequest({ borrowerAddress: address, plaidToken, tokenId: data.tokenId, requestedAmount: parseUSDC(amount).toString(), tenureMonths: parseInt(tenure), nonce })
      if (res.error) { toast.error(res.error); setLoading(false); return }
      setRequestHash(res.requestHash)
      toast.info("Approving NFT transfer...")
      writeContract({ address: CONTRACTS.PropertyNFT.address, abi: CONTRACTS.PropertyNFT.abi, functionName: "approve", args: [CONTRACTS.LoanManager.address, BigInt(data.tokenId)] })
    } catch { toast.error("Failed to submit loan request") }
    setLoading(false)
  }

  useEffect(() => { if (txConfirmed && requestHash && !hasPendingRequest) { writeContract({ address: CONTRACTS.LoanManager.address, abi: CONTRACTS.LoanManager.abi, functionName: "submitRequest", args: [requestHash as `0x${string}`] }) } }, [txConfirmed, requestHash, hasPendingRequest, writeContract])

  if (hasPendingRequest) {
    return (
      <GlassCard className="max-w-lg" accent="gold" hover={false}>
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#0D0D0D' }} />
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Awaiting CRE Assessment</h2>
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full anim-dot" style={{ background: '#0D0D0D' }} />
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3D3D3D' }}>CRE enclave is assessing your credit...</p>
          </div>
          <div className="space-y-2" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#C8F135', fontSize: '14px' }}>&gt;</span>
              Fetching financial data via Confidential HTTP
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#C8F135', fontSize: '14px' }}>&gt;</span>
              Running hard gates (LTV, coverage, defaults)
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#C8F135', fontSize: '14px' }}>&gt;</span>
              Sending metrics to LLM for scoring
            </p>
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#C8F135', fontSize: '14px' }}>&gt;</span>
              Checking pool liquidity
            </p>
          </div>
          <p className="stat-label" style={{ marginTop: '16px' }}>Polling every 10s for verdict...</p>
        </GlassCardContent>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="max-w-lg" hover={false}>
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" style={{ color: '#0D0D0D' }} />
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Request Loan</h2>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-4">
          <div>
            <label className="stat-label" style={{ marginBottom: '8px', display: 'block' }}>Loan Amount (USDC)</label>
            <input type="number" placeholder="e.g. 500000" value={amount} onChange={(e) => setAmount(e.target.value)} className="nb-input" style={{ height: '44px' }} />
          </div>
          <div>
            <label className="stat-label" style={{ marginBottom: '8px', display: 'block' }}>Tenure (months)</label>
            <div className="flex gap-2">
              {["6", "12", "24", "36"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTenure(t)}
                  className={`nb-btn flex-1 ${tenure === t ? 'lime' : 'ghost'}`}
                  style={{ padding: '8px 0', fontSize: '12px', boxShadow: '2px 2px 0px #0D0D0D' }}
                >
                  {t}mo
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="stat-label" style={{ marginBottom: '8px', display: 'block' }}>Plaid Token</label>
            <input value={plaidToken} onChange={(e) => setPlaidToken(e.target.value)} className="nb-input" style={{ height: '44px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }} />
          </div>
          <button onClick={handleSubmit} disabled={loading || isPending || !amount} className="nb-btn lime w-full" style={{ height: '44px' }}>
            {loading || isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "Submit Loan Request"}
          </button>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}

function StepClaimLoan({ approval, refetch, onComplete }: { approval: { requestHash: `0x${string}`; approvedLimit: bigint; tenureMonths: bigint; computedEMI: bigint; expiresAt: bigint }; refetch: () => void; onComplete: () => void }) {
  const { writeContract, data: txHash, isPending } = useBlockscoutTx()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => { if (isSuccess) { toast.success("Loan claimed! USDC disbursed."); refetch(); onComplete() } }, [isSuccess, refetch, onComplete])

  return (
    <GlassCard className="max-w-lg" accent="lime" hover={false}>
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4" style={{ color: '#0D0D0D' }} />
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Claim Your Loan</h2>
        </div>
        <span className="nb-tag approved">Approved</span>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-3 mb-5">
          <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ color: '#3D3D3D' }}>Approved Amount</span>
            <span className="stat-number" style={{ fontSize: '18px' }}>{formatUSDC(approval.approvedLimit)} USDC</span>
          </div>
          <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ color: '#3D3D3D' }}>Tenure</span>
            <span style={{ fontWeight: 700 }}>{approval.tenureMonths.toString()} months</span>
          </div>
          <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ color: '#3D3D3D' }}>Monthly EMI</span>
            <span className="stat-number" style={{ fontSize: '18px' }}>{formatUSDC(approval.computedEMI)} USDC</span>
          </div>
          <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ color: '#3D3D3D' }}>Expires</span>
            <span style={{ fontSize: '12px', color: '#888880' }}>{formatTimestamp(Number(approval.expiresAt))}</span>
          </div>
        </div>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#888880', marginBottom: '16px' }}>
          This will lock your PropertyNFT as collateral and disburse USDC to your wallet.
        </p>
        <button
          onClick={() => { writeContract({ address: CONTRACTS.LoanManager.address, abi: CONTRACTS.LoanManager.abi, functionName: "claimLoan", args: [approval.requestHash] }) }}
          disabled={isPending || confirming}
          className="nb-btn w-full"
          style={{ height: '44px', background: '#0D0D0D', color: '#FAFAF7' }}
        >
          {isPending ? "Confirm in wallet..." : confirming ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : "Lock NFT & Claim Loan"}
        </button>
      </GlassCardContent>
    </GlassCard>
  )
}

function StepRepay({ loan, loanId, refetchLoan }: { loan: { principal: bigint; remainingPrincipal: bigint; emiAmount: bigint; nextDueDate: bigint; missedPayments: bigint; status: number } | undefined; loanId: bigint; refetchLoan: () => void }) {
  const { address } = useAccount()
  const balances = useTokenBalances()
  const { writeContract, data: txHash, isPending } = useBlockscoutTx()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const [approving, setApproving] = useState(false)

  useEffect(() => { if (isSuccess) { toast.success("EMI payment successful!"); refetchLoan(); balances.refetch() } }, [isSuccess, refetchLoan, balances])

  if (!loan) return <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#3D3D3D' }}>Loading loan details...</p>

  const progress = loan.principal > 0n ? Number(((loan.principal - loan.remainingPrincipal) * 100n) / loan.principal) : 0
  const statusLabels = ["Active", "Defaulted", "Closed"]

  const handleRepay = () => {
    if (!address) return
    const allowance = balances.usdcAllowanceLendingPool ?? 0n
    if (allowance < loan.emiAmount) {
      setApproving(true)
      writeContract({ address: CONTRACTS.MockUSDC.address, abi: CONTRACTS.MockUSDC.abi, functionName: "approve", args: [CONTRACTS.LoanManager.address, loan.emiAmount] }, {
        onSuccess: () => { setApproving(false); writeContract({ address: CONTRACTS.LoanManager.address, abi: CONTRACTS.LoanManager.abi, functionName: "repay", args: [loanId] }) },
      })
    } else {
      writeContract({ address: CONTRACTS.LoanManager.address, abi: CONTRACTS.LoanManager.abi, functionName: "repay", args: [loanId] })
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <GlassCard hover={false}>
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" style={{ color: '#0D0D0D' }} />
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Active Loan</h2>
          </div>
          <span className={`nb-tag ${loan.status === 0 ? 'active' : 'default'}`}>
            {statusLabels[loan.status]}
          </span>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-3">
            <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: '#3D3D3D' }}>Principal</span>
              <span className="stat-number" style={{ fontSize: '16px' }}>{formatUSDC(loan.principal)} USDC</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: '#3D3D3D' }}>Remaining</span>
              <span style={{ fontWeight: 600 }}>{formatUSDC(loan.remainingPrincipal)} USDC</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: '#3D3D3D' }}>EMI Amount</span>
              <span style={{ fontWeight: 600 }}>{formatUSDC(loan.emiAmount)} USDC</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: '#3D3D3D' }}>Next Due</span>
              <span style={{ fontSize: '12px', color: '#888880' }}>{formatTimestamp(Number(loan.nextDueDate))}</span>
            </div>
            <div className="flex justify-between" style={{ fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ color: '#3D3D3D' }}>Missed Payments</span>
              <span style={{ fontWeight: 700, color: loan.missedPayments > 0n ? '#FF8A80' : '#0D0D0D' }}>{loan.missedPayments.toString()}</span>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      <GlassCard hover={false}>
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: '#0D0D0D' }} />
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>Repayment</h2>
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="mb-5">
            <div className="flex justify-between stat-label" style={{ marginBottom: '8px' }}>
              <span>Progress</span>
              <span className="stat-number" style={{ fontSize: '14px' }}>{progress}%</span>
            </div>
            <div className="nb-progress">
              <div className="nb-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {loan.status === 0 && (
            <button onClick={handleRepay} disabled={isPending || confirming} className="nb-btn lime w-full" style={{ height: '44px' }}>
              {approving ? "Approving USDC..." : isPending ? "Confirm..." : confirming ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : `Pay EMI (${formatUSDC(loan.emiAmount)} USDC)`}
            </button>
          )}
        </GlassCardContent>
      </GlassCard>
    </div>
  )
}

"use client"

import { useState } from "react"
import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card"
import {
  ShieldCheck,
  Gavel,
  Lock,
  Scale,
  Terminal,
  ChevronRight,
} from "lucide-react"

const WORKFLOWS = [
  {
    id: "credit-assessment",
    title: "Credit Assessment",
    description: "Evaluates borrower creditworthiness inside a CRE enclave. Fetches Plaid financial data, scores via LLM, and writes approval on-chain.",
    command: "cre workflow simulate credit-assessment-workflow --target staging-settings --non-interactive --trigger-index 0 --broadcast --verbose",
    icon: ShieldCheck,
    steps: ["Trigger: LoanManager.RequestSubmitted event", "Fetch borrower financial data via Plaid API", "Score creditworthiness with Groq LLM (llama-3.3-70b)", "Compute EMI, interest rate, approved limit", "Write LoanManager.approveLoan() on-chain"],
  },
  {
    id: "create-auction",
    title: "Create Auction",
    description: "Cron-triggered workflow that scans for defaulted loans (3+ missed payments) and creates sealed-bid auctions on-chain.",
    command: "cre workflow simulate create-auction-workflow --target staging-settings --non-interactive --trigger-index 0 --broadcast --verbose",
    icon: Gavel,
    steps: ["Trigger: Cron schedule (every 5 minutes)", "Read all active loans from LoanManager", "Check for defaults (missedPayments >= 3)", "Fetch property listing from API, compute hash", "Call LienFiAuction.createAuction() on-chain"],
  },
  {
    id: "bid",
    title: "Sealed Bid Collection",
    description: "Collects EIP-712 signed bids off-chain. Bids are sealed — only the CRE enclave sees the amounts. Verified and stored securely.",
    command: "POST /bid — EIP-712 signed bid submitted via API",
    icon: Lock,
    steps: ["Bidder deposits USDC to auction pool (World ID verified)", "Bidder signs EIP-712 typed data with bid amount", "API verifies signature and auction eligibility", "Bid stored in encrypted enclave storage", "Only opaque bid count visible on-chain"],
  },
  {
    id: "settlement",
    title: "Auction Settlement",
    description: "After deadline, the CRE workflow reveals all bids, determines the Vickrey winner (highest bidder pays second-highest price), and settles on-chain.",
    command: "cre workflow simulate settlement-workflow --target staging-settings --non-interactive --trigger-index 0 --broadcast --verbose",
    icon: Scale,
    steps: ["Trigger: Cron / manual after auction deadline", "Fetch all sealed bids from enclave storage", "Verify each EIP-712 signature", "Determine winner (highest bid) and price (second-highest)", "Call LienFiAuction.settleAuction() on-chain"],
  },
]

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <h1 className="display-title" style={{ marginTop: '16px' }}>Workflows</h1>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3D3D3D', marginTop: '-8px' }}>
        Chainlink Runtime Environment workflows powering LienFi.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {WORKFLOWS.map((wf) => <WorkflowPanel key={wf.id} workflow={wf} />)}
      </div>
    </div>
  )
}

function WorkflowPanel({ workflow }: { workflow: (typeof WORKFLOWS)[number] }) {
  const [output, setOutput] = useState("")
  const Icon = workflow.icon

  return (
    <GlassCard hover={false}>
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 flex items-center justify-center"
            style={{ border: '2px solid #0D0D0D', borderRadius: '4px', background: '#C8F135' }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: '#0D0D0D' }} />
          </div>
          <span className="nb-tag active">{workflow.id}</span>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>{workflow.title}</h2>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D', marginBottom: '16px', lineHeight: 1.6 }}>
          {workflow.description}
        </p>

        <div className="mb-4">
          <p className="stat-label" style={{ marginBottom: '8px' }}>Steps</p>
          <div className="space-y-1.5">
            {workflow.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" style={{ color: '#0D0D0D' }} />
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#3D3D3D' }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <p className="stat-label" style={{ marginBottom: '8px' }}>CLI Command</p>
          <div
            className="px-4 py-3"
            style={{
              background: '#1A1A1A',
              border: '2px solid #0D0D0D',
              borderRadius: '4px',
              boxShadow: '2px 2px 0px #0D0D0D',
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#C8F135', fontSize: '14px' }}>&gt;</span>
              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#FAFAF7', wordBreak: 'break-all' }}>
                {workflow.command}
              </code>
            </div>
          </div>
        </div>

        <div>
          <p className="stat-label" style={{ marginBottom: '8px' }}>Live Output</p>
          <textarea
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            placeholder="Paste CRE simulation output here..."
            className="nb-input"
            style={{
              width: '100%',
              height: '144px',
              resize: 'vertical',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
            }}
            spellCheck={false}
          />
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}

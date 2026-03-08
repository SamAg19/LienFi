"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { GlassCard, GlassCardHeader, GlassCardContent } from "@/components/ui/glass-card"
import { getWorkflowLogs } from "@/lib/api"
import {
  ShieldCheck,
  Gavel,
  Lock,
  Scale,
  Terminal,
  ChevronRight,
  Copy,
  Check,
  Play,
  Square,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"

const WORKFLOWS = [
  {
    id: "credit-assessment",
    title: "Credit Assessment",
    description: "Evaluates borrower creditworthiness inside a CRE enclave. Fetches Plaid financial data, scores via LLM, and writes approval on-chain.",
    command: (hash: string) => `./run-cre.sh credit-assessment-workflow ${hash || "<request-hash>"}`,
    icon: ShieldCheck,
    steps: ["Trigger: LoanManager.RequestSubmitted event", "Fetch borrower financial data via Plaid API", "Score creditworthiness with Groq LLM (llama-3.3-70b)", "Compute EMI, interest rate, approved limit", "Write LoanManager.approveLoan() on-chain"],
  },
  {
    id: "create-auction",
    title: "Create Auction",
    description: "Cron-triggered workflow that scans for defaulted loans (3+ missed payments) and creates sealed-bid auctions on-chain.",
    command: () => `./run-cre-cron.sh create-auction-workflow create-auction`,
    fixedLogKey: "create-auction",
    icon: Gavel,
    steps: ["Trigger: Cron schedule (every 5 minutes)", "Read all active loans from LoanManager", "Check for defaults (missedPayments >= 3)", "Fetch property listing from API, compute hash", "Call LienFiAuction.createAuction() on-chain"],
  },
  {
    id: "bid",
    title: "Sealed Bid Collection",
    description: "HTTP-triggered CRE workflow that forwards signed bids to the API, validates eligibility, and registers the opaque bid hash on-chain via DON-signed report.",
    command: () => `./run-cre-bid.sh /path/to/bid-payload.json bid`,
    fixedLogKey: "bid",
    icon: Lock,
    steps: ["Trigger: HTTP payload (signed bid JSON)", "Forward bid to API via Confidential HTTP", "API validates: EIP-712 sig, pool balance, lock expiry, reserve price", "Encode report: abi.encode(auctionId, bidHash)", "DON-sign and write to LienFiAuction._registerBid()"],
  },
  {
    id: "settlement",
    title: "Auction Settlement",
    description: "After deadline, the CRE workflow reveals all bids, determines the Vickrey winner (highest bidder pays second-highest price), and settles on-chain.",
    command: () => `./run-cre-cron.sh settlement-workflow settlement`,
    fixedLogKey: "settlement",
    icon: Scale,
    steps: ["Trigger: Cron / manual after auction deadline", "Fetch all sealed bids from enclave storage", "Verify each EIP-712 signature", "Determine winner (highest bid) and price (second-highest)", "Call LienFiAuction.settleAuction() on-chain"],
  },
]

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <h1 className="display-title" style={{ marginTop: '16px' }}>Workflows</h1>
      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: '#3D3D3D', marginTop: '-8px' }}>
        Chainlink Runtime Environment workflows powering LienFi. Paste a request hash to watch live output.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {WORKFLOWS.map((wf) => <WorkflowPanel key={wf.id} workflow={wf} />)}
      </div>
    </div>
  )
}

function WorkflowPanel({ workflow }: { workflow: (typeof WORKFLOWS)[number] }) {
  const [requestHash, setRequestHash] = useState("")
  const logKey = workflow.fixedLogKey || requestHash
  const [watching, setWatching] = useState(false)
  const [lines, setLines] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const lastTimestamp = useRef(0)
  const Icon = workflow.icon

  const poll = useCallback(async () => {
    if (!logKey) return
    try {
      const res = await getWorkflowLogs(logKey, lastTimestamp.current)
      if (res.logs && res.logs.length > 0) {
        const newLines = res.logs.map((l) => l.line)
        setLines((prev) => [...prev, ...newLines])
        lastTimestamp.current = res.logs[res.logs.length - 1].timestamp
      }
    } catch {}
  }, [requestHash])

  useEffect(() => {
    if (!watching) return
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [watching, poll])

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [lines])

  const handleWatch = () => {
    if (!logKey) {
      toast.error("Enter a request hash first")
      return
    }
    setLines([])
    lastTimestamp.current = 0
    setWatching(true)
    toast.info("Watching for CRE output...")
  }

  const handleStop = () => {
    setWatching(false)
  }

  const commandStr = workflow.fixedLogKey ? workflow.command() : workflow.command(requestHash)

  const copyCommand = () => {
    navigator.clipboard.writeText(commandStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

        {/* Request hash input — only for event-triggered workflows */}
        {!workflow.fixedLogKey && (
          <div className="mb-4">
            <p className="stat-label" style={{ marginBottom: '8px' }}>Request Hash</p>
            <input
              type="text"
              placeholder="0x..."
              value={requestHash}
              onChange={(e) => setRequestHash(e.target.value)}
              className="nb-input"
              style={{ height: '38px', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}
            />
          </div>
        )}

        {/* CLI command with copy */}
        <div className="mb-4">
          <p className="stat-label" style={{ marginBottom: '8px' }}>CLI Command</p>
          <div
            className="px-4 py-3 flex items-center justify-between gap-2"
            style={{
              background: '#1A1A1A',
              border: '2px solid #0D0D0D',
              borderRadius: '4px',
              boxShadow: '2px 2px 0px #0D0D0D',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#C8F135', fontSize: '14px' }}>&gt;</span>
              <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#FAFAF7', wordBreak: 'break-all' }}>
                {commandStr}
              </code>
            </div>
            <button onClick={copyCommand} className="shrink-0" style={{ color: '#888880' }}>
              {copied ? <Check className="w-3.5 h-3.5" style={{ color: '#C8F135' }} /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Live terminal */}
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
            <p className="stat-label flex items-center gap-2">
              <Terminal className="w-3 h-3" />
              Live Output
              {watching && <span className="w-1.5 h-1.5 rounded-full inline-block anim-dot" style={{ background: '#C8F135' }} />}
            </p>
            {!watching ? (
              <button
                onClick={handleWatch}
                className="nb-btn ghost"
                style={{ padding: '4px 10px', fontSize: '10px', boxShadow: '2px 2px 0px #0D0D0D' }}
              >
                <Play className="w-3 h-3" />
                Watch
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="nb-btn ghost"
                style={{ padding: '4px 10px', fontSize: '10px', boxShadow: '2px 2px 0px #0D0D0D' }}
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
            )}
          </div>
          <div
            ref={terminalRef}
            style={{
              background: '#1A1A1A',
              border: '2px solid #0D0D0D',
              borderRadius: '4px',
              boxShadow: '2px 2px 0px #0D0D0D',
              height: '360px',
              overflowY: 'auto',
              padding: '12px 16px',
            }}
          >
            {lines.length === 0 ? (
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#555' }}>
                {watching ? "Waiting for CRE output..." : "Run the CLI command above, then click Watch to see live output here."}
              </p>
            ) : (
              lines.filter((l) => !l.startsWith("REPORT_TX:")).map((line, i) => (
                <div key={i} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: lineColor(line), lineHeight: 1.7 }}>
                  <LinkifyTxHash text={line} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Forwarder Transactions — only MockKeystoneForwarder report tx hashes */}
        {(() => {
          const txHashes = extractReportTxHashes(lines)
          if (txHashes.length === 0) return null
          return (
            <div style={{ marginTop: 16 }}>
              <p className="stat-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ExternalLink className="w-3 h-3" />
                Forwarder Transactions
              </p>
              <div className="space-y-2">
                {txHashes.map((hash) => (
                  <div
                    key={hash}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                    style={{
                      background: '#FAFAF7',
                      border: '2px solid #0D0D0D',
                      borderRadius: 4,
                      boxShadow: '2px 2px 0px #0D0D0D',
                    }}
                  >
                    <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#3D3D3D' }}>
                      {hash.slice(0, 18)}...{hash.slice(-8)}
                    </code>
                    <a
                      href={`${BLOCKSCOUT_BASE}${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nb-btn ghost"
                      style={{ padding: '4px 10px', fontSize: 10, boxShadow: '2px 2px 0px #0D0D0D', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Blockscout
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </GlassCardContent>
    </GlassCard>
  )
}

const BLOCKSCOUT_BASE = "https://eth-sepolia.blockscout.com/tx/"
const TX_HASH_REGEX = /\b(0x[a-fA-F0-9]{64})\b/g

function LinkifyTxHash({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const regex = new RegExp(TX_HASH_REGEX.source, 'g')

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const hash = match[1]
    parts.push(
      <a
        key={match.index}
        href={`${BLOCKSCOUT_BASE}${hash}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#A8D8FF',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          cursor: 'pointer',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {hash.slice(0, 10)}...{hash.slice(-6)}
        <ExternalLink className="w-2.5 h-2.5 inline-block ml-1" style={{ verticalAlign: 'middle' }} />
      </a>
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? <>{parts}</> : <>{text}</>
}

/** Extract only MockKeystoneForwarder report tx hashes (tagged by CRE wrapper scripts) */
function extractReportTxHashes(lines: string[]): string[] {
  const hashes: string[] = []
  for (const line of lines) {
    if (!line.startsWith("REPORT_TX:")) continue
    const hash = line.slice("REPORT_TX:".length).trim()
    if (/^0x[a-fA-F0-9]{64}$/.test(hash) && !hashes.includes(hash)) {
      hashes.push(hash)
    }
  }
  return hashes
}

function lineColor(line: string): string {
  if (line.startsWith("✓") || line.includes("passed") || line.includes("approved")) return "#A8F0D8"
  if (line.startsWith("✗") || line.includes("REJECTED") || line.includes("failed") || line.includes("Error")) return "#FF8A80"
  if (line.startsWith("▶") || line.startsWith("---")) return "#C8F135"
  if (line.includes("WARNING") || line.includes("WARN")) return "#FFD180"
  return "#FAFAF7"
}

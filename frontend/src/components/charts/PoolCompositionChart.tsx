'use client'

interface PoolCompositionChartProps {
  availableLiquidity: number
  totalLoaned: number
}

export function PoolCompositionChart({ availableLiquidity, totalLoaned }: PoolCompositionChartProps) {
  const total = availableLiquidity + totalLoaned
  const availPct = total > 0 ? (availableLiquidity / total) * 100 : 50
  const loanedPct = total > 0 ? (totalLoaned / total) * 100 : 50

  const fmtVal = (v: number) =>
    '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div>
      {/* Big TVL number */}
      <div className="flex items-baseline gap-3 mb-4">
        <span className="chart-pct">
          ${total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total.toFixed(0)}
        </span>
        <span className="stat-label">Total Value Locked</span>
      </div>

      {/* Stacked horizontal bar */}
      <div
        className="flex overflow-hidden mb-4"
        style={{
          height: '28px',
          border: '2px solid #0D0D0D',
          borderRadius: '4px',
          boxShadow: '3px 3px 0px #0D0D0D',
        }}
      >
        <div
          style={{
            width: `${availPct}%`,
            background: '#D8ECFA',
            borderRight: loanedPct > 0 ? '2px solid #0D0D0D' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {availPct > 15 && (
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '12px', color: '#0D0D0D' }}>
              {availPct.toFixed(0)}%
            </span>
          )}
        </div>
        <div
          style={{
            width: `${loanedPct}%`,
            background: '#F5E6C4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loanedPct > 15 && (
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '12px', color: '#0D0D0D' }}>
              {loanedPct.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Legend row */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="p-3"
          style={{
            background: '#D8ECFA',
            border: '2px solid #0D0D0D',
            borderRadius: '4px',
            boxShadow: '2px 2px 0px #0D0D0D',
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="stat-label">Available</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#3D3D3D', fontWeight: 600 }}>
              {availPct.toFixed(1)}%
            </span>
          </div>
          <span className="stat-number" style={{ fontSize: '20px' }}>
            {fmtVal(availableLiquidity)}
          </span>
        </div>
        <div
          className="p-3"
          style={{
            background: '#F5E6C4',
            border: '2px solid #0D0D0D',
            borderRadius: '4px',
            boxShadow: '2px 2px 0px #0D0D0D',
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="stat-label">Loaned</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#3D3D3D', fontWeight: 600 }}>
              {loanedPct.toFixed(1)}%
            </span>
          </div>
          <span className="stat-number" style={{ fontSize: '20px' }}>
            {fmtVal(totalLoaned)}
          </span>
        </div>
      </div>
    </div>
  )
}

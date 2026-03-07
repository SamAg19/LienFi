'use client'

interface ExchangeRateChartProps {
  currentRate: number
}

function generateTrend(current: number): { day: string; value: number }[] {
  const baseline = current * 0.992
  const range = current - baseline
  const labels = ['7d', '6d', '5d', '4d', '3d', '2d', '1d', 'Now']
  return labels.map((day, i) => ({
    day,
    value: baseline + range * (i / (labels.length - 1)) + Math.sin(i * 1.1) * range * 0.12,
  }))
}

export function ExchangeRateChart({ currentRate }: ExchangeRateChartProps) {
  const data = generateTrend(currentRate)

  const W = 460
  const H = 200
  const PAD_L = 50
  const PAD_R = 20
  const PAD_T = 20
  const PAD_B = 30

  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  const values = data.map((d) => d.value)
  const minVal = Math.min(...values) - 0.0005
  const maxVal = Math.max(...values) + 0.0005
  const valRange = maxVal - minVal

  const getX = (i: number) => PAD_L + (i / (data.length - 1)) * chartW
  const getY = (v: number) => PAD_T + chartH - ((v - minVal) / valRange) * chartH

  // Build staircase (step) path
  let stepLine = `M ${getX(0)} ${getY(data[0].value)}`
  let areaPath = `M ${getX(0)} ${PAD_T + chartH} L ${getX(0)} ${getY(data[0].value)}`

  for (let i = 1; i < data.length; i++) {
    // Horizontal then vertical (step)
    stepLine += ` L ${getX(i)} ${getY(data[i - 1].value)}`
    stepLine += ` L ${getX(i)} ${getY(data[i].value)}`
    areaPath += ` L ${getX(i)} ${getY(data[i - 1].value)}`
    areaPath += ` L ${getX(i)} ${getY(data[i].value)}`
  }
  areaPath += ` L ${getX(data.length - 1)} ${PAD_T + chartH} Z`

  // Change percentage
  const changePct = ((data[data.length - 1].value - data[0].value) / data[0].value * 100).toFixed(1)

  return (
    <div className="w-full">
      {/* Big percentage label */}
      <div className="mb-3">
        <span className="chart-pct">+{changePct}%</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '200px' }}>
        {/* Filled area */}
        <path d={areaPath} fill="rgba(200,241,53,0.15)" />

        {/* Dashed vertical lines from each point to baseline */}
        {data.map((d, i) => (
          <line
            key={`vline-${i}`}
            x1={getX(i)}
            y1={getY(d.value)}
            x2={getX(i)}
            y2={PAD_T + chartH}
            stroke="#0D0D0D"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity={0.3}
          />
        ))}

        {/* Step line */}
        <path d={stepLine} fill="none" stroke="#0D0D0D" strokeWidth="2.5" />

        {/* Arrow marker at end */}
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#0D0D0D" />
          </marker>
        </defs>
        <line
          x1={getX(data.length - 1) - 1}
          y1={getY(data[data.length - 1].value)}
          x2={getX(data.length - 1) + 12}
          y2={getY(data[data.length - 1].value)}
          stroke="#0D0D0D"
          strokeWidth="2.5"
          markerEnd="url(#arrowhead)"
        />

        {/* Open circle markers */}
        {data.map((d, i) => (
          <circle
            key={`pt-${i}`}
            cx={getX(i)}
            cy={getY(d.value)}
            r="4"
            fill="#FAFAF7"
            stroke="#0D0D0D"
            strokeWidth="2"
          />
        ))}

        {/* Bottom baseline */}
        <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="#0D0D0D" strokeWidth="2" />

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={`label-${i}`}
            x={getX(i)}
            y={H - 5}
            textAnchor="middle"
            style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', fill: '#888880', fontWeight: 500 }}
          >
            {d.day}
          </text>
        ))}

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
          const val = minVal + valRange * frac
          return (
            <text
              key={`y-${i}`}
              x={PAD_L - 8}
              y={PAD_T + chartH - frac * chartH + 4}
              textAnchor="end"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', fill: '#888880' }}
            >
              {val.toFixed(3)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

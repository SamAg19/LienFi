"use client"

import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  icon?: React.ReactNode
  className?: string
  loading?: boolean
  accent?: "lime" | "peach" | "sky" | "lavender"
}

const accentBg: Record<string, string> = {
  lime: "#E8F0D8",
  peach: "#F5E0D8",
  sky: "#D8ECFA",
  lavender: "#E4DDF5",
}

export function StatCard({
  label,
  value,
  icon,
  className,
  loading = false,
  accent,
}: StatCardProps) {
  return (
    <div
      className={cn("nb-card p-5", className)}
      style={accent ? { background: accentBg[accent] } : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="stat-label">{label}</span>
        {icon && (
          <div
            className="w-8 h-8 flex items-center justify-center"
            style={{
              border: '2px solid #0D0D0D',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.3)',
            }}
          >
            {icon}
          </div>
        )}
      </div>
      {loading ? (
        <div
          className="h-9 w-28"
          style={{
            background: 'rgba(13,13,13,0.08)',
            borderRadius: '3px',
            animation: 'stamp 1s ease infinite alternate',
          }}
        />
      ) : (
        <span className="stat-number">{value}</span>
      )}
    </div>
  )
}

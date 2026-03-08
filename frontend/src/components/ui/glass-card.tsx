"use client"

import { cn } from "@/lib/utils"

interface NbCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  accent?: "lime" | "peach" | "sky" | "lavender" | "gold" | "mint" | "coral"
}

const accentBg: Record<string, string> = {
  lime: "#EEF5D8",
  peach: "#F5E0DA",
  sky: "#D8ECFA",
  lavender: "#E4DDF5",
  gold: "#F5EDD6",
  mint: "#D8F0E6",
  coral: "#F5D6D2",
}

export function GlassCard({ children, className, hover = true, accent }: NbCardProps) {
  return (
    <div
      className={cn("nb-card", !hover && "no-hover", className)}
      style={accent ? { background: accentBg[accent] } : undefined}
    >
      {children}
    </div>
  )
}

export function GlassCardHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-5 py-4",
        className
      )}
      style={{ borderBottom: '2px solid #0D0D0D' }}
    >
      {children}
    </div>
  )
}

export function GlassCardContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn("px-5 py-5", className)}>{children}</div>
}

"use client"

import { cn } from "@/lib/utils"

interface NbCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  accent?: "lime" | "peach" | "sky" | "lavender" | "gold" | "mint" | "coral"
}

const accentBg: Record<string, string> = {
  lime: "#C8F135",
  peach: "#FFB4A0",
  sky: "#A8D8FF",
  lavender: "#C4B5FF",
  gold: "#FFD97D",
  mint: "#A8F0D8",
  coral: "#FF8A80",
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

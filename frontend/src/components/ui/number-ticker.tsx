"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface NumberTickerProps {
  value: number
  direction?: "up" | "down"
  delay?: number
  decimalPlaces?: number
  className?: string
  prefix?: string
  suffix?: string
}

export function NumberTicker({
  value,
  direction = "up",
  delay = 0,
  decimalPlaces = 0,
  className,
  prefix = "",
  suffix = "",
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [displayValue, setDisplayValue] = useState(direction === "down" ? value : 0)

  useEffect(() => {
    const startValue = direction === "down" ? value : 0
    const endValue = direction === "down" ? 0 : value
    const duration = 1500
    const startTime = Date.now() + delay

    const tick = () => {
      const now = Date.now()
      if (now < startTime) {
        requestAnimationFrame(tick)
        return
      }

      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (endValue - startValue) * eased

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }

    requestAnimationFrame(tick)
  }, [value, direction, delay])

  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)}>
      {prefix}
      {displayValue.toFixed(decimalPlaces).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
      {suffix}
    </span>
  )
}

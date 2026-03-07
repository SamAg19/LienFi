"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface CountdownTimerProps {
  deadline: number
  className?: string
  compact?: boolean
}

export function CountdownTimer({ deadline, className, compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(deadline))

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getTimeLeft(deadline)), 1000)
    return () => clearInterval(interval)
  }, [deadline])

  if (timeLeft.total <= 0) {
    return <span className={cn("font-bold", className)} style={{ fontFamily: "'Fraunces', serif", color: '#FF8A80' }}>Expired</span>
  }

  if (compact) {
    return (
      <span
        className={cn("font-bold tabular-nums", className)}
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: '#0D0D0D' }}
      >
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
      </span>
    )
  }

  return (
    <div className={cn("flex gap-2", className)}>
      {timeLeft.days > 0 && <TimeBlock value={timeLeft.days} label="Days" />}
      <TimeBlock value={timeLeft.hours} label="Hrs" />
      <TimeBlock value={timeLeft.minutes} label="Min" />
      <TimeBlock value={timeLeft.seconds} label="Sec" />
    </div>
  )
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="flex flex-col items-center px-3 py-2"
      style={{
        background: '#FFD97D',
        border: '2px solid #0D0D0D',
        borderRadius: '4px',
        boxShadow: '2px 2px 0px #0D0D0D',
      }}
    >
      <span
        className="tabular-nums"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: '20px', color: '#0D0D0D', lineHeight: 1 }}
      >
        {value.toString().padStart(2, "0")}
      </span>
      <span className="stat-label" style={{ fontSize: '9px', marginTop: '2px' }}>{label}</span>
    </div>
  )
}

function getTimeLeft(deadline: number) {
  const total = deadline - Math.floor(Date.now() / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return { total, days, hours, minutes, seconds }
}

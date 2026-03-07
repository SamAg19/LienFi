"use client"

import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
  variant?: "primary" | "secondary"
}

export function ShimmerButton({
  children,
  className,
  variant = "primary",
  ...props
}: ShimmerButtonProps) {
  return (
    <motion.button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-[22px] py-[10px] font-semibold text-[13px] transition-all",
        variant === "primary"
          ? "bg-hl text-page shadow-[0_0_20px_rgba(229,165,48,0.25)] hover:brightness-110"
          : "bg-transparent border border-white/[0.12] text-t2 hover:border-white/[0.2] hover:text-t1",
        className
      )}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      {...(props as any)}
    >
      {children}
    </motion.button>
  )
}

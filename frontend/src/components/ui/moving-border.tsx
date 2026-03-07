"use client"

import React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export function MovingBorder({
  children,
  duration = 2000,
  className,
  containerClassName,
  borderClassName,
  as: Component = "div",
  ...otherProps
}: {
  children: React.ReactNode
  duration?: number
  className?: string
  containerClassName?: string
  borderClassName?: string
  as?: React.ElementType
  [key: string]: unknown
}) {
  return (
    <Component
      className={cn(
        "relative overflow-hidden rounded-2xl p-[1px]",
        containerClassName
      )}
      {...otherProps}
    >
      <div
        className="absolute inset-0"
        style={{ borderRadius: "inherit" }}
      >
        <motion.div
          className={cn(
            "absolute h-20 w-20 bg-[radial-gradient(var(--color-hl)_40%,transparent_60%)] opacity-80",
            borderClassName
          )}
          animate={{
            x: [0, 200, 200, 0, 0],
            y: [0, 0, 200, 200, 0],
          }}
          transition={{
            duration: duration / 1000,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            top: "-10px",
            left: "-10px",
          }}
        />
      </div>
      <div
        className={cn(
          "relative rounded-[inherit] bg-page",
          className
        )}
      >
        {children}
      </div>
    </Component>
  )
}

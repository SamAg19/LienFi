import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUSDC(amount: bigint): string {
  const whole = amount / 1_000_000n
  const frac = amount % 1_000_000n
  const fracStr = frac.toString().padStart(6, '0').slice(0, 2)
  return `${whole.toLocaleString()}.${fracStr}`
}

export function parseUSDC(input: string): bigint {
  const [whole, frac = ''] = input.split('.')
  const paddedFrac = frac.padEnd(6, '0').slice(0, 6)
  return BigInt(whole || '0') * 1_000_000n + BigInt(paddedFrac)
}

export function formatExchangeRate(rate: bigint): string {
  const rateNum = Number(rate) / 1e18
  return rateNum.toFixed(4)
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString()
}

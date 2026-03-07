const TX_HISTORY_KEY = "lienfi-tx-history"
const MAX_ENTRIES = 50

export type TxRecord = {
  hash: string
  functionName: string
  contractName: string
  timestamp: number
  status: "pending" | "confirmed" | "failed"
}

export function getTxHistory(): TxRecord[] {
  try {
    const raw = localStorage.getItem(TX_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addTxRecord(record: TxRecord) {
  const history = getTxHistory()
  history.unshift(record)
  if (history.length > MAX_ENTRIES) history.length = MAX_ENTRIES
  localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(history))
}

export function updateTxStatus(hash: string, status: TxRecord["status"]) {
  const history = getTxHistory()
  const entry = history.find((tx) => tx.hash === hash)
  if (entry) {
    entry.status = status
    localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(history))
  }
}

export function clearTxHistory() {
  localStorage.removeItem(TX_HISTORY_KEY)
}

export function getExplorerUrl(hash: string): string {
  return `https://eth-sepolia.blockscout.com/tx/${hash}`
}

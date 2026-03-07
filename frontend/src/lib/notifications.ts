const NOTIF_KEY = "lienfi-notifications"
const MAX_NOTIFICATIONS = 20

export type AppNotification = {
  id: string
  title: string
  description: string
  hash?: string
  timestamp: number
  read: boolean
}

export function getNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addNotification(notif: Omit<AppNotification, "id" | "timestamp" | "read">) {
  const all = getNotifications()
  // Deduplicate by title+hash
  if (notif.hash && all.some((n) => n.hash === notif.hash)) return
  all.unshift({
    ...notif,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    read: false,
  })
  if (all.length > MAX_NOTIFICATIONS) all.length = MAX_NOTIFICATIONS
  localStorage.setItem(NOTIF_KEY, JSON.stringify(all))
}

export function markAllRead() {
  const all = getNotifications()
  all.forEach((n) => (n.read = true))
  localStorage.setItem(NOTIF_KEY, JSON.stringify(all))
}

export function getUnreadCount(): number {
  return getNotifications().filter((n) => !n.read).length
}

export function clearNotifications() {
  localStorage.removeItem(NOTIF_KEY)
}

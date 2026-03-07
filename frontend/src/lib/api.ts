const API_BASE = "https://sealbid.onrender.com"
const API_KEY = "33ab8800ae775f6b302118a9f9811bf77d4633450ee690e27afcd2eb4a33cc25"

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Api-Key": API_KEY,
  }
}

export async function verifyProperty(propertyId: string, sellerAddress: string) {
  const res = await fetch(`${API_BASE}/verify-property`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ propertyId, sellerAddress }),
  })
  return res.json()
}

export async function submitLoanRequest(data: {
  borrowerAddress: string
  plaidToken: string
  tokenId: number
  requestedAmount: string
  tenureMonths: number
  nonce: number
}) {
  const res = await fetch(`${API_BASE}/loan-request`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function submitBid(data: {
  auctionId: string
  bidder: string
  amount: string
  nonce: number
  signature: string
  auctionDeadline: number
}) {
  const res = await fetch(`${API_BASE}/bid`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function getAuctionStatus(auctionId: string) {
  const res = await fetch(`${API_BASE}/status/${auctionId}`, {
    headers: authHeaders(),
  })
  return res.json()
}

export async function getListing(auctionId: string) {
  const res = await fetch(`${API_BASE}/listing/${auctionId}`)
  return res.json()
}

export async function revealProperty(auctionId: string, signature: string) {
  const res = await fetch(`${API_BASE}/reveal/${auctionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature }),
  })
  return res.json()
}

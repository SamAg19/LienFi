import type { Metadata } from "next"
import { DM_Sans, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { TopNav } from "@/components/layout/TopNav"
import { Toaster } from "@/components/ui/sonner"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "LienFi — Private Credit + Sealed-Bid Auctions",
  description:
    "DeFi lending with private credit assessment and privacy-preserving Vickrey auctions on Chainlink CRE",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <Providers>
          <TopNav />
          <div className="min-h-screen pt-4 pb-12 page-content">
            <main className="max-w-[1280px] mx-auto px-8">
              {children}
            </main>
          </div>
          <Toaster
            toastOptions={{
              style: {
                background: '#FAFAF7',
                border: '2px solid #0D0D0D',
                color: '#0D0D0D',
                borderRadius: '4px',
                boxShadow: '4px 4px 0px #0D0D0D',
                fontFamily: "'DM Sans', sans-serif",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}

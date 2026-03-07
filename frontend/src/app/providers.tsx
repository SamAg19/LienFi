'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotificationProvider, TransactionPopupProvider } from '@blockscout/app-sdk'
import { config } from '@/config/wagmi'
import { privyConfig } from '@/config/privy'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'placeholder'}
      config={privyConfig}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <NotificationProvider>
            <TransactionPopupProvider>
              {children}
            </TransactionPopupProvider>
          </NotificationProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}

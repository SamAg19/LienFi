import type { PrivyClientConfig } from '@privy-io/react-auth'
import { sepolia } from 'wagmi/chains'

export const privyConfig: PrivyClientConfig = {
  loginMethods: ['wallet', 'email', 'google'],
  appearance: {
    theme: 'light',
    accentColor: '#0D0D0D',
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
  defaultChain: sepolia,
  supportedChains: [sepolia],
}

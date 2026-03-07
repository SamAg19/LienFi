export const CONTRACTS = {
  MockUSDC: {
    address: '0x3Ef3f81b24ACB7334C75EAA38a2C132c8eA74656' as `0x${string}`,
    abi: [
      {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
        ],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
      },
      {
        name: 'mint',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
      },
      {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint8' }],
      },
    ] as const,
  },

  clUSDC: {
    address: '0x40Eb4B08D1Bf9b9dbF0CD5C1825f9507c7484F9E' as `0x${string}`,
    abi: [
      {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'totalSupply',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint8' }],
      },
    ] as const,
  },

  LendingPool: {
    address: '0xa2E797b58489B849c8A47413197BC1db2EeEBbD4' as `0x${string}`,
    abi: [
      {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
      },
      {
        name: 'withdraw',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'clUsdcAmount', type: 'uint256' }],
        outputs: [],
      },
      {
        name: 'exchangeRate',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'availableLiquidity',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'totalPoolValue',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'totalLoaned',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
      },
    ] as const,
  },

  LoanManager: {
    address: '0x901e8969F1368A58dbBa84813147e086E2B006DD' as `0x${string}`,
    abi: [
      {
        name: 'submitRequest',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'requestHash', type: 'bytes32' }],
        outputs: [],
      },
      {
        name: 'claimLoan',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'requestHash', type: 'bytes32' }],
        outputs: [],
      },
      {
        name: 'repay',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'loanId', type: 'uint256' }],
        outputs: [],
      },
      {
        name: 'getLoan',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'loanId', type: 'uint256' }],
        outputs: [
          {
            type: 'tuple',
            components: [
              { name: 'loanId', type: 'uint256' },
              { name: 'borrower', type: 'address' },
              { name: 'tokenId', type: 'uint256' },
              { name: 'principal', type: 'uint256' },
              { name: 'interestRateBps', type: 'uint256' },
              { name: 'tenureMonths', type: 'uint256' },
              { name: 'emiAmount', type: 'uint256' },
              { name: 'nextDueDate', type: 'uint256' },
              { name: 'missedPayments', type: 'uint256' },
              { name: 'remainingPrincipal', type: 'uint256' },
              { name: 'status', type: 'uint8' },
            ],
          },
        ],
      },
      {
        name: 'loanCounter',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'pendingRequests',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ type: 'bytes32' }],
      },
      {
        name: 'pendingApprovals',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [
          { name: 'requestHash', type: 'bytes32' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'approvedLimit', type: 'uint256' },
          { name: 'tenureMonths', type: 'uint256' },
          { name: 'computedEMI', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
          { name: 'exists', type: 'bool' },
        ],
      },
      {
        name: 'borrowerActiveLoan',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'interestRateBps',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'uint256' }],
      },
    ] as const,
  },

  PropertyNFT: {
    address: '0x10e39BcF7c1148FA62d90D40cCFc40D1Bf9F0F35' as `0x${string}`,
    abi: [
      {
        name: 'mint',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'metadataHash', type: 'bytes32' }],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
        ],
        outputs: [],
      },
      {
        name: 'ownerOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [{ type: 'address' }],
      },
      {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'tokenMetadataHash',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [{ type: 'bytes32' }],
      },
      {
        name: 'getApproved',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [{ type: 'address' }],
      },
    ] as const,
  },

  LienFiAuction: {
    address: '0x5f69cbcf902Fd3F01dFD6F297b94C7D779a7544E' as `0x${string}`,
    abi: [
      {
        name: 'activeAuctionId',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ type: 'bytes32' }],
      },
      {
        name: 'auctions',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'bytes32' }],
        outputs: [
          { name: 'seller', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'reservePrice', type: 'uint256' },
          { name: 'settled', type: 'bool' },
          { name: 'winner', type: 'address' },
          { name: 'settledPrice', type: 'uint256' },
          { name: 'listingHash', type: 'bytes32' },
        ],
      },
      {
        name: 'getBidCount',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'auctionId', type: 'bytes32' }],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'canBid',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'bidder', type: 'address' },
          { name: 'auctionId', type: 'bytes32' },
        ],
        outputs: [{ type: 'bool' }],
      },
      {
        name: 'poolBalance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: '', type: 'address' },
          { name: '', type: 'address' },
        ],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'lockExpiry',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ type: 'uint256' }],
      },
      {
        name: 'depositToPool',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'token', type: 'address' },
          { name: 'lockUntil', type: 'uint256' },
          { name: 'amount', type: 'uint256' },
          { name: 'root', type: 'uint256' },
          { name: 'nullifierHash', type: 'uint256' },
          { name: 'proof', type: 'uint256[8]' },
        ],
        outputs: [],
      },
      {
        name: 'withdrawFromPool',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
      },
    ] as const,
  },
} as const

export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`
export const CHAIN_ID = 11155111

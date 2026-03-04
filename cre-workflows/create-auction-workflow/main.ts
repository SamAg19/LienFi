import {
  CronCapability,
  ConfidentialHTTPClient,
  EVMClient,
  getNetwork,
  encodeCallMsg,
  bytesToHex,
  hexToBase64,
  LAST_FINALIZED_BLOCK_NUMBER,
  TxStatus,
  handler,
  consensusIdenticalAggregation,
  ok,
  json,
  type ConfidentialHTTPSendRequester,
  type Runtime,
  Runner,
} from "@chainlink/cre-sdk"
import {
  encodeFunctionData,
  decodeFunctionResult,
  encodeAbiParameters,
  parseAbiParameters,
  type Address,
  type Abi,
  zeroAddress,
} from "viem"
import { z } from "zod"
import LoanManagerABI from "../abis/LoanManagerABI.json"
import LienFiAuctionABI from "../abis/LienFiAuctionABI.json"

const LOAN_MANAGER_ABI = LoanManagerABI as Abi
const AUCTION_ABI = LienFiAuctionABI as Abi
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000"

// LoanStatus enum matches the Solidity contract
const LOAN_STATUS_ACTIVE = 0n

// 3 missed EMI periods (each 30 days) = default threshold
const EMI_PERIOD_SECONDS = 30n * 24n * 3600n
const DEFAULT_THRESHOLD_PERIODS = 3n

const configSchema = z.object({
  schedule: z.string(),
  url: z.string(),
  owner: z.string(),
  evms: z.array(
    z.object({
      chainSelectorName: z.string(),
      loanManagerAddress: z.string(),
      lienFiAuctionAddress: z.string(),
      gasLimit: z.string(),
    })
  ),
})
type Config = z.infer<typeof configSchema>

type LoanStruct = {
  loanId: bigint
  borrower: string
  tokenId: bigint
  principal: bigint
  interestRateBps: bigint
  tenureMonths: bigint
  emiAmount: bigint
  nextDueDate: bigint
  missedPayments: bigint
  remainingPrincipal: bigint
  status: number
}

const readContract = (
  evmClient: EVMClient,
  runtime: Runtime<Config>,
  to: Address,
  abi: Abi,
  functionName: string,
  args?: readonly unknown[]
): `0x${string}` => {
  const callData = encodeFunctionData({ abi, functionName, args })
  const result = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to,
        data: callData,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result()
  return bytesToHex(result.data)
}

/**
 * Fetch listing hash from LienFi API via Confidential HTTP.
 * Called before the auction exists on-chain, keyed by tokenId.
 */
type ListingHashResponse = { listingHash: string }

const fetchListingHash = (
  sendRequester: ConfidentialHTTPSendRequester,
  config: Config,
  tokenId: bigint
): ListingHashResponse => {
  const response = sendRequester
    .sendRequest({
      request: {
        url: `${config.url}/listing-hash/${tokenId}`,
        method: "GET",
        multiHeaders: {
          "X-Api-Key": { values: ["{{.apiKey}}"] },
          "Content-Type": { values: ["application/json"] },
        },
      },
      vaultDonSecrets: [
        { key: "apiKey", owner: config.owner },
        { key: "san_marino_aes_gcm_encryption_key", owner: config.owner },
      ],
    })
    .result()

  if (!ok(response)) {
    throw new Error(`Listing hash API failed: ${response.statusCode}`)
  }
  return json(response) as ListingHashResponse
}

const onCronTrigger = (runtime: Runtime<Config>): string => {
  const { loanManagerAddress, lienFiAuctionAddress, chainSelectorName, gasLimit } =
    runtime.config.evms[0]

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName,
    isTestnet: true,
  })
  if (!network) throw new Error(`Network not found: ${chainSelectorName}`)

  const evmClient = new EVMClient(network.chainSelector.selector)

  // 1. Check if an auction is already active — only one auction at a time
  const activeAuctionRaw = readContract(
    evmClient, runtime,
    lienFiAuctionAddress as Address,
    AUCTION_ABI,
    "activeAuctionId"
  )
  const activeAuctionId = decodeFunctionResult({
    abi: AUCTION_ABI,
    functionName: "activeAuctionId",
    data: activeAuctionRaw,
  }) as `0x${string}`

  if (activeAuctionId !== ZERO_BYTES32) {
    runtime.log("Auction already active, skipping default detection")
    return "no-op"
  }

  // 2. Read total loan count
  const counterRaw = readContract(
    evmClient, runtime,
    loanManagerAddress as Address,
    LOAN_MANAGER_ABI,
    "loanCounter"
  )
  const loanCount = decodeFunctionResult({
    abi: LOAN_MANAGER_ABI,
    functionName: "loanCounter",
    data: counterRaw,
  }) as bigint

  if (loanCount === 0n) {
    runtime.log("No loans exist, skipping")
    return "no-op"
  }

  runtime.log(`Scanning ${loanCount} loans for defaults...`)

  // 3. Scan each loan for default condition
  const now = BigInt(Math.floor(Date.now() / 1000))

  for (let i = 1n; i <= loanCount; i++) {
    const loanRaw = readContract(
      evmClient, runtime,
      loanManagerAddress as Address,
      LOAN_MANAGER_ABI,
      "getLoan",
      [i]
    )
    const loan = decodeFunctionResult({
      abi: LOAN_MANAGER_ABI,
      functionName: "getLoan",
      data: loanRaw,
    }) as LoanStruct

    const status = BigInt(loan.status)
    const nextDueDate = loan.nextDueDate

    // Skip non-active loans
    if (status !== LOAN_STATUS_ACTIVE) continue

    // Default condition: current time > nextDueDate + (3 * EMI_PERIOD)
    const defaultThreshold = nextDueDate + (DEFAULT_THRESHOLD_PERIODS * EMI_PERIOD_SECONDS)
    if (now <= defaultThreshold) continue

    const loanId = loan.loanId
    const tokenId = loan.tokenId
    runtime.log(`Loan ${loanId} is in default (nextDueDate=${nextDueDate}, now=${now})`)

    // 4. Fetch listing hash from API via Confidential HTTP
    const httpClient = new ConfidentialHTTPClient()
    const hashResponse = httpClient
      .sendRequest(
        runtime,
        fetchListingHash,
        consensusIdenticalAggregation<ListingHashResponse>()
      )(runtime.config, tokenId)
      .result()
    const listingHash = hashResponse.listingHash as `0x${string}`
    runtime.log(`Fetched listingHash=${listingHash.slice(0, 10)}... for tokenId=${tokenId}`)

    // 5. Encode report: loanId + listingHash — contract decodes both
    const reportData = encodeAbiParameters(
      parseAbiParameters("uint256 loanId, bytes32 listingHash"),
      [loanId, listingHash]
    )

    // 6. Get DON-signed report
    const reportResponse = runtime
      .report({
        encodedPayload: hexToBase64(reportData),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result()

    // 7. Write report to LoanManager (not LienFiAuction)
    const writeResult = evmClient
      .writeReport(runtime, {
        receiver: loanManagerAddress,
        report: reportResponse,
        gasConfig: { gasLimit },
      })
      .result()

    if (writeResult.txStatus !== TxStatus.SUCCESS) {
      throw new Error(`processDefault tx failed: ${writeResult.txStatus}`)
    }

    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32))
    runtime.log(`Default processed for loanId=${loanId}: ${txHash}`)

    // Only handle one default per cron tick (one auction at a time)
    return txHash
  }

  runtime.log("No defaulted loans found")
  return "no-op"
}

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [
    handler(
      cron.trigger({ schedule: config.schedule }),
      onCronTrigger
    ),
  ]
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema })
  await runner.run(initWorkflow)
}

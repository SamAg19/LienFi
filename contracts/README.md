# LienFi Contracts

Smart contracts for the LienFi protocol - a privacy-preserving mortgage system on Ethereum.

## Deployed Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| MockUSDC | `0x17e822bAF7c8d7e0583103eF01F411BC6E9FA1E2` |
| PropertyNFT | `0xF9E84941A1D2868CcD1dF95Be040C14C0b7D82cB` |
| clUSDC | `0xCB155F43443D352771A7E62d8095Fc2bC07844AB` |
| LendingPool | `0xA82FcBa5a703a0d7d791c5b075300CbCAc9a4Aac` |
| LienFiAuction | `0x72845CfA0a560d1AB8E25c8df2801c413f993EC8` |
| LoanManager | `0x01b4bdeE19f0cd17F96cEE141961f5CCae57Ec9d` |
| Forwarder | `0xf6aC8a8715024fE9Ff592D6A3f186E2B502B356a` |

## Configuration

- Interest Rate: 800 bps (8%)
- Chain ID: 11155111 (Sepolia)

## Usage

### Build

```shell
forge build
```

### Test

```shell
forge test
```

### Deploy

```shell
source .env && forge script script/DeployLienFi.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
```

## Environment Variables

Create a `.env` file with:

```env
PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://...
CHAINLINK_FORWARDER_ADDRESS=0x...  # Optional, defaults to deployer
INTEREST_RATE_BPS=800              # Optional, defaults to 800

# Deployed Contract Addresses (Sepolia)
MOCK_USDC_ADDRESS=0x17e822bAF7c8d7e0583103eF01F411BC6E9FA1E2
PROPERTY_NFT_ADDRESS=0xF9E84941A1D2868CcD1dF95Be040C14C0b7D82cB
CL_USDC_ADDRESS=0xCB155F43443D352771A7E62d8095Fc2bC07844AB
LENDING_POOL_ADDRESS=0xA82FcBa5a703a0d7d791c5b075300CbCAc9a4Aac
LIENFI_AUCTION_ADDRESS=0x72845CfA0a560d1AB8E25c8df2801c413f993EC8
LOAN_MANAGER_ADDRESS=0x01b4bdeE19f0cd17F96cEE141961f5CCae57Ec9d
FORWARDER_ADDRESS=0xf6aC8a8715024fE9Ff592D6A3f186E2B502B356a
INTEREST_RATE_BPS=800
```

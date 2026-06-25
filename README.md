# OSM — Osmotix Token

> Fixed-supply ERC-20 token on the Base network. Transparent issuance. Predictable scarcity.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Network: Base](https://img.shields.io/badge/Network-Base-0052FF)](https://base.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-363636)](https://soliditylang.org)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.x-4E5EE4)](https://openzeppelin.com)

---

## Overview

OSM (Osmotix) is a fixed-supply digital asset built on the [Base](https://base.org) network (Ethereum Layer 2). The protocol is designed around transparency, scarcity, and predictable issuance.

| Property | Value |
|---|---|
| **Contract** | `0xcfCDD0108E4B6b344c04EF98e47b54de2F2Bc8F8` |
| **Network** | Base (Chain ID 8453) |
| **Standard** | ERC-20 |
| **Name / Symbol** | Osmotix / OSM |
| **Max Supply** | 430,000,000 OSM |
| **Decimals** | 18 |

---

## Token Distribution & Release Schedule

| Stage | % of Supply | OSM Amount |
|---|---|---|
| Initial Genesis Supply | 15.00% | 64,500,000 |
| Year 1 Unlock | 21.25% | 91,375,000 |
| Year 2 Unlock | 21.25% | 91,375,000 |
| Year 3 Unlock | 21.25% | 91,375,000 |
| Year 4 Unlock | 21.25% | 91,375,000 |
| **Total** | **100%** | **430,000,000** |

- **Genesis supply** (64.5M) is minted to the treasury wallet at deployment.
- Each **annual unlock** (91.375M) becomes claimable exactly 365/730/1095/1460 days after deployment.
- Any address can trigger `claimAnnualUnlock(year)` once a window opens; tokens always go to the treasury.

---

## Security Principles

- ✅ **Fixed maximum supply** — 430,000,000 OSM, enforced on-chain
- ✅ **No additional minting** beyond the predetermined schedule
- ✅ **No transfer taxes** — full amount always arrives at destination
- ✅ **No blacklist or freeze functions** — permissionless transfers
- ✅ **Immutable, non-upgradeable** contract after deployment

---

## Repository Structure

```
osmotix/
├── contracts/
│   └── OSM.sol              # ERC-20 token with phased release schedule
├── scripts/
│   └── deploy.js            # Deployment + Basescan verification
├── test/
│   └── OSM.test.js          # Full test suite (Hardhat + Chai)
├── frontend/
│   └── index.html           # Token dashboard (static, no build step)
├── deployments/             # Auto-generated per-network deployment JSON
├── hardhat.config.js
├── package.json
├── .env.example
└── README.md
```

---

## Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- npm ≥ 9

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in PRIVATE_KEY, BASE_RPC_URL, BASESCAN_API_KEY
```

### 3. Compile contracts

```bash
npm run compile
```

### 4. Run the test suite

```bash
npm test
```

Expected output: **21 passing** tests covering deployment, annual unlocks, view helpers, ERC-20 transfers, and supply cap invariants.

### 5. Run tests with gas report

```bash
npm run test:gas
```

### 6. Generate coverage report

```bash
npm run coverage
```

---

## Deployment

### Base Sepolia Testnet

```bash
npm run deploy:testnet
```

### Base Mainnet

```bash
npm run deploy:mainnet
```

Deployment artifacts are saved to `deployments/<network>.json`. Contract source is automatically verified on Basescan after 5 confirmations.

---

## Claiming Annual Unlocks

Once a year has elapsed since deployment, anyone may call:

```solidity
osm.claimAnnualUnlock(1); // Year 1
osm.claimAnnualUnlock(2); // Year 2
osm.claimAnnualUnlock(3); // Year 3
osm.claimAnnualUnlock(4); // Year 4
```

Or via the Basescan Write Contract UI.

To check when a year unlocks:

```solidity
osm.unlockTimestamp(1); // returns Unix timestamp
```

---

## Frontend Dashboard

Open `frontend/index.html` directly in a browser — no build step required. Update the `DEPLOY_TS` constant in the `<script>` block with the actual deployment timestamp once deployed.

---

## Contract ABI Summary

| Function | Type | Description |
|---|---|---|
| `claimAnnualUnlock(uint256 year)` | write | Claims an annual unlock (year 1–4) |
| `unlockTimestamp(uint256 year)` | view | Returns unlock Unix timestamp for a year |
| `unlockClaimed(uint256 year)` | view | Returns `true` if a year has been claimed |
| `claimedUnlocks()` | view | Returns count of claimed unlock epochs |
| `remainingMintable()` | view | Returns OSM not yet minted |
| `treasury()` | view | Returns treasury address |
| `deployedAt()` | view | Returns deployment Unix timestamp |
| `MAX_SUPPLY()` | view | 430,000,000 × 10^18 |
| `GENESIS_SUPPLY()` | view | 64,500,000 × 10^18 |
| `ANNUAL_UNLOCK()` | view | 91,375,000 × 10^18 |

Plus all standard ERC-20 functions: `transfer`, `transferFrom`, `approve`, `allowance`, `balanceOf`, `totalSupply`, `name`, `symbol`, `decimals`.

---

## License

MIT

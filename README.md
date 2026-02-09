# Shroud

**The first fully anonymous prediction market — where nobody can trace your bets, your positions, or your winnings.**

Built on [Starknet](https://starknet.io) for the [RE{DEFINE} Hackathon](https://dorahacks.io/hackathon/redefine/detail).

---

## The Problem

Every prediction market today — Polymarket, Kalshi, Drift, Azuro — is **fully transparent**. Your bets, your positions, your winnings are public for anyone to see.

They call it "anonymous" because you use a wallet instead of your name. But anonymity of identity means nothing when your **behavior is completely exposed**:

| What happens today | Real consequence |
|---|---|
| Everyone sees whale positions | Herd behavior — retail follows blindly, whales dump |
| MEV bots read pending bets | Front-running — bots profit at your expense |
| All bet directions are public | Social pressure — people bet with the crowd, not their conviction |
| Oracle voters are visible | Resolution manipulation — whales bribe or pressure voters |
| Winnings are on-chain | Tax/privacy exposure — anyone can see your P&L |

**This isn't theoretical.** In 2025-2026, Polymarket experienced:

- **$7M Ukraine deal manipulation** — A whale moved a market from 9% to 100% through visible position size
- **$16M UFO market scam** — Whales forced a YES resolution with no evidence, using token-weighted voting
- **Maduro insider trading** — Visible trade timing triggered a federal investigation and new legislation
- **Two whales control 50%+ of UMA resolution votes** — Centralized power through transparent governance

**The root cause of every incident: visible bet data.**

---

## The Solution

Shroud is a prediction market where **you cannot trace deposits to bets to payouts**. The link between your wallet and your prediction is cryptographically severed.

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  1. DEPOSIT                                              │
│     User deposits fixed amount (e.g., 100 STRK)         │
│     into a shared pool. Gets a secret note.              │
│     On-chain: "Someone deposited 100 STRK"               │
│     One of hundreds of depositors — indistinguishable.   │
│                                                          │
│  2. BET (anonymous)                                      │
│     User generates a ZK proof proving:                   │
│       • "I'm a depositor" (Merkle membership)            │
│       • "Here's my bet" (hidden in commitment)           │
│       • "I haven't bet before" (nullifier)               │
│     Submitted from ANY wallet. No link to deposit.       │
│                                                          │
│  3. REVEAL                                               │
│     After market deadline, user reveals bet direction.   │
│     ZK proof links reveal to original commitment.        │
│     Still no link to deposit wallet.                     │
│                                                          │
│  4. RESOLVE                                              │
│     Market outcome determined by:                        │
│       • Pragma Oracle (price markets — automated)        │
│       • Creator resolution + dispute window (events)     │
│                                                          │
│  5. CLAIM (anonymous)                                    │
│     Winner generates ZK proof of winning bet.            │
│     Payout sent to ANY address via Tongo                 │
│     (confidential transfer — amount hidden too).         │
│     Zero link between deposit, bet, and payout.          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### What the Public Sees

| Action | What's visible | What's hidden |
|--------|---------------|---------------|
| Deposit | "Someone deposited 100 STRK" | Which wallet (one of many) |
| Bet | "A valid bet was placed" | Who placed it, which side, amount |
| Reveal | "A bet was on YES" | Who made this bet |
| Resolution | Market outcome | — |
| Claim | "A payout was made" | Who received it, how much (Tongo) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      FRONTEND                             │
│                (NextJS + Scaffold-Stark)                   │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │ Deposit  │ │ Browse   │ │ Bet    │ │ Claim        │  │
│  │ to Pool  │ │ Markets  │ │ (anon) │ │ Winnings     │  │
│  └──────────┘ └──────────┘ └────────┘ └──────────────┘  │
│         In-browser Noir proof generation                  │
│         StarknetKit wallet connection                     │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                  SMART CONTRACTS (Cairo)                   │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ DepositPool.cairo                                    │ │
│  │   • deposit(commitment) → adds to Merkle tree       │ │
│  │   • Fixed amounts: 10 / 100 / 1000 STRK             │ │
│  │   • Maintains on-chain Merkle tree of commitments    │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ MarketFactory.cairo                                  │ │
│  │   • create_market(question, options, deadline,       │ │
│  │     resolution_source, pool_tier)                    │ │
│  │   • list_markets() → browse active markets           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ Market.cairo                                         │ │
│  │   • place_bet(zk_proof, bet_commitment, nullifier)  │ │
│  │   • reveal_bet(outcome, nonce, zk_proof)            │ │
│  │   • resolve(outcome) → via Pragma or creator        │ │
│  │   • claim(zk_proof, recipient_address)              │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ GaragaVerifier.cairo (AUTO-GENERATED)                │ │
│  │   • verify_membership_proof()                        │ │
│  │   • verify_bet_proof()                               │ │
│  │   • verify_claim_proof()                             │ │
│  │   Generated by Garaga from Noir circuits             │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                   NOIR ZK CIRCUITS                         │
│                                                           │
│  membership_proof.nr                                      │
│    Proves: "I deposited into the pool"                    │
│    Hides: which deposit is mine                           │
│    Inputs: secret, nullifier, merkle_path, merkle_root    │
│    Public: merkle_root, nullifier, bet_commitment         │
│                                                           │
│  bet_proof.nr                                             │
│    Proves: "This reveal matches my commitment"            │
│    Hides: link to deposit                                 │
│    Inputs: outcome, nonce, original_commitment            │
│    Public: outcome, original_commitment                   │
│                                                           │
│  claim_proof.nr                                           │
│    Proves: "I own a winning bet"                          │
│    Hides: which bet, which deposit                        │
│    Inputs: secret, bet_data, market_outcome               │
│    Public: market_id, recipient_address                   │
│                                                           │
└──────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                 EXTERNAL INTEGRATIONS                      │
│                                                           │
│  Garaga SDK  → Compile Noir circuits to Cairo verifiers   │
│  Tongo SDK   → Confidential ERC20 payouts                 │
│  Pragma      → Price oracle for market resolution         │
│  StarknetKit → Wallet connection                          │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Smart Contracts | Cairo (Starknet) | Market logic, deposit pool, Merkle tree |
| ZK Circuits | Noir (Aztec) | Anonymous membership & bet proofs |
| Proof Verification | Garaga | Compile Noir → Cairo verifier (auto) |
| Confidential Payments | Tongo SDK | Hidden payout amounts |
| Price Oracle | Pragma | Automated market resolution |
| Frontend | NextJS + Scaffold-Stark | dApp UI |
| Wallet | StarknetKit | Starknet wallet connection |
| Network | Starknet Sepolia (testnet) | Deployment target |

---

## Hackathon Track Fit

### Primary: Privacy Track
> "Build privacy-preserving applications using STARKs, zero-knowledge proofs, and confidential transactions"

Shroud uses ALL three:
- **STARKs** — Starknet's native proof system secures every transaction
- **Zero-knowledge proofs** — Noir circuits prove membership and bet ownership without revealing identity
- **Confidential transactions** — Tongo encrypts payout amounts

### Secondary: Wildcard Track
> "Build any innovative product on Starknet — gaming, social, payments. Surprise us!"

A fully anonymous prediction market that solves Polymarket's $7M manipulation crisis is the definition of a surprise.

---

## Why This Is Innovative

| Existing Market | Privacy Level | Shroud |
|----------------|--------------|--------|
| Polymarket | Pseudonymous wallet, all bets public | Fully anonymous — no link between wallet and bet |
| Kalshi | Centralized, KYC required | Permissionless, zero-knowledge |
| Drift BET | Transparent on Solana | ZK-hidden on Starknet |
| Pythia | Commit-reveal but reputation only, no real money | Real stakes with cryptographic anonymity |
| **Every prediction market** | **Visible positions** | **Invisible positions** |

No prediction market — on any chain — provides the level of privacy Shroud offers. This is the first.

---

## Project Structure

```
shroud/
├── README.md                          # This file
├── contracts/                         # Cairo smart contracts
│   ├── Scarb.toml                     # Cairo package manager config
│   ├── src/
│   │   ├── lib.cairo                  # Module declarations
│   │   ├── deposit_pool.cairo         # Anonymity pool + Merkle tree
│   │   ├── market_factory.cairo       # Market creation and listing
│   │   ├── market.cairo               # Core market logic
│   │   └── interfaces.cairo           # Contract interfaces
│   └── tests/
│       └── test_market.cairo          # Contract tests
├── circuits/                          # Noir ZK circuits
│   ├── membership_proof/              # Prove pool membership
│   │   ├── Nargo.toml
│   │   └── src/main.nr
│   ├── bet_proof/                     # Prove bet ownership
│   │   ├── Nargo.toml
│   │   └── src/main.nr
│   └── claim_proof/                   # Prove winning claim
│       ├── Nargo.toml
│       └── src/main.nr
├── frontend/                          # NextJS dApp (Scaffold-Stark)
└── docs/
    └── architecture.md                # Detailed technical docs
```

---

## Getting Started

### Prerequisites

- [Scarb](https://docs.swmansion.com/scarb/) — Cairo package manager
- [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/) — Testing & deployment
- [Nargo](https://noir-lang.org/docs/getting_started/installation/) — Noir compiler
- [Garaga](https://github.com/keep-starknet-strange/garaga) — ZK proof verification
- [Node.js 18+](https://nodejs.org/) — Frontend
- Python 3.10+ — Garaga SDK

### Setup

```bash
# Clone the repo
git clone <repo-url>
cd shroud

# Install Cairo dependencies
cd contracts
scarb build

# Compile Noir circuits
cd ../circuits/membership_proof
nargo compile

# Generate Garaga verifier
garaga gen --system ultra_keccak_honk --vk <verification_key> --project-name shroud_verifier

# Start frontend
cd ../../frontend
npm install
npm run dev
```

### Deploy to Testnet

```bash
# Get testnet STRK from faucet
# https://starknet-faucet.vercel.app/

# Deploy contracts
cd contracts
sncast deploy --network sepolia
```

---

## Market Resolution

Shroud supports two resolution mechanisms:

### Automated (Price Markets)
For markets like "Will BTC exceed $150K by March 2026?":
- **Pragma Oracle** provides on-chain price feeds
- Market contract reads the price at the deadline
- Resolution is fully automated — no human intervention
- Trustless and manipulation-resistant

### Creator Resolution (Event Markets)
For markets like "Will team X win the championship?":
- Market creator submits the outcome after the event
- A **dispute window** (e.g., 48 hours) allows participants to challenge
- If disputed, resolution escalates to a multi-sig or extended review
- Simple for MVP, upgradeable to decentralized oracle committees later

---

## Roadmap

### Phase 1 — Hackathon MVP (Feb 2026)
- [x] Project architecture and design
- [ ] Cairo contracts: deposit pool, Merkle tree, market logic
- [ ] Noir circuits: membership proof, bet proof, claim proof
- [ ] Garaga verifier integration
- [ ] Frontend: deposit, browse, bet, claim flows
- [ ] Tongo integration for confidential payouts
- [ ] Deploy to Starknet Sepolia testnet
- [ ] Demo video (3 minutes)

### Phase 2 — Post-Hackathon
- [ ] Decentralized oracle committee (VeilCast upgrade)
- [ ] BTC integration via Atomiq bridge (Bitcoin track)
- [ ] Multiple pool tiers (10 / 100 / 1000 STRK)
- [ ] Mobile-responsive UI
- [ ] Mainnet deployment

---

## Team

Built for the [Starknet RE{DEFINE} Hackathon](https://dorahacks.io/hackathon/redefine/detail)

---

## License

MIT

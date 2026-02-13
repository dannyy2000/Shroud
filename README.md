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

**Every incident traces back to one root cause: visible bet data.**

---

## The Solution

Shroud is a prediction market where **you cannot trace deposits to bets to payouts**. The link between your wallet and your prediction is cryptographically severed.

One architecture eliminates MEV, manipulation, herding, and oracle bribery simultaneously.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  1. DEPOSIT                                                  │
│     User deposits a fixed amount (e.g., 100 STRK)           │
│     into a shared anonymity pool. Gets a secret note.        │
│     On-chain: "Someone deposited 100 STRK"                   │
│     One of hundreds of depositors — indistinguishable.       │
│                                                              │
│  2. COMMIT (anonymous bet)                                   │
│     User generates a ZK proof in-browser proving:            │
│       - "I'm a depositor" (Merkle membership)                │
│       - "Here's my bet" (hidden inside a commitment)         │
│       - "I haven't bet before" (nullifier)                   │
│     Submitted from ANY wallet. No link to deposit.           │
│     Verified on-chain by Garaga (Noir → Cairo verifier).     │
│                                                              │
│  3. REVEAL (batch settlement)                                │
│     After the betting deadline, all bets are revealed.       │
│     ZK proof links each reveal to its original commitment.   │
│     No bet has ordering priority — commit-reveal creates     │
│     a natural batch auction. MEV is structurally dead.       │
│                                                              │
│  4. SETTLE (parimutuel)                                      │
│     Total pool is split proportionally among winners.        │
│     Odds are determined AFTER all bets are revealed —        │
│     nobody can see or react to the odds while betting.       │
│     Users bet on conviction, not momentum.                   │
│                                                              │
│  5. RESOLVE                                                  │
│     Market outcome determined by:                            │
│       - Pragma Oracle (price markets — automated)            │
│       - Creator resolution + dispute window (events)         │
│                                                              │
│  6. CLAIM (anonymous)                                        │
│     Winner generates ZK proof of winning bet.                │
│     Payout sent to ANY address.                              │
│     Zero link between deposit, bet, and payout.              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### What the Public Sees

| Action | What's visible | What's hidden |
|--------|---------------|---------------|
| Deposit | "Someone deposited 100 STRK" | Which wallet (one of many) |
| Bet | "A valid bet was placed" | Who placed it, which side |
| Reveal | Aggregate outcome counts | Who bet what |
| Settlement | Total pool, payout per winner | Individual P&L |
| Resolution | Market outcome | — |
| Claim | "A payout was made" | Who received it |

---

## Pricing Model: Commit-Reveal Parimutuel

Shroud uses a **commit-reveal parimutuel** model — a deliberate design choice driven by the privacy architecture.

### Why Not an AMM or Order Book?

| Model | Problem for privacy |
|-------|-------------------|
| **Order Book** | Orders are visible — leaks intent, enables front-running |
| **AMM (CPMM/LMSR)** | Every trade moves price visibly — leaks position data |
| **Parimutuel** | Bets pooled, odds computed after deadline — nothing to leak |

### How Parimutuel Works

1. All bets go into a shared pool (e.g., 10,000 STRK total across all bettors)
2. After the reveal phase: 7,000 STRK was on YES, 3,000 STRK was on NO
3. If YES wins: each YES bettor receives a proportional share of the full 10,000 pool
4. A 2% protocol fee is deducted before distribution

**Nobody knows the odds until the reveal phase.** This is a feature, not a limitation — it means:
- No price signal to front-run
- No whale position to herd on
- No visible momentum to manipulate
- Users bet on their actual conviction

### Why Commit-Reveal IS a Batch Auction

The commit-reveal structure naturally creates a **batch auction**:

- **Commit phase:** All bets are submitted encrypted. Order doesn't matter — you can't see what anyone else bet.
- **Reveal phase:** All bets are decrypted simultaneously after the deadline.
- **Settlement:** Pool is divided among winners proportionally.

No bet has priority over another. A sequencer can't reorder them for profit because the contents are hidden during commit and the outcome is pool-based at reveal. **MEV is structurally impossible.**

---

## Market Creation

Markets are created permissionlessly with a **staked bond** to align incentives:

### Staked Creation
- Creator stakes STRK (e.g., 50 STRK) when creating a market
- Stake is slashed if the creator resolves dishonestly and loses a dispute
- Stake is returned after successful resolution and the dispute window closes
- This prevents spam and incentivizes honest resolution

### Minimum Pool Threshold
- Each market has a minimum participation threshold (e.g., 5 bets per side)
- If the threshold isn't met by the betting deadline, the market is cancelled
- All deposits for that market are refundable
- Prevents single-bettor attacks and ensures meaningful odds

### Market Parameters
```
create_market(
    question:           "Will ETH exceed $10K by June 2026?",
    resolution_source:  PRAGMA_ORACLE,
    oracle_params:      { pair_id: ETH/USD, target_price: 10000 },
    pool_tier:          MEDIUM (100 STRK per bet),
    bet_deadline:       timestamp,
    reveal_deadline:    timestamp,
    stake:              50 STRK
)
```

---

## Market Resolution

### Automated (Price Markets)
For markets like "Will BTC exceed $150K by March 2026?":
- **Pragma Oracle** provides on-chain price feeds
- Market contract reads the price at the deadline
- Resolution is fully automated — no human intervention
- Trustless and manipulation-resistant

### Creator Resolution (Event Markets)
For markets like "Will team X win the championship?":
- Market creator submits the outcome after the event
- A **48-hour dispute window** allows participants to challenge
- If disputed, resolution escalates to governance review
- Creator's stake is slashed if resolution is overturned

### Forfeited Bets
- Bets that are not revealed during the reveal window are **forfeited**
- Forfeited stake is added to the winner's pool
- This incentivizes timely reveals and increases winner payouts

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                        FRONTEND                                │
│                  (NextJS + Scaffold-Stark)                      │
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐   │
│  │ Deposit  │ │ Browse   │ │ Bet      │ │ Claim          │   │
│  │ to Pool  │ │ Markets  │ │ (anon)   │ │ Winnings       │   │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘   │
│                                                                │
│  In-browser Noir proof generation (noir.js)                    │
│  Garaga JS SDK for calldata generation                         │
│  StarknetKit wallet connection                                 │
└───────────────────────┬───────────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────────┐
│                 SMART CONTRACTS (Cairo 2.14)                    │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ DepositPool.cairo                                         │ │
│  │   - deposit(commitment, tier) → adds to Merkle tree      │ │
│  │   - Fixed tiers: 10 / 100 / 1000 STRK                   │ │
│  │   - On-chain Poseidon Merkle tree (~1M deposits/tier)    │ │
│  │   - Nullifier registry (prevents double-spending)        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ MarketFactory.cairo                                       │ │
│  │   - create_market(question, deadlines, tier, stake)      │ │
│  │   - Staked creation (bond slashed on dishonest resolve)  │ │
│  │   - Minimum pool threshold enforcement                   │ │
│  │   - Market indexing and browsing                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Market.cairo                                              │ │
│  │   - place_bet(proof_with_hints, bet_commitment, nullifier)│ │
│  │   - reveal_bet(proof_with_hints, outcome, nonce)         │ │
│  │   - resolve(outcome) → via Pragma or creator             │ │
│  │   - claim(proof_with_hints, recipient_address)           │ │
│  │   - Parimutuel settlement with 2% protocol fee           │ │
│  │   - Forfeited bet redistribution to winners              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Garaga Verifier Contracts (AUTO-GENERATED)                │ │
│  │   - MembershipVerifier — verifies deposit pool membership│ │
│  │   - BetVerifier — verifies reveal matches commitment     │ │
│  │   - ClaimVerifier — verifies winning bet ownership       │ │
│  │   - Generated by Garaga SDK from Noir verification keys  │ │
│  │   - UltraKeccakZKHonk proof system (BN254)              │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────────┐
│                    NOIR ZK CIRCUITS                             │
│                                                                │
│  membership_proof/src/main.nr                                  │
│    Proves: "I deposited into the pool"                         │
│    Hides: which deposit is mine                                │
│    Private: secret, nullifier_secret, merkle_path              │
│    Public: merkle_root, nullifier, bet_commitment, market_id   │
│                                                                │
│  bet_proof/src/main.nr                                         │
│    Proves: "This reveal matches my original commitment"        │
│    Hides: link to deposit                                      │
│    Private: nonce                                              │
│    Public: bet_commitment, outcome                             │
│                                                                │
│  claim_proof/src/main.nr                                       │
│    Proves: "I own a winning bet"                               │
│    Hides: which bet, which deposit                             │
│    Private: nonce, nullifier_secret                            │
│    Public: bet_commitment, winning_outcome, market_id,         │
│            nullifier                                           │
│                                                                │
└───────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────────┐
│                  PROOF VERIFICATION FLOW                        │
│                                                                │
│  1. User's browser generates Noir proof (noir.js)              │
│  2. Garaga JS SDK converts proof → calldata (felt252 array)   │
│  3. User sends tx to Market contract with calldata             │
│  4. Market contract calls Garaga verifier:                     │
│       verify_ultra_keccak_zk_honk_proof(calldata)              │
│       → returns Ok(public_inputs) or Err                       │
│  5. Market contract validates public inputs match expected     │
│     values (merkle_root, nullifier, bet_commitment)            │
│                                                                │
└───────────────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────────┐
│                  EXTERNAL INTEGRATIONS                          │
│                                                                │
│  Garaga v1.0.1  → Noir circuit → Cairo verifier generation    │
│  Pragma         → Price oracle for automated resolution        │
│  StarknetKit    → Wallet connection                            │
│  noir.js        → In-browser ZK proof generation               │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Smart Contracts | Cairo (Starknet) | 2.14.0 | Market logic, deposit pool, Merkle tree |
| ZK Circuits | Noir | 1.0.0-beta.16 | Anonymous membership, bet & claim proofs |
| Proof Backend | Barretenberg | 3.0.0-nightly.20251104 | Proof generation and verification keys |
| On-chain Verification | Garaga | 1.0.1 | Noir → Cairo verifier (UltraKeccakZKHonk) |
| Price Oracle | Pragma | — | Automated market resolution |
| Frontend | NextJS + Scaffold-Stark | — | dApp UI |
| Wallet | StarknetKit | — | Starknet wallet connection |
| Package Manager | Scarb | 2.14.0 | Cairo dependency management |
| Testing | Starknet Foundry | 0.53.0 | Contract testing and deployment |
| Network | Starknet Sepolia | testnet | Deployment target |

---

## Why This Is Different

| Existing Market | Privacy Level | Shroud |
|----------------|--------------|--------|
| Polymarket | Pseudonymous wallet, all bets/positions/odds public | Fully anonymous — no link between wallet and bet |
| Kalshi | Centralized, KYC required | Permissionless, zero-knowledge |
| Drift BET | Transparent on Solana | ZK-hidden on Starknet |
| Azuro | Transparent odds, visible liquidity | Hidden bets, post-reveal odds |
| **Every prediction market** | **Visible positions enable manipulation** | **Invisible positions eliminate it** |

### What Shroud Eliminates

| Attack Vector | How others are vulnerable | How Shroud prevents it |
|--------------|--------------------------|----------------------|
| **Front-running / MEV** | Pending bets visible in mempool | Bets are encrypted commitments — nothing to front-run |
| **Whale manipulation** | Large positions visible, move markets | Position sizes hidden until reveal — no signal |
| **Herd behavior** | Live odds create bandwagon effect | No live odds — users bet conviction, not momentum |
| **Oracle bribery** | Voters are visible, can be targeted | ZK-private governance voting (Phase 2) |
| **Insider detection** | Trade timing + wallet analysis exposes insiders | Deposit pool breaks wallet-to-bet link entirely |

---

## Hackathon Track Fit

### Primary: Privacy Track
> "Build privacy-preserving applications using STARKs, zero-knowledge proofs, and confidential transactions"

Shroud uses all three:
- **STARKs** — Starknet's native proof system secures every transaction
- **Zero-knowledge proofs** — Noir circuits prove membership and bet ownership without revealing identity, verified on-chain via Garaga
- **Commit-reveal parimutuel** — Bet directions and amounts are cryptographically hidden until settlement

### Secondary: Wildcard Track
> "Build any innovative product on Starknet — gaming, social, payments. Surprise us!"

A fully anonymous prediction market that solves Polymarket's manipulation crisis through a single coherent cryptographic design.

---

## Project Structure

```
shroud/
├── README.md
├── contracts/                           # Cairo smart contracts
│   ├── Scarb.toml
│   └── src/
│       ├── lib.cairo                    # Module declarations
│       ├── deposit_pool.cairo           # Anonymity pool + Poseidon Merkle tree
│       ├── market_factory.cairo         # Staked market creation + indexing
│       ├── market.cairo                 # Core market logic + parimutuel settlement
│       └── interfaces.cairo             # Contract interfaces and types
├── circuits/                            # Noir ZK circuits
│   ├── membership_proof/                # Prove deposit pool membership
│   │   ├── Nargo.toml
│   │   └── src/main.nr
│   ├── bet_proof/                       # Prove reveal matches commitment
│   │   ├── Nargo.toml
│   │   └── src/main.nr
│   └── claim_proof/                     # Prove winning bet ownership
│       ├── Nargo.toml
│       └── src/main.nr
├── verifiers/                           # Garaga-generated Cairo verifiers
│   ├── membership_verifier/             # Auto-generated from membership_proof
│   ├── bet_verifier/                    # Auto-generated from bet_proof
│   └── claim_verifier/                  # Auto-generated from claim_proof
├── frontend/                            # NextJS dApp (Scaffold-Stark)
└── scripts/                             # Build, deploy, and proof generation scripts
    ├── build_circuits.sh                # Compile all Noir circuits
    ├── generate_verifiers.sh            # Generate Garaga verifier contracts
    └── deploy.sh                        # Deploy all contracts to Sepolia
```

---

## Getting Started

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Scarb | 2.14.0 | `curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh \| sh -s -- -v 2.14.0` |
| Starknet Foundry | 0.53.0 | [Installation guide](https://foundry-rs.github.io/starknet-foundry/) |
| Nargo | 1.0.0-beta.16 | `noirup --version 1.0.0-beta.16` |
| Barretenberg | 3.0.0-nightly.20251104 | `bbup --version 3.0.0-nightly.20251104` |
| Garaga | 1.0.1 | `pip install garaga==1.0.1` |
| Python | 3.10-3.12 | Required by Garaga |
| Node.js | 18+ | Frontend |

### Build

```bash
# Clone the repo
git clone <repo-url>
cd shroud

# 1. Compile Noir circuits
cd circuits/membership_proof && nargo build && cd ../..
cd circuits/bet_proof && nargo build && cd ../..
cd circuits/claim_proof && nargo build && cd ../..

# 2. Generate verification keys
bb write_vk -s ultra_honk --oracle_hash keccak \
  -b circuits/membership_proof/target/membership_proof.json \
  -o circuits/membership_proof/target/vk

bb write_vk -s ultra_honk --oracle_hash keccak \
  -b circuits/bet_proof/target/bet_proof.json \
  -o circuits/bet_proof/target/vk

bb write_vk -s ultra_honk --oracle_hash keccak \
  -b circuits/claim_proof/target/claim_proof.json \
  -o circuits/claim_proof/target/vk

# 3. Generate Garaga Cairo verifiers
garaga gen --system ultra_keccak_zk_honk \
  --vk circuits/membership_proof/target/vk \
  --project-name verifiers/membership_verifier

garaga gen --system ultra_keccak_zk_honk \
  --vk circuits/bet_proof/target/vk \
  --project-name verifiers/bet_verifier

garaga gen --system ultra_keccak_zk_honk \
  --vk circuits/claim_proof/target/vk \
  --project-name verifiers/claim_verifier

# 4. Build Cairo contracts
cd contracts && scarb build && cd ..
```

### Deploy to Testnet

```bash
# Configure .secrets file with Starknet Sepolia credentials
# SEPOLIA_RPC_URL, SEPOLIA_ACCOUNT_PRIVATE_KEY, SEPOLIA_ACCOUNT_ADDRESS

# Declare and deploy verifier contracts
garaga declare --project-path verifiers/membership_verifier --env-file .secrets --network sepolia
garaga deploy --class-hash <CLASS_HASH> --env-file .secrets --network sepolia
# Repeat for bet_verifier and claim_verifier

# Deploy core contracts via Starknet Foundry
cd contracts
sncast deploy --network sepolia
```

---

## Roadmap

### Phase 1 — Hackathon MVP (Feb 2026)
- [x] Project architecture and design
- [x] Cairo contracts: deposit pool, Merkle tree, market logic
- [x] Noir circuits: membership proof, bet proof, claim proof
- [ ] Garaga verifier integration (replace verification stubs with real on-chain verification)
- [ ] Staked market creation with bond + slashing
- [ ] Minimum pool threshold + refund mechanism
- [ ] Parimutuel settlement with protocol fee
- [ ] Pragma Oracle integration for price markets
- [ ] Frontend: deposit, browse markets, bet, reveal, claim flows
- [ ] Deploy to Starknet Sepolia testnet
- [ ] Demo video (3 minutes)

### Phase 2 — Post-Hackathon
- [ ] ZK-private dispute voting (same ZK infrastructure applied to governance — voters prove token membership without revealing identity, preventing oracle bribery)
- [ ] AI-powered market suggestions (scan trending topics, suggest markets to creators)
- [ ] Confidential payouts via Tongo SDK (hide claim amounts on-chain)
- [ ] Multiple betting epochs per market (periodic commit-reveal rounds for price discovery)
- [ ] BTC integration via atomic swaps (Bitcoin track)
- [ ] Mobile-responsive UI
- [ ] Mainnet deployment

---

## Team

Solo builder. Built for the [Starknet RE{DEFINE} Hackathon](https://dorahacks.io/hackathon/redefine/detail).

---

## License

MIT

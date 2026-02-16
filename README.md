# Shroud

**Prediction markets have a transparency problem. Shroud makes bets invisible.**

Every prediction market today — Polymarket, Kalshi, Drift, Azuro — exposes your bets, positions, and winnings on-chain. They call it "anonymous" because you use a wallet instead of your name. But when your behavior is fully visible, anonymity means nothing.

Shroud is a prediction market on [Starknet](https://starknet.io) where the link between your wallet and your bet is cryptographically severed. You deposit, bet, and claim — and nobody can connect the three.

Built for the [RE{DEFINE} Hackathon](https://dorahacks.io/hackathon/redefine/detail) | Privacy Track + Wildcard

---

## Why This Exists

In 2025-2026, transparent prediction markets failed publicly:

- **$7M Ukraine deal manipulation** — A whale moved a Polymarket market from 9% to 100% through visible position size
- **$16M UFO market scam** — Whales forced a YES resolution with no evidence, using token-weighted voting
- **Maduro insider trading** — Visible trade timing triggered a federal investigation and new legislation
- **Two whales control 50%+ of UMA resolution votes** — Centralized power through transparent governance

Every incident traces back to one root cause: **visible bet data**.

| What's visible today | What goes wrong |
|---|---|
| Whale positions | Retail herds blindly, whales dump |
| Pending bets in mempool | MEV bots front-run at your expense |
| Bet directions | Social pressure overrides conviction |
| Oracle voter identities | Whales bribe or pressure voters |

---

## How Shroud Works

Shroud breaks the deposit-to-bet-to-payout link using ZK proofs at every step.

### The Flow

**1. Deposit** — You deposit a fixed amount (10, 100, or 1000 STRK) into a shared anonymity pool. On-chain, all anyone sees is *"someone deposited 100 STRK"* — you're one of hundreds of identical depositors.

**2. Bet** — From any wallet, you submit a ZK proof that says *"I'm a valid depositor and here's my bet."* The proof is verified on-chain by [Garaga](https://github.com/keep-starknet-strange/garaga). Your bet direction is hidden inside a cryptographic commitment. Nobody knows which side you took.

**3. Reveal** — After the betting deadline, everyone reveals their bet direction. The commit-reveal structure means no bet had ordering priority — this is a natural batch auction. MEV is structurally dead.

**4. Settle** — The total pool is split among winners (parimutuel). Odds are computed *after* all bets are revealed. Nobody could see or react to odds while betting.

**5. Resolve** — The outcome is determined by [Pragma Oracle](https://pragma.build) (price markets) or creator resolution with a 48-hour dispute window (event markets).

**6. Claim** — Winners generate a ZK proof of their winning bet and claim to *any* address. Fresh wallet, different chain, doesn't matter. Zero link between deposit, bet, and payout.

### What the Public Sees

| Action | Visible | Hidden |
|--------|---------|--------|
| Deposit | "Someone deposited 100 STRK" | Which wallet |
| Bet | "A valid bet was placed" | Who placed it, which side |
| Reveal | Aggregate YES/NO counts | Individual positions |
| Claim | "A payout was sent" | Who received it |

---

## Design Decisions

### Why Fixed Deposit Tiers?

Privacy requires uniformity. If Alice deposits 73 STRK and later someone claims 73 STRK, the amount itself is a fingerprint. With fixed tiers (10 / 100 / 1000 STRK), every depositor in a tier is indistinguishable — the same principle behind [Tornado Cash](https://tornado.cash)'s fixed denominations.

The tradeoff: you can't bet 47 STRK. You pick a tier. **The constraint is the privacy mechanism.**

### Why Parimutuel, Not an AMM?

| Model | Problem for privacy |
|-------|-------------------|
| Order Book | Orders are visible — leaks intent, enables front-running |
| AMM (CPMM/LMSR) | Every trade moves price visibly — leaks position data |
| **Parimutuel** | **Bets pooled, odds computed after deadline — nothing to leak** |

Parimutuel is the only settlement model compatible with commit-reveal privacy. Nobody knows the odds until the reveal phase. Users bet on conviction, not momentum.

### Why Staked Market Creation?

Anyone can create a market by staking a STRK bond. If the creator resolves dishonestly and gets disputed, the bond is slashed. If they resolve honestly, the bond is returned after the dispute window closes. This prevents spam and aligns creator incentives without permissioning.

---

## Architecture

```
Frontend (NextJS + Scaffold-Stark)
  │  In-browser Noir proof generation (noir.js)
  │  Garaga JS SDK for calldata generation
  │
  ▼
Smart Contracts (Cairo)
  ├── DepositPool.cairo     Anonymity pool + Poseidon Merkle tree (depth 20)
  ├── MarketFactory.cairo   Staked market creation + indexing
  ├── Market.cairo           Betting, reveal, resolution, settlement, claims
  └── Verifiers/             Garaga-generated (UltraKeccakZKHonk)
        ├── MembershipVerifier   "I deposited into the pool"
        ├── BetVerifier          "This reveal matches my commitment"
        └── ClaimVerifier        "I own a winning bet"
  │
  ▼
Noir ZK Circuits
  ├── membership_proof   Private: secret, nullifier, merkle_path
  │                      Public: merkle_root, nullifier, bet_commitment, market_id
  ├── bet_proof          Private: nonce
  │                      Public: bet_commitment, outcome
  └── claim_proof        Private: nonce, nullifier_secret
                         Public: bet_commitment, winning_outcome, market_id, nullifier
```

### Verification Flow

1. User generates a Noir proof in-browser (`noir.js`)
2. Garaga JS SDK converts the proof to calldata (`felt252` array)
3. User sends a transaction to the Market contract
4. Market contract calls the Garaga verifier: `verify_ultra_keccak_zk_honk_proof(calldata)` → returns `Ok(public_inputs)` or `Err`
5. Market contract validates public inputs against expected on-chain values

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Smart Contracts | Cairo (Starknet) | 2.14.0 |
| ZK Circuits | Noir | 1.0.0-beta.16 |
| Proof Backend | Barretenberg | 3.0.0-nightly.20251104 |
| On-chain Verification | Garaga | 1.0.1 |
| Price Oracle | Pragma | — |
| Frontend | NextJS + Scaffold-Stark | — |
| Wallet | StarknetKit | — |
| Network | Starknet Sepolia | testnet |

---

## Comparison

| Platform | Privacy | Shroud |
|----------|---------|--------|
| Polymarket | Pseudonymous wallet, all positions public | Fully anonymous — no link between wallet and bet |
| Kalshi | Centralized, KYC required | Permissionless, zero-knowledge |
| Drift BET | Transparent on Solana | ZK-hidden on Starknet |
| Azuro | Transparent odds, visible liquidity | Hidden bets, post-reveal odds |

| Attack Vector | Others | Shroud |
|--------------|--------|--------|
| Front-running / MEV | Pending bets visible in mempool | Bets are encrypted commitments |
| Whale manipulation | Large positions visible, move markets | Positions hidden until reveal |
| Herd behavior | Live odds create bandwagon effect | No live odds exist |
| Oracle bribery | Voters visible, can be targeted | ZK-private voting (Phase 2) |

---

## Project Structure

```
shroud/
├── contracts/src/
│   ├── interfaces.cairo        Contract interfaces and types
│   ├── deposit_pool.cairo      Anonymity pool + Poseidon Merkle tree
│   ├── market_factory.cairo    Staked market creation + indexing
│   └── market.cairo            Core market lifecycle
├── circuits/
│   ├── membership_proof/       Prove pool membership without revealing deposit
│   ├── bet_proof/              Prove reveal matches commitment
│   └── claim_proof/            Prove winning bet ownership
├── verifiers/
│   ├── membership_verifier/    Garaga-generated Cairo verifier
│   ├── bet_verifier/           Garaga-generated Cairo verifier
│   └── claim_verifier/         Garaga-generated Cairo verifier
└── frontend/                   NextJS dApp
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
cd contracts && scarb build
```

---

## Roadmap

### Phase 1 — MVP (Feb 2026)
- [x] Architecture and design
- [x] Cairo contracts: deposit pool, Merkle tree, market lifecycle
- [x] Noir circuits: membership, bet, and claim proofs
- [x] Garaga on-chain verification integration
- [x] Parimutuel settlement with 2% protocol fee
- [x] Staked market creation with bond + slashing
- [x] Pragma Oracle integration for price markets
- [ ] Frontend: deposit, browse, bet, reveal, claim
- [ ] Deploy to Starknet Sepolia
- [ ] Demo video

### Phase 2 — Post-Hackathon
- [ ] ZK-private dispute voting (prevent oracle bribery)
- [ ] Confidential payouts via Tongo SDK
- [ ] Multiple betting epochs per market
- [ ] Mobile-responsive UI
- [ ] Mainnet deployment

---

## License

MIT

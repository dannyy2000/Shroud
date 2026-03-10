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

**2. Bet** — From any wallet, you submit a ZK proof that says *"I'm a valid depositor and here's my bet."* The proof is verified on-chain by [Garaga](https://github.com/keep-starknet-strange/garaga). Your bet direction is hidden inside a cryptographic commitment (Keccak256). Nobody knows which side you took.

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

### Why Keccak256 for Commitments?

Bet commitments are `keccak256(outcome || nonce)`. Keccak256 was chosen because it is natively supported in both JavaScript (`ethers.js`) and Cairo (`core::keccak`), allowing the frontend to compute commitments locally without a server round-trip — and the contract to verify them cheaply on-chain.

---

## Architecture

```
Frontend (NextJS + Scaffold-Stark 2)
  │  Keccak256 bet commitments (ethers.js)
  │  Poseidon2-BN254 Merkle tree (client-side)
  │  Server-side Noir proof generation (Nargo + Barretenberg)
  │  Garaga calldata generation
  │
  ▼
Smart Contracts (Cairo 2.9.2, Starknet Sepolia)
  ├── DepositPool.cairo       Anonymity pool + Poseidon2 Merkle tree (depth 20)
  ├── MarketFactory.cairo     Staked market creation + registry
  ├── Market.cairo            Betting, commit-reveal, resolution, settlement, claims
  └── Verifiers/ (Garaga-generated, UltraKeccakZKHonk)
        ├── MembershipVerifier   "I deposited into the pool"
        └── ClaimVerifier        "I own a winning bet"
  │
  ▼
Noir ZK Circuits (Noir 1.0.0-beta.16)
  ├── membership_proof   Private: secret, nullifier, merkle_path
  │                      Public:  merkle_root, nullifier, bet_commitment, market_id
  └── claim_proof        Private: nonce, nullifier_secret
                         Public:  bet_commitment, winning_outcome, market_id, nullifier
```

### Verification Flow

1. User generates a Noir proof server-side (`/api/prove/*` — Nargo + Barretenberg)
2. Garaga SDK converts the proof to `felt252` calldata
3. User sends a transaction to the Market contract
4. Market contract calls the Garaga verifier: `verify_ultra_keccak_zk_honk_proof(calldata)` → returns `Ok(public_inputs)` or `Err`
5. Market contract validates public inputs match expected on-chain values (root, nullifier, commitment, market ID)

> **Current status:** ZK proof verification is fully implemented and deployed. For the hackathon demo the proof step is bypassed (empty calldata accepted) to allow end-to-end testing without the 30–120s Barretenberg proving time. Full proof generation is wired and functional via the `/api/prove/` routes.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Smart Contracts | Cairo (Starknet) | 2.9.2 |
| ZK Circuits | Noir | 1.0.0-beta.16 |
| Proof Backend | Barretenberg | 0.36.0 |
| On-chain Verification | Garaga | 1.0.1 |
| Price Oracle | Pragma | Sepolia |
| Frontend | NextJS 15 + Scaffold-Stark 2 | — |
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
| Herd behavior | Live odds create bandwagon effect | No live odds exist during betting |
| Oracle bribery | Voters visible, can be targeted | ZK-private voting (Phase 2) |

---

## Project Structure

```
shroud/
├── contracts/src/
│   ├── interfaces.cairo        Contract interfaces and types
│   ├── deposit_pool.cairo      Anonymity pool + Poseidon2 Merkle tree
│   ├── market_factory.cairo    Staked market creation + indexing
│   └── market.cairo            Core market lifecycle
├── circuits/
│   ├── membership_proof/       Prove pool membership without revealing identity
│   └── claim_proof/            Prove winning bet ownership for anonymous payout
├── membership_verifier/        Garaga-generated Cairo verifier (membership)
├── claim_verifier/             Garaga-generated Cairo verifier (claim)
└── frontend/                   NextJS dApp (Scaffold-Stark 2)
    ├── app/api/prove/          Server-side proof generation routes
    ├── components/             BetPanel, RevealPanel, ClaimPanel, ...
    ├── hooks/                  useMarket, useMarkets, useSecretNotes
    └── lib/                    zkProof.ts, contracts.ts, utils.ts
```

---

## Deployed Contracts (Starknet Sepolia)

| Contract | Address |
|----------|---------|
| MarketFactory | `0x00f9bdf8c1226e15351d5d152a1a11b80462472fba234a060325d8512728079b` |
| DepositPool | `0x319e9d15cae7ee4ab4bf8efb3b4ea48bb18c47cf649e02fab421b0d6eae4b28` |

---

## Getting Started

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Scarb | 2.9.2 | `curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh \| sh` |
| Starknet Foundry | latest | [Installation guide](https://foundry-rs.github.io/starknet-foundry/) |
| Nargo | 1.0.0-beta.16 | `noirup --version 1.0.0-beta.16` |
| Barretenberg | 0.36.0 | `bbup --version 0.36.0` |
| Garaga | 1.0.1 | `pip install garaga==1.0.1` |
| Node.js | 18+ | Frontend |

### Build

```bash
# 1. Compile Cairo contracts
cd contracts && scarb build

# 2. Compile Noir circuits
cd circuits/membership_proof && nargo build
cd ../claim_proof && nargo build

# 3. Frontend
cd frontend && yarn install && yarn dev
```

### Environment

Copy `frontend/.env.example` to `frontend/.env` and fill in:

```bash
NEXT_PUBLIC_SEPOLIA_PROVIDER_URL=<alchemy-or-infura-rpc>
NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=<deployed-factory>
NEXT_PUBLIC_DEPOSIT_POOL_ADDRESS=<deployed-pool>
```

---

## Roadmap

### Phase 1 — MVP (Hackathon, March 2026)
- [x] Architecture and design
- [x] Cairo contracts: deposit pool, Merkle tree, market lifecycle
- [x] Noir circuits: membership and claim proofs
- [x] Garaga on-chain ZK verifier integration
- [x] Parimutuel settlement with 2% protocol fee
- [x] Staked market creation with bond + slashing
- [x] Pragma Oracle integration for automated price markets
- [x] Commit-reveal scheme with Keccak256 (MEV-resistant)
- [x] Frontend: deposit, browse, bet, reveal, claim, resolve
- [x] Deployed to Starknet Sepolia

### Phase 2 — Post-Hackathon
- [ ] Remove ZK bypass — full proof generation in production flow
- [ ] ZK-private dispute voting (prevent oracle bribery)
- [ ] Confidential payouts via Tongo SDK
- [ ] Multiple betting epochs per market
- [ ] Mobile-responsive UI
- [ ] Mainnet deployment

---

## License

MIT

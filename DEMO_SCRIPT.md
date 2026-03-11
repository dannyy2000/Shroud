# Shroud — 5-Minute Demo Script

---

## Before You Start Recording

Do all of this BEFORE you hit record.

**You need two wallets:**
- **Wallet A** — your main wallet, has STRK, connected to the app
- **Wallet B** — a fresh wallet, never used, just copy its address

**You need two markets:**

- **Market A** — a fresh market, still OPEN (bet deadline in the future)
  - You will deposit and place a bet on this live during the video
  - Question: anything simple, e.g. *"Will ETH close above $2,000 today?"*
  - Set the bet deadline to 30+ minutes from now

- **Market B** — a pre-setup market, already in RESOLVING phase
  - Create this ahead of time
  - Place a bet as YES and reveal it
  - Let both deadlines pass so it moves to Resolving
  - This is the market you will resolve and claim on during the video

**Also before recording:**
- Open the Shroud app in your browser
- Have Braavos open on your phone or as a second window
- Copy Wallet B's address and have it ready to paste

---

## The Script

---

### [0:00 – 0:30] Hook

> *"Every prediction market today — Polymarket, Kalshi, Azuro — shows your bets on-chain. Your wallet, your positions, your winnings. All public."*

**Show:** Open Braavos on Wallet A. Scroll through the activity — Create Market, Deposit, bets are all visible.

> *"Whales can see your positions and front-run you. Bots copy your trades the moment they hit the mempool. Shroud fixes this."*

---

### [0:30 – 1:15] How It Works

> *"Shroud is a prediction market where the link between your wallet, your bet, and your payout is cryptographically severed."*

**Show:** The Shroud home page and market list.

> *"Three steps. One — you deposit into a shared anonymity pool. On-chain, all anyone sees is 'someone deposited 10 STRK.' You're indistinguishable from every other depositor."*

> *"Two — you place a bet. Not your direction — just a cryptographic commitment. The contract doesn't know if you bet YES or NO. Nobody does."*

> *"Three — after the market resolves, you claim your winnings to any wallet you choose. A fresh address with no connection to your deposit or your bet. No trail."*

**Navigate to:** Create Market page. Show the form briefly — don't fill it in, just scroll through.

> *"Anyone can create a market by staking a STRK bond. And when you create, you pick how it resolves — either you resolve it yourself as the creator, or you connect it to Pragma oracle, which fetches the price on-chain automatically. No human, no trust, fully automated."*

**Go back to:** the market list.

---

### [1:15 – 1:45] Live: Deposit

**Navigate to:** Deposit page on the Shroud app.

> *"Let me show you. First, I deposit into the pool."*

- Select 10 STRK tier
- Click Deposit, sign in Braavos

> *"The contract stores a Keccak commitment of my secret. My deposit is just one leaf in a Merkle tree — identical to everyone else's. No wallet address. No amount beyond the fixed tier."*

**Show:** Braavos activity — you can see "Deposit" in the list but nothing about which wallet or direction.

---

### [1:45 – 2:15] Live: Place a Bet

**Navigate to:** Market A (the fresh open market).

> *"Now I place a bet. I pick YES — but watch what actually goes on-chain."*

- Select your deposit note
- Pick YES
- Click Bet, sign in Braavos

> *"The contract receives a commitment — keccak of my outcome and a random nonce. The outcome is completely hidden. The contract doesn't know what I bet. Nobody does."*

**Show:** Braavos activity — the bet transaction shows, but it's just a hash.

---

### [2:15 – 2:45] Fast Forward to Reveal

**Navigate to:** Market B (the pre-setup market in Resolving phase).

> *"In a real flow, I would wait for the bet deadline to close, then reveal. I've already done that here — this market's betting window has closed and my bet is revealed."*

> *"The reveal phase is where I provide the nonce that unlocks my commitment. The contract verifies the hash matches and counts my vote. Crucially — nobody could have known my direction before this moment. No live odds to react to. No position to copy."*

---

### [2:45 – 3:30] Live: Resolve + Claim to Fresh Wallet

**Navigate to:** Market B, Resolving state.

> *"The market is ready to resolve. YES wins."*

- Click Resolve as YES, sign in Braavos

**Navigate to:** Claim panel.

> *"Now the important part. I could claim to my current wallet — but I won't. I'll claim to a completely fresh address that has never touched this market."*

- Paste **Wallet B** address into the recipient field
- Click Claim, sign in Braavos

> *"Done."*

**Open Braavos on Wallet B:**

> *"Look at Wallet B. It just received STRK. But there is no on-chain connection between Wallet B and the bet. No connection to the deposit. No connection to Wallet A at all."*

> *"You bet, you won, you claimed — and nobody can prove it was you."*

---

### [3:30 – 4:00] Tech Stack

**Show code as you narrate — open each file at the line indicated:**

> *"Under the hood:"*

> *"Every deposit adds a leaf to a Poseidon2 Merkle tree. The contract stores only the commitment — a Keccak hash of your secret. No wallet, no amount."*

**→ Show: `contracts/src/deposit_pool.cairo` lines 104–109**
```cairo
let leaf_index = current_count;
self.leaves.write((tier_id, leaf_index), commitment);
self.deposit_count.write(tier_id, current_count + 1);
// Update Merkle root (client-computed Poseidon2-BN254 root)
self.merkle_roots.write(tier_id, new_merkle_root);
```

> *"When you place a bet, the contract receives only a commitment — keccak of your outcome and a nonce. The direction is completely hidden."*

**→ Show: `contracts/src/market.cairo` lines 267–270**
```cairo
// commitment = keccak256(outcome || nonce) as 248-bit field
let outcome_felt = outcome_to_felt(outcome);
let expected_commitment = hash_pair(outcome_felt, nonce);
assert(expected_commitment == bet_commitment, 'Reveal mismatch');
```

> *"Before the bet is accepted, the contract calls the Garaga ZK verifier — on-chain proof that the caller is a valid pool depositor, without revealing who they are."*

**→ Show: `contracts/src/market.cairo` lines 632–635**
```cairo
let result = verifier.verify_ultra_keccak_zk_honk_proof(zk_proof);
let public_inputs = match result {
    Result::Ok(inputs) => inputs,
    Result::Err(_) => { panic!("Membership proof verification failed"); },
};
```

> *"And the claim goes to any recipient address — fresh wallet, no link back."*

**→ Show: `contracts/src/market.cairo` lines 373–378**
```cairo
fn claim(
    ref self: ContractState,
    zk_proof: Span<felt252>,
    bet_commitment: felt252,
    recipient: ContractAddress,
)
```

---

### [4:00 – 4:30] Comparison

> *"Every other prediction market treats privacy as a feature. Shroud treats it as the foundation."*

> *"Polymarket — all positions public. Kalshi — KYC required. Azuro — transparent on-chain. Shroud — zero-knowledge from deposit to payout."*

> *"No whale can see your position. No bot can copy your bet. No observer can link your deposit to your claim. That's not a promise — it's a cryptographic guarantee."*

---

### [4:30 – 5:00] Wrap Up

> *"Shroud is live on Starknet Sepolia. Contracts deployed. ZK circuits compiled. Full proof pipeline wired and ready."*

> *"For the demo we're running with proof bypass to avoid the 60-second proving time — but the architecture is production-complete. One flag enables it."*

> *"Built for RE{DEFINE} Hackathon — Privacy Track. Thank you."*

**End on:** the market list page showing real on-chain markets.

---

## Quick Reference — What You Do Live vs Pre-Done

| Step | Live or Pre-Done |
|------|-----------------|
| Create Market A (open market) | Pre-done |
| Create Market B (revealing/resolving market) | Pre-done |
| Place + reveal bet on Market B | Pre-done |
| Deposit | LIVE |
| Place bet on Market A | LIVE |
| Resolve Market B | LIVE |
| Claim to Wallet B | LIVE |

---

## If You Get Questions

**"Why not just use Tornado Cash?"**
> Tornado Cash anonymizes transfers, not bets. You still have to submit your bet from some wallet. Shroud anonymizes the bet itself, not just the money.

**"Is the ZK proof bypassed?"**
> The circuit is compiled, the Garaga verifier is deployed, and the contract handles full proof verification. The bypass is for demo UX only — full proving takes 60 seconds client-side. One flag enables it in production.

**"What stops someone from betting without depositing?"**
> The ZK membership proof. You can only generate a valid proof if you know the secret for a leaf in the Merkle tree — which you only get by depositing.

**"Isn't the reveal phase public?"**
> Yes — you reveal your direction to be counted. But by then the bet is locked. Nobody knew during the betting phase, so there was no market impact. And the link between revealer and depositor is still broken by ZK.

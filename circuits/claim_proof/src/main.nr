// Claim Proof Circuit — Shroud
//
// Used during the CLAIM phase. Proves that the prover owns a winning bet
// and is entitled to a payout, without revealing their identity.
//
// What it proves:
//   1. "I know the nonce for this bet commitment"
//   2. "This bet was on the winning outcome"
//   3. "I'm the same person who placed this bet" (via nullifier_secret link)
//
// What it hides:
//   - Who is claiming (payout goes to any specified address)
//   - Link between deposit, bet, and claim
//
// Why this circuit exists:
//   Without it, the claim transaction would need to come from a traceable
//   wallet. With this proof, the winner specifies ANY recipient address
//   and proves ownership cryptographically — the payout wallet has zero
//   connection to the deposit or betting wallet.

use std::hash::poseidon2::Poseidon2;

fn main(
    // === PRIVATE INPUTS ===

    // The nonce used in the original bet commitment
    nonce: Field,
    // The nullifier secret from the original deposit
    // Links this claim to the deposit without revealing which deposit
    nullifier_secret: Field,

    // === PUBLIC INPUTS ===

    // The bet commitment being claimed
    bet_commitment: pub Field,
    // The winning outcome (1 = Yes, 2 = No) — set by market resolution
    winning_outcome: pub Field,
    // The market ID — binds this claim to the correct market
    market_id: pub Field,
    // The nullifier — must match the one used during bet placement
    // This prevents claiming someone else's winning bet
    nullifier: pub Field,
) {
    // Step 1: Verify the bet commitment matches the winning outcome + nonce
    let computed_commitment = Poseidon2::hash(winning_outcome, nonce);
    assert(
        computed_commitment == bet_commitment,
        "Bet commitment does not match winning outcome",
    );

    // Step 2: Verify the nullifier links this claim to the original bet
    // The same nullifier_secret + market_id produces the same nullifier
    // that was used during bet placement — proving same person
    let expected_nullifier = Poseidon2::hash(nullifier_secret, market_id);
    assert(nullifier == expected_nullifier, "Nullifier mismatch - not the bet owner");

    // Step 3: Validate winning outcome
    assert(
        (winning_outcome == 1) | (winning_outcome == 2),
        "Invalid winning outcome",
    );
}

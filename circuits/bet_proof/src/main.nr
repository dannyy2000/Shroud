// Bet Proof Circuit — Shroud
//
// Used during the REVEAL phase. Proves that a revealed bet (outcome + nonce)
// matches an original bet commitment, without revealing who placed it.
//
// What it proves:
//   1. "I know the nonce used to create this bet commitment"
//   2. "poseidon_hash(outcome, nonce) == bet_commitment"
//
// What it hides:
//   - Who placed this bet (no wallet link)
//   - The nonce itself (only the commitment and outcome are public)
//
// Why this circuit exists:
//   In the reveal phase, we need to verify that someone isn't lying about
//   what they originally bet. But we also don't want the reveal transaction
//   to be linkable to the original bet placement transaction.
//   This ZK proof lets anyone submit the reveal from any wallet.

use std::hash::poseidon2::Poseidon2;

fn main(
    // === PRIVATE INPUTS ===

    // The random nonce used when creating the bet commitment
    nonce: Field,

    // === PUBLIC INPUTS ===

    // The original bet commitment stored on-chain
    bet_commitment: pub Field,
    // The revealed outcome (1 = Yes, 2 = No)
    outcome: pub Field,
) {
    // Validate outcome is Yes (1) or No (2)
    assert((outcome == 1) | (outcome == 2), "Outcome must be 1 (Yes) or 2 (No)");

    // Verify: commitment = poseidon_hash(outcome, nonce)
    let computed_commitment = Poseidon2::hash(outcome, nonce);
    assert(
        computed_commitment == bet_commitment,
        "Reveal does not match bet commitment",
    );
}

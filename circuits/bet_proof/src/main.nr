// Bet Proof Circuit - Shroud
//
// Used during the REVEAL phase. Proves that a revealed bet matches
// its original commitment, without revealing who placed it.

use std::hash::poseidon2_permutation;

// Poseidon2 hash of two field elements (sponge construction)
fn hash2(a: Field, b: Field) -> Field {
    let state: [Field; 4] = poseidon2_permutation([a, b, 0, 0], 4);
    state[0]
}

fn main(
    // === PRIVATE INPUTS ===
    nonce: Field,

    // === PUBLIC INPUTS ===
    bet_commitment: pub Field,
    outcome: pub Field,
) {
    // Validate outcome is Yes (1) or No (2)
    assert((outcome == 1) | (outcome == 2), "Outcome must be 1 (Yes) or 2 (No)");

    // Verify: commitment = poseidon_hash(outcome, nonce)
    let computed_commitment = hash2(outcome, nonce);
    assert(
        computed_commitment == bet_commitment,
        "Reveal does not match bet commitment",
    );
}

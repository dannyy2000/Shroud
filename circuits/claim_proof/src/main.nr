// Claim Proof Circuit - Shroud
//
// Used during the CLAIM phase. Proves that the prover owns a winning bet
// and is entitled to a payout, without revealing their identity.

use std::hash::poseidon2_permutation;

// Poseidon2 hash of two field elements (sponge construction)
fn hash2(a: Field, b: Field) -> Field {
    let state: [Field; 4] = poseidon2_permutation([a, b, 0, 0], 4);
    state[0]
}

fn main(
    // === PRIVATE INPUTS ===
    nonce: Field,
    nullifier_secret: Field,

    // === PUBLIC INPUTS ===
    bet_commitment: pub Field,
    winning_outcome: pub Field,
    market_id: pub Field,
    nullifier: pub Field,
) {
    // Step 1: Verify the bet commitment matches the winning outcome + nonce
    let computed_commitment = hash2(winning_outcome, nonce);
    assert(
        computed_commitment == bet_commitment,
        "Bet commitment does not match winning outcome",
    );

    // Step 2: Verify the nullifier links this claim to the original bet
    let expected_nullifier = hash2(nullifier_secret, market_id);
    assert(nullifier == expected_nullifier, "Nullifier mismatch - not the bet owner");

    // Step 3: Validate winning outcome
    assert(
        (winning_outcome == 1) | (winning_outcome == 2),
        "Invalid winning outcome",
    );
}

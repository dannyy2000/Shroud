// Membership Proof Circuit - Shroud
//
// Proves that the prover is a valid depositor in the Shroud
// anonymity pool WITHOUT revealing which deposit is theirs.

use std::hash::poseidon2_permutation;

// Poseidon2 hash of two field elements (sponge construction)
fn hash2(a: Field, b: Field) -> Field {
    let state: [Field; 4] = poseidon2_permutation([a, b, 0, 0], 4);
    state[0]
}

// Merkle tree depth - must match the Cairo contract (20 levels = ~1M deposits)
global TREE_DEPTH: u32 = 20;

fn main(
    // === PRIVATE INPUTS ===
    secret: Field,
    nullifier_secret: Field,
    merkle_path: [Field; 20],
    path_indices: [Field; 20],

    // === PUBLIC INPUTS ===
    merkle_root: pub Field,
    nullifier: pub Field,
    bet_commitment: pub Field,
    market_id: pub Field,
) {
    // Step 1: Compute the leaf commitment
    // leaf = poseidon_hash(secret, nullifier_secret)
    let leaf = hash2(secret, nullifier_secret);

    // Step 2: Verify the Merkle proof
    let mut current_hash = leaf;

    for i in 0..TREE_DEPTH {
        let sibling = merkle_path[i];
        let index = path_indices[i];

        // path_indices[i] must be 0 or 1
        assert(index * (1 - index) == 0, "Path index must be 0 or 1");

        let (left, right) = if index == 0 {
            (current_hash, sibling)
        } else {
            (sibling, current_hash)
        };

        current_hash = hash2(left, right);
    }

    // Step 3: Verify computed root matches the public Merkle root
    assert(current_hash == merkle_root, "Merkle proof verification failed");

    // Step 4: Verify the nullifier is correctly derived
    // nullifier = poseidon_hash(nullifier_secret, market_id)
    let expected_nullifier = hash2(nullifier_secret, market_id);
    assert(nullifier == expected_nullifier, "Invalid nullifier");

    // Step 5: Verify bet_commitment is non-zero
    assert(bet_commitment != 0, "Invalid bet commitment");
}

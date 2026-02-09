// Membership Proof Circuit — Shroud
//
// This circuit proves that the prover is a valid depositor in the Shroud
// anonymity pool WITHOUT revealing which deposit is theirs.
//
// What it proves:
//   1. "I know a (secret, nullifier_secret) pair"
//   2. "poseidon_hash(secret, nullifier_secret) is a leaf in the Merkle tree"
//   3. "The Merkle tree has this root" (matches on-chain state)
//   4. "My nullifier = poseidon_hash(nullifier_secret, market_id)" (unique per market)
//   5. "I'm committing this bet_commitment as a public output"
//
// What it hides:
//   - Which leaf in the tree is mine (anonymous among all depositors)
//   - My secret and nullifier_secret
//   - Any link between my deposit wallet and this bet

use std::hash::poseidon2::Poseidon2;

// Merkle tree depth — must match the Cairo contract (20 levels = ~1M deposits)
global TREE_DEPTH: u32 = 20;

fn main(
    // === PRIVATE INPUTS (known only to the prover, never revealed) ===

    // The secret the user chose when depositing
    secret: Field,
    // The nullifier secret — used to derive the unique nullifier
    nullifier_secret: Field,
    // The Merkle proof path: sibling hashes from leaf to root
    merkle_path: [Field; 20],
    // The path indices: 0 = left child, 1 = right child (bit at each level)
    path_indices: [Field; 20],

    // === PUBLIC INPUTS (visible on-chain, verified by the contract) ===

    // The current Merkle root of the deposit pool (read from contract)
    merkle_root: pub Field,
    // The nullifier — unique per deposit+market, prevents double-betting
    nullifier: pub Field,
    // The bet commitment — hash(outcome, nonce), hides what the user bet on
    bet_commitment: pub Field,
    // The market ID — binds this proof to a specific market
    market_id: pub Field,
) {
    // Step 1: Compute the leaf commitment from the secret inputs
    // This must match what was stored in the Merkle tree during deposit
    // leaf = poseidon_hash(secret, nullifier_secret)
    let leaf = Poseidon2::hash(secret, nullifier_secret);

    // Step 2: Verify the Merkle proof — prove this leaf exists in the tree
    // Walk from the leaf up to the root, hashing with siblings at each level
    let mut current_hash = leaf;

    for i in 0..TREE_DEPTH {
        let sibling = merkle_path[i];
        let index = path_indices[i];

        // path_indices[i] must be 0 or 1
        assert(index * (1 - index) == 0, "Path index must be 0 or 1");

        // If index == 0: current node is left child → hash(current, sibling)
        // If index == 1: current node is right child → hash(sibling, current)
        let (left, right) = if index == 0 {
            (current_hash, sibling)
        } else {
            (sibling, current_hash)
        };

        current_hash = Poseidon2::hash(left, right);
    }

    // Step 3: Verify computed root matches the public Merkle root
    assert(current_hash == merkle_root, "Merkle proof verification failed");

    // Step 4: Verify the nullifier is correctly derived
    // nullifier = poseidon_hash(nullifier_secret, market_id)
    // This ensures:
    //   - Each deposit can only bet ONCE per market (same nullifier_secret → same nullifier)
    //   - The same deposit CAN bet on different markets (different market_id → different nullifier)
    //   - Nobody can link nullifiers across markets (market_id is mixed in)
    let expected_nullifier = Poseidon2::hash(nullifier_secret, market_id);
    assert(nullifier == expected_nullifier, "Invalid nullifier");

    // Step 5: Verify bet_commitment is non-zero (sanity check)
    // The actual bet content (outcome + nonce) is hidden — we just bind it to this proof
    assert(bet_commitment != 0, "Invalid bet commitment");
}

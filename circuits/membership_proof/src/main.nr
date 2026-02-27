// Membership Proof Circuit - Shroud
//
// Proves that the prover knows a secret whose keccak256(secret, nullifier_secret)
// commitment is a leaf in a Poseidon2-BN254 Merkle tree of depth 20.
//
// Hash functions used:
//   * Merkle NODES: Poseidon2-BN254 native ACIR blackbox (~50 gates/call)
//     poseidon2_permutation([left, right, 0, 0], 4)[0]  (bb requires width=4)
//   * Leaf commitment + nullifier: keccak256 (matches Cairo keccak_u256s_be_inputs
//     and JS ethers.keccak256) - implemented via keccakf1600 (~22K gates each)
//
// Total: ~2 x 22K (leaf + nullifier) + 20 x 50 (tree) ~ 45K gates

// -- keccak256 of two 32-byte field elements ----------------------------------
// Built from keccakf1600 (rate=136 bytes, Ethereum 0x01/0x80 padding).
// Truncates result to 248 bits (drops top byte) - fits both BN254 and Stark252.

fn keccak256_64(input: [u8; 64]) -> [u8; 32] {
    let mut state: [u64; 25] = [0; 25];
    for i in 0..8 {
        let b0 = input[8 * i + 0] as u64;
        let b1 = input[8 * i + 1] as u64;
        let b2 = input[8 * i + 2] as u64;
        let b3 = input[8 * i + 3] as u64;
        let b4 = input[8 * i + 4] as u64;
        let b5 = input[8 * i + 5] as u64;
        let b6 = input[8 * i + 6] as u64;
        let b7 = input[8 * i + 7] as u64;
        state[i] = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
                 | (b4 << 32) | (b5 << 40) | (b6 << 48) | (b7 << 56);
    }
    state[8] = 0x01;
    state[16] = 0x80u64 << 56;
    let result = dep::std::hash::keccakf1600(state);
    let mut output: [u8; 32] = [0; 32];
    for i in 0..4 {
        let w = result[i];
        output[8 * i + 0] = (w & 0xFF) as u8;
        output[8 * i + 1] = ((w >> 8) & 0xFF) as u8;
        output[8 * i + 2] = ((w >> 16) & 0xFF) as u8;
        output[8 * i + 3] = ((w >> 24) & 0xFF) as u8;
        output[8 * i + 4] = ((w >> 32) & 0xFF) as u8;
        output[8 * i + 5] = ((w >> 40) & 0xFF) as u8;
        output[8 * i + 6] = ((w >> 48) & 0xFF) as u8;
        output[8 * i + 7] = ((w >> 56) & 0xFF) as u8;
    }
    output
}

fn keccak256_pair(a: Field, b: Field) -> Field {
    let a_bytes = a.to_be_bytes::<32>();
    let b_bytes = b.to_be_bytes::<32>();
    let mut input: [u8; 64] = [0; 64];
    for i in 0..32 {
        input[i] = a_bytes[i];
        input[i + 32] = b_bytes[i];
    }
    let h = keccak256_64(input);
    // Drop top byte -> 248 bits, safe for both BN254 and Stark252
    let mut result: Field = 0;
    for i in 1..32 {
        result = result * 256 + (h[i] as Field);
    }
    result
}

// -- Poseidon2-BN254 compression for Merkle nodes -----------------------------
// Native ACIR blackbox (~50 gates/call). bb requires state width = 4.
// Matches @aztec/bb.js poseidon2Permutation([left, right, 0n, 0n])[0].
fn poseidon2_compress(left: Field, right: Field) -> Field {
    dep::std::hash::poseidon2_permutation([left, right, 0, 0], 4)[0]
}

// -- Circuit -------------------------------------------------------------------

global TREE_DEPTH: u32 = 20;

fn main(
    secret: Field,
    nullifier_secret: Field,
    merkle_path: [Field; 20],
    path_indices: [Field; 20],
    merkle_root: pub Field,
    nullifier: pub Field,
    bet_commitment: pub Field,
    market_id: pub Field,
) {
    // Leaf = keccak256(secret || nullifier_secret)
    // Matches: DepositCard.tsx hashPairHex(secret, nullifier)
    let leaf = keccak256_pair(secret, nullifier_secret);

    // Verify Merkle inclusion using Poseidon2-BN254 node hashes
    let mut current_hash = leaf;
    for i in 0..TREE_DEPTH {
        let sibling = merkle_path[i];
        let index = path_indices[i];
        assert(index * (1 - index) == 0, "Path index must be 0 or 1");
        let (left, right) = if index == 0 {
            (current_hash, sibling)
        } else {
            (sibling, current_hash)
        };
        current_hash = poseidon2_compress(left, right);
    }
    assert(current_hash == merkle_root, "Merkle proof verification failed");

    // Nullifier = keccak256(nullifier_secret || market_id)
    // Matches: zkProof.ts hashPair(note.nullifier, marketId)
    // and: deposit_pool.cairo has no nullifier hash (it's market-specific)
    let expected_nullifier = keccak256_pair(nullifier_secret, market_id);
    assert(nullifier == expected_nullifier, "Invalid nullifier");

    assert(bet_commitment != 0, "Invalid bet commitment");
}

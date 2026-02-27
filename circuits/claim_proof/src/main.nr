// Claim Proof Circuit - Shroud
//
// Hash function: keccak256 over big-endian 32-byte field serialisation.
// Matches market.cairo reveal_bet check and JS (ethers.keccak256).
//
// Noir 1.0.0-beta.16 does not expose keccak256 directly; we build it from
// keccakf1600 (rate = 136 bytes, Ethereum/Keccak padding 0x01...0x80).

// keccak-256 of a 64-byte input, built from the raw keccakf1600 permutation.
fn keccak256_64(input: [u8; 64]) -> [u8; 32] {
    // Pad to 136 bytes (rate): absorb 64 bytes then 0x01, zeros, 0x80 at byte 135
    let mut state: [u64; 25] = [0; 25];

    // Words 0..7: input bytes 0..63 packed little-endian into u64
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
    // Word 8: byte 64 = 0x01 (Keccak padding start), bytes 65..71 = 0x00
    state[8] = 0x01;
    // Words 9..15: all zero (already 0)
    // Word 16: byte 135 = 0x80 (Keccak padding end) at bit position 56 (byte 7 of word 16)
    state[16] = 0x80u64 << 56;

    // Apply Keccak-f[1600]
    let result = dep::std::hash::keccakf1600(state);

    // Squeeze first 32 bytes from first 4 words (little-endian)
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

// keccak256 of two field elements as 32 big-endian bytes each.
// Result truncated to 31 bytes (248 bits) -- fits both BN254 and Stark252.
fn hash_pair(a: Field, b: Field) -> Field {
    let a_bytes = a.to_be_bytes::<32>();
    let b_bytes = b.to_be_bytes::<32>();
    let mut input: [u8; 64] = [0; 64];
    for i in 0..32 {
        input[i] = a_bytes[i];
        input[i + 32] = b_bytes[i];
    }
    let h = keccak256_64(input);
    // Skip first byte -> 248 bits, safe for both field primes
    let mut result: Field = 0;
    for i in 1..32 {
        result = result * 256 + (h[i] as Field);
    }
    result
}

fn main(
    nonce: Field,
    nullifier_secret: Field,
    bet_commitment: pub Field,
    winning_outcome: pub Field,
    market_id: pub Field,
    nullifier: pub Field,
) {
    // commitment = keccak256(winning_outcome || nonce)
    let computed_commitment = hash_pair(winning_outcome, nonce);
    assert(
        computed_commitment == bet_commitment,
        "Bet commitment does not match winning outcome",
    );

    // nullifier = keccak256(nullifier_secret || market_id)
    let expected_nullifier = hash_pair(nullifier_secret, market_id);
    assert(nullifier == expected_nullifier, "Nullifier mismatch - not the bet owner");

    assert(
        (winning_outcome == 1) | (winning_outcome == 2),
        "Invalid winning outcome",
    );
}

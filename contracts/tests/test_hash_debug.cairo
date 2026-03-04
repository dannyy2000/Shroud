// Debug test: figure out which Cairo keccak function matches JS ethers
// JS hash(1, 0xe508e1b2ca6f9e7013c4e1cf2fe9856eeb70f2595cc335650506a17e04485d)
// = 0x3ac24dc7110b3df02828e611f0af3eb463e1bc3f20ffe0d636aa327ce8657

fn hash_pair_fixed(left: felt252, right: felt252) -> felt252 {
    let left_u256: u256 = left.into();
    let right_u256: u256 = right.into();
    let inputs = array![left_u256, right_u256].span();
    let h: u256 = core::keccak::keccak_u256s_be_inputs(inputs);
    let be: u256 = u256 {
        high: core::integer::u128_byte_reverse(h.low),
        low: core::integer::u128_byte_reverse(h.high),
    };
    let truncated: u256 = u256 {
        high: be.high & 0x00ffffffffffffffffffffffffffffff_u128,
        low: be.low,
    };
    truncated.try_into().unwrap()
}

#[test]
fn test_be_matches_js() {
    // From live Sepolia error: JS produced this commitment
    let outcome_felt: felt252 = 1;
    let nonce: felt252 = 0xe508e1b2ca6f9e7013c4e1cf2fe9856eeb70f2595cc335650506a17e04485d;
    // JS hashPair(1, nonce) = 0x3ac24dc7110b3df02828e611f0af3eb463e1bc3f20ffe0d636aa327ce8657
    let js_expected: felt252 = 0x3ac24dc7110b3df02828e611f0af3eb463e1bc3f20ffe0d636aa327ce8657;

    let result = hash_pair_fixed(outcome_felt, nonce);
    assert(result == js_expected, 'hash mismatch');
}

fn hash_pair(left: felt252, right: felt252) -> felt252 {
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
fn test_reveal_hash() {
    let outcome_felt: felt252 = 1;
    let nonce: felt252 = 0x53334f54c6cf8bcf39dee8054c51aff32060977234070021b6a6cb3e69c0c5;
    // JS: hashPair(1n, nonce) = 0xbd025fac5b652afa21675c924f282c7baebacd53faa563b2a289d746866d80
    let expected: felt252 = 0xbd025fac5b652afa21675c924f282c7baebacd53faa563b2a289d746866d80;

    let actual = hash_pair(outcome_felt, nonce);

    assert(actual == expected, 'Hash mismatch');
}

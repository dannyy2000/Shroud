import { CONTRACTS } from "./constants";

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [{ type: "core::bool" }],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "balance_of",
    inputs: [
      { name: "account", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "core::starknet::contract_address::ContractAddress" },
      { name: "spender", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
] as const;

export const DEPOSIT_POOL_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "commitment", type: "core::felt252" },
      {
        name: "tier",
        type: "core::felt252",
      },
    ],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "get_merkle_root",
    inputs: [{ name: "tier", type: "core::felt252" }],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_deposit_count",
    inputs: [{ name: "tier", type: "core::felt252" }],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_tier_amount",
    inputs: [{ name: "tier", type: "core::felt252" }],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
] as const;

export const MARKET_FACTORY_ABI = [
  {
    type: "function",
    name: "create_market",
    inputs: [
      { name: "question", type: "core::byte_array::ByteArray" },
      { name: "bet_deadline", type: "core::integer::u64" },
      { name: "reveal_deadline", type: "core::integer::u64" },
      { name: "resolution_source", type: "core::felt252" },
      { name: "pool_tier", type: "core::felt252" },
      { name: "pragma_pair_id", type: "core::felt252" },
      { name: "target_price", type: "core::integer::u256" },
      { name: "creator_stake", type: "core::integer::u256" },
      { name: "min_bets", type: "core::integer::u32" },
    ],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "get_market_count",
    inputs: [],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_market_address",
    inputs: [{ name: "market_id", type: "core::integer::u64" }],
    outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_deposit_pool",
    inputs: [],
    outputs: [{ type: "core::starknet::contract_address::ContractAddress" }],
    state_mutability: "view",
  },
] as const;

export const MARKET_ABI = [
  {
    type: "function",
    name: "place_bet",
    inputs: [
      { name: "zk_proof", type: "core::array::Span::<core::felt252>" },
      { name: "bet_commitment", type: "core::felt252" },
      { name: "nullifier", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "reveal_bet",
    inputs: [
      { name: "bet_commitment", type: "core::felt252" },
      { name: "outcome", type: "core::felt252" },
      { name: "nonce", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "resolve",
    inputs: [{ name: "outcome", type: "core::felt252" }],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "claim",
    inputs: [
      { name: "zk_proof", type: "core::array::Span::<core::felt252>" },
      { name: "bet_commitment", type: "core::felt252" },
      { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "claim_refund",
    inputs: [
      { name: "zk_proof", type: "core::array::Span::<core::felt252>" },
      { name: "bet_commitment", type: "core::felt252" },
      { name: "recipient", type: "core::starknet::contract_address::ContractAddress" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "get_question",
    inputs: [],
    outputs: [{ type: "core::byte_array::ByteArray" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_status",
    inputs: [],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_outcome",
    inputs: [],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_config",
    inputs: [],
    outputs: [
      {
        type: "(core::starknet::contract_address::ContractAddress, core::integer::u64, core::integer::u64, core::integer::u64, core::felt252, core::felt252, core::felt252, core::integer::u256, core::integer::u256, core::integer::u32)",
      },
    ],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_total_bets",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_yes_count",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_no_count",
    inputs: [],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_pool_balance",
    inputs: [],
    outputs: [{ type: "core::integer::u256" }],
    state_mutability: "view",
  },
] as const;

export { CONTRACTS };

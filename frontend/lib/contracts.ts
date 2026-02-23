import { Contract, RpcProvider, CairoCustomEnum } from "starknet";
import { CONTRACTS } from "./constants";
import { getRpcUrl } from "~~/services/web3/provider";
import scaffoldConfig from "~~/scaffold.config";

// ─── Provider singleton ───────────────────────────────────────────────
let _provider: RpcProvider | null = null;
export function getProvider(): RpcProvider {
  if (!_provider) {
    const network = scaffoldConfig.targetNetworks[0].network;
    const url = getRpcUrl(network);
    _provider = new RpcProvider({ nodeUrl: url });
  }
  return _provider;
}

// ─── Enum helpers ─────────────────────────────────────────────────────
const POOL_TIER_VARIANTS = ["Small", "Medium", "Large"] as const;
const RESOLUTION_SOURCE_VARIANTS = ["PragmaOracle", "CreatorResolve"] as const;

export function poolTierEnum(tier: number): CairoCustomEnum {
  const variant = POOL_TIER_VARIANTS[tier] || "Small";
  const obj: Record<string, unknown> = {};
  for (const v of POOL_TIER_VARIANTS) obj[v] = v === variant ? {} : undefined;
  return new CairoCustomEnum(obj);
}

export function resolutionSourceEnum(source: "oracle" | "creator"): CairoCustomEnum {
  const variant = source === "oracle" ? "PragmaOracle" : "CreatorResolve";
  const obj: Record<string, unknown> = {};
  for (const v of RESOLUTION_SOURCE_VARIANTS) obj[v] = v === variant ? {} : undefined;
  return new CairoCustomEnum(obj);
}

// ─── Compiled ABIs (from contracts/target/dev/) ───────────────────────

export const ERC20_ABI = [
  {
    type: "interface",
    name: "IERC20",
    items: [
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
    ],
  },
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    type: "enum",
    name: "core::bool",
    variants: [
      { name: "False", type: "()" },
      { name: "True", type: "()" },
    ],
  },
] as const;

export const DEPOSIT_POOL_ABI = [
  { type: "impl", name: "DepositPoolImpl", interface_name: "shroud::interfaces::IDepositPool" },
  {
    type: "enum",
    name: "shroud::interfaces::PoolTier",
    variants: [
      { name: "Small", type: "()" },
      { name: "Medium", type: "()" },
      { name: "Large", type: "()" },
    ],
  },
  {
    type: "enum",
    name: "core::bool",
    variants: [
      { name: "False", type: "()" },
      { name: "True", type: "()" },
    ],
  },
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    type: "interface",
    name: "shroud::interfaces::IDepositPool",
    items: [
      {
        type: "function",
        name: "deposit",
        inputs: [
          { name: "commitment", type: "core::felt252" },
          { name: "tier", type: "shroud::interfaces::PoolTier" },
        ],
        outputs: [{ type: "core::integer::u32" }],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_merkle_root",
        inputs: [{ name: "tier", type: "shroud::interfaces::PoolTier" }],
        outputs: [{ type: "core::felt252" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_deposit_count",
        inputs: [{ name: "tier", type: "shroud::interfaces::PoolTier" }],
        outputs: [{ type: "core::integer::u32" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "is_nullifier_used",
        inputs: [{ name: "nullifier", type: "core::felt252" }],
        outputs: [{ type: "core::bool" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "use_nullifier",
        inputs: [{ name: "nullifier", type: "core::felt252" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_tier_amount",
        inputs: [{ name: "tier", type: "shroud::interfaces::PoolTier" }],
        outputs: [{ type: "core::integer::u256" }],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_leaf",
        inputs: [
          { name: "tier", type: "shroud::interfaces::PoolTier" },
          { name: "index", type: "core::integer::u32" },
        ],
        outputs: [{ type: "core::felt252" }],
        state_mutability: "view",
      },
    ],
  },
] as const;

export const MARKET_FACTORY_ABI = [
  { type: "impl", name: "MarketFactoryImpl", interface_name: "shroud::interfaces::IMarketFactory" },
  {
    type: "struct",
    name: "core::byte_array::ByteArray",
    members: [
      { name: "data", type: "core::array::Array::<core::bytes_31::bytes31>" },
      { name: "pending_word", type: "core::felt252" },
      { name: "pending_word_len", type: "core::internal::bounded_int::BoundedInt::<0, 30>" },
    ],
  },
  {
    type: "enum",
    name: "shroud::interfaces::ResolutionSource",
    variants: [
      { name: "PragmaOracle", type: "()" },
      { name: "CreatorResolve", type: "()" },
    ],
  },
  {
    type: "enum",
    name: "shroud::interfaces::PoolTier",
    variants: [
      { name: "Small", type: "()" },
      { name: "Medium", type: "()" },
      { name: "Large", type: "()" },
    ],
  },
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      { name: "low", type: "core::integer::u128" },
      { name: "high", type: "core::integer::u128" },
    ],
  },
  {
    type: "interface",
    name: "shroud::interfaces::IMarketFactory",
    items: [
      {
        type: "function",
        name: "create_market",
        inputs: [
          { name: "question", type: "core::byte_array::ByteArray" },
          { name: "bet_deadline", type: "core::integer::u64" },
          { name: "reveal_deadline", type: "core::integer::u64" },
          { name: "resolution_source", type: "shroud::interfaces::ResolutionSource" },
          { name: "pool_tier", type: "shroud::interfaces::PoolTier" },
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
    ],
  },
  {
    type: "event",
    name: "shroud::market_factory::MarketFactory::MarketCreated",
    kind: "struct",
    members: [
      { name: "market_id", type: "core::integer::u64", kind: "data" },
      { name: "creator", type: "core::starknet::contract_address::ContractAddress", kind: "data" },
      { name: "question", type: "core::byte_array::ByteArray", kind: "data" },
      { name: "bet_deadline", type: "core::integer::u64", kind: "data" },
      { name: "reveal_deadline", type: "core::integer::u64", kind: "data" },
      { name: "pool_tier", type: "shroud::interfaces::PoolTier", kind: "data" },
      { name: "resolution_source", type: "shroud::interfaces::ResolutionSource", kind: "data" },
      { name: "creator_stake", type: "core::integer::u256", kind: "data" },
      { name: "min_bets", type: "core::integer::u32", kind: "data" },
    ],
  },
  {
    type: "event",
    name: "shroud::market_factory::MarketFactory::Event",
    kind: "enum",
    variants: [
      {
        name: "MarketCreated",
        type: "shroud::market_factory::MarketFactory::MarketCreated",
        kind: "nested",
      },
    ],
  },
] as const;

// ─── Market ABI ───────────────────────────────────────────────────────

export const MARKET_ABI = [
  { type: "impl", name: "MarketImpl", interface_name: "shroud::interfaces::IMarket" },
  { type: "struct", name: "core::array::Span::<core::felt252>", members: [{ name: "snapshot", type: "@core::array::Array::<core::felt252>" }] },
  { type: "enum", name: "shroud::interfaces::Outcome", variants: [{ name: "Pending", type: "()" }, { name: "Yes", type: "()" }, { name: "No", type: "()" }] },
  { type: "enum", name: "shroud::interfaces::MarketStatus", variants: [{ name: "Open", type: "()" }, { name: "Revealing", type: "()" }, { name: "Resolving", type: "()" }, { name: "Resolved", type: "()" }, { name: "Disputed", type: "()" }, { name: "Cancelled", type: "()" }] },
  { type: "enum", name: "shroud::interfaces::ResolutionSource", variants: [{ name: "PragmaOracle", type: "()" }, { name: "CreatorResolve", type: "()" }] },
  { type: "enum", name: "shroud::interfaces::PoolTier", variants: [{ name: "Small", type: "()" }, { name: "Medium", type: "()" }, { name: "Large", type: "()" }] },
  { type: "struct", name: "core::integer::u256", members: [{ name: "low", type: "core::integer::u128" }, { name: "high", type: "core::integer::u128" }] },
  { type: "enum", name: "core::bool", variants: [{ name: "False", type: "()" }, { name: "True", type: "()" }] },
  {
    type: "interface",
    name: "shroud::interfaces::IMarket",
    items: [
      { type: "function", name: "place_bet", inputs: [{ name: "zk_proof", type: "core::array::Span::<core::felt252>" }, { name: "bet_commitment", type: "core::felt252" }, { name: "nullifier", type: "core::felt252" }], outputs: [], state_mutability: "external" },
      { type: "function", name: "reveal_bet", inputs: [{ name: "bet_commitment", type: "core::felt252" }, { name: "outcome", type: "shroud::interfaces::Outcome" }, { name: "nonce", type: "core::felt252" }], outputs: [], state_mutability: "external" },
      { type: "function", name: "resolve", inputs: [{ name: "outcome", type: "shroud::interfaces::Outcome" }], outputs: [], state_mutability: "external" },
      { type: "function", name: "claim", inputs: [{ name: "zk_proof", type: "core::array::Span::<core::felt252>" }, { name: "bet_commitment", type: "core::felt252" }, { name: "recipient", type: "core::starknet::contract_address::ContractAddress" }], outputs: [], state_mutability: "external" },
      { type: "function", name: "claim_refund", inputs: [{ name: "zk_proof", type: "core::array::Span::<core::felt252>" }, { name: "bet_commitment", type: "core::felt252" }, { name: "recipient", type: "core::starknet::contract_address::ContractAddress" }], outputs: [], state_mutability: "external" },
      { type: "function", name: "claim_creator_stake", inputs: [], outputs: [], state_mutability: "external" },
      { type: "function", name: "get_status", inputs: [], outputs: [{ type: "shroud::interfaces::MarketStatus" }], state_mutability: "view" },
      { type: "function", name: "get_outcome", inputs: [], outputs: [{ type: "shroud::interfaces::Outcome" }], state_mutability: "view" },
      { type: "function", name: "get_total_bets", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
      { type: "function", name: "get_total_revealed", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
      { type: "function", name: "get_yes_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
      { type: "function", name: "get_no_count", inputs: [], outputs: [{ type: "core::integer::u32" }], state_mutability: "view" },
      { type: "function", name: "get_pool_balance", inputs: [], outputs: [{ type: "core::integer::u256" }], state_mutability: "view" },
      { type: "function", name: "is_bet_revealed", inputs: [{ name: "bet_commitment", type: "core::felt252" }], outputs: [{ type: "core::bool" }], state_mutability: "view" },
      { type: "function", name: "is_bet_claimed", inputs: [{ name: "bet_commitment", type: "core::felt252" }], outputs: [{ type: "core::bool" }], state_mutability: "view" },
    ],
  },
] as const;

// ─── Outcome enum helper ──────────────────────────────────────────────

export function outcomeEnum(outcome: "yes" | "no"): CairoCustomEnum {
  return new CairoCustomEnum({
    Pending: undefined,
    Yes: outcome === "yes" ? {} : undefined,
    No: outcome === "no" ? {} : undefined,
  });
}

// ─── Market address cache ─────────────────────────────────────────────
const _marketAddressCache = new Map<number, string>();

const ZERO_ADDRESS = "0x" + "0".repeat(64);

export function isZeroAddress(addr: string): boolean {
  return !addr || BigInt(addr) === 0n;
}

export async function getMarketAddress(marketId: number): Promise<string> {
  if (_marketAddressCache.has(marketId)) {
    const cached = _marketAddressCache.get(marketId)!;
    if (isZeroAddress(cached)) {
      throw new Error("Market contract not deployed — the factory MVP stores markets in-contract only. Separate Market contracts must be deployed before betting.");
    }
    return cached;
  }
  const factory = getMarketFactoryContract();
  const raw = await factory.get_market_address(marketId);
  const address = "0x" + BigInt(raw).toString(16).padStart(64, "0");
  _marketAddressCache.set(marketId, address);
  if (isZeroAddress(address)) {
    throw new Error("Market contract not deployed — the factory MVP stores markets in-contract only. Separate Market contracts must be deployed before betting.");
  }
  return address;
}

// ─── Contract instances ───────────────────────────────────────────────

export function getMarketContract(address: string, accountOrProvider?: any): Contract {
  return new Contract({
    abi: MARKET_ABI as any,
    address,
    providerOrAccount: accountOrProvider ?? getProvider(),
  });
}

export function getDepositPoolContract(): Contract {
  return new Contract({
    abi: DEPOSIT_POOL_ABI as any,
    address: CONTRACTS.DEPOSIT_POOL,
    providerOrAccount: getProvider(),
  });
}

export function getMarketFactoryContract(): Contract {
  return new Contract({
    abi: MARKET_FACTORY_ABI as any,
    address: CONTRACTS.MARKET_FACTORY,
    providerOrAccount: getProvider(),
  });
}

export { CONTRACTS };

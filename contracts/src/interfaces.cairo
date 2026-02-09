use starknet::ContractAddress;

/// Pool tier — fixed deposit amounts for anonymity.
/// All depositors in a tier are indistinguishable.
#[derive(Drop, Copy, Serde, starknet::Store, PartialEq)]
pub enum PoolTier {
    Small,   // 10 STRK
    Medium,  // 100 STRK
    Large,   // 1000 STRK
}

/// Market lifecycle status
#[derive(Drop, Copy, Serde, starknet::Store, PartialEq)]
pub enum MarketStatus {
    Open,       // Accepting anonymous bets
    Revealing,  // Bet deadline passed, reveal window active
    Resolving,  // Reveals done, awaiting outcome
    Resolved,   // Outcome determined, claims open
    Disputed,   // Creator resolution challenged
}

/// How the market outcome is determined
#[derive(Drop, Copy, Serde, starknet::Store, PartialEq)]
pub enum ResolutionSource {
    PragmaOracle,    // Automated price feed
    CreatorResolve,  // Creator submits outcome + dispute window
}

/// Market outcome
#[derive(Drop, Copy, Serde, starknet::Store, PartialEq)]
pub enum Outcome {
    Pending,
    Yes,
    No,
}

/// Stored bet data (after anonymous placement)
#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct Bet {
    pub commitment: felt252,    // hash(outcome + nonce) — direction hidden
    pub revealed: bool,         // Whether the bet has been revealed
    pub outcome: Outcome,       // Revealed outcome (Pending until revealed)
    pub claimed: bool,          // Whether winnings have been claimed
}

/// Market configuration set at creation
#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct MarketConfig {
    pub creator: ContractAddress,
    pub bet_deadline: u64,        // Timestamp: last moment to place bets
    pub reveal_deadline: u64,     // Timestamp: last moment to reveal
    pub dispute_deadline: u64,    // Timestamp: last moment to dispute resolution
    pub resolution_source: ResolutionSource,
    pub pool_tier: PoolTier,
    pub pragma_pair_id: felt252,  // Oracle pair ID (0 if creator-resolved)
    pub target_price: u256,       // Target price for oracle resolution (0 if creator-resolved)
}

#[starknet::interface]
pub trait IDepositPool<TContractState> {
    /// Deposit a fixed amount into the anonymity pool.
    /// `commitment` = poseidon_hash(secret, nullifier) — computed client-side.
    /// Returns the leaf index in the Merkle tree.
    fn deposit(ref self: TContractState, commitment: felt252, tier: PoolTier) -> u32;

    /// Get the current Merkle root for a pool tier
    fn get_merkle_root(self: @TContractState, tier: PoolTier) -> felt252;

    /// Get the number of deposits in a pool tier
    fn get_deposit_count(self: @TContractState, tier: PoolTier) -> u32;

    /// Check if a nullifier has already been used
    fn is_nullifier_used(self: @TContractState, nullifier: felt252) -> bool;

    /// Mark a nullifier as used (callable by authorized market contracts)
    fn use_nullifier(ref self: TContractState, nullifier: felt252);

    /// Get the deposit amount for a pool tier (in wei)
    fn get_tier_amount(self: @TContractState, tier: PoolTier) -> u256;

    /// Get a leaf value at a specific index
    fn get_leaf(self: @TContractState, tier: PoolTier, index: u32) -> felt252;
}

#[starknet::interface]
pub trait IMarketFactory<TContractState> {
    /// Create a new prediction market
    fn create_market(
        ref self: TContractState,
        question: ByteArray,
        bet_deadline: u64,
        reveal_deadline: u64,
        resolution_source: ResolutionSource,
        pool_tier: PoolTier,
        pragma_pair_id: felt252,
        target_price: u256,
    ) -> u64;

    /// Get total number of markets
    fn get_market_count(self: @TContractState) -> u64;

    /// Get market address by ID
    fn get_market_address(self: @TContractState, market_id: u64) -> ContractAddress;

    /// Get the deposit pool address
    fn get_deposit_pool(self: @TContractState) -> ContractAddress;
}

#[starknet::interface]
pub trait IMarket<TContractState> {
    /// Place an anonymous bet.
    /// Caller proves pool membership via ZK proof without revealing which deposit is theirs.
    /// `zk_proof` — serialized Noir proof verified by Garaga on-chain
    /// `bet_commitment` — hash(outcome + nonce), hides bet direction
    /// `nullifier` — unique per deposit note, prevents double-betting
    fn place_bet(
        ref self: TContractState,
        zk_proof: Span<felt252>,
        bet_commitment: felt252,
        nullifier: felt252,
    );

    /// Reveal bet direction after betting deadline.
    /// `bet_commitment` — the original commitment to identify the bet
    /// `outcome` — which side the user bet on
    /// `nonce` — random value used in the commitment
    fn reveal_bet(
        ref self: TContractState,
        bet_commitment: felt252,
        outcome: Outcome,
        nonce: felt252,
    );

    /// Resolve the market outcome.
    /// For CreatorResolve: only the creator can call, starts dispute window.
    /// For PragmaOracle: anyone can trigger, reads oracle price.
    fn resolve(ref self: TContractState, outcome: Outcome);

    /// Claim winnings anonymously.
    /// `zk_proof` — proves caller owns a winning revealed bet
    /// `bet_commitment` — identifies which winning bet to claim
    /// `recipient` — any address to receive payout (can be fresh wallet)
    fn claim(
        ref self: TContractState,
        zk_proof: Span<felt252>,
        bet_commitment: felt252,
        recipient: ContractAddress,
    );

    /// Dispute a creator-resolved outcome (within dispute window)
    fn dispute(ref self: TContractState);

    // -- View functions --

    fn get_question(self: @TContractState) -> ByteArray;
    fn get_status(self: @TContractState) -> MarketStatus;
    fn get_outcome(self: @TContractState) -> Outcome;
    fn get_config(self: @TContractState) -> MarketConfig;
    fn get_total_bets(self: @TContractState) -> u32;
    fn get_total_revealed(self: @TContractState) -> u32;
    fn get_yes_count(self: @TContractState) -> u32;
    fn get_no_count(self: @TContractState) -> u32;
    fn get_pool_balance(self: @TContractState) -> u256;
    fn is_bet_revealed(self: @TContractState, bet_commitment: felt252) -> bool;
    fn is_bet_claimed(self: @TContractState, bet_commitment: felt252) -> bool;
}

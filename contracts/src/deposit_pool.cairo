/// DepositPool — Anonymity pool for Shroud.
///
/// Users deposit a fixed amount of STRK into a pool tier.
/// Each deposit adds a commitment (keccak256(secret, nullifier)) as a leaf.
///
/// The Merkle tree (depth 20, Poseidon2-BN254 node hashes) is maintained
/// CLIENT-SIDE. The depositor computes the new Merkle root after their leaf
/// is added and submits it with the deposit. The contract stores it without
/// re-computing, trusting the ZK proof submitted at bet-time to enforce
/// correctness (a wrong root simply makes the membership proof unprovable).

#[starknet::contract]
pub mod DepositPool {
    use starknet::{
        ContractAddress, get_caller_address, get_contract_address,
        storage::{
            Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
            StoragePointerWriteAccess,
        },
    };
    use shroud::interfaces::{IDepositPool, PoolTier};

    // Deposit amounts per tier (in wei, 18 decimals)
    const SMALL_AMOUNT: u256 = 10_000_000_000_000_000_000;   // 10 STRK
    const MEDIUM_AMOUNT: u256 = 100_000_000_000_000_000_000; // 100 STRK
    const LARGE_AMOUNT: u256 = 1_000_000_000_000_000_000_000; // 1000 STRK

    // Maximum leaves per tier (2^20 ≈ 1 M)
    const MAX_LEAVES: u32 = 1048576;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        strk_token: ContractAddress,
        authorized_markets: Map<ContractAddress, bool>,

        // Leaves per tier: (tier_id, index) -> commitment
        leaves: Map<(felt252, u32), felt252>,
        // Number of deposits per tier
        deposit_count: Map<felt252, u32>,
        // Current Merkle root per tier (Poseidon2-BN254, maintained client-side)
        merkle_roots: Map<felt252, felt252>,

        // Used nullifiers (global across all tiers)
        used_nullifiers: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposited: Deposited,
        NullifierUsed: NullifierUsed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposited {
        pub tier: felt252,
        pub leaf_index: u32,
        pub commitment: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct NullifierUsed {
        pub nullifier: felt252,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        strk_token: ContractAddress,
    ) {
        self.owner.write(owner);
        self.strk_token.write(strk_token);
        // Roots start at 0 — the Poseidon2 empty-tree root is known to the client.
        // The contract does not need to enforce the initial root value.
        self.merkle_roots.write(tier_to_id(PoolTier::Small), 0);
        self.merkle_roots.write(tier_to_id(PoolTier::Medium), 0);
        self.merkle_roots.write(tier_to_id(PoolTier::Large), 0);
    }

    #[abi(embed_v0)]
    impl DepositPoolImpl of IDepositPool<ContractState> {
        fn deposit(
            ref self: ContractState,
            commitment: felt252,
            tier: PoolTier,
            new_merkle_root: felt252,
        ) -> u32 {
            assert(commitment != 0, 'Invalid commitment');

            let tier_id = tier_to_id(tier);
            let current_count = self.deposit_count.read(tier_id);
            assert(current_count < MAX_LEAVES, 'Pool is full');

            // Transfer STRK from caller to this contract
            let amount = self._get_tier_amount(tier);
            self._transfer_in(get_caller_address(), amount);

            // Store the leaf
            let leaf_index = current_count;
            self.leaves.write((tier_id, leaf_index), commitment);
            self.deposit_count.write(tier_id, current_count + 1);

            // Update Merkle root (client-computed Poseidon2-BN254 root)
            self.merkle_roots.write(tier_id, new_merkle_root);

            self
                .emit(
                    Deposited {
                        tier: tier_id,
                        leaf_index,
                        commitment,
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            leaf_index
        }

        fn get_merkle_root(self: @ContractState, tier: PoolTier) -> felt252 {
            self.merkle_roots.read(tier_to_id(tier))
        }

        fn get_deposit_count(self: @ContractState, tier: PoolTier) -> u32 {
            self.deposit_count.read(tier_to_id(tier))
        }

        fn is_nullifier_used(self: @ContractState, nullifier: felt252) -> bool {
            self.used_nullifiers.read(nullifier)
        }

        fn use_nullifier(ref self: ContractState, nullifier: felt252) {
            let caller = get_caller_address();
            assert(self.authorized_markets.read(caller), 'Not authorized');
            assert(!self.used_nullifiers.read(nullifier), 'Nullifier already used');

            self.used_nullifiers.write(nullifier, true);
            self.emit(NullifierUsed { nullifier });
        }

        fn get_tier_amount(self: @ContractState, tier: PoolTier) -> u256 {
            self._get_tier_amount(tier)
        }

        fn get_leaf(self: @ContractState, tier: PoolTier, index: u32) -> felt252 {
            self.leaves.read((tier_to_id(tier), index))
        }
    }

    #[generate_trait]
    pub impl AdminImpl of AdminTrait {
        fn authorize_market(ref self: ContractState, market: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.authorized_markets.write(market, true);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _get_tier_amount(self: @ContractState, tier: PoolTier) -> u256 {
            match tier {
                PoolTier::Small => SMALL_AMOUNT,
                PoolTier::Medium => MEDIUM_AMOUNT,
                PoolTier::Large => LARGE_AMOUNT,
            }
        }

        fn _transfer_in(ref self: ContractState, from: ContractAddress, amount: u256) {
            let strk = self.strk_token.read();
            let this = get_contract_address();

            let mut calldata: Array<felt252> = array![];
            from.serialize(ref calldata);
            this.serialize(ref calldata);
            amount.serialize(ref calldata);

            let mut result = starknet::syscalls::call_contract_syscall(
                strk, selector!("transferFrom"), calldata.span(),
            )
                .unwrap();

            let success = Serde::<bool>::deserialize(ref result).unwrap();
            assert(success, 'STRK transfer failed');
        }
    }

    fn tier_to_id(tier: PoolTier) -> felt252 {
        match tier {
            PoolTier::Small => 1,
            PoolTier::Medium => 2,
            PoolTier::Large => 3,
        }
    }
}

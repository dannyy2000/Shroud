/// DepositPool — Anonymity pool with Merkle tree for Shroud.
///
/// Users deposit a fixed amount of STRK into a pool tier.
/// Each deposit adds a commitment (hash of secret + nullifier) to a Merkle tree.
/// Later, users prove membership in the tree via ZK proofs without
/// revealing which deposit is theirs.

#[starknet::contract]
pub mod DepositPool {
    use core::poseidon::PoseidonTrait;
    use core::hash::HashStateTrait;
    use starknet::{
        ContractAddress, get_caller_address, get_contract_address,
        storage::{
            Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
            StoragePointerWriteAccess,
        },
    };
    use shroud::interfaces::{IDepositPool, PoolTier};

    // Merkle tree depth — supports 2^20 = ~1M deposits per tier
    const TREE_DEPTH: u32 = 20;

    // Deposit amounts per tier (in wei, 18 decimals)
    // 10 STRK = 10 * 10^18
    const SMALL_AMOUNT: u256 = 10_000_000_000_000_000_000;
    // 100 STRK = 100 * 10^18
    const MEDIUM_AMOUNT: u256 = 100_000_000_000_000_000_000;
    // 1000 STRK = 1000 * 10^18
    const LARGE_AMOUNT: u256 = 1_000_000_000_000_000_000_000;

    #[storage]
    struct Storage {
        // Owner of the contract
        owner: ContractAddress,
        // STRK token address
        strk_token: ContractAddress,
        // Authorized market contracts that can use nullifiers
        authorized_markets: Map<ContractAddress, bool>,

        // Merkle tree leaves per tier: (tier_id, index) -> commitment
        leaves: Map<(felt252, u32), felt252>,
        // Number of deposits per tier
        deposit_count: Map<felt252, u32>,
        // Merkle tree nodes per tier: (tier_id, level, index) -> hash
        tree_nodes: Map<(felt252, u32, u32), felt252>,
        // Current Merkle root per tier
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

        // Initialize Merkle roots with empty tree root for each tier
        let empty_root = self._compute_empty_root();
        self.merkle_roots.write(tier_to_id(PoolTier::Small), empty_root);
        self.merkle_roots.write(tier_to_id(PoolTier::Medium), empty_root);
        self.merkle_roots.write(tier_to_id(PoolTier::Large), empty_root);
    }

    #[abi(embed_v0)]
    impl DepositPoolImpl of IDepositPool<ContractState> {
        fn deposit(ref self: ContractState, commitment: felt252, tier: PoolTier) -> u32 {
            // Validate commitment is non-zero
            assert(commitment != 0, 'Invalid commitment');

            let tier_id = tier_to_id(tier);
            let current_count = self.deposit_count.read(tier_id);

            // Check tree capacity
            let max_leaves: u32 = pow2(TREE_DEPTH);
            assert(current_count < max_leaves, 'Pool is full');

            // Transfer STRK from caller to this contract
            let amount = self._get_tier_amount(tier);
            self._transfer_in(get_caller_address(), amount);

            // Store the leaf
            let leaf_index = current_count;
            self.leaves.write((tier_id, leaf_index), commitment);

            // Update the Merkle tree
            self._insert_leaf(tier_id, leaf_index, commitment);

            // Increment deposit count
            self.deposit_count.write(tier_id, current_count + 1);

            // Emit event (no wallet info beyond "someone deposited")
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
            // Only authorized market contracts can mark nullifiers
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

    // -- Admin functions --
    #[generate_trait]
    pub impl AdminImpl of AdminTrait {
        /// Authorize a market contract to use nullifiers
        fn authorize_market(ref self: ContractState, market: ContractAddress) {
            assert(get_caller_address() == self.owner.read(), 'Only owner');
            self.authorized_markets.write(market, true);
        }
    }

    // -- Internal functions --
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Get deposit amount for a tier
        fn _get_tier_amount(self: @ContractState, tier: PoolTier) -> u256 {
            match tier {
                PoolTier::Small => SMALL_AMOUNT,
                PoolTier::Medium => MEDIUM_AMOUNT,
                PoolTier::Large => LARGE_AMOUNT,
            }
        }

        /// Transfer STRK tokens from user to this contract
        fn _transfer_in(ref self: ContractState, from: ContractAddress, amount: u256) {
            let strk = self.strk_token.read();
            let this = get_contract_address();

            // Call ERC20 transferFrom
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

        /// Insert a leaf into the Merkle tree and update all intermediate nodes
        fn _insert_leaf(ref self: ContractState, tier_id: felt252, index: u32, leaf: felt252) {
            // Store the leaf at level 0
            self.tree_nodes.write((tier_id, 0, index), leaf);

            // Update path from leaf to root
            let mut current_index = index;
            let mut current_hash = leaf;
            let mut level: u32 = 0;

            while level < TREE_DEPTH {
                let (left, right) = if current_index % 2 == 0 {
                    // Current node is left child
                    let sibling = self.tree_nodes.read((tier_id, level, current_index + 1));
                    (current_hash, sibling)
                } else {
                    // Current node is right child
                    let sibling = self.tree_nodes.read((tier_id, level, current_index - 1));
                    (sibling, current_hash)
                };

                // Hash the pair to get parent
                current_hash = hash_pair(left, right);
                current_index = current_index / 2;
                level += 1;

                // Store the intermediate node
                self.tree_nodes.write((tier_id, level, current_index), current_hash);
            };

            // The final current_hash is the new root
            self.merkle_roots.write(tier_id, current_hash);
        }

        /// Compute the root of an empty Merkle tree
        fn _compute_empty_root(self: @ContractState) -> felt252 {
            let mut current = 0; // Empty leaf = 0
            let mut level: u32 = 0;
            while level < TREE_DEPTH {
                current = hash_pair(current, current);
                level += 1;
            };
            current
        }
    }

    // -- Pure helper functions --
    fn hash_pair(left: felt252, right: felt252) -> felt252 {
        PoseidonTrait::new().update(left).update(right).finalize()
    }

    fn tier_to_id(tier: PoolTier) -> felt252 {
        match tier {
            PoolTier::Small => 1,
            PoolTier::Medium => 2,
            PoolTier::Large => 3,
        }
    }

    fn pow2(exp: u32) -> u32 {
        let mut result: u32 = 1;
        let mut i: u32 = 0;
        while i < exp {
            result = result * 2;
            i += 1;
        };
        result
    }
}

/// MarketFactory — Creates and indexes Shroud prediction markets.
///
/// Each market is a separate contract instance deployed via deploy_syscall.
/// The Market class hash must be declared on-chain before calling create_market.

#[starknet::contract]
pub mod MarketFactory {
    use starknet::{
        ContractAddress, ClassHash, get_caller_address, get_block_timestamp, get_contract_address,
        storage::{
            Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
            StoragePointerWriteAccess,
        },
        syscalls::deploy_syscall,
    };
    use shroud::interfaces::{IMarketFactory, ResolutionSource, PoolTier, MarketConfig};

    const DISPUTE_WINDOW: u64 = 172800; // 48 hours

    /// Stored market metadata
    #[derive(Drop, Copy, Serde, starknet::Store)]
    struct MarketInfo {
        market_address: ContractAddress,
        creator: ContractAddress,
        pool_tier: PoolTier,
        created_at: u64,
        creator_stake: u256,
    }

    #[storage]
    struct Storage {
        owner: ContractAddress,
        deposit_pool: ContractAddress,
        strk_token: ContractAddress,
        market_class_hash: felt252,
        membership_verifier: ContractAddress,
        claim_verifier: ContractAddress,
        pragma_oracle: ContractAddress,
        protocol_fee_recipient: ContractAddress,
        market_count: u64,
        markets: Map<u64, MarketInfo>,
        // Store questions separately (ByteArray can't be in struct with starknet::Store)
        market_questions: Map<u64, ByteArray>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MarketCreated: MarketCreated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MarketCreated {
        pub market_id: u64,
        pub market_address: ContractAddress,
        pub creator: ContractAddress,
        pub question: ByteArray,
        pub bet_deadline: u64,
        pub reveal_deadline: u64,
        pub pool_tier: PoolTier,
        pub resolution_source: ResolutionSource,
        pub creator_stake: u256,
        pub min_bets: u32,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        deposit_pool: ContractAddress,
        strk_token: ContractAddress,
        market_class_hash: felt252,
        membership_verifier: ContractAddress,
        claim_verifier: ContractAddress,
        pragma_oracle: ContractAddress,
        protocol_fee_recipient: ContractAddress,
    ) {
        self.owner.write(owner);
        self.deposit_pool.write(deposit_pool);
        self.strk_token.write(strk_token);
        self.market_class_hash.write(market_class_hash);
        self.membership_verifier.write(membership_verifier);
        self.claim_verifier.write(claim_verifier);
        self.pragma_oracle.write(pragma_oracle);
        self.protocol_fee_recipient.write(protocol_fee_recipient);
        self.market_count.write(0);
    }

    #[abi(embed_v0)]
    impl MarketFactoryImpl of IMarketFactory<ContractState> {
        fn create_market(
            ref self: ContractState,
            question: ByteArray,
            bet_deadline: u64,
            reveal_deadline: u64,
            resolution_source: ResolutionSource,
            pool_tier: PoolTier,
            pragma_pair_id: felt252,
            target_price: u256,
            creator_stake: u256,
            min_bets: u32,
        ) -> u64 {
            let caller = get_caller_address();
            let now = get_block_timestamp();

            // Validate deadlines
            assert(bet_deadline > now, 'Bet deadline must be in future');
            assert(reveal_deadline > bet_deadline, 'Reveal after bet deadline');

            // Validate oracle config
            if resolution_source == ResolutionSource::PragmaOracle {
                assert(pragma_pair_id != 0, 'Oracle pair ID required');
            }

            // Escrow creator's STRK bond if provided
            if creator_stake > 0 {
                self._transfer_in(caller, creator_stake);
            }

            let market_id = self.market_count.read();
            let dispute_deadline = reveal_deadline + DISPUTE_WINDOW;

            let config = MarketConfig {
                creator: caller,
                bet_deadline,
                reveal_deadline,
                dispute_deadline,
                resolution_source,
                pool_tier,
                pragma_pair_id,
                target_price,
                creator_stake,
                min_bets,
            };

            // Serialize Market constructor calldata:
            // (config, question, deposit_pool, membership_verifier, claim_verifier,
            //  market_id, strk_token, protocol_fee_recipient, pragma_oracle)
            let mut calldata: Array<felt252> = array![];
            config.serialize(ref calldata);
            question.serialize(ref calldata);
            self.deposit_pool.read().serialize(ref calldata);
            self.membership_verifier.read().serialize(ref calldata);
            self.claim_verifier.read().serialize(ref calldata);
            let market_id_felt: felt252 = market_id.into();
            market_id_felt.serialize(ref calldata);
            self.strk_token.read().serialize(ref calldata);
            self.protocol_fee_recipient.read().serialize(ref calldata);
            self.pragma_oracle.read().serialize(ref calldata);

            // Deploy the Market contract
            let class_hash: ClassHash = self.market_class_hash.read().try_into().unwrap();
            let (market_address, _) = deploy_syscall(
                class_hash, market_id_felt, calldata.span(), false,
            )
                .unwrap();

            let market_info = MarketInfo {
                market_address,
                creator: caller,
                pool_tier,
                created_at: now,
                creator_stake,
            };

            self.markets.write(market_id, market_info);
            self.market_questions.write(market_id, question.clone());
            self.market_count.write(market_id + 1);

            self
                .emit(
                    MarketCreated {
                        market_id,
                        market_address,
                        creator: caller,
                        question,
                        bet_deadline,
                        reveal_deadline,
                        pool_tier,
                        resolution_source,
                        creator_stake,
                        min_bets,
                    },
                );

            market_id
        }

        fn get_market_count(self: @ContractState) -> u64 {
            self.market_count.read()
        }

        fn get_market_address(self: @ContractState, market_id: u64) -> ContractAddress {
            assert(market_id < self.market_count.read(), 'Market does not exist');
            self.markets.read(market_id).market_address
        }

        fn get_deposit_pool(self: @ContractState) -> ContractAddress {
            self.deposit_pool.read()
        }
    }

    // -- Internal functions --
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Transfer STRK tokens from user to this contract (for creator bond)
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

    // -- View helpers --
    #[generate_trait]
    pub impl ViewImpl of ViewTrait {
        fn get_market_info(self: @ContractState, market_id: u64) -> MarketInfo {
            assert(market_id < self.market_count.read(), 'Market does not exist');
            self.markets.read(market_id)
        }

        fn get_market_question(self: @ContractState, market_id: u64) -> ByteArray {
            assert(market_id < self.market_count.read(), 'Market does not exist');
            self.market_questions.read(market_id)
        }
    }
}


/// Market — Core prediction market logic for Shroud.
///
/// Handles the full lifecycle:
/// 1. Anonymous bet placement (via ZK proof of pool membership)
/// 2. Bet reveal (commit-reveal after deadline)
/// 3. Market resolution (Pragma oracle or creator)
/// 4. Anonymous claiming (ZK proof of winning bet)

#[starknet::contract]
pub mod Market {
    use starknet::{
        ContractAddress, get_caller_address, get_block_timestamp, get_contract_address,
        storage::{
            Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
            StoragePointerWriteAccess,
        },
    };
    use shroud::interfaces::{
        IMarket, IDepositPoolDispatcher, IDepositPoolDispatcherTrait,
        IUltraKeccakZKHonkVerifierDispatcher, IUltraKeccakZKHonkVerifierDispatcherTrait,
        IPragmaOracleDispatcher, IPragmaOracleDispatcherTrait,
        MarketStatus, MarketConfig, Outcome, ResolutionSource, PoolTier, Bet,
    };

    // Dispute window: 48 hours after creator resolution
    const DISPUTE_WINDOW: u64 = 172800;

    // Protocol fee: 2% (represented as 200 basis points)
    const PROTOCOL_FEE_BPS: u256 = 200;
    const BPS_DENOMINATOR: u256 = 10000;

    // Pragma data type for spot price
    const PRAGMA_SPOT_ENTRY: felt252 = 'SPOT';

    #[storage]
    struct Storage {
        // Market configuration
        config: MarketConfig,
        question: ByteArray,
        status: MarketStatus,
        resolved_outcome: Outcome,

        // Deposit pool reference
        deposit_pool: ContractAddress,

        // Garaga verifier contract addresses
        membership_verifier: ContractAddress,
        claim_verifier: ContractAddress,

        // Market ID (needed for public input validation)
        market_id: felt252,

        // Bets storage: commitment -> Bet
        bets: Map<felt252, Bet>,
        bet_exists: Map<felt252, bool>,
        total_bets: u32,
        total_revealed: u32,

        // Counts after reveal phase
        yes_count: u32,
        no_count: u32,

        // Track forfeited (unrevealed) bets for redistribution
        forfeited_count: u32,

        // STRK token address
        strk_token: ContractAddress,

        // Protocol fee recipient
        protocol_fee_recipient: ContractAddress,

        // Pragma oracle address
        pragma_oracle: ContractAddress,

        // Creator stake tracking
        creator_stake_returned: bool,

        // Track refunded bets on cancelled markets
        bet_refunded: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        BetPlaced: BetPlaced,
        BetRevealed: BetRevealed,
        MarketResolved: MarketResolved,
        WinningsClaimed: WinningsClaimed,
        MarketDisputed: MarketDisputed,
        CreatorStakeReturned: CreatorStakeReturned,
        CreatorStakeSlashed: CreatorStakeSlashed,
        MarketCancelled: MarketCancelled,
        RefundClaimed: RefundClaimed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BetPlaced {
        pub bet_commitment: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BetRevealed {
        pub bet_commitment: felt252,
        pub outcome: Outcome,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MarketResolved {
        pub outcome: Outcome,
        pub resolution_source: ResolutionSource,
    }

    #[derive(Drop, starknet::Event)]
    pub struct WinningsClaimed {
        pub bet_commitment: felt252,
        pub recipient: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MarketDisputed {
        pub disputed_by: ContractAddress,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CreatorStakeReturned {
        pub creator: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CreatorStakeSlashed {
        pub creator: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MarketCancelled {
        pub total_bets: u32,
        pub min_bets_required: u32,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RefundClaimed {
        pub bet_commitment: felt252,
        pub recipient: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        config: MarketConfig,
        question: ByteArray,
        deposit_pool: ContractAddress,
        membership_verifier: ContractAddress,
        claim_verifier: ContractAddress,
        market_id: felt252,
        strk_token: ContractAddress,
        protocol_fee_recipient: ContractAddress,
        pragma_oracle: ContractAddress,
    ) {
        self.config.write(config);
        self.question.write(question);
        self.status.write(MarketStatus::Open);
        self.resolved_outcome.write(Outcome::Pending);
        self.deposit_pool.write(deposit_pool);
        self.membership_verifier.write(membership_verifier);
        self.claim_verifier.write(claim_verifier);
        self.market_id.write(market_id);
        self.strk_token.write(strk_token);
        self.protocol_fee_recipient.write(protocol_fee_recipient);
        self.pragma_oracle.write(pragma_oracle);
        self.creator_stake_returned.write(false);
        self.total_bets.write(0);
        self.total_revealed.write(0);
        self.yes_count.write(0);
        self.no_count.write(0);
        self.forfeited_count.write(0);
    }

    #[abi(embed_v0)]
    impl MarketImpl of IMarket<ContractState> {
        fn place_bet(
            ref self: ContractState,
            zk_proof: Span<felt252>,
            bet_commitment: felt252,
            nullifier: felt252,
        ) {
            // Check market is open
            self._update_status();
            assert(self.status.read() == MarketStatus::Open, 'Market not accepting bets');

            // Validate bet commitment is unique
            assert(!self.bet_exists.read(bet_commitment), 'Duplicate bet commitment');

            // Verify ZK proof: caller is a valid pool depositor
            // The proof proves:
            //   1. Prover knows a secret whose commitment is in the Merkle tree
            //   2. The nullifier is correctly derived from the secret
            //   3. The Merkle root matches the current pool state
            self._verify_membership_proof(zk_proof, bet_commitment, nullifier);

            // Fund the market and prevent double-spending.
            if zk_proof.len() > 0 {
                // Full ZK mode: mark nullifier used in pool (pool holds the STRK).
                // NOTE: full anonymity requires the DepositPool to also transfer the
                // tier amount here — tracked as a future improvement once ZK is live.
                let pool = IDepositPoolDispatcher {
                    contract_address: self.deposit_pool.read(),
                };
                pool.use_nullifier(nullifier);
            } else {
                // Bypass mode (dev / no ZK proof): pull STRK directly from the caller.
                // This links the caller to the bet commitment, but is acceptable for
                // testing. Caller must have approved this contract for the tier amount.
                let config = self.config.read();
                let tier_amount: u256 = match config.pool_tier {
                    PoolTier::Small => 10_000_000_000_000_000_000_u256,
                    PoolTier::Medium => 100_000_000_000_000_000_000_u256,
                    PoolTier::Large => 1_000_000_000_000_000_000_000_u256,
                };
                self._transfer_in_from(starknet::get_caller_address(), tier_amount);
            }

            // Store the bet
            let bet = Bet {
                commitment: bet_commitment,
                revealed: false,
                outcome: Outcome::Pending,
                claimed: false,
            };
            self.bets.write(bet_commitment, bet);
            self.bet_exists.write(bet_commitment, true);
            self.total_bets.write(self.total_bets.read() + 1);

            self
                .emit(
                    BetPlaced { bet_commitment, timestamp: get_block_timestamp() },
                );
        }

        fn reveal_bet(
            ref self: ContractState,
            bet_commitment: felt252,
            outcome: Outcome,
            nonce: felt252,
        ) {
            // Check we're in the reveal phase
            self._update_status();
            assert(self.status.read() == MarketStatus::Revealing, 'Not in reveal phase');

            // Validate the bet exists and hasn't been revealed
            assert(self.bet_exists.read(bet_commitment), 'Bet does not exist');
            let mut bet = self.bets.read(bet_commitment);
            assert(!bet.revealed, 'Already revealed');

            // Validate outcome is not Pending
            assert(outcome != Outcome::Pending, 'Invalid outcome');

            // Verify the reveal matches the commitment
            // commitment = keccak256(outcome || nonce) as 248-bit field
            let outcome_felt = outcome_to_felt(outcome);
            let expected_commitment = hash_pair(outcome_felt, nonce);
            assert(expected_commitment == bet_commitment, 'Reveal mismatch');

            // Update the bet
            bet.revealed = true;
            bet.outcome = outcome;
            self.bets.write(bet_commitment, bet);
            self.total_revealed.write(self.total_revealed.read() + 1);

            // Update outcome counts
            match outcome {
                Outcome::Yes => self.yes_count.write(self.yes_count.read() + 1),
                Outcome::No => self.no_count.write(self.no_count.read() + 1),
                Outcome::Pending => {},
            };

            self.emit(BetRevealed { bet_commitment, outcome });
        }

        fn resolve(ref self: ContractState, outcome: Outcome) {
            self._update_status();
            let status = self.status.read();
            let config = self.config.read();

            // Block resolution on cancelled markets
            assert(status != MarketStatus::Cancelled, 'Market is cancelled');

            match config.resolution_source {
                ResolutionSource::CreatorResolve => {
                    // Only creator can resolve
                    assert(get_caller_address() == config.creator, 'Only creator can resolve');
                    assert(
                        status == MarketStatus::Resolving,
                        'Not ready for resolution',
                    );
                    assert(outcome != Outcome::Pending, 'Invalid outcome');

                    self.resolved_outcome.write(outcome);

                    // Calculate forfeited bets (unrevealed)
                    let forfeited = self.total_bets.read() - self.total_revealed.read();
                    self.forfeited_count.write(forfeited);

                    self.status.write(MarketStatus::Resolved);
                    self
                        .emit(
                            MarketResolved {
                                outcome, resolution_source: ResolutionSource::CreatorResolve,
                            },
                        );
                },
                ResolutionSource::PragmaOracle => {
                    assert(
                        status == MarketStatus::Resolving,
                        'Not ready for resolution',
                    );

                    // Fetch price from Pragma oracle
                    let oracle = IPragmaOracleDispatcher {
                        contract_address: self.pragma_oracle.read(),
                    };
                    let (price, decimals, _last_updated, _num_sources) = oracle
                        .get_data(PRAGMA_SPOT_ENTRY, config.pragma_pair_id);

                    // Normalize oracle price to 18 decimals for comparison with target_price
                    let oracle_price_normalized = if decimals < 18 {
                        let scale_factor = pow10((18 - decimals));
                        price * scale_factor
                    } else if decimals > 18 {
                        let scale_factor = pow10((decimals - 18));
                        price / scale_factor
                    } else {
                        price
                    };

                    // Determine outcome: Yes if price >= target, No otherwise
                    let resolved_outcome = if oracle_price_normalized >= config.target_price {
                        Outcome::Yes
                    } else {
                        Outcome::No
                    };

                    self.resolved_outcome.write(resolved_outcome);

                    let forfeited = self.total_bets.read() - self.total_revealed.read();
                    self.forfeited_count.write(forfeited);

                    // No dispute window for oracle-resolved markets
                    self.status.write(MarketStatus::Resolved);
                    self
                        .emit(
                            MarketResolved {
                                outcome: resolved_outcome,
                                resolution_source: ResolutionSource::PragmaOracle,
                            },
                        );
                },
            }
        }

        fn claim(
            ref self: ContractState,
            zk_proof: Span<felt252>,
            bet_commitment: felt252,
            recipient: ContractAddress,
        ) {
            // Check market is resolved
            assert(self.status.read() == MarketStatus::Resolved, 'Market not resolved');

            // Validate the bet exists, is revealed, and hasn't been claimed
            assert(self.bet_exists.read(bet_commitment), 'Bet does not exist');
            let mut bet = self.bets.read(bet_commitment);
            assert(bet.revealed, 'Bet not revealed');
            assert(!bet.claimed, 'Already claimed');

            // Check the bet is a winner
            let resolved = self.resolved_outcome.read();
            assert(bet.outcome == resolved, 'Bet did not win');

            // Verify ZK proof: caller owns this winning bet
            // In full implementation, this proves knowledge of the nonce
            // without linking to any identity
            self._verify_claim_proof(zk_proof, bet_commitment);

            // Mark as claimed
            bet.claimed = true;
            self.bets.write(bet_commitment, bet);

            // Calculate payout (after 2% protocol fee)
            let (payout, fee) = self._calculate_payout();

            // Transfer protocol fee to fee recipient (skip if zero address — dev mode)
            let fee_recipient = self.protocol_fee_recipient.read();
            if fee > 0 && !fee_recipient.is_zero() {
                self._transfer_out(fee_recipient, fee);
            }

            // Transfer winnings to recipient (any address — can be fresh wallet)
            // If fee_recipient is zero, include the fee so no STRK is stranded
            let actual_payout = if fee_recipient.is_zero() { payout + fee } else { payout };
            self._transfer_out(recipient, actual_payout);

            self.emit(WinningsClaimed { bet_commitment, recipient });
        }

        fn dispute(ref self: ContractState) {
            let config = self.config.read();
            assert(
                config.resolution_source == ResolutionSource::CreatorResolve,
                'Only creator-resolved markets',
            );
            assert(self.status.read() == MarketStatus::Resolved, 'Market not resolved');

            let now = get_block_timestamp();
            assert(now <= config.dispute_deadline, 'Dispute window closed');

            self.status.write(MarketStatus::Disputed);
            self.emit(MarketDisputed { disputed_by: get_caller_address(), timestamp: now });

            // Slash creator's stake — transfer to protocol treasury
            if config.creator_stake > 0 && !self.creator_stake_returned.read() {
                self.creator_stake_returned.write(true);
                self._transfer_out(self.protocol_fee_recipient.read(), config.creator_stake);
                self
                    .emit(
                        CreatorStakeSlashed {
                            creator: config.creator, amount: config.creator_stake,
                        },
                    );
            }
        }

        fn claim_refund(
            ref self: ContractState,
            zk_proof: Span<felt252>,
            bet_commitment: felt252,
            recipient: ContractAddress,
        ) {
            // Only available on cancelled markets
            assert(self.status.read() == MarketStatus::Cancelled, 'Market not cancelled');

            // Validate the bet exists and hasn't been refunded
            assert(self.bet_exists.read(bet_commitment), 'Bet does not exist');
            assert(!self.bet_refunded.read(bet_commitment), 'Already refunded');

            // Verify ZK proof of bet ownership (same pattern as claim)
            self._verify_claim_proof(zk_proof, bet_commitment);

            // Mark as refunded
            self.bet_refunded.write(bet_commitment, true);

            // Refund the tier amount
            let config = self.config.read();
            let tier_amount = match config.pool_tier {
                PoolTier::Small => 10_000_000_000_000_000_000_u256,
                PoolTier::Medium => 100_000_000_000_000_000_000_u256,
                PoolTier::Large => 1_000_000_000_000_000_000_000_u256,
            };
            self._transfer_out(recipient, tier_amount);

            self.emit(RefundClaimed { bet_commitment, recipient });
        }

        fn claim_creator_stake(ref self: ContractState) {
            let config = self.config.read();
            assert(config.creator_stake > 0, 'No stake to claim');
            assert(!self.creator_stake_returned.read(), 'Stake already returned');

            let caller = get_caller_address();
            assert(caller == config.creator, 'Only creator can claim stake');

            let status = self.status.read();

            // Creator can reclaim bond after dispute window closes on a non-disputed market
            // For oracle-resolved markets, claimable immediately after resolution
            match config.resolution_source {
                ResolutionSource::CreatorResolve => {
                    assert(status == MarketStatus::Resolved, 'Market not resolved');
                    let now = get_block_timestamp();
                    assert(now > config.dispute_deadline, 'Dispute window still open');
                },
                ResolutionSource::PragmaOracle => {
                    assert(status == MarketStatus::Resolved, 'Market not resolved');
                },
            }

            self.creator_stake_returned.write(true);
            self._transfer_out(config.creator, config.creator_stake);
            self
                .emit(
                    CreatorStakeReturned { creator: config.creator, amount: config.creator_stake },
                );
        }

        // -- View functions --

        fn get_question(self: @ContractState) -> ByteArray {
            self.question.read()
        }

        fn get_status(self: @ContractState) -> MarketStatus {
            self.status.read()
        }

        fn get_outcome(self: @ContractState) -> Outcome {
            self.resolved_outcome.read()
        }

        fn get_config(self: @ContractState) -> MarketConfig {
            self.config.read()
        }

        fn get_total_bets(self: @ContractState) -> u32 {
            self.total_bets.read()
        }

        fn get_total_revealed(self: @ContractState) -> u32 {
            self.total_revealed.read()
        }

        fn get_yes_count(self: @ContractState) -> u32 {
            self.yes_count.read()
        }

        fn get_no_count(self: @ContractState) -> u32 {
            self.no_count.read()
        }

        fn get_pool_balance(self: @ContractState) -> u256 {
            // Read STRK balance of this contract
            let strk = self.strk_token.read();
            let this = get_contract_address();

            let mut calldata: Array<felt252> = array![];
            this.serialize(ref calldata);

            let mut result = starknet::syscalls::call_contract_syscall(
                strk, selector!("balanceOf"), calldata.span(),
            )
                .unwrap();

            Serde::<u256>::deserialize(ref result).unwrap()
        }

        fn is_bet_revealed(self: @ContractState, bet_commitment: felt252) -> bool {
            if !self.bet_exists.read(bet_commitment) {
                return false;
            }
            self.bets.read(bet_commitment).revealed
        }

        fn is_bet_claimed(self: @ContractState, bet_commitment: felt252) -> bool {
            if !self.bet_exists.read(bet_commitment) {
                return false;
            }
            self.bets.read(bet_commitment).claimed
        }

        fn get_protocol_fee_recipient(self: @ContractState) -> ContractAddress {
            self.protocol_fee_recipient.read()
        }
    }

    // -- Internal functions --
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Auto-update market status based on timestamps
        fn _update_status(ref self: ContractState) {
            let config = self.config.read();
            let now = get_block_timestamp();
            let current_status = self.status.read();

            // Only auto-transition forward
            if current_status == MarketStatus::Open && now > config.bet_deadline {
                self.status.write(MarketStatus::Revealing);
            }

            let updated_status = self.status.read();
            if updated_status == MarketStatus::Revealing && now > config.reveal_deadline {
                // Check minimum pool threshold before transitioning to Resolving
                if config.min_bets > 0
                    && self.total_revealed.read() < config.min_bets {
                    self.status.write(MarketStatus::Cancelled);
                    self
                        .emit(
                            MarketCancelled {
                                total_bets: self.total_revealed.read(),
                                min_bets_required: config.min_bets,
                                timestamp: now,
                            },
                        );
                } else {
                    self.status.write(MarketStatus::Resolving);
                }
            }
        }

        /// Verify ZK proof of pool membership for anonymous betting
        fn _verify_membership_proof(
            self: @ContractState,
            zk_proof: Span<felt252>,
            bet_commitment: felt252,
            nullifier: felt252,
        ) {
            // Bypass: if no proof is supplied, skip on-chain verification.
            // Used during development while the Poseidon2 (BN254) vs Starknet
            // Poseidon (Stark252) hash alignment is being resolved.
            if zk_proof.len() == 0 {
                return;
            }

            // Call the Garaga membership verifier contract
            let verifier = IUltraKeccakZKHonkVerifierDispatcher {
                contract_address: self.membership_verifier.read(),
            };

            let result = verifier.verify_ultra_keccak_zk_honk_proof(zk_proof);
            let public_inputs = match result {
                Result::Ok(inputs) => inputs,
                Result::Err(_) => { panic!("Membership proof verification failed"); },
            };

            // Validate public inputs match expected values
            // Circuit public inputs order (from membership_proof/src/main.nr):
            //   [0] merkle_root
            //   [1] nullifier
            //   [2] bet_commitment
            //   [3] market_id
            assert(public_inputs.len() >= 4, 'Invalid public inputs length');

            // Verify merkle root matches current pool state
            let pool = IDepositPoolDispatcher {
                contract_address: self.deposit_pool.read(),
            };
            let config = self.config.read();
            let expected_root: felt252 = pool.get_merkle_root(config.pool_tier);
            let proof_root: felt252 = (*public_inputs.at(0)).try_into().expect('Invalid root');
            assert(proof_root == expected_root, 'Merkle root mismatch');

            // Verify nullifier matches
            let proof_nullifier: felt252 = (*public_inputs.at(1)).try_into().expect('Invalid nullifier');
            assert(proof_nullifier == nullifier, 'Nullifier mismatch');

            // Verify bet commitment matches
            let proof_commitment: felt252 = (*public_inputs.at(2)).try_into().expect('Invalid commitment');
            assert(proof_commitment == bet_commitment, 'Bet commitment mismatch');

            // Verify market ID matches
            let proof_market_id: felt252 = (*public_inputs.at(3)).try_into().expect('Invalid market id');
            assert(proof_market_id == self.market_id.read(), 'Market ID mismatch');
        }

        /// Verify ZK proof of bet ownership for anonymous claiming
        fn _verify_claim_proof(
            self: @ContractState, zk_proof: Span<felt252>, bet_commitment: felt252,
        ) {
            // Bypass: if no proof is supplied, skip on-chain verification.
            if zk_proof.len() == 0 {
                return;
            }

            // Call the Garaga claim verifier contract
            let verifier = IUltraKeccakZKHonkVerifierDispatcher {
                contract_address: self.claim_verifier.read(),
            };

            let result = verifier.verify_ultra_keccak_zk_honk_proof(zk_proof);
            let public_inputs = match result {
                Result::Ok(inputs) => inputs,
                Result::Err(_) => { panic!("Claim proof verification failed"); },
            };

            // Validate public inputs match expected values
            // Circuit public inputs order (from claim_proof/src/main.nr):
            //   [0] bet_commitment
            //   [1] winning_outcome
            //   [2] market_id
            //   [3] nullifier
            assert(public_inputs.len() >= 4, 'Invalid public inputs length');

            // Verify bet commitment matches
            let proof_commitment: felt252 = (*public_inputs.at(0)).try_into().expect('Invalid commitment');
            assert(proof_commitment == bet_commitment, 'Bet commitment mismatch');

            // Verify winning outcome matches the resolved outcome
            let resolved = self.resolved_outcome.read();
            let expected_outcome_felt = outcome_to_felt(resolved);
            let proof_outcome: felt252 = (*public_inputs.at(1)).try_into().expect('Invalid outcome');
            assert(proof_outcome == expected_outcome_felt, 'Outcome mismatch');

            // Verify market ID matches
            let proof_market_id: felt252 = (*public_inputs.at(2)).try_into().expect('Invalid market id');
            assert(proof_market_id == self.market_id.read(), 'Market ID mismatch');
        }

        /// Calculate payout per winning bet (returns (winner_payout, protocol_fee))
        fn _calculate_payout(self: @ContractState) -> (u256, u256) {
            let config = self.config.read();
            let tier_amount = match config.pool_tier {
                PoolTier::Small => 10_000_000_000_000_000_000_u256,   // 10 STRK
                PoolTier::Medium => 100_000_000_000_000_000_000_u256, // 100 STRK
                PoolTier::Large => 1_000_000_000_000_000_000_000_u256, // 1000 STRK
            };

            let total_pool = tier_amount * self.total_bets.read().into();
            let resolved = self.resolved_outcome.read();

            let winner_count: u32 = match resolved {
                Outcome::Yes => self.yes_count.read(),
                Outcome::No => self.no_count.read(),
                Outcome::Pending => 0,
            };

            if winner_count == 0 {
                return (0, 0);
            }

            // Total pool (including forfeited bets) split among winners
            let gross_payout_per_winner = total_pool / winner_count.into();

            // Deduct 2% protocol fee
            let fee_per_winner = gross_payout_per_winner * PROTOCOL_FEE_BPS / BPS_DENOMINATOR;
            let net_payout = gross_payout_per_winner - fee_per_winner;

            (net_payout, fee_per_winner)
        }

        /// Transfer STRK tokens from `from` into this contract (requires prior approval)
        fn _transfer_in_from(ref self: ContractState, from: ContractAddress, amount: u256) {
            let strk = self.strk_token.read();

            let mut calldata: Array<felt252> = array![];
            from.serialize(ref calldata);
            starknet::get_contract_address().serialize(ref calldata);
            amount.serialize(ref calldata);

            let mut result = starknet::syscalls::call_contract_syscall(
                strk, selector!("transferFrom"), calldata.span(),
            )
                .unwrap();

            let success = Serde::<bool>::deserialize(ref result).unwrap();
            assert(success, 'STRK transfer failed');
        }

        /// Transfer STRK tokens from this contract to recipient
        fn _transfer_out(ref self: ContractState, to: ContractAddress, amount: u256) {
            let strk = self.strk_token.read();

            let mut calldata: Array<felt252> = array![];
            to.serialize(ref calldata);
            amount.serialize(ref calldata);

            let mut result = starknet::syscalls::call_contract_syscall(
                strk, selector!("transfer"), calldata.span(),
            )
                .unwrap();

            let success = Serde::<bool>::deserialize(ref result).unwrap();
            assert(success, 'STRK transfer failed');
        }
    }

    // -- Pure helpers --

    /// keccak256(left || right) where left and right are 32-byte big-endian field elements.
    /// Result truncated to 248 bits to fit Stark252 prime.
    /// Matches JavaScript: BigInt(ethers.keccak256(pad32(left) + pad32(right))) & ((1n<<248n)-1n)
    ///
    /// Why the byte-reverse: Cairo's keccak returns a LE u256
    ///   (h.low = first 16 output bytes as LE u128, h.high = last 16 bytes as LE u128).
    /// JS BigInt treats the output as big-endian, so we reverse each u128 half.
    fn hash_pair(left: felt252, right: felt252) -> felt252 {
        let left_u256: u256 = left.into();
        let right_u256: u256 = right.into();
        let inputs = array![left_u256, right_u256].span();
        let h: u256 = core::keccak::keccak_u256s_be_inputs(inputs);
        let be: u256 = u256 {
            high: core::integer::u128_byte_reverse(h.low),
            low: core::integer::u128_byte_reverse(h.high),
        };
        // Truncate to 248 bits (drop top byte) -- safe for Stark252 prime
        let truncated: u256 = u256 {
            high: be.high & 0x00ffffffffffffffffffffffffffffff_u128,
            low: be.low,
        };
        truncated.try_into().unwrap()
    }

    fn outcome_to_felt(outcome: Outcome) -> felt252 {
        match outcome {
            Outcome::Pending => 0,
            Outcome::Yes => 1,
            Outcome::No => 2,
        }
    }

    fn pow10(exp: u32) -> u256 {
        let mut result: u256 = 1;
        let mut i: u32 = 0;
        while i < exp {
            result = result * 10;
            i += 1;
        };
        result
    }
}

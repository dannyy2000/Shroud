/// Market — Core prediction market logic for Shroud.
///
/// Handles the full lifecycle:
/// 1. Anonymous bet placement (via ZK proof of pool membership)
/// 2. Bet reveal (commit-reveal after deadline)
/// 3. Market resolution (Pragma oracle or creator)
/// 4. Anonymous claiming (ZK proof of winning bet)

#[starknet::contract]
pub mod Market {
    use core::poseidon::PoseidonTrait;
    use core::hash::{HashStateTrait, HashStateExTrait};
    use starknet::{
        ContractAddress, get_caller_address, get_block_timestamp, get_contract_address,
        storage::{Map, StorageMapReadAccess, StorageMapWriteAccess},
    };
    use shroud::interfaces::{
        IMarket, IDepositPoolDispatcher, IDepositPoolDispatcherTrait, MarketStatus, MarketConfig,
        Outcome, ResolutionSource, PoolTier, Bet,
    };

    // Dispute window: 48 hours after creator resolution
    const DISPUTE_WINDOW: u64 = 172800;

    #[storage]
    struct Storage {
        // Market configuration
        config: MarketConfig,
        question: ByteArray,
        status: MarketStatus,
        resolved_outcome: Outcome,

        // Deposit pool reference
        deposit_pool: ContractAddress,

        // Garaga verifier contract address
        verifier: ContractAddress,

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
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        BetPlaced: BetPlaced,
        BetRevealed: BetRevealed,
        MarketResolved: MarketResolved,
        WinningsClaimed: WinningsClaimed,
        MarketDisputed: MarketDisputed,
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

    #[constructor]
    fn constructor(
        ref self: ContractState,
        config: MarketConfig,
        question: ByteArray,
        deposit_pool: ContractAddress,
        verifier: ContractAddress,
        strk_token: ContractAddress,
    ) {
        self.config.write(config);
        self.question.write(question);
        self.status.write(MarketStatus::Open);
        self.resolved_outcome.write(Outcome::Pending);
        self.deposit_pool.write(deposit_pool);
        self.verifier.write(verifier);
        self.strk_token.write(strk_token);
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

            // Mark nullifier as used in the deposit pool (prevents double-betting)
            let pool = IDepositPoolDispatcher {
                contract_address: self.deposit_pool.read(),
            };
            pool.use_nullifier(nullifier);

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
            // commitment = poseidon_hash(outcome_felt, nonce)
            let outcome_felt = Self::_outcome_to_felt(outcome);
            let expected_commitment = PoseidonTrait::new()
                .update(outcome_felt)
                .update(nonce)
                .finalize();
            assert(expected_commitment == bet_commitment, 'Reveal does not match commitment');

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
            let config = self.config.read();

            match config.resolution_source {
                ResolutionSource::CreatorResolve => {
                    // Only creator can resolve
                    assert(get_caller_address() == config.creator, 'Only creator can resolve');
                    assert(
                        self.status.read() == MarketStatus::Resolving,
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
                    // TODO: Integrate Pragma oracle price feed
                    // For MVP, read price from Pragma and compare to target_price
                    // If price >= target_price → Yes, else → No
                    assert(
                        self.status.read() == MarketStatus::Resolving,
                        'Not ready for resolution',
                    );

                    // Placeholder: In production, this reads from Pragma oracle contract
                    assert(outcome != Outcome::Pending, 'Invalid outcome');
                    self.resolved_outcome.write(outcome);

                    let forfeited = self.total_bets.read() - self.total_revealed.read();
                    self.forfeited_count.write(forfeited);

                    self.status.write(MarketStatus::Resolved);
                    self
                        .emit(
                            MarketResolved {
                                outcome, resolution_source: ResolutionSource::PragmaOracle,
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

            // Calculate payout
            let payout = self._calculate_payout();

            // Transfer winnings to recipient (any address — can be fresh wallet)
            self._transfer_out(recipient, payout);

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
            if current_status == MarketStatus::Revealing && now > config.reveal_deadline {
                self.status.write(MarketStatus::Resolving);
            }
        }

        /// Verify ZK proof of pool membership for anonymous betting
        fn _verify_membership_proof(
            self: @ContractState,
            zk_proof: Span<felt252>,
            bet_commitment: felt252,
            nullifier: felt252,
        ) {
            // In production: call Garaga verifier contract
            // verify_ultra_keccak_zk_honk_proof(proof_with_hints)
            //
            // The proof verifies:
            // - Prover knows (secret, nullifier_secret) such that
            //   commitment = poseidon(secret, nullifier_secret) is in the Merkle tree
            // - nullifier = poseidon(nullifier_secret, market_id)
            // - bet_commitment is included as a public input
            //
            // For hackathon MVP: verify proof length is valid as placeholder
            // TODO: Replace with actual Garaga verifier call
            assert(zk_proof.len() > 0, 'Invalid proof');
        }

        /// Verify ZK proof of bet ownership for anonymous claiming
        fn _verify_claim_proof(
            self: @ContractState, zk_proof: Span<felt252>, bet_commitment: felt252,
        ) {
            // In production: call Garaga verifier contract
            // Proves: caller knows the nonce used in bet_commitment = poseidon(outcome, nonce)
            // without revealing any identity link
            //
            // For hackathon MVP: verify proof length as placeholder
            // TODO: Replace with actual Garaga verifier call
            assert(zk_proof.len() > 0, 'Invalid proof');
        }

        /// Calculate payout per winning bet
        fn _calculate_payout(self: @ContractState) -> u256 {
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
                return 0;
            }

            // Total pool (including forfeited bets) split among winners
            total_pool / winner_count.into()
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
    #[generate_trait]
    pub impl HelpersImpl of HelpersTrait {
        fn _outcome_to_felt(outcome: Outcome) -> felt252 {
            match outcome {
                Outcome::Pending => 0,
                Outcome::Yes => 1,
                Outcome::No => 2,
            }
        }
    }
}

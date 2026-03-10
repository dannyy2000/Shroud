"use client";

import { useState, useEffect } from "react";
import { useAccount } from "@starknet-react/core";
import { CallData } from "starknet";
import toast from "react-hot-toast";
import { loadBetsForMarket } from "~~/components/BetPanel";
import { getMarketAddress, getMarketContract, outcomeEnum } from "~~/lib/contracts";

interface RevealPanelProps {
  marketId: number;
  marketAddress?: string;
}

export const RevealPanel = ({ marketId, marketAddress }: RevealPanelProps) => {
  const { account, status } = useAccount();
  const [savedBets, setSavedBets] = useState<ReturnType<typeof loadBetsForMarket>>([]);
  const [selectedBetIdx, setSelectedBetIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"idle" | "preparing" | "signing" | "confirming">("idle");

  const REVEALED_KEY = `shroud_revealed_${marketId}`;

  // Load revealed set from localStorage so it survives page reloads
  const [revealed, setRevealed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(REVEALED_KEY);
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Persist revealed set whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(REVEALED_KEY, JSON.stringify([...revealed]));
    } catch { }
  }, [revealed, REVEALED_KEY]);

  useEffect(() => {
    const bets = loadBetsForMarket(marketId, marketAddress);
    setSavedBets(bets);

    // Sync revealed status with on-chain data
    const syncOnChain = async () => {
      try {
        const address = await getMarketAddress(marketId);
        const contract = getMarketContract(address);
        const onChainRevealed = new Set<string>();

        // Check each saved bet against the contract
        await Promise.all(
          bets.map(async (bet) => {
            const isRevealed = await contract.is_bet_revealed(bet.betCommitment);
            if (isRevealed) {
              onChainRevealed.add(bet.betCommitment);
            }
          })
        );

        if (onChainRevealed.size > 0) {
          setRevealed((prev) => {
            const next = new Set(prev);
            onChainRevealed.forEach((c) => next.add(c));
            return next;
          });
        }
      } catch (err) {
        console.error("Failed to sync revealed status on-chain:", err);
      }
    };

    if (bets.length > 0) {
      syncOnChain();
    }
  }, [marketId]);

  const unrevealed = savedBets.filter((b) => !revealed.has(b.betCommitment));
  const selectedBet = unrevealed[selectedBetIdx] ?? null;

  const handleReveal = async () => {
    if (!account || status !== "connected") {
      toast.error("Connect your wallet first");
      return;
    }
    if (!selectedBet) {
      toast.error("No bet to reveal");
      return;
    }

    setSubmitting(true);
    setStep("preparing");

    try {
      // Use the address where the bet was actually placed (stored at bet time).
      // Re-fetching from the factory would return the wrong address if the factory
      // was redeployed after the bet was placed.
      const marketAddress = selectedBet.marketAddress || (await getMarketAddress(marketId));

      // reveal_bet(bet_commitment, outcome, nonce)
      // outcome must match what was committed: poseidon(outcome_felt, nonce) == bet_commitment
      setStep("signing");
      const tx = await account.execute([
        {
          contractAddress: marketAddress,
          entrypoint: "reveal_bet",
          calldata: CallData.compile({
            bet_commitment: selectedBet.betCommitment,
            outcome: outcomeEnum(selectedBet.outcome),
            nonce: selectedBet.nonce,
          }),
        },
      ]);

      setStep("confirming");
      toast.loading("Confirming reveal...", { id: "reveal-tx" });

      const { RpcProvider } = await import("starknet");
      const provider = new RpcProvider({
        nodeUrl:
          process.env.NEXT_PUBLIC_SEPOLIA_PROVIDER_URL ||
          "https://starknet-sepolia-rpc.publicnode.com",
      });
      const receipt = await provider.waitForTransaction(tx.transaction_hash);
      toast.dismiss("reveal-tx");

      if ((receipt as any).execution_status === "REVERTED") {
        throw new Error((receipt as any).revert_reason ?? "Transaction reverted");
      }

      setRevealed((prev) => new Set([...prev, selectedBet.betCommitment]));
      setSelectedBetIdx(0);
      toast.success(
        `Bet revealed as ${selectedBet.outcome.toUpperCase()}! You're eligible to claim if you won.`,
      );
      setStep("idle");
    } catch (err: any) {
      toast.dismiss("reveal-tx");
      const msg = err?.message || String(err);
      if (msg.includes("User abort") || msg.includes("rejected")) {
        toast.error("Transaction rejected");
      } else if (msg.includes("Reveal mismatch")) {
        toast.error("Reveal mismatch — commitment doesn't match outcome/nonce");
      } else if (msg.includes("Not in reveal phase")) {
        toast.error(
          "Cannot reveal: the market is not in the reveal phase. The betting window may not have closed yet, or the reveal deadline may have already passed.",
          { duration: 8000 }
        );
      } else {
        toast.error("Reveal failed: " + msg.slice(0, 120));
      }
      console.error(err);
      setStep("idle");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shroud-card p-6 space-y-5">
      <h3 className="text-lg font-semibold" style={{ color: "#e6edf3" }}>
        Reveal Your Bet
      </h3>

      <p className="text-xs" style={{ color: "#8b949e" }}>
        Betting is closed. Reveal your bet direction to be counted toward the outcome and to
        claim winnings if you&apos;re on the winning side.
      </p>

      {unrevealed.length === 0 ? (
        <div
          className="p-4 rounded-lg text-center text-sm"
          style={{ backgroundColor: "#0d1117", border: "1px solid #30363d", color: "#8b949e" }}
        >
          {savedBets.length === 0
            ? "No bets found for this market in your browser."
            : "All your bets have been revealed."}
        </div>
      ) : (
        <>
          {/* Bet selector */}
          {unrevealed.length > 1 && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
                Select bet to reveal ({unrevealed.length} remaining)
              </label>
              <select
                value={selectedBetIdx}
                onChange={(e) => setSelectedBetIdx(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono"
                style={{
                  backgroundColor: "#0d1117",
                  border: "1px solid #30363d",
                  color: "#e6edf3",
                  outline: "none",
                }}
              >
                {unrevealed.map((bet, i) => (
                  <option key={bet.betCommitment} value={i}>
                    {bet.betCommitment.slice(0, 10)}...{bet.betCommitment.slice(-6)} •{" "}
                    {bet.outcome.toUpperCase()} •{" "}
                    {new Date(bet.timestamp).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bet details */}
          {selectedBet && (
            <div
              className="p-3 rounded-lg space-y-2 text-xs"
              style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}
            >
              <div className="flex justify-between">
                <span style={{ color: "#8b949e" }}>Your bet</span>
                <span
                  className="font-bold"
                  style={{ color: selectedBet.outcome === "yes" ? "#3fb950" : "#f85149" }}
                >
                  {selectedBet.outcome.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "#8b949e" }}>Commitment</span>
                <span className="font-mono" style={{ color: "#e6edf3" }}>
                  {selectedBet.betCommitment.slice(0, 10)}...
                  {selectedBet.betCommitment.slice(-6)}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "#8b949e" }}>Date placed</span>
                <span style={{ color: "#e6edf3" }}>
                  {new Date(selectedBet.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          {/* Step indicator */}
          {step !== "idle" && (
            <div className="flex items-center gap-2 text-xs">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: "#58a6ff" }}
              />
              <span style={{ color: "#58a6ff" }}>
                {step === "signing" ? "Sign transaction in wallet..." : "Confirming on-chain..."}
              </span>
            </div>
          )}

          <button
            onClick={handleReveal}
            disabled={!selectedBet || submitting || status !== "connected"}
            className="w-full py-3 rounded-xl font-semibold text-sm shroud-btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? step === "confirming"
                ? "Confirming..."
                : step === "signing"
                  ? "Signing..."
                  : "Preparing..."
              : status !== "connected"
                ? "Connect Wallet"
                : `Reveal ${selectedBet?.outcome.toUpperCase() ?? ""} Bet`}
          </button>
        </>
      )}
    </div>
  );
};

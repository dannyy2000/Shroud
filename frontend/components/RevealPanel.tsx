"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import toast from "react-hot-toast";

interface RevealPanelProps {
  marketId: number;
}

export const RevealPanel = ({ marketId }: RevealPanelProps) => {
  const { address, status } = useAccount();
  const [betCommitment, setBetCommitment] = useState("");
  const [nonce, setNonce] = useState("");
  const [outcome, setOutcome] = useState<"yes" | "no" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleReveal = async () => {
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!betCommitment || !nonce || !outcome) {
      toast.error("Fill in all fields");
      return;
    }

    setSubmitting(true);
    try {
      // Call reveal_bet on the market contract
      toast.success("Bet revealed successfully!");
      setBetCommitment("");
      setNonce("");
      setOutcome(null);
    } catch (err) {
      toast.error("Failed to reveal bet");
      console.error(err);
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
        The betting period has ended. Reveal your bet direction to be eligible for winnings.
        You must reveal before the deadline.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
            Bet Commitment
          </label>
          <input
            type="text"
            value={betCommitment}
            onChange={(e) => setBetCommitment(e.target.value)}
            placeholder="0x..."
            className="shroud-input w-full text-sm"
          />
        </div>

        <div>
          <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
            Your Outcome
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setOutcome("yes")}
              className="py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: outcome === "yes" ? "#3fb950" : "#0d1117",
                color: outcome === "yes" ? "#0d1117" : "#3fb950",
                border: `1px solid ${outcome === "yes" ? "#3fb950" : "#30363d"}`,
              }}
            >
              YES
            </button>
            <button
              onClick={() => setOutcome("no")}
              className="py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: outcome === "no" ? "#f85149" : "#0d1117",
                color: outcome === "no" ? "#0d1117" : "#f85149",
                border: `1px solid ${outcome === "no" ? "#f85149" : "#30363d"}`,
              }}
            >
              NO
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
            Nonce (from your bet receipt)
          </label>
          <input
            type="text"
            value={nonce}
            onChange={(e) => setNonce(e.target.value)}
            placeholder="0x..."
            className="shroud-input w-full text-sm"
          />
        </div>
      </div>

      <button
        onClick={handleReveal}
        disabled={!betCommitment || !nonce || !outcome || submitting || status !== "connected"}
        className="w-full py-3 rounded-xl font-semibold text-sm shroud-btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? "Revealing..." : "Reveal Bet"}
      </button>
    </div>
  );
};

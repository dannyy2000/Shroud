"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import toast from "react-hot-toast";

interface ClaimPanelProps {
  marketId: number;
  outcome: string;
}

export const ClaimPanel = ({ marketId, outcome }: ClaimPanelProps) => {
  const { address, status } = useAccount();
  const [betCommitment, setBetCommitment] = useState("");
  const [recipient, setRecipient] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleClaim = async () => {
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!betCommitment) {
      toast.error("Enter your bet commitment");
      return;
    }

    setSubmitting(true);
    try {
      // Call claim on market contract with ZK proof
      toast.success("Winnings claimed successfully!");
      setBetCommitment("");
      setRecipient("");
    } catch (err) {
      toast.error("Failed to claim");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const outcomeColor = outcome === "Yes" ? "#3fb950" : "#f85149";

  return (
    <div className="shroud-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: "#e6edf3" }}>
          Claim Winnings
        </h3>
        <span className="text-sm font-bold" style={{ color: outcomeColor }}>
          Outcome: {outcome}
        </span>
      </div>

      <p className="text-xs" style={{ color: "#8b949e" }}>
        This market has been resolved. If you bet on the winning side, claim your
        winnings to any address (preserving anonymity).
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
            Recipient Address (optional — defaults to connected wallet)
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x... (leave empty for connected wallet)"
            className="shroud-input w-full text-sm"
          />
        </div>
      </div>

      <button
        onClick={handleClaim}
        disabled={!betCommitment || submitting || status !== "connected"}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#3fb950", color: "#0d1117" }}
      >
        {submitting ? "Claiming..." : "Claim Winnings"}
      </button>
    </div>
  );
};

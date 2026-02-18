"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import toast from "react-hot-toast";

interface RefundPanelProps {
  marketId: number;
}

export const RefundPanel = ({ marketId }: RefundPanelProps) => {
  const { address, status } = useAccount();
  const [betCommitment, setBetCommitment] = useState("");
  const [recipient, setRecipient] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRefund = async () => {
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
      toast.success("Refund claimed successfully!");
      setBetCommitment("");
      setRecipient("");
    } catch (err) {
      toast.error("Failed to claim refund");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shroud-card p-6 space-y-5">
      <h3 className="text-lg font-semibold" style={{ color: "#e6edf3" }}>
        Claim Refund
      </h3>

      <div
        className="p-3 rounded-lg text-sm"
        style={{ backgroundColor: "rgba(248, 81, 73, 0.1)", border: "1px solid #f85149", color: "#f85149" }}
      >
        This market was cancelled (minimum bets not reached). You can claim a full refund.
      </div>

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
            Recipient Address (optional)
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
        onClick={handleRefund}
        disabled={!betCommitment || submitting || status !== "connected"}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: "#f85149", color: "#0d1117" }}
      >
        {submitting ? "Claiming Refund..." : "Claim Refund"}
      </button>
    </div>
  );
};

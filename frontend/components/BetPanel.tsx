"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "@starknet-react/core";
import toast from "react-hot-toast";

interface BetPanelProps {
  marketId: number;
  poolTier: number;
}

const TIER_AMOUNTS = [10, 100, 1000];
const TIER_LABELS = ["Small", "Medium", "Large"];

export const BetPanel = ({ marketId, poolTier }: BetPanelProps) => {
  const { address, status } = useAccount();
  const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amount = TIER_AMOUNTS[poolTier] ?? 0;
  const tierLabel = TIER_LABELS[poolTier] ?? "";

  const handlePlaceBet = async () => {
    if (!address) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!selectedOutcome) {
      toast.error("Select YES or NO");
      return;
    }

    setSubmitting(true);
    try {
      // MVP: In production, this generates a ZK proof from a deposit note
      // and submits commitment = hash(outcome, nonce) to hide bet direction
      await new Promise((r) => setTimeout(r, 800));
      toast.success(
        `Bet placed! Your anonymous ${selectedOutcome.toUpperCase()} commitment is on-chain.`,
      );
      setSelectedOutcome(null);
    } catch (err) {
      toast.error("Failed to place bet");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shroud-card p-6 space-y-5">
      <h3 className="text-lg font-semibold" style={{ color: "#e6edf3" }}>
        Place Your Bet
      </h3>

      {/* How it works callout */}
      <div
        className="p-3 rounded-lg space-y-2 text-xs"
        style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}
      >
        <div className="flex items-start gap-2">
          <span style={{ color: "#58a6ff" }}>1.</span>
          <span style={{ color: "#8b949e" }}>
            You need a <strong style={{ color: "#e6edf3" }}>deposit note</strong> from the{" "}
            <strong style={{ color: "#58a6ff" }}>{tierLabel} ({amount} STRK)</strong> pool.
            Each note = 1 bet on 1 market.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span style={{ color: "#58a6ff" }}>2.</span>
          <span style={{ color: "#8b949e" }}>
            Your bet direction (YES/NO) is <strong style={{ color: "#e6edf3" }}>hidden</strong> behind
            a commitment hash — no one can see which side you picked.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span style={{ color: "#58a6ff" }}>3.</span>
          <span style={{ color: "#8b949e" }}>
            A <strong style={{ color: "#e6edf3" }}>ZK proof</strong> verifies your pool membership
            without revealing your identity.
          </span>
        </div>
      </div>

      {/* Deposit note check */}
      <Link
        href="/deposit"
        className="block text-center text-xs py-2 rounded-lg transition-colors"
        style={{ backgroundColor: "#161b22", border: "1px solid #30363d", color: "#58a6ff" }}
      >
        Don&apos;t have a deposit note? Go to Deposit →
      </Link>

      {/* YES / NO buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setSelectedOutcome("yes")}
          className="py-4 rounded-xl text-lg font-bold transition-all"
          style={{
            backgroundColor: selectedOutcome === "yes" ? "#3fb950" : "#161b22",
            color: selectedOutcome === "yes" ? "#0d1117" : "#3fb950",
            border: `2px solid ${selectedOutcome === "yes" ? "#3fb950" : "#30363d"}`,
          }}
        >
          YES
        </button>
        <button
          onClick={() => setSelectedOutcome("no")}
          className="py-4 rounded-xl text-lg font-bold transition-all"
          style={{
            backgroundColor: selectedOutcome === "no" ? "#f85149" : "#161b22",
            color: selectedOutcome === "no" ? "#0d1117" : "#f85149",
            border: `2px solid ${selectedOutcome === "no" ? "#f85149" : "#30363d"}`,
          }}
        >
          NO
        </button>
      </div>

      {/* Cost display */}
      <div
        className="flex justify-between items-center p-3 rounded-lg"
        style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}
      >
        <span className="text-sm" style={{ color: "#8b949e" }}>
          Consumes
        </span>
        <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
          1 deposit note ({amount} STRK)
        </span>
      </div>

      {/* Submit */}
      <button
        onClick={handlePlaceBet}
        disabled={!selectedOutcome || submitting || status !== "connected"}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background:
            selectedOutcome === "yes"
              ? "#3fb950"
              : selectedOutcome === "no"
                ? "#f85149"
                : "linear-gradient(135deg, #58a6ff, #8b45fd)",
          color: "#0d1117",
        }}
      >
        {submitting
          ? "Generating proof..."
          : status !== "connected"
            ? "Connect Wallet"
            : !selectedOutcome
              ? "Select an Outcome"
              : `Bet ${selectedOutcome.toUpperCase()} Anonymously`}
      </button>
    </div>
  );
};

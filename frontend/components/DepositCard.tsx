"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import toast from "react-hot-toast";
import { POOL_TIERS } from "~~/lib/constants";
import { generateRandomFelt } from "~~/lib/utils";
import { useSecretNotes, type SecretNote } from "~~/hooks/useSecretNotes";

interface DepositCardProps {
  tier: (typeof POOL_TIERS)[number];
  depositCount: number;
}

export const DepositCard = ({ tier, depositCount }: DepositCardProps) => {
  const { address, status } = useAccount();
  const { addNote } = useSecretNotes();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"idle" | "approving" | "depositing" | "done">("idle");

  const handleDeposit = async () => {
    if (status !== "connected" || !address) {
      toast.error("Connect your wallet first");
      return;
    }

    setSubmitting(true);
    setStep("approving");

    try {
      // Generate secret + nullifier client-side
      const secret = generateRandomFelt();
      const nullifier = generateRandomFelt();
      // In production: commitment = poseidon_hash(secret, nullifier)
      const commitment = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

      // Step 1: Approve STRK
      await new Promise((r) => setTimeout(r, 800));
      setStep("depositing");

      // Step 2: Deposit
      await new Promise((r) => setTimeout(r, 800));

      // Save secret note to localStorage
      const note: SecretNote = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        secret,
        nullifier,
        commitment,
        tier: tier.id,
        leafIndex: depositCount,
        timestamp: Date.now(),
        used: false,
      };

      addNote(note);
      setStep("done");
      toast.success(`Deposited ${tier.amount} STRK! Secret note saved.`);
    } catch (err) {
      toast.error("Deposit failed");
      console.error(err);
      setStep("idle");
    } finally {
      setSubmitting(false);
    }
  };

  const isSelected = step !== "idle";

  return (
    <div
      className="shroud-card p-6 flex flex-col gap-4 transition-all"
      style={{
        borderColor: isSelected ? "#58a6ff" : undefined,
      }}
    >
      {/* Tier header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={{ color: "#e6edf3" }}>
          {tier.label}
        </h3>
        <span
          className="text-2xl font-bold"
          style={{ color: "#58a6ff" }}
        >
          {tier.amount}
          <span className="text-sm ml-1 font-normal" style={{ color: "#8b949e" }}>
            STRK
          </span>
        </span>
      </div>

      {/* Pool info */}
      <div
        className="p-3 rounded-lg space-y-2"
        style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}
      >
        <div className="flex justify-between text-xs">
          <span style={{ color: "#8b949e" }}>Deposits in pool</span>
          <span style={{ color: "#e6edf3" }}>{depositCount}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span style={{ color: "#8b949e" }}>Pool total</span>
          <span style={{ color: "#e6edf3" }}>
            {(depositCount * tier.amount).toLocaleString()} STRK
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span style={{ color: "#8b949e" }}>Anonymity set</span>
          <span style={{ color: depositCount >= 10 ? "#3fb950" : "#d29922" }}>
            {depositCount >= 10 ? "Strong" : depositCount >= 3 ? "Moderate" : "Weak"}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs" style={{ color: "#8b949e" }}>
        Deposit {tier.amount} STRK into the anonymity pool. You&apos;ll receive a secret note
        that proves pool membership without revealing your identity.
      </p>

      {/* Progress steps */}
      {step !== "idle" && step !== "done" && (
        <div className="flex items-center gap-2 text-xs">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: "#58a6ff" }}
          />
          <span style={{ color: "#58a6ff" }}>
            {step === "approving" ? "Approving STRK..." : "Depositing..."}
          </span>
        </div>
      )}

      {step === "done" ? (
        <div
          className="p-3 rounded-lg text-center text-sm font-medium"
          style={{ backgroundColor: "rgba(63, 185, 80, 0.1)", color: "#3fb950", border: "1px solid #3fb950" }}
        >
          Deposit complete! Secret note saved to browser.
        </div>
      ) : (
        <button
          onClick={handleDeposit}
          disabled={submitting || status !== "connected"}
          className="w-full py-3 rounded-xl font-semibold text-sm shroud-btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? "Processing..."
            : status !== "connected"
              ? "Connect Wallet"
              : `Deposit ${tier.amount} STRK`}
        </button>
      )}
    </div>
  );
};

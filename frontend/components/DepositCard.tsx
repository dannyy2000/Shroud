"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "@starknet-react/core";
import { CallData, cairo } from "starknet";
import toast from "react-hot-toast";
import { POOL_TIERS, CONTRACTS } from "~~/lib/constants";
import { generateRandomFelt, hashPairHex } from "~~/lib/utils";
import { useSecretNotes, type SecretNote } from "~~/hooks/useSecretNotes";
import { fetchLeavesForTier, computeNewMerkleRoot } from "~~/lib/zkProof";

interface DepositCardProps {
  tier: (typeof POOL_TIERS)[number];
  depositCount: number;
  onDeposited?: () => void;
}

export const DepositCard = ({ tier, depositCount, onDeposited }: DepositCardProps) => {
  const { account, address, status } = useAccount();
  const { addNote } = useSecretNotes();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"idle" | "computing-root" | "approving" | "depositing" | "done">("idle");
  const [lastNoteId, setLastNoteId] = useState<string | null>(null);

  const handleDeposit = async () => {
    if (status !== "connected" || !account || !address) {
      toast.error("Connect your wallet first");
      return;
    }

    setSubmitting(true);
    setStep("approving");

    try {
      // Generate secret + nullifier client-side
      const secret = generateRandomFelt();
      const nullifier = generateRandomFelt();
      // commitment = keccak256(secret || nullifier) — matches ZK circuit and deposit_pool.cairo
      const commitment = hashPairHex(BigInt(secret), BigInt(nullifier));

      // Compute the new Poseidon2-BN254 Merkle root after adding this leaf
      setStep("computing-root");
      const existingLeaves = await fetchLeavesForTier(tier.id);
      const newRootBigInt = await computeNewMerkleRoot(existingLeaves, BigInt(commitment));
      const newMerkleRoot = "0x" + newRootBigInt.toString(16);

      // Multicall: approve STRK + deposit in one transaction
      setStep("depositing");
      const tx = await account.execute([
        {
          contractAddress: CONTRACTS.STRK_TOKEN,
          entrypoint: "approve",
          calldata: CallData.compile({
            spender: CONTRACTS.DEPOSIT_POOL,
            amount: cairo.uint256(BigInt(tier.amountWei)),
          }),
        },
        {
          contractAddress: CONTRACTS.DEPOSIT_POOL,
          entrypoint: "deposit",
          calldata: CallData.compile({
            commitment,
            tier: tier.id, // enum variant index: 0=Small, 1=Medium, 2=Large
            new_merkle_root: newMerkleRoot,
          }),
        },
      ]);

      toast.loading("Waiting for confirmation...", { id: "deposit-tx" });
      // Wait for the transaction - starknet.js v9 uses waitForTransaction on provider
      const { RpcProvider } = await import("starknet");
      const provider = new RpcProvider({ nodeUrl: process.env.NEXT_PUBLIC_SEPOLIA_PROVIDER_URL || "https://starknet-sepolia-rpc.publicnode.com" });
      await provider.waitForTransaction(tx.transaction_hash);
      toast.dismiss("deposit-tx");

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
      setLastNoteId(note.id);
      setStep("done");
      toast.success(`Deposited ${tier.amount} STRK! Secret note saved.`);
      onDeposited?.();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("User abort") || msg.includes("rejected")) {
        toast.error("Transaction rejected");
      } else {
        toast.error("Deposit failed: " + msg.slice(0, 100));
      }
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
            {step === "computing-root"
              ? "Computing Merkle root…"
              : step === "approving"
                ? "Approving STRK..."
                : "Depositing..."}
          </span>
        </div>
      )}

      {step === "done" ? (
        <div className="space-y-3">
          <div
            className="p-3 rounded-lg text-center text-sm font-medium"
            style={{ backgroundColor: "rgba(63, 185, 80, 0.1)", color: "#3fb950", border: "1px solid #3fb950" }}
          >
            Deposit complete! Secret note saved.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => router.back()}
              className="py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: "#58a6ff", color: "#0d1117" }}
            >
              Go Back &amp; Bet
            </button>
            <Link
              href="/"
              className="py-2.5 rounded-xl text-sm font-semibold text-center transition-all"
              style={{ backgroundColor: "#21262d", border: "1px solid #30363d", color: "#e6edf3" }}
            >
              All Markets
            </Link>
          </div>
          <button
            onClick={() => setStep("idle")}
            className="w-full text-xs"
            style={{ color: "#8b949e" }}
          >
            Deposit another note
          </button>
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

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "@starknet-react/core";
import { CallData } from "starknet";
import toast from "react-hot-toast";
import { useSecretNotes } from "~~/hooks/useSecretNotes";
import { getMarketAddress } from "~~/lib/contracts";
import { generateRandomFelt, hashPairHex } from "~~/lib/utils";
import { POOL_TIERS } from "~~/lib/constants";

interface BetPanelProps {
  marketId: number;
  poolTier: number;
}

interface StoredBet {
  marketId: number;
  marketAddress: string;
  betCommitment: string;
  nonce: string;
  outcome: "yes" | "no";
  noteId: string;
  timestamp: number;
}

const BET_STORAGE_KEY = "shroud_pending_bets";

export function loadBetsForMarket(marketId: number): StoredBet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BET_STORAGE_KEY);
    const all: StoredBet[] = raw ? JSON.parse(raw) : [];
    return all.filter((b) => b.marketId === marketId);
  } catch {
    return [];
  }
}

function saveBet(bet: StoredBet) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(BET_STORAGE_KEY);
    const all: StoredBet[] = raw ? JSON.parse(raw) : [];
    all.push(bet);
    localStorage.setItem(BET_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

// outcome_to_felt: Pending=0, Yes=1, No=2 (matches Cairo contract)
function outcomeToFelt(outcome: "yes" | "no"): string {
  return outcome === "yes" ? "1" : "2";
}

export const BetPanel = ({ marketId, poolTier }: BetPanelProps) => {
  const { account, address, status } = useAccount();
  const { unusedNotes, markUsed } = useSecretNotes();
  const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no" | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"idle" | "signing" | "confirming">("idle");

  const tierInfo = POOL_TIERS[poolTier];
  const availableNotes = unusedNotes.filter((n) => n.tier === poolTier);

  // Auto-select first available note
  useEffect(() => {
    if (availableNotes.length > 0 && !selectedNoteId) {
      setSelectedNoteId(availableNotes[0].id);
    }
  }, [availableNotes, selectedNoteId]);

  const selectedNote = availableNotes.find((n) => n.id === selectedNoteId) ?? null;

  const handlePlaceBet = async () => {
    if (!account || !address || status !== "connected") {
      toast.error("Connect your wallet first");
      return;
    }
    if (!selectedOutcome) {
      toast.error("Select YES or NO");
      return;
    }
    if (!selectedNote) {
      toast.error("No deposit note available for this tier");
      return;
    }

    setSubmitting(true);
    setStep("signing");

    try {
      // 1. Get deployed market address
      const marketAddress = await getMarketAddress(marketId);

      // 2. Generate nonce and compute bet commitment
      //    commitment = keccak256(outcome || nonce) — hides bet direction
      //    Matches market.cairo reveal_bet and Noir claim/bet circuits.
      const nonce = generateRandomFelt();
      const outcomeFelt = outcomeToFelt(selectedOutcome);
      const betCommitment = hashPairHex(BigInt(outcomeFelt), BigInt(nonce));

      // 3. ZK membership proof — bypassed in this dev build.
      //    The contract accepts an empty proof span; commitment uses keccak256.
      //    Enable full proofs via generateMembershipProof() in zkProof.ts.
      const zkProofCalldata: string[] = [];

      // 4. Submit place_bet transaction
      setStep("signing");
      const tx = await account.execute([
        {
          contractAddress: marketAddress,
          entrypoint: "place_bet",
          calldata: CallData.compile({
            zk_proof: zkProofCalldata,
            bet_commitment: betCommitment,
            nullifier: selectedNote.nullifier,
          }),
        },
      ]);

      setStep("confirming");
      toast.loading("Waiting for confirmation...", { id: "bet-tx" });

      const { RpcProvider } = await import("starknet");
      const provider = new RpcProvider({
        nodeUrl:
          process.env.NEXT_PUBLIC_SEPOLIA_PROVIDER_URL ||
          "https://starknet-sepolia-rpc.publicnode.com",
      });
      await provider.waitForTransaction(tx.transaction_hash);
      toast.dismiss("bet-tx");

      // 5. Save bet record for reveal phase
      const betRecord: StoredBet = {
        marketId,
        marketAddress,
        betCommitment,
        nonce,
        outcome: selectedOutcome,
        noteId: selectedNote.id,
        timestamp: Date.now(),
      };
      saveBet(betRecord);

      // 5. Mark the deposit note as used
      markUsed(selectedNote.id, marketId, betCommitment);

      toast.success(`Anonymous ${selectedOutcome.toUpperCase()} bet placed! Save your receipt.`);
      setSelectedOutcome(null);
      setSelectedNoteId("");
      setStep("idle");
    } catch (err: any) {
      toast.dismiss("bet-tx");
      const msg = err?.message || String(err);
      if (msg.includes("User abort") || msg.includes("rejected")) {
        toast.error("Transaction rejected");
      } else if (
        msg.includes("Membership proof") ||
        msg.includes("execution error") ||
        msg.includes("reverted") ||
        msg.includes("verify")
      ) {
        toast.error("On-chain ZK verification failed. Your note is still valid.", { duration: 8000 });
      } else {
        toast.error("Bet failed: " + msg.slice(0, 120));
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
        Place Your Bet
      </h3>

      {/* How it works */}
      <div
        className="p-3 rounded-lg space-y-2 text-xs"
        style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}
      >
        <div className="flex items-start gap-2">
          <span style={{ color: "#58a6ff" }}>1.</span>
          <span style={{ color: "#8b949e" }}>
            You need a <strong style={{ color: "#e6edf3" }}>deposit note</strong> from the{" "}
            <strong style={{ color: "#58a6ff" }}>
              {tierInfo?.label} ({tierInfo?.amount} STRK)
            </strong>{" "}
            pool.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span style={{ color: "#58a6ff" }}>2.</span>
          <span style={{ color: "#8b949e" }}>
            Your bet direction is hidden behind a{" "}
            <strong style={{ color: "#e6edf3" }}>commitment hash</strong> — no one can see which
            side you picked.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span style={{ color: "#58a6ff" }}>3.</span>
          <span style={{ color: "#8b949e" }}>
            Reveal your bet after the deadline to claim winnings.
          </span>
        </div>
      </div>

      {/* Deposit note selector */}
      {availableNotes.length === 0 ? (
        <Link
          href="/deposit"
          className="flex items-center justify-between p-3 rounded-lg text-xs transition-colors"
          style={{ backgroundColor: "#161b22", border: "1px solid #30363d", color: "#58a6ff" }}
        >
          <span>No {tierInfo?.label} ({tierInfo?.amount} STRK) notes — deposit first</span>
          <span>Deposit →</span>
        </Link>
      ) : (
        <div>
          <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
            Deposit note ({availableNotes.length} available)
          </label>
          <select
            value={selectedNoteId}
            onChange={(e) => setSelectedNoteId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-xs font-mono"
            style={{
              backgroundColor: "#0d1117",
              border: "1px solid #30363d",
              color: "#e6edf3",
              outline: "none",
            }}
          >
            {availableNotes.map((note) => (
              <option key={note.id} value={note.id}>
                {note.commitment.slice(0, 10)}...{note.commitment.slice(-6)} •{" "}
                {new Date(note.timestamp).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* YES / NO */}
      <div className="grid grid-cols-2 gap-3">
        {(["yes", "no"] as const).map((side) => (
          <button
            key={side}
            onClick={() => setSelectedOutcome(side)}
            className="py-4 rounded-xl text-lg font-bold transition-all"
            style={{
              backgroundColor:
                selectedOutcome === side
                  ? side === "yes"
                    ? "#3fb950"
                    : "#f85149"
                  : "#161b22",
              color:
                selectedOutcome === side
                  ? "#0d1117"
                  : side === "yes"
                    ? "#3fb950"
                    : "#f85149",
              border: `2px solid ${
                selectedOutcome === side
                  ? side === "yes"
                    ? "#3fb950"
                    : "#f85149"
                  : "#30363d"
              }`,
            }}
          >
            {side.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Cost row */}
      <div
        className="flex justify-between items-center px-3 py-2 rounded-lg text-xs"
        style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}
      >
        <span style={{ color: "#8b949e" }}>Consumes</span>
        <span style={{ color: "#e6edf3" }}>
          1 deposit note ({tierInfo?.amount} STRK)
        </span>
      </div>

      {/* Step indicator */}
      {step !== "idle" && (
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#58a6ff" }} />
          <span style={{ color: "#58a6ff" }}>
            {step === "signing" ? "Sign transaction in wallet…" : "Confirming on-chain…"}
          </span>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handlePlaceBet}
        disabled={!selectedOutcome || !selectedNote || submitting || status !== "connected"}
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
          ? step === "confirming"
            ? "Confirming..."
            : "Signing..."
          : status !== "connected"
            ? "Connect Wallet"
            : !selectedNote
              ? "No deposit note"
              : !selectedOutcome
                ? "Select an Outcome"
                : `Bet ${selectedOutcome.toUpperCase()} Anonymously`}
      </button>
    </div>
  );
};

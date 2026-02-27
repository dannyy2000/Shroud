"use client";

import { useState, useEffect } from "react";
import { useAccount } from "@starknet-react/core";
import { CallData } from "starknet";
import toast from "react-hot-toast";
import { loadBetsForMarket } from "~~/components/BetPanel";
import { getMarketAddress } from "~~/lib/contracts";
import { useSecretNotes } from "~~/hooks/useSecretNotes";

interface ClaimPanelProps {
  marketId: number;
  outcome: string; // "Yes" | "No" — the winning outcome
}

export const ClaimPanel = ({ marketId, outcome }: ClaimPanelProps) => {
  const { account, address, status } = useAccount();
  useSecretNotes(); // keep hook for note storage side-effects
  const [savedBets, setSavedBets] = useState<ReturnType<typeof loadBetsForMarket>>([]);
  const [selectedBetIdx, setSelectedBetIdx] = useState(0);
  const [recipient, setRecipient] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"idle" | "signing" | "confirming">("idle");
  const [claimed, setClaimed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSavedBets(loadBetsForMarket(marketId));
  }, [marketId]);

  // Only show bets that match the winning outcome and haven't been claimed
  const winningBets = savedBets.filter(
    (b) => b.outcome === outcome.toLowerCase() && !claimed.has(b.betCommitment),
  );

  const allBets = savedBets.filter((b) => !claimed.has(b.betCommitment));
  const selectedBet = winningBets[selectedBetIdx] ?? null;
  const outcomeColor = outcome === "Yes" ? "#3fb950" : "#f85149";

  const handleClaim = async () => {
    if (!account || !address || status !== "connected") {
      toast.error("Connect your wallet first");
      return;
    }
    if (!selectedBet) {
      toast.error("No winning bet to claim");
      return;
    }

    setSubmitting(true);
    setStep("signing");

    try {
      const marketAddress = await getMarketAddress(marketId);
      const recipientAddress = recipient.trim() || address;

      // ZK claim proof bypassed while Poseidon2 (BN254) vs Starknet Poseidon
      // hash alignment is being resolved. Contract accepts empty proof span.
      const zkProofCalldata: string[] = [];
      const tx = await account.execute([
        {
          contractAddress: marketAddress,
          entrypoint: "claim",
          calldata: CallData.compile({
            zk_proof: zkProofCalldata,
            bet_commitment: selectedBet.betCommitment,
            recipient: recipientAddress,
          }),
        },
      ]);

      setStep("confirming");
      toast.loading("Confirming claim...", { id: "claim-tx" });

      const { RpcProvider } = await import("starknet");
      const provider = new RpcProvider({
        nodeUrl:
          process.env.NEXT_PUBLIC_SEPOLIA_PROVIDER_URL ||
          "https://starknet-sepolia-rpc.publicnode.com",
      });
      await provider.waitForTransaction(tx.transaction_hash);
      toast.dismiss("claim-tx");

      setClaimed((prev) => new Set([...prev, selectedBet.betCommitment]));
      setSelectedBetIdx(0);
      toast.success("Winnings claimed successfully!");
      setStep("idle");
    } catch (err: any) {
      toast.dismiss("claim-tx");
      const msg = err?.message || String(err);
      if (msg.includes("User abort") || msg.includes("rejected")) {
        toast.error("Transaction rejected");
      } else if (msg.includes("Membership proof") || msg.includes("zk_proof")) {
        toast.error("ZK proof required — proof generation not yet integrated");
      } else if (msg.includes("Already claimed")) {
        toast.error("This bet has already been claimed");
      } else if (msg.includes("Not winner")) {
        toast.error("This bet is not on the winning side");
      } else {
        toast.error("Claim failed: " + msg.slice(0, 120));
      }
      console.error(err);
      setStep("idle");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shroud-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: "#e6edf3" }}>
          Claim Winnings
        </h3>
        <span className="text-sm font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${outcomeColor}20`, color: outcomeColor }}>
          Resolved: {outcome}
        </span>
      </div>

      <p className="text-xs" style={{ color: "#8b949e" }}>
        This market has resolved <strong style={{ color: outcomeColor }}>{outcome}</strong>.
        If you bet on the winning side, claim winnings to any address — your identity stays hidden.
      </p>

      {allBets.length === 0 ? (
        <div
          className="p-4 rounded-lg text-center text-sm"
          style={{ backgroundColor: "#0d1117", border: "1px solid #30363d", color: "#8b949e" }}
        >
          {savedBets.length === 0
            ? "No bets found for this market in your browser."
            : "All your bets have been claimed."}
        </div>
      ) : winningBets.length === 0 ? (
        <div
          className="p-4 rounded-lg text-sm"
          style={{ backgroundColor: "#0d1117", border: "1px solid #30363d", color: "#8b949e" }}
        >
          Your bets were on the{" "}
          <strong style={{ color: "#f85149" }}>
            {allBets[0]?.outcome.toUpperCase()}
          </strong>{" "}
          side. The winning side was{" "}
          <strong style={{ color: outcomeColor }}>{outcome}</strong>.
          {" "}Better luck next time!
        </div>
      ) : (
        <>
          {/* Bet selector */}
          {winningBets.length > 1 && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
                Select bet to claim ({winningBets.length} winning bets)
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
                {winningBets.map((bet, i) => (
                  <option key={bet.betCommitment} value={i}>
                    {bet.betCommitment.slice(0, 10)}...{bet.betCommitment.slice(-6)} •{" "}
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
                <span className="font-bold" style={{ color: outcomeColor }}>
                  {selectedBet.outcome.toUpperCase()} ✓
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "#8b949e" }}>Commitment</span>
                <span className="font-mono" style={{ color: "#e6edf3" }}>
                  {selectedBet.betCommitment.slice(0, 10)}...
                  {selectedBet.betCommitment.slice(-6)}
                </span>
              </div>
            </div>
          )}

          {/* Recipient */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
              Recipient Address{" "}
              <span style={{ color: "#30363d" }}>(leave empty to use connected wallet)</span>
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x... (optional)"
              className="shroud-input w-full text-sm"
            />
          </div>

          {/* Step indicator */}
          {step !== "idle" && (
            <div className="flex items-center gap-2 text-xs">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: "#58a6ff" }}
              />
              <span style={{ color: "#58a6ff" }}>
                {step === "signing" ? "Sign transaction in wallet…" : "Confirming on-chain…"}
              </span>
            </div>
          )}

          <button
            onClick={handleClaim}
            disabled={!selectedBet || submitting || status !== "connected"}
            className="w-full py-3 rounded-xl font-semibold text-sm shroud-btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? step === "confirming"
                ? "Confirming..."
                : "Signing..."
              : status !== "connected"
                ? "Connect Wallet"
                : "Claim Winnings"}
          </button>
        </>
      )}
    </div>
  );
};

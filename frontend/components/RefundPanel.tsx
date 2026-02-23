"use client";

import { useState, useEffect } from "react";
import { useAccount } from "@starknet-react/core";
import { CallData } from "starknet";
import toast from "react-hot-toast";
import { loadBetsForMarket } from "~~/components/BetPanel";
import { getMarketAddress } from "~~/lib/contracts";

interface RefundPanelProps {
  marketId: number;
}

export const RefundPanel = ({ marketId }: RefundPanelProps) => {
  const { account, address, status } = useAccount();
  const [savedBets, setSavedBets] = useState<ReturnType<typeof loadBetsForMarket>>([]);
  const [selectedBetIdx, setSelectedBetIdx] = useState(0);
  const [recipient, setRecipient] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"idle" | "signing" | "confirming">("idle");
  const [refunded, setRefunded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSavedBets(loadBetsForMarket(marketId));
  }, [marketId]);

  const unrefunded = savedBets.filter((b) => !refunded.has(b.betCommitment));
  const selectedBet = unrefunded[selectedBetIdx] ?? null;

  const handleRefund = async () => {
    if (!account || !address || status !== "connected") {
      toast.error("Connect your wallet first");
      return;
    }
    if (!selectedBet) {
      toast.error("No bet to refund");
      return;
    }

    setSubmitting(true);
    setStep("signing");

    try {
      const marketAddress = await getMarketAddress(marketId);
      const recipientAddress = recipient.trim() || address;

      // claim_refund(zk_proof, bet_commitment, recipient)
      const tx = await account.execute([
        {
          contractAddress: marketAddress,
          entrypoint: "claim_refund",
          calldata: CallData.compile({
            zk_proof: [],
            bet_commitment: selectedBet.betCommitment,
            recipient: recipientAddress,
          }),
        },
      ]);

      setStep("confirming");
      toast.loading("Confirming refund...", { id: "refund-tx" });

      const { RpcProvider } = await import("starknet");
      const provider = new RpcProvider({
        nodeUrl:
          process.env.NEXT_PUBLIC_SEPOLIA_PROVIDER_URL ||
          "https://starknet-sepolia-rpc.publicnode.com",
      });
      await provider.waitForTransaction(tx.transaction_hash);
      toast.dismiss("refund-tx");

      setRefunded((prev) => new Set([...prev, selectedBet.betCommitment]));
      setSelectedBetIdx(0);
      toast.success("Refund claimed successfully!");
      setStep("idle");
    } catch (err: any) {
      toast.dismiss("refund-tx");
      const msg = err?.message || String(err);
      if (msg.includes("User abort") || msg.includes("rejected")) {
        toast.error("Transaction rejected");
      } else if (msg.includes("Membership proof") || msg.includes("zk_proof")) {
        toast.error("ZK proof required — proof generation not yet integrated");
      } else if (msg.includes("Already claimed")) {
        toast.error("This refund has already been claimed");
      } else {
        toast.error("Refund failed: " + msg.slice(0, 120));
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
        Claim Refund
      </h3>

      <div
        className="p-3 rounded-lg text-sm"
        style={{
          backgroundColor: "rgba(248, 81, 73, 0.1)",
          border: "1px solid #f85149",
          color: "#f85149",
        }}
      >
        This market was cancelled (minimum bets not reached). Claim a full refund of your stake.
      </div>

      {unrefunded.length === 0 ? (
        <div
          className="p-4 rounded-lg text-center text-sm"
          style={{ backgroundColor: "#0d1117", border: "1px solid #30363d", color: "#8b949e" }}
        >
          {savedBets.length === 0
            ? "No bets found for this market in your browser."
            : "All your bets have been refunded."}
        </div>
      ) : (
        <>
          {/* Bet selector */}
          {unrefunded.length > 1 && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
                Select bet to refund ({unrefunded.length} remaining)
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
                {unrefunded.map((bet, i) => (
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
                {step === "signing" ? "Sign transaction in wallet..." : "Confirming on-chain..."}
              </span>
            </div>
          )}

          <button
            onClick={handleRefund}
            disabled={!selectedBet || submitting || status !== "connected"}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#f85149", color: "#0d1117" }}
          >
            {submitting
              ? step === "confirming"
                ? "Confirming..."
                : "Signing..."
              : status !== "connected"
                ? "Connect Wallet"
                : "Claim Refund"}
          </button>
        </>
      )}
    </div>
  );
};

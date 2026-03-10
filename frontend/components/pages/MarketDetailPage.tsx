"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAccount } from "@starknet-react/core";
import { CallData } from "starknet";
import { useMarket } from "~~/hooks/useMarket";
import { StatusBadge } from "~~/components/StatusBadge";
import { CountdownTimer } from "~~/components/CountdownTimer";
import { PoolStats } from "~~/components/PoolStats";
import { BetPanel } from "~~/components/BetPanel";
import { RevealPanel } from "~~/components/RevealPanel";
import { ClaimPanel } from "~~/components/ClaimPanel";
import { RefundPanel } from "~~/components/RefundPanel";
import { getTierLabel, timestampToDate } from "~~/lib/utils";
import { CATEGORY_ICONS } from "~~/lib/constants";
import { getMarketAddress } from "~~/lib/contracts";

/**
 * Derive the market status from timestamps when the stored on-chain status is
 * stale (it only updates inside mutating txs via _update_status()).
 */
function getEffectiveStatus(
  storedStatus: string,
  betDeadline: number,
  revealDeadline: number,
): string {
  if (storedStatus !== "Open" && storedStatus !== "Revealing") return storedStatus;
  const now = Math.floor(Date.now() / 1000);
  if (storedStatus === "Open" && betDeadline > 0 && now > betDeadline) {
    if (revealDeadline > 0 && now > revealDeadline) return "Resolving";
    return "Revealing";
  }
  if (storedStatus === "Revealing" && revealDeadline > 0 && now > revealDeadline) {
    return "Resolving";
  }
  return storedStatus;
}

export default function MarketDetailPage({ id }: { id: string }) {
  const marketId = parseInt(id);
  const { market, loading, contractDeployed } = useMarket(marketId);
  const { account, address, status: walletStatus } = useAccount();
  const [resolving, setResolving] = useState(false);
  const [resolveOutcome, setResolveOutcome] = useState<"yes" | "no" | null>(null);

  const handleResolve = async () => {
    if (!account || walletStatus !== "connected") { toast.error("Connect wallet"); return; }

    const isOracle = market?.resolutionSource === "PragmaOracle";
    if (!isOracle && !resolveOutcome) { toast.error("Select an outcome"); return; }

    setResolving(true);
    try {
      const marketAddress = await getMarketAddress(marketId);
      const { CairoCustomEnum } = await import("starknet");
      const outcomeEnum = new CairoCustomEnum({
        Pending: isOracle ? {} : undefined,
        Yes: !isOracle && resolveOutcome === "yes" ? {} : undefined,
        No: !isOracle && resolveOutcome === "no" ? {} : undefined,
      });
      const tx = await account.execute([{
        contractAddress: marketAddress,
        entrypoint: "resolve",
        calldata: CallData.compile({ outcome: outcomeEnum }),
      }]);
      toast.loading("Confirming resolution...", { id: "resolve-tx" });
      const { RpcProvider } = await import("starknet");
      const provider = new RpcProvider({ nodeUrl: process.env.NEXT_PUBLIC_SEPOLIA_PROVIDER_URL || "https://starknet-sepolia-rpc.publicnode.com" });
      await provider.waitForTransaction(tx.transaction_hash);
      toast.dismiss("resolve-tx");
      toast.success("Market resolved!");
    } catch (err: any) {
      toast.dismiss("resolve-tx");
      const msg = err?.message ?? String(err);
      if (msg.includes("Only creator can resolve")) {
        toast.error("Only the market creator can resolve this market.");
      } else if (msg.includes("Not ready for resolution")) {
        toast.error("The reveal window hasn't closed yet. Wait for the reveal deadline to pass.");
      } else if (msg.includes("Market is cancelled")) {
        toast.error("This market was cancelled and cannot be resolved.");
      } else {
        toast.error("Resolve failed: " + msg.slice(0, 120));
      }
    } finally {
      setResolving(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/market/${marketId}`;
    if (navigator.share) {
      navigator.share({ title: market?.question || "Shroud Market", url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Market link copied!");
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-48 rounded" style={{ backgroundColor: "#30363d" }} />
          <div className="h-10 w-full rounded" style={{ backgroundColor: "#30363d" }} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64 rounded-xl" style={{ backgroundColor: "#161b22" }} />
            <div className="h-64 rounded-xl" style={{ backgroundColor: "#161b22" }} />
          </div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-center">
        <h2 className="text-xl font-semibold mb-4" style={{ color: "#e6edf3" }}>Market not found</h2>
        <Link href="/" className="text-sm shroud-btn-primary px-4 py-2 rounded-lg inline-block">Back to Markets</Link>
      </div>
    );
  }

  const categoryIcon = CATEGORY_ICONS[market.category || ""] || "🔮";
  const anonymityLevel = market.totalBets >= 50 ? "Strong" : market.totalBets >= 20 ? "Moderate" : "Growing";
  const anonymityColor = market.totalBets >= 50 ? "#3fb950" : market.totalBets >= 20 ? "#d29922" : "#8b949e";
  const effectiveStatus = getEffectiveStatus(market.status, market.betDeadline, market.revealDeadline);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      {/* Breadcrumb + Share */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" style={{ color: "#58a6ff" }} className="hover:underline">Markets</Link>
          <span style={{ color: "#30363d" }}>/</span>
          <span style={{ color: "#8b949e" }}>#{market.id}</span>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{ backgroundColor: "#21262d", border: "1px solid #30363d", color: "#8b949e" }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main market card */}
          <div className="shroud-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: "#0d1117" }}
                >
                  {categoryIcon}
                </span>
                <StatusBadge status={effectiveStatus} />
                {market.category && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "#30363d", color: "#8b949e" }}>{market.category}</span>
                )}
              </div>
              {/* Privacy shield */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                style={{ backgroundColor: `${anonymityColor}15`, border: `1px solid ${anonymityColor}30` }}
                title={`${market.totalBets} bets in the anonymity set`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill={anonymityColor}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span style={{ color: anonymityColor }}>{anonymityLevel} Privacy</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-6" style={{ color: "#e6edf3" }}>{market.question}</h1>

            {/* Pool balance prominent */}
            <div
              className="flex items-center gap-6 p-4 rounded-lg mb-6"
              style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}
            >
              <div>
                <span className="text-xs block mb-0.5" style={{ color: "#8b949e" }}>Total Pool</span>
                <span className="text-xl font-bold" style={{ color: "#58a6ff" }}>{market.poolBalance || "0 STRK"}</span>
              </div>
              <div>
                <span className="text-xs block mb-0.5" style={{ color: "#8b949e" }}>Total Bets</span>
                <span className="text-xl font-bold" style={{ color: "#e6edf3" }}>{market.totalBets}</span>
              </div>
              <div>
                <span className="text-xs block mb-0.5" style={{ color: "#8b949e" }}>Bet Size</span>
                <span className="text-xl font-bold" style={{ color: "#e6edf3" }}>{getTierLabel(market.poolTier)}</span>
              </div>
            </div>

            <PoolStats
              totalBets={market.totalBets}
              yesCount={market.yesCount}
              noCount={market.noCount}
              poolBalance={market.poolBalance}
              hideVotes={effectiveStatus === "Open"}
            />
          </div>

          {/* Market Details */}
          <div className="shroud-card p-6">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "#e6edf3" }}>Market Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="Pool Tier" value={getTierLabel(market.poolTier)} />
              <DetailItem label="Resolution" value={market.resolutionSource === "PragmaOracle" ? "Oracle (Pragma)" : "Creator Resolved"} />
              <DetailItem label="Bet Deadline" value={timestampToDate(market.betDeadline)} />
              <DetailItem label="Reveal Deadline" value={timestampToDate(market.revealDeadline)} />
            </div>
          </div>

          {/* Deadlines */}
          <div className="shroud-card p-6">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "#e6edf3" }}>Deadlines</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}>
                <span className="text-xs block mb-1" style={{ color: "#8b949e" }}>Betting ends</span>
                <CountdownTimer deadline={market.betDeadline} />
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}>
                <span className="text-xs block mb-1" style={{ color: "#8b949e" }}>Reveal ends</span>
                <CountdownTimer deadline={market.revealDeadline} />
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar - action panels */}
        <div className="space-y-6">
          {/* Contract deployment status */}
          {contractDeployed === false && (
            <div
              className="shroud-card p-5"
              style={{ borderColor: "#d29922" }}
            >
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="#d29922" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold mb-1" style={{ color: "#d29922" }}>
                    Betting Unavailable
                  </h4>
                  <p className="text-xs leading-relaxed" style={{ color: "#8b949e" }}>
                    This market was created via the factory MVP which stores market data in-contract only.
                    A separate Market contract must be deployed before betting, revealing, or claiming is possible.
                    Market metadata (question, deadlines, tier) is available now.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Only show action panels when contract is deployed */}
          {contractDeployed !== false && effectiveStatus === "Open" && (
            <BetPanel marketId={market.id} poolTier={market.poolTier} />
          )}
          {contractDeployed !== false && effectiveStatus === "Revealing" && (
            <RevealPanel marketId={market.id} marketAddress={market.address} />
          )}
          {contractDeployed !== false && effectiveStatus === "Resolved" && (
            <ClaimPanel marketId={market.id} marketAddress={market.address} outcome={market.outcome ?? "Unknown"} />
          )}
          {contractDeployed !== false && effectiveStatus === "Cancelled" && (
            <RefundPanel marketId={market.id} />
          )}
          {(effectiveStatus === "Resolving" || effectiveStatus === "Disputed") && (
            <div className="shroud-card p-6 space-y-4">
              <h3 className="text-lg font-semibold" style={{ color: "#e6edf3" }}>
                {effectiveStatus === "Resolving" ? "Resolve Market" : "Dispute in Progress"}
              </h3>
              {effectiveStatus === "Resolving" ? (
                <>
                  {market.resolutionSource === "PragmaOracle" ? (
                    <>
                      <p className="text-xs" style={{ color: "#8b949e" }}>
                        This market is automated via Pragma Oracle. Anyone can trigger the resolution now that the reveal window has closed.
                      </p>
                      <button
                        onClick={handleResolve}
                        disabled={resolving || walletStatus !== "connected"}
                        className="w-full py-4 rounded-xl font-bold text-sm shroud-btn-primary transition-all flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                        {resolving ? "Calling Oracle..." : "Resolve via Pragma Oracle"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs" style={{ color: "#8b949e" }}>
                        The reveal window has closed. As market creator, pick the winning outcome to resolve.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {(["yes", "no"] as const).map((side) => (
                          <button
                            key={side}
                            onClick={() => setResolveOutcome(side)}
                            className="py-3 rounded-xl font-bold text-sm transition-all"
                            style={{
                              backgroundColor: resolveOutcome === side ? (side === "yes" ? "#3fb950" : "#f85149") : "#161b22",
                              color: resolveOutcome === side ? "#0d1117" : (side === "yes" ? "#3fb950" : "#f85149"),
                              border: `2px solid ${resolveOutcome === side ? (side === "yes" ? "#3fb950" : "#f85149") : "#30363d"}`,
                            }}
                          >
                            {side.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={handleResolve}
                        disabled={!resolveOutcome || resolving || walletStatus !== "connected"}
                        className="w-full py-3 rounded-xl font-semibold text-sm shroud-btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resolving ? "Resolving..." : resolveOutcome ? `Resolve as ${resolveOutcome.toUpperCase()}` : "Select outcome above"}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm" style={{ color: "#8b949e" }}>
                  This market&apos;s resolution has been disputed. Awaiting final outcome.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs block mb-0.5" style={{ color: "#8b949e" }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: "#e6edf3" }}>{value}</span>
    </div>
  );
}

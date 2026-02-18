"use client";

import Link from "next/link";
import toast from "react-hot-toast";
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

export default function MarketDetailPage({ id }: { id: string }) {
  const marketId = parseInt(id);
  const { market, loading } = useMarket(marketId);

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
                <StatusBadge status={market.status} />
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
              hideVotes={market.status === "Open"}
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
          {market.status === "Open" && <BetPanel marketId={market.id} poolTier={market.poolTier} />}
          {market.status === "Revealing" && <RevealPanel marketId={market.id} />}
          {market.status === "Resolved" && <ClaimPanel marketId={market.id} outcome="No" />}
          {market.status === "Cancelled" && <RefundPanel marketId={market.id} />}
          {(market.status === "Resolving" || market.status === "Disputed") && (
            <div className="shroud-card p-6">
              <h3 className="text-lg font-semibold mb-3" style={{ color: "#e6edf3" }}>
                {market.status === "Resolving" ? "Awaiting Resolution" : "Dispute in Progress"}
              </h3>
              <p className="text-sm" style={{ color: "#8b949e" }}>
                {market.status === "Resolving"
                  ? "This market is being resolved. The outcome will be determined shortly."
                  : "This market's resolution has been disputed. Awaiting final outcome."}
              </p>
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

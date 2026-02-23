"use client";

import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { CountdownTimer } from "./CountdownTimer";
import { PoolStats } from "./PoolStats";
import { getTierLabel } from "~~/lib/utils";
import { CATEGORY_ICONS } from "~~/lib/constants";

export interface MarketData {
  id: number;
  question: string;
  status: string;
  poolTier: number;
  totalBets: number;
  yesCount: number;
  noCount: number;
  betDeadline: number;
  revealDeadline: number;
  resolutionSource: string;
  category?: string;
  poolBalance?: string;
  address?: string;
  outcome?: string; // "Yes" | "No" | "Pending" — set after resolution
}

interface MarketCardProps {
  market: MarketData;
}

export const MarketCard = ({ market }: MarketCardProps) => {
  const activeDeadline =
    market.status === "Open"
      ? market.betDeadline
      : market.status === "Revealing"
        ? market.revealDeadline
        : 0;

  const categoryIcon = CATEGORY_ICONS[market.category || ""] || "🔮";
  const anonymityLevel = market.totalBets >= 50 ? "Strong" : market.totalBets >= 20 ? "Moderate" : "Growing";
  const anonymityColor = market.totalBets >= 50 ? "#3fb950" : market.totalBets >= 20 ? "#d29922" : "#8b949e";

  return (
    <Link href={`/market/${market.id}`}>
      <div className="shroud-card p-5 h-full flex flex-col gap-3 transition-all hover:translate-y-[-2px] animate-fadeIn cursor-pointer">
        {/* Top row: category icon + status + privacy badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center text-sm"
              style={{ backgroundColor: "#0d1117" }}
            >
              {categoryIcon}
            </span>
            <StatusBadge status={market.status} />
          </div>
          {/* Privacy shield */}
          <div className="flex items-center gap-1 text-xs" title={`Anonymity: ${anonymityLevel} (${market.totalBets} bets)`}>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill={anonymityColor}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span style={{ color: anonymityColor }}>{anonymityLevel}</span>
          </div>
        </div>

        {/* Question */}
        <h3
          className="text-sm font-semibold leading-snug line-clamp-2 flex-1"
          style={{ color: "#e6edf3" }}
        >
          {market.question}
        </h3>

        {/* Pool balance prominent */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: "#8b949e" }}>Pool</span>
            <span className="text-sm font-bold" style={{ color: "#58a6ff" }}>{market.poolBalance || "0 STRK"}</span>
          </div>
          <span className="text-xs" style={{ color: "#8b949e" }}>
            {market.totalBets} bet{market.totalBets !== 1 ? "s" : ""} · {getTierLabel(market.poolTier)}
          </span>
        </div>

        {/* Stats */}
        <PoolStats
          totalBets={market.totalBets}
          yesCount={market.yesCount}
          noCount={market.noCount}
          poolBalance={market.poolBalance}
          hideVotes={market.status === "Open"}
        />

        {/* Bottom row: countdown + source */}
        <div className="flex items-center justify-between">
          {activeDeadline > 0 ? (
            <CountdownTimer deadline={activeDeadline} label="Ends:" />
          ) : (
            <span className="text-xs" style={{ color: "#8b949e" }}>
              --
            </span>
          )}
          <span className="text-xs flex items-center gap-1" style={{ color: "#8b949e" }}>
            {market.resolutionSource === "PragmaOracle" ? (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                Oracle
              </>
            ) : (
              <>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                Creator
              </>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
};

"use client";

import { useState } from "react";
import Link from "next/link";
import { CategoryTabs } from "~~/components/CategoryTabs";
import { MarketGrid } from "~~/components/MarketGrid";
import { useMarkets, filterMarkets, type SortOption } from "~~/hooks/useMarkets";
import type { Category } from "~~/lib/constants";
import { CATEGORY_ICONS } from "~~/lib/constants";
import { getTierLabel } from "~~/lib/utils";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "most_bets", label: "Most Bets" },
  { value: "ending_soon", label: "Ending Soon" },
];

const HomePage = () => {
  const { markets, loading } = useMarkets();
  const [category, setCategory] = useState<Category>("Trending");
  const [sort, setSort] = useState<SortOption>("newest");
  const [search, setSearch] = useState("");

  const filtered = filterMarkets(markets, category, sort, search);

  // Pick top 2 markets by total bets for featured section
  const featured = [...markets]
    .filter((m) => m.status === "Open")
    .sort((a, b) => b.totalBets - a.totalBets)
    .slice(0, 2);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Hero Banner */}
      <div
        className="relative rounded-2xl p-8 sm:p-10 mb-8 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1a1f2e 100%)",
          border: "1px solid #30363d",
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #58a6ff, transparent)", transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #8b45fd, transparent)", transform: "translate(-30%, 30%)" }} />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: "linear-gradient(135deg, #58a6ff, #8b45fd)", color: "#0d1117" }}>S</div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(63, 185, 80, 0.15)", color: "#3fb950" }}>Live on Starknet</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: "#e6edf3" }}>
            Predict Anonymously
          </h1>
          <p className="text-sm sm:text-base max-w-xl mb-6" style={{ color: "#8b949e" }}>
            The first prediction market where your identity and bet direction are hidden by zero-knowledge proofs.
            No whales. No front-running. Just fair markets.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/deposit"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-2"
              style={{ background: "linear-gradient(135deg, #58a6ff, #8b45fd)", color: "#0d1117" }}
            >
              Get Started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <Link
              href="/create"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-2"
              style={{ backgroundColor: "#21262d", border: "1px solid #30363d", color: "#e6edf3" }}
            >
              Create Market
            </Link>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <HowItWorksCard
          icon="🛡️"
          title="Fixed Deposit Pools"
          desc="Everyone bets the same amount (10, 100, or 1000 STRK). No whales can dominate."
          accent="#3fb950"
        />
        <HowItWorksCard
          icon="🔒"
          title="ZK-Hidden Identity"
          desc="Zero-knowledge proofs verify your pool membership without revealing who you are."
          accent="#58a6ff"
        />
        <HowItWorksCard
          icon="🎭"
          title="Commitment Scheme"
          desc="Your bet direction (YES/NO) is hidden until the reveal phase. No front-running."
          accent="#8b45fd"
        />
      </div>

      {/* Featured Markets */}
      {!loading && featured.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🔥</span>
            <h2 className="text-lg font-bold" style={{ color: "#e6edf3" }}>Trending Markets</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featured.map((market) => (
              <FeaturedMarketCard key={market.id} market={market} />
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="mb-6">
        <CategoryTabs active={category} onChange={setCategory} />
      </div>

      {/* Sort + Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: sort === opt.value ? "#58a6ff" : "transparent",
                color: sort === opt.value ? "#0d1117" : "#8b949e",
                border: sort === opt.value ? "none" : "1px solid #30363d",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="shroud-input text-sm w-full sm:w-64 pl-9"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "#8b949e" }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* All Markets heading */}
      {!loading && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: "#e6edf3" }}>
            All Markets
          </h2>
          <span className="text-xs" style={{ color: "#8b949e" }}>
            {filtered.length} market{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      <MarketGrid markets={filtered} loading={loading} />
    </div>
  );
};

function HowItWorksCard({ icon, title, desc, accent }: { icon: string; title: string; desc: string; accent: string }) {
  return (
    <div
      className="p-5 rounded-xl transition-all"
      style={{ backgroundColor: "#161b22", border: "1px solid #30363d" }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
          style={{ backgroundColor: `${accent}15` }}
        >
          {icon}
        </div>
        <h3 className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{title}</h3>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "#8b949e" }}>{desc}</p>
    </div>
  );
}

function FeaturedMarketCard({ market }: { market: import("~~/components/MarketCard").MarketData }) {
  const categoryIcon = CATEGORY_ICONS[market.category || ""] || "🔮";
  const anonymityLevel = market.totalBets >= 50 ? "Strong" : market.totalBets >= 20 ? "Moderate" : "Growing";
  const anonymityColor = market.totalBets >= 50 ? "#3fb950" : market.totalBets >= 20 ? "#d29922" : "#8b949e";

  return (
    <Link href={`/market/${market.id}`}>
      <div
        className="p-6 rounded-xl flex flex-col gap-4 transition-all hover:translate-y-[-2px] cursor-pointer h-full"
        style={{ backgroundColor: "#161b22", border: "1px solid #30363d" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ backgroundColor: "#0d1117" }}
            >
              {categoryIcon}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "#0d1117", color: "#8b949e" }}>
              {market.category}
            </span>
          </div>
          {/* Privacy shield badge */}
          <div className="flex items-center gap-1.5 text-xs" title={`Anonymity set: ${anonymityLevel}`}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={anonymityColor}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span style={{ color: anonymityColor }}>{anonymityLevel}</span>
          </div>
        </div>

        <h3 className="text-base font-bold leading-snug" style={{ color: "#e6edf3" }}>
          {market.question}
        </h3>

        <div className="flex items-center gap-4 mt-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: "#8b949e" }}>Pool</span>
            <span className="text-sm font-bold" style={{ color: "#58a6ff" }}>{market.poolBalance}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: "#8b949e" }}>Bets</span>
            <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>{market.totalBets}</span>
          </div>
          <div className="ml-auto">
            <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: "#0d1117", color: "#8b949e" }}>
              {getTierLabel(market.poolTier)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default HomePage;

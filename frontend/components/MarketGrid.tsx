"use client";

import { MarketCard, type MarketData } from "./MarketCard";

interface MarketGridProps {
  markets: MarketData[];
  loading?: boolean;
}

export const MarketGrid = ({ markets, loading }: MarketGridProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="shroud-card p-5 h-48 animate-pulse"
            style={{ backgroundColor: "#161b22" }}
          >
            <div className="h-4 w-16 rounded mb-4" style={{ backgroundColor: "#30363d" }} />
            <div className="h-4 w-full rounded mb-2" style={{ backgroundColor: "#30363d" }} />
            <div className="h-4 w-3/4 rounded mb-6" style={{ backgroundColor: "#30363d" }} />
            <div className="h-2 w-full rounded mb-4" style={{ backgroundColor: "#30363d" }} />
            <div className="h-3 w-1/2 rounded" style={{ backgroundColor: "#30363d" }} />
          </div>
        ))}
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div
        className="text-center py-20 rounded-xl border"
        style={{ borderColor: "#30363d", backgroundColor: "#161b22" }}
      >
        <div className="text-4xl mb-4">🔮</div>
        <h3 className="text-lg font-semibold mb-2" style={{ color: "#e6edf3" }}>
          No markets yet
        </h3>
        <p className="text-sm" style={{ color: "#8b949e" }}>
          Be the first to create a prediction market
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
};

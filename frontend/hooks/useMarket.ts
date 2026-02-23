"use client";

import { useState, useEffect } from "react";
import { formatUnits } from "ethers";
import type { MarketData } from "~~/components/MarketCard";
import { useMarkets } from "./useMarkets";
import { getMarketAddress, getMarketContract, isZeroAddress } from "~~/lib/contracts";

const STATUS_MAP: Record<string, string> = {
  Open: "Open",
  Revealing: "Revealing",
  Resolving: "Resolving",
  Resolved: "Resolved",
  Disputed: "Disputed",
  Cancelled: "Cancelled",
};

// Single market — event data merged with live on-chain reads
export function useMarket(id: number) {
  const { markets, loading: marketsLoading } = useMarkets();
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [contractDeployed, setContractDeployed] = useState<boolean | null>(null);

  useEffect(() => {
    if (marketsLoading) return;

    const base = markets.find((m) => m.id === id);
    if (!base) {
      setMarket(null);
      setLoading(false);
      return;
    }

    // Set base data immediately so the page isn't blank while we fetch live data
    setMarket(base);
    setLoading(false);

    // Then fetch live on-chain data
    const fetchLive = async () => {
      try {
        // Check if the market contract is separately deployed
        // (factory MVP sets market_address = 0x0)
        let address: string;
        try {
          address = await getMarketAddress(id);
        } catch {
          // Market contract not deployed (factory MVP limitation)
          setContractDeployed(false);
          return;
        }
        setContractDeployed(true);
        const contract = getMarketContract(address);

        const [totalBets, yesCount, noCount, poolBalanceRaw, statusRaw, outcomeRaw] = await Promise.all([
          contract.get_total_bets(),
          contract.get_yes_count(),
          contract.get_no_count(),
          contract.get_pool_balance(),
          contract.get_status(),
          contract.get_outcome(),
        ]);

        const poolBalanceBig = BigInt(poolBalanceRaw?.low ?? poolBalanceRaw ?? 0n);
        const poolBalanceFormatted = parseFloat(formatUnits(poolBalanceBig, 18)).toFixed(4);

        // get_status / get_outcome return variant objects like { Open: {} } or { Yes: {} }
        const statusVariant = statusRaw?.activeVariant?.() ?? Object.keys(statusRaw ?? {})[0] ?? "Open";
        const status = STATUS_MAP[statusVariant] ?? base.status;

        const outcomeVariant = outcomeRaw?.activeVariant?.() ?? Object.keys(outcomeRaw ?? {})[0] ?? "Pending";
        const outcome = outcomeVariant === "Yes" || outcomeVariant === "No" ? outcomeVariant : undefined;

        setMarket((prev) =>
          prev
            ? {
                ...prev,
                address,
                totalBets: Number(totalBets),
                yesCount: Number(yesCount),
                noCount: Number(noCount),
                poolBalance: `${poolBalanceFormatted} STRK`,
                status,
                outcome,
              }
            : prev,
        );
      } catch (err) {
        console.error("Failed to fetch live market data:", err);
      }
    };

    fetchLive();
  }, [id, markets, marketsLoading]);

  return { market, loading, contractDeployed };
}

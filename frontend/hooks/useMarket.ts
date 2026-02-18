"use client";

import { useState, useEffect } from "react";
import type { MarketData } from "~~/components/MarketCard";

// Mock single market fetch — will be replaced with contract reads
export function useMarket(id: number) {
  const [market, setMarket] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Mock data matching the markets list
      const mockMarkets: Record<number, MarketData> = {
        1: {
          id: 1,
          question: "Will BTC break $150K before March 2026?",
          status: "Open",
          poolTier: 1,
          totalBets: 24,
          yesCount: 15,
          noCount: 9,
          betDeadline: Math.floor(Date.now() / 1000) + 86400 * 3,
          revealDeadline: Math.floor(Date.now() / 1000) + 86400 * 4,
          resolutionSource: "PragmaOracle",
          category: "Crypto",
          poolBalance: "2,400 STRK",
        },
        2: {
          id: 2,
          question: "Will ETH flip BTC in market cap by 2027?",
          status: "Open",
          poolTier: 2,
          totalBets: 42,
          yesCount: 18,
          noCount: 24,
          betDeadline: Math.floor(Date.now() / 1000) + 86400 * 7,
          revealDeadline: Math.floor(Date.now() / 1000) + 86400 * 8,
          resolutionSource: "CreatorResolve",
          category: "Crypto",
          poolBalance: "42,000 STRK",
        },
        3: {
          id: 3,
          question: "Will the Lakers win the 2026 NBA Championship?",
          status: "Open",
          poolTier: 0,
          totalBets: 67,
          yesCount: 30,
          noCount: 37,
          betDeadline: Math.floor(Date.now() / 1000) + 86400 * 14,
          revealDeadline: Math.floor(Date.now() / 1000) + 86400 * 15,
          resolutionSource: "CreatorResolve",
          category: "Sports",
          poolBalance: "670 STRK",
        },
        4: {
          id: 4,
          question: "Will Starknet TVL exceed $5B by Q3 2026?",
          status: "Revealing",
          poolTier: 1,
          totalBets: 35,
          yesCount: 22,
          noCount: 13,
          betDeadline: Math.floor(Date.now() / 1000) - 3600,
          revealDeadline: Math.floor(Date.now() / 1000) + 86400 * 2,
          resolutionSource: "PragmaOracle",
          category: "Crypto",
          poolBalance: "3,500 STRK",
        },
        5: {
          id: 5,
          question: "Will AI pass the Turing test definitively in 2026?",
          status: "Open",
          poolTier: 0,
          totalBets: 89,
          yesCount: 51,
          noCount: 38,
          betDeadline: Math.floor(Date.now() / 1000) + 86400 * 30,
          revealDeadline: Math.floor(Date.now() / 1000) + 86400 * 31,
          resolutionSource: "CreatorResolve",
          category: "Entertainment",
          poolBalance: "890 STRK",
        },
        6: {
          id: 6,
          question: "Will US inflation drop below 2% by end of 2026?",
          status: "Resolved",
          poolTier: 2,
          totalBets: 156,
          yesCount: 72,
          noCount: 84,
          betDeadline: Math.floor(Date.now() / 1000) - 86400 * 10,
          revealDeadline: Math.floor(Date.now() / 1000) - 86400 * 9,
          resolutionSource: "PragmaOracle",
          category: "Politics",
          poolBalance: "156,000 STRK",
        },
        7: {
          id: 7,
          question: "Will STRK token reach $5 in 2026?",
          status: "Open",
          poolTier: 0,
          totalBets: 12,
          yesCount: 8,
          noCount: 4,
          betDeadline: Math.floor(Date.now() / 1000) + 86400 * 5,
          revealDeadline: Math.floor(Date.now() / 1000) + 86400 * 6,
          resolutionSource: "PragmaOracle",
          category: "Crypto",
          poolBalance: "120 STRK",
        },
        8: {
          id: 8,
          question: "Will the next FIFA World Cup have an African finalist?",
          status: "Open",
          poolTier: 1,
          totalBets: 45,
          yesCount: 20,
          noCount: 25,
          betDeadline: Math.floor(Date.now() / 1000) + 86400 * 60,
          revealDeadline: Math.floor(Date.now() / 1000) + 86400 * 61,
          resolutionSource: "CreatorResolve",
          category: "Sports",
          poolBalance: "4,500 STRK",
        },
        9: {
          id: 9,
          question: "Will a major country adopt Bitcoin as legal tender in 2026?",
          status: "Cancelled",
          poolTier: 0,
          totalBets: 3,
          yesCount: 2,
          noCount: 1,
          betDeadline: Math.floor(Date.now() / 1000) - 86400 * 5,
          revealDeadline: Math.floor(Date.now() / 1000) - 86400 * 4,
          resolutionSource: "CreatorResolve",
          category: "Politics",
          poolBalance: "30 STRK",
        },
      };

      setMarket(mockMarkets[id] || null);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [id]);

  return { market, loading };
}

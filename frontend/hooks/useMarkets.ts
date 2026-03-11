"use client";

import { useState, useEffect, useCallback } from "react";
import { hash, num } from "starknet";
import type { MarketData } from "~~/components/MarketCard";
import { CONTRACTS } from "~~/lib/constants";
import { getProvider, getMarketFactoryContract, getMarketContract } from "~~/lib/contracts";

export type SortOption = "newest" | "most_bets" | "ending_soon";

const POOL_TIER_NAMES = ["Small", "Medium", "Large"];
const POOL_TIER_AMOUNTS = [10, 100, 1000];
const RESOLUTION_NAMES = ["PragmaOracle", "CreatorResolve"];

// Detect category from question keywords
function detectCategory(question: string): string {
  const q = question.toLowerCase();
  const crypto = ["btc", "eth", "bitcoin", "ethereum", "starknet", "strk", "crypto", "token", "defi", "nft", "solana", "sol", "chain", "tvl", "market cap", "price"];
  const sports = ["nba", "nfl", "fifa", "world cup", "championship", "league", "soccer", "football", "basketball", "baseball", "tennis", "olympics", "team", "win the", "lakers", "finals"];
  const politics = ["president", "election", "congress", "senate", "vote", "government", "policy", "inflation", "gdp", "fed", "regulation", "country", "legal tender", "law"];
  const entertainment = ["movie", "oscar", "grammy", "album", "tv show", "netflix", "ai", "turing", "music", "game", "release", "celebrity"];

  if (crypto.some((kw) => q.includes(kw))) return "Crypto";
  if (sports.some((kw) => q.includes(kw))) return "Sports";
  if (politics.some((kw) => q.includes(kw))) return "Politics";
  if (entertainment.some((kw) => q.includes(kw))) return "Entertainment";
  return "Crypto"; // default fallback
}

// Check localStorage for user-set category, fall back to keyword detection
function getCategoryForQuestion(question: string): string {
  if (typeof window !== "undefined") {
    try {
      const cats = JSON.parse(localStorage.getItem("shroud_market_categories") || "{}");
      if (cats[question.trim()]) return cats[question.trim()];
    } catch { }
  }
  return detectCategory(question);
}

// Decode a ByteArray from event data felts starting at offset.
// Returns [decodedString, newOffset].
function decodeByteArray(data: string[], offset: number): [string, number] {
  const dataLen = Number(BigInt(data[offset]));
  let result = "";
  let idx = offset + 1;

  // Decode full 31-byte chunks
  for (let i = 0; i < dataLen; i++) {
    const hexVal = BigInt(data[idx]).toString(16);
    // Each bytes31 holds up to 31 bytes
    const bytes = hexVal.match(/.{1,2}/g) || [];
    result += bytes.map((b) => String.fromCharCode(parseInt(b, 16))).join("");
    idx++;
  }

  // Decode pending_word (remaining bytes)
  const pendingWord = BigInt(data[idx]);
  const pendingWordLen = Number(BigInt(data[idx + 1]));
  if (pendingWordLen > 0 && pendingWord > 0n) {
    const hexVal = pendingWord.toString(16).padStart(pendingWordLen * 2, "0");
    const bytes = hexVal.match(/.{1,2}/g) || [];
    result += bytes.map((b) => String.fromCharCode(parseInt(b, 16))).join("");
  }

  return [result, idx + 2];
}

function parseMarketCreatedEvent(data: string[]): MarketData | null {
  try {
    let offset = 0;

    // market_id: u64 (1 felt)
    const marketId = Number(BigInt(data[offset]));
    offset++;

    // market_address: ContractAddress (1 felt) — present in new factory events
    const marketAddress = data[offset] ?? "0x0";
    offset++;

    // creator: ContractAddress (1 felt)
    offset++; // skip creator

    // question: ByteArray (variable length)
    const [question, newOffset] = decodeByteArray(data, offset);
    offset = newOffset;

    // bet_deadline: u64 (1 felt)
    const betDeadline = Number(BigInt(data[offset]));
    offset++;

    // reveal_deadline: u64 (1 felt)
    const revealDeadline = Number(BigInt(data[offset]));
    offset++;

    // pool_tier: PoolTier enum (1 felt - variant index)
    const poolTier = Number(BigInt(data[offset]));
    offset++;

    // resolution_source: ResolutionSource enum (1 felt - variant index)
    const resolutionSource = Number(BigInt(data[offset]));
    offset++;

    // creator_stake: u256 (2 felts - low, high)
    const stakeLow = BigInt(data[offset]);
    const stakeHigh = BigInt(data[offset + 1]);
    offset += 2;

    // min_bets: u32 (1 felt)
    // const minBets = Number(BigInt(data[offset]));

    // Determine market status based on current time
    const now = Math.floor(Date.now() / 1000);
    let status: string;
    if (now < betDeadline) {
      status = "Open";
    } else if (now < revealDeadline) {
      status = "Revealing";
    } else {
      status = "Resolving";
    }

    const tierAmount = POOL_TIER_AMOUNTS[poolTier] ?? 0;

    return {
      id: marketId,
      question,
      status,
      poolTier,
      totalBets: 0,
      yesCount: 0,
      noCount: 0,
      betDeadline,
      revealDeadline,
      resolutionSource: RESOLUTION_NAMES[resolutionSource] || "CreatorResolve",
      category: getCategoryForQuestion(question),
      poolBalance: "0 STRK",
      address: marketAddress !== "0x0" ? marketAddress : undefined,
    };
  } catch (err) {
    console.error("Failed to parse MarketCreated event:", err);
    return null;
  }
}

const STATUS_MAP: Record<string, string> = {
  "0": "Open",
  "1": "Revealing",
  "2": "Resolving",
  "3": "Resolved",
  "4": "Disputed",
  "5": "Cancelled",
};

// Status lifecycle order — higher = further along.
const STATUS_ORDER: Record<string, number> = {
  Open: 0, Revealing: 1, Resolving: 2, Resolved: 3, Disputed: 4, Cancelled: 5,
};

// Starknet contracts only run _update_status() inside transactions,
// so a contract with passed deadlines may still report "Open" on-chain if
// no one has interacted with it. This computes the true display status.
function getEffectiveStatus(onChain: string, betDeadline: number, revealDeadline: number): string {
  if (onChain === "Resolved" || onChain === "Cancelled" || onChain === "Disputed") return onChain;
  const now = Math.floor(Date.now() / 1000);
  let ts: string;
  if (now < betDeadline) ts = "Open";
  else if (now < revealDeadline) ts = "Revealing";
  else ts = "Resolving";
  return (STATUS_ORDER[onChain] ?? 0) >= (STATUS_ORDER[ts] ?? 0) ? onChain : ts;
}

export function useMarkets() {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const provider = getProvider();
      const factoryAddress = CONTRACTS.MARKET_FACTORY;

      if (factoryAddress === "0x0") {
        setMarkets([]);
        setLoading(false);
        return;
      }

      // Fetch MarketCreated events directly — market_count check removed for speed
      const eventKey = hash.getSelectorFromName("MarketCreated");
      let eventsResponse;
      try {
        eventsResponse = await provider.getEvents({
          address: factoryAddress,
          keys: [[eventKey]],
          from_block: { block_number: 0 },
          to_block: "latest",
          chunk_size: 100,
        });
      } catch {
        setMarkets([]);
        setLoading(false);
        return;
      }

      if (!eventsResponse.events.length) {
        setMarkets([]);
        setLoading(false);
        return;
      }

      const parsed: MarketData[] = [];
      for (const event of eventsResponse.events) {
        const market = parseMarketCreatedEvent(event.data);
        if (market) {
          parsed.push(market);
        }
      }

      // Show markets immediately from event data so the list isn't blank
      setMarkets(parsed);
      setLoading(false);

      // Then fetch live on-chain data per market (status + counts) in background
      const withLive = await Promise.all(
        parsed.map(async (market) => {
          if (!market.address) return market;
          try {
            const contract = getMarketContract(market.address);
            const [totalBets, yesCount, noCount, statusRaw, poolBalRaw] = await Promise.all([
              contract.get_total_bets(),
              contract.get_yes_count(),
              contract.get_no_count(),
              contract.get_status(),
              contract.get_pool_balance(),
            ]);

            // Resolve the real on-chain status (Resolved, Cancelled, etc.)
            // statusRaw is a variant object like { Open: {} } or a felt index
            let onChainStatus: string | undefined;
            if (statusRaw !== undefined && statusRaw !== null) {
              const variantName = statusRaw?.activeVariant?.() ?? Object.keys(statusRaw ?? {})[0];
              if (variantName && variantName !== "undefined") {
                onChainStatus = variantName; // "Open", "Revealing", "Resolving", "Resolved", ...
              } else {
                // Fallback: statusRaw might be a raw felt string like "0x3"
                const idx = String(Number(BigInt(String(statusRaw))));
                onChainStatus = STATUS_MAP[idx];
              }
            }

            // Compute effective status: whichever is further in the lifecycle wins.
            // On-chain status can lag if no tx has run _update_status() since the deadline.
            const effectiveStatus = getEffectiveStatus(
              onChainStatus ?? market.status,
              market.betDeadline,
              market.revealDeadline,
            );

            const poolWei = poolBalRaw != null ? BigInt(poolBalRaw) : 0n;
            const poolStrk = (Number(poolWei) / 1e18).toFixed(4);

            return {
              ...market,
              totalBets: Number(totalBets),
              yesCount: Number(yesCount),
              noCount: Number(noCount),
              status: effectiveStatus,
              poolBalance: `${poolStrk} STRK`,
            };
          } catch {
            return market;
          }
        }),
      );

      // Merge live data into the already-visible list
      setMarkets(withLive);
    } catch (err: any) {
      console.error("Failed to fetch markets:", err);
      setError(err?.message || "Failed to load markets");
      setMarkets([]);
    } finally {
      // setLoading(false); // Removed as it's set earlier
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets };
}

export function filterMarkets(
  markets: MarketData[],
  category: string,
  sort: SortOption,
  search: string,
): MarketData[] {
  let filtered = [...markets];

  // Category filter
  if (category !== "All" && category !== "Trending") {
    filtered = filtered.filter((m) => m.category === category);
  }
  if (category === "Trending") {
    filtered = filtered.sort((a, b) => b.totalBets - a.totalBets);
  }

  // Search filter
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter((m) => m.question.toLowerCase().includes(q));
  }

  // Sort
  switch (sort) {
    case "newest":
      filtered.sort((a, b) => b.id - a.id);
      break;
    case "most_bets":
      filtered.sort((a, b) => b.totalBets - a.totalBets);
      break;
    case "ending_soon":
      filtered.sort((a, b) => a.betDeadline - b.betDeadline);
      break;
  }

  return filtered;
}

export const POOL_TIERS = [
  { id: 0, label: "Small", amount: 10, amountWei: "10000000000000000000" },
  { id: 1, label: "Medium", amount: 100, amountWei: "100000000000000000000" },
  { id: 2, label: "Large", amount: 1000, amountWei: "1000000000000000000000" },
] as const;

export const CATEGORIES = [
  "Trending",
  "Crypto",
  "Sports",
  "Politics",
  "Entertainment",
  "All",
] as const;

export const CATEGORY_ICONS: Record<string, string> = {
  Trending: "🔥",
  Crypto: "₿",
  Sports: "⚽",
  Politics: "🏛️",
  Entertainment: "🎬",
  All: "🌐",
};

export const CATEGORY_IMAGES: Record<string, string> = {
  Crypto: "₿",
  Sports: "⚽",
  Politics: "🏛️",
  Entertainment: "🎬",
};

export type Category = (typeof CATEGORIES)[number];

export const MARKET_STATUS = {
  0: "Open",
  1: "Revealing",
  2: "Resolving",
  3: "Resolved",
  4: "Disputed",
  5: "Cancelled",
} as const;

export type MarketStatusKey = keyof typeof MARKET_STATUS;

export const STATUS_COLORS: Record<string, string> = {
  Open: "bg-[#3fb950]",
  Revealing: "bg-[#58a6ff]",
  Resolving: "bg-[#d29922]",
  Resolved: "bg-[#8b949e]",
  Disputed: "bg-[#f85149]",
  Cancelled: "bg-[#f85149]",
};

export const RESOLUTION_SOURCE = {
  0: "PragmaOracle",
  1: "CreatorResolve",
} as const;

// Contract addresses (update after deployment)
export const CONTRACTS = {
  MARKET_FACTORY: process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS || "0x0",
  DEPOSIT_POOL: process.env.NEXT_PUBLIC_DEPOSIT_POOL_ADDRESS || "0x0",
  STRK_TOKEN: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
} as const;

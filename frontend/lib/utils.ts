import { keccak256 } from "ethers";

export function formatStrk(weiAmount: bigint | string): string {
  const wei = typeof weiAmount === "string" ? BigInt(weiAmount) : weiAmount;
  const whole = wei / BigInt(10 ** 18);
  const frac = wei % BigInt(10 ** 18);
  if (frac === 0n) return `${whole} STRK`;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 2);
  return `${whole}.${fracStr} STRK`;
}

export function shortenAddress(addr: string, chars = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}

export function timeRemaining(deadline: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadline - now;
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function timestampToDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getTierLabel(tier: number): string {
  const labels = ["Small (10 STRK)", "Medium (100 STRK)", "Large (1000 STRK)"];
  return labels[tier] ?? "Unknown";
}

export function generateRandomFelt(): string {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/**
 * keccak256(a || b) where a and b are packed as 32-byte big-endian field elements.
 * Result truncated to 248 bits (top byte dropped) to fit Stark252 prime.
 * Matches hash_pair in deposit_pool.cairo, market.cairo, and all Noir circuits.
 */
export function hashPair(a: bigint, b: bigint): bigint {
  const aHex = a.toString(16).padStart(64, "0");
  const bHex = b.toString(16).padStart(64, "0");
  const h = keccak256("0x" + aHex + bHex);
  // Drop top byte -> 248 bits, fits Stark252 prime
  return BigInt(h) & ((1n << 248n) - 1n);
}

/** hashPair result as a 0x-prefixed hex string */
export function hashPairHex(a: bigint, b: bigint): string {
  return "0x" + hashPair(a, b).toString(16);
}

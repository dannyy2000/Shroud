"use client";

/**
 * ZK Proof generation for Shroud — Noir + Barretenberg + Garaga
 *
 * Merkle tree node hash : Poseidon2-BN254 (native ACIR blackbox, ~50 gates/call).
 * Leaf / nullifier / bet_commitment hash : keccak256 (packed 32-byte big-endian felts).
 * Proof generation : server-side via /api/prove/* (nargo execute + bb prove CLI).
 */

import { hashPair } from "~~/lib/utils";
import type { SecretNote } from "~~/hooks/useSecretNotes";
import { getDepositPoolContract, poolTierEnum } from "~~/lib/contracts";

const TREE_DEPTH = 20;

// ── Poseidon2-BN254 via @aztec/bb.js ──────────────────────────────────────

let _bbSync: any = null;

async function getBBSync(): Promise<any> {
  if (_bbSync) return _bbSync;
  const { BarretenbergSync } = await import("@aztec/bb.js");
  _bbSync = await BarretenbergSync.initSingleton();
  return _bbSync;
}

function frToBigInt(fr: { toBuffer(): Uint8Array }): bigint {
  const buf = fr.toBuffer();
  let val = 0n;
  for (const b of buf) val = (val << 8n) | BigInt(b);
  return val;
}

/**
 * Poseidon2 compression for Merkle nodes.
 * Matches `poseidon2_permutation([left, right, 0, 0], 4)[0]` in the Noir circuit.
 */
export async function poseidon2Compress(left: bigint, right: bigint): Promise<bigint> {
  const { Fr } = await import("@aztec/bb.js");
  const bb = await getBBSync();
  const result = bb.poseidon2Permutation([
    new Fr(left),
    new Fr(right),
    new Fr(0n),
    new Fr(0n),
  ]);
  return frToBigInt(result[0]);
}

// Lazily computed Poseidon2 empty-subtree hashes for each level (0 = empty leaf)
let _emptyLevelHashes: bigint[] | null = null;

async function getEmptyLevelHashes(): Promise<bigint[]> {
  if (_emptyLevelHashes) return _emptyLevelHashes;
  const h: bigint[] = [0n]; // level 0: empty leaf = 0
  for (let i = 0; i < TREE_DEPTH; i++) {
    h.push(await poseidon2Compress(h[i], h[i]));
  }
  _emptyLevelHashes = h;
  return h;
}

// ── Sparse memoised tree ───────────────────────────────────────────────────

/**
 * Build a memoised Merkle tree over `leaves`.
 * Any subtree whose first leaf index >= leaves.length returns emptyHashes[level].
 */
async function buildTree(leaves: bigint[]): Promise<{
  nodeAt: (level: number, idx: number) => Promise<bigint>;
}> {
  const emptyHashes = await getEmptyLevelHashes();
  const cache = new Map<string, bigint>();

  // Seed leaf level
  for (let i = 0; i < leaves.length; i++) {
    cache.set(`0:${i}`, leaves[i]);
  }

  const nodeAt = async (level: number, idx: number): Promise<bigint> => {
    const key = `${level}:${idx}`;
    if (cache.has(key)) return cache.get(key)!;

    // Subtree starts at leaf idx * 2^level; if that's beyond our leaves it's empty
    const firstLeaf = idx * Math.pow(2, level);
    if (firstLeaf >= leaves.length) {
      cache.set(key, emptyHashes[level]);
      return emptyHashes[level];
    }

    let val: bigint;
    if (level === 0) {
      val = leaves[idx] ?? 0n;
    } else {
      val = await poseidon2Compress(
        await nodeAt(level - 1, 2 * idx),
        await nodeAt(level - 1, 2 * idx + 1),
      );
    }
    cache.set(key, val);
    return val;
  };

  return { nodeAt };
}

// ── Fetch all leaf commitments for a tier ─────────────────────────────────

export async function fetchLeavesForTier(tier: number): Promise<bigint[]> {
  const contract = getDepositPoolContract();
  const countRaw = await contract.get_deposit_count(poolTierEnum(tier));
  const count = Number(countRaw);
  if (count === 0) return [];
  return Promise.all(
    Array.from({ length: count }, (_, i) =>
      contract.get_leaf(poolTierEnum(tier), i).then((v: any) => BigInt(v)),
    ),
  );
}

// ── Compute new Merkle root after appending a leaf ─────────────────────────

/**
 * Compute the Poseidon2-BN254 Merkle root after inserting `newLeaf`
 * as the next leaf.  Used by DepositCard before calling `deposit()`.
 *
 * NOTE: BN254 field elements can be up to ~254 bits, which overflows the
 * Stark252 prime (~251 bits).  We truncate to 248 bits (same mask used by
 * hashPair throughout the codebase) so the result always fits in felt252.
 * In bypass mode (empty ZK proof) the on-chain verifier never reads this
 * root, so the truncation is safe.  When full ZK proofs are enabled the
 * Merkle-tree hash function will need to be replaced with a felt252-native
 * hash (e.g. Starknet Poseidon) that is natively < Stark252 prime.
 */
export async function computeNewMerkleRoot(
  existingLeaves: bigint[],
  newLeaf: bigint,
): Promise<bigint> {
  const { nodeAt } = await buildTree([...existingLeaves, newLeaf]);
  const raw = await nodeAt(TREE_DEPTH, 0);
  // Truncate to 248 bits so it fits in felt252 (Stark252 prime ≈ 2^251)
  const MASK_248 = (1n << 248n) - 1n;
  return raw & MASK_248;
}

// ── Merkle path reconstruction (for membership proof) ─────────────────────

export async function buildMerklePath(
  tier: number,
  leafIndex: number,
): Promise<{ path: string[]; pathIndices: string[]; root: string }> {
  const leafValues = await fetchLeavesForTier(tier);

  if (leafValues.length === 0) throw new Error("No deposits in this tier pool");
  if (leafIndex >= leafValues.length) throw new Error("Leaf index out of range");

  const { nodeAt } = await buildTree(leafValues);

  const emptyHashes = await getEmptyLevelHashes();
  const path: string[] = [];
  const pathIndices: string[] = [];
  let cur = leafIndex;

  for (let l = 0; l < TREE_DEPTH; l++) {
    const pathIdx = cur % 2; // 0 = cur is left child, 1 = right child
    const sibIdx = pathIdx === 0 ? cur + 1 : cur - 1;

    // Sibling: use cached value if within leaf range, else empty-subtree hash
    const firstSibLeaf = sibIdx * Math.pow(2, l);
    const sib =
      firstSibLeaf < leafValues.length
        ? await nodeAt(l, sibIdx)
        : emptyHashes[l];

    path.push("0x" + sib.toString(16));
    pathIndices.push(pathIdx.toString());
    cur = Math.floor(cur / 2);
  }

  const root = "0x" + (await nodeAt(TREE_DEPTH, 0)).toString(16);
  return { path, pathIndices, root };
}

// ── Membership proof (place_bet) ───────────────────────────────────────────

export async function generateMembershipProof(
  note: SecretNote,
  betCommitment: string,
  marketId: string,
  onProgress?: (msg: string) => void,
): Promise<string[]> {
  onProgress?.("Fetching Merkle path from deposit pool…");
  const { path, pathIndices, root } = await buildMerklePath(note.tier, note.leafIndex);

  // nullifier = keccak256(nullifier_secret || market_id) — matches Noir circuit
  const nullifierPublic =
    "0x" + hashPair(BigInt(note.nullifier), BigInt(marketId)).toString(16);

  onProgress?.("Generating ZK proof on server — this takes 30–120 s…");
  const res = await fetch("/api/prove/membership", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: note.secret,
      nullifier_secret: note.nullifier,
      merkle_path: path,
      path_indices: pathIndices,
      merkle_root: root,
      nullifier: nullifierPublic,
      bet_commitment: betCommitment,
      market_id: marketId,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error("Membership proof failed: " + (err.error ?? res.statusText));
  }

  const { calldata } = await res.json();
  return calldata as string[];
}

// ── Claim proof (claim / claim_refund) ─────────────────────────────────────

export async function generateClaimProof(
  note: SecretNote,
  betCommitment: string,
  winningOutcome: "yes" | "no",
  nonce: string,
  marketId: string,
  onProgress?: (msg: string) => void,
): Promise<string[]> {
  const outcomeFelt = winningOutcome === "yes" ? "1" : "2";
  // nullifier = keccak256(nullifier_secret || market_id) — matches Noir circuit
  const nullifierPublic =
    "0x" + hashPair(BigInt(note.nullifier), BigInt(marketId)).toString(16);

  onProgress?.("Generating ZK proof on server — this takes 30–120 s…");
  const res = await fetch("/api/prove/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nonce,
      nullifier_secret: note.nullifier,
      bet_commitment: betCommitment,
      winning_outcome: outcomeFelt,
      market_id: marketId,
      nullifier: nullifierPublic,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error("Claim proof failed: " + (err.error ?? res.statusText));
  }

  const { calldata } = await res.json();
  return calldata as string[];
}

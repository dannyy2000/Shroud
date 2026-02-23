"use client";

/**
 * ZK Proof generation for Shroud — Noir + Barretenberg + Garaga
 *
 * ── Hash compatibility note ────────────────────────────────────────────────
 * The Noir circuits use `poseidon2_permutation` (Poseidon2, BN254 field).
 * The Cairo contracts use Starknet Poseidon (`PoseidonTrait`, Stark252 field).
 * These are different hash functions over different prime fields, so:
 *
 *  • Membership proof (place_bet): the Merkle path is built with Starknet
 *    Poseidon (matching the on-chain tree), but the circuit recomputes the
 *    root with Poseidon2 — the circuit constraint will fail.
 *
 *  • Claim proof (claim): the bet_commitment was stored using Starknet
 *    Poseidon (from BetPanel), but the circuit checks it with Poseidon2 —
 *    the constraint will fail.
 *
 * Fix: change `hash_pair` in deposit_pool.cairo and the commitment check in
 * market.cairo `reveal_bet` to use Poseidon2, then redeploy. Once that is
 * done, every proof generated here will verify correctly on-chain.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { hash as starkHash } from "starknet";
import type { SecretNote } from "~~/hooks/useSecretNotes";
import { getDepositPoolContract, poolTierEnum } from "~~/lib/contracts";

const TREE_DEPTH = 20;

// ── Starknet Poseidon of two field elements ────────────────────────────────
// Matches the on-chain `hash_pair` in deposit_pool.cairo.
function snPoseidon(a: bigint, b: bigint): bigint {
  const ha = "0x" + (a === 0n ? "0" : a.toString(16));
  const hb = "0x" + (b === 0n ? "0" : b.toString(16));
  return BigInt(starkHash.computePoseidonHashOnElements([ha, hb]));
}

// Precompute empty subtree hashes at each level (empty leaf = 0).
// Matches `_compute_empty_root` in deposit_pool.cairo.
const EMPTY_LEVEL_HASHES: bigint[] = (() => {
  const h: bigint[] = [0n];
  for (let i = 0; i < TREE_DEPTH; i++) h.push(snPoseidon(h[i], h[i]));
  return h;
})();

// ── Merkle path reconstruction ─────────────────────────────────────────────

export async function buildMerklePath(
  tier: number,
  leafIndex: number,
): Promise<{ path: string[]; pathIndices: string[]; root: string }> {
  const contract = getDepositPoolContract();

  // Read deposit count for this tier
  const countRaw = await contract.get_deposit_count(poolTierEnum(tier));
  const depositCount = Number(countRaw);

  if (depositCount === 0) throw new Error("No deposits in this tier pool");
  if (leafIndex >= depositCount) throw new Error("Leaf index out of range");

  // Fetch all leaves concurrently
  const leafValues: bigint[] = await Promise.all(
    Array.from({ length: depositCount }, (_, i) =>
      contract.get_leaf(poolTierEnum(tier), i).then((v: any) => BigInt(v)),
    ),
  );

  // Sparse memoised tree — only compute nodes on the path
  const cache = new Map<string, bigint>();

  function node(level: number, idx: number): bigint {
    const key = `${level}:${idx}`;
    if (cache.has(key)) return cache.get(key)!;
    let val: bigint;
    if (level === 0) {
      val = leafValues[idx] ?? 0n;
    } else {
      val = snPoseidon(node(level - 1, 2 * idx), node(level - 1, 2 * idx + 1));
    }
    cache.set(key, val);
    return val;
  }

  // Pre-seed leaf level
  for (let i = 0; i < leafValues.length; i++) {
    cache.set(`0:${i}`, leafValues[i]);
  }

  const path: string[] = [];
  const pathIndices: string[] = [];
  let cur = leafIndex;

  for (let l = 0; l < TREE_DEPTH; l++) {
    const pathIdx = cur % 2; // 0 = current is left child, 1 = right child
    const sibIdx = pathIdx === 0 ? cur + 1 : cur - 1;

    // Use cached value if the sibling has been deposited; otherwise use the
    // precomputed empty subtree hash for this level.
    const sibKey = `${l}:${sibIdx}`;
    const sib = cache.has(sibKey) ? cache.get(sibKey)! : EMPTY_LEVEL_HASHES[l];

    path.push("0x" + sib.toString(16));
    pathIndices.push(pathIdx.toString());
    cur = Math.floor(cur / 2);
  }

  const root = "0x" + node(TREE_DEPTH, 0).toString(16);
  return { path, pathIndices, root };
}

// ── Shared: encode publicInputs array into a flat Uint8Array ──────────────
// Garaga expects 32 bytes per public input, big-endian.
function encodePublicInputs(publicInputs: string[]): Uint8Array {
  const bytes = new Uint8Array(publicInputs.length * 32);
  publicInputs.forEach((pi, i) => {
    const hex = pi.replace(/^0x/i, "").padStart(64, "0");
    for (let j = 0; j < 32; j++) {
      bytes[i * 32 + j] = parseInt(hex.slice(j * 2, j * 2 + 2), 16);
    }
  });
  return bytes;
}

// ── Membership proof (place_bet) ───────────────────────────────────────────

export async function generateMembershipProof(
  note: SecretNote,
  betCommitment: string,
  marketId: string,
  onProgress?: (msg: string) => void,
): Promise<string[]> {
  onProgress?.("Loading ZK circuits…");

  // Dynamic imports keep the heavy WASM out of the initial bundle
  const [{ Noir }, { UltraHonkBackend }, garaga] = await Promise.all([
    import("@noir-lang/noir_js"),
    import("@noir-lang/backend_barretenberg"),
    import("garaga"),
  ]);
  await garaga.init();

  const [circuitJson, vkBuffer] = await Promise.all([
    fetch("/circuits/membership_proof.json").then((r) => {
      if (!r.ok) throw new Error("Failed to fetch membership_proof.json");
      return r.json();
    }),
    fetch("/circuits/membership_vk").then((r) => {
      if (!r.ok) throw new Error("Failed to fetch membership_vk");
      return r.arrayBuffer();
    }),
  ]);
  const vkBytes = new Uint8Array(vkBuffer);

  onProgress?.("Fetching Merkle path from deposit pool…");
  const { path, pathIndices, root } = await buildMerklePath(note.tier, note.leafIndex);

  // Public nullifier = poseidon(nullifier_secret, market_id)
  // NOTE: on-chain the nullifier was registered as-is (note.nullifier).
  // When the contract uses Poseidon2, use the computed value here instead.
  const nullifierPublic =
    "0x" +
    BigInt(starkHash.computePoseidonHashOnElements([note.nullifier, marketId])).toString(16);

  const inputs = {
    // Private
    secret: note.secret,
    nullifier_secret: note.nullifier,
    merkle_path: path,
    path_indices: pathIndices,
    // Public
    merkle_root: root,
    nullifier: nullifierPublic,
    bet_commitment: betCommitment,
    market_id: marketId,
  };

  onProgress?.("Generating ZK proof — this takes 30–90 s…");
  const backend = new UltraHonkBackend(circuitJson.bytecode);
  const noir = new Noir(circuitJson);
  const { witness } = await noir.execute(inputs);
  const proofData = await backend.generateProof(witness);

  onProgress?.("Converting proof to on-chain calldata…");
  const piBytes = encodePublicInputs(
    Array.isArray(proofData.publicInputs)
      ? (proofData.publicInputs as string[])
      : [],
  );
  const calldata = garaga.getZKHonkCallData(proofData.proof, piBytes, vkBytes);
  return calldata.map((x: bigint) => "0x" + x.toString(16));
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
  onProgress?.("Loading ZK circuits…");

  const [{ Noir }, { UltraHonkBackend }, garaga] = await Promise.all([
    import("@noir-lang/noir_js"),
    import("@noir-lang/backend_barretenberg"),
    import("garaga"),
  ]);
  await garaga.init();

  const [circuitJson, vkBuffer] = await Promise.all([
    fetch("/circuits/claim_proof.json").then((r) => {
      if (!r.ok) throw new Error("Failed to fetch claim_proof.json");
      return r.json();
    }),
    fetch("/circuits/claim_vk").then((r) => {
      if (!r.ok) throw new Error("Failed to fetch claim_vk");
      return r.arrayBuffer();
    }),
  ]);
  const vkBytes = new Uint8Array(vkBuffer);

  const outcomeFelt = winningOutcome === "yes" ? "1" : "2";
  const nullifierPublic =
    "0x" +
    BigInt(starkHash.computePoseidonHashOnElements([note.nullifier, marketId])).toString(16);

  const inputs = {
    // Private
    nonce,
    nullifier_secret: note.nullifier,
    // Public
    bet_commitment: betCommitment,
    winning_outcome: outcomeFelt,
    market_id: marketId,
    nullifier: nullifierPublic,
  };

  onProgress?.("Generating ZK proof — this takes 30–90 s…");
  const backend = new UltraHonkBackend(circuitJson.bytecode);
  const noir = new Noir(circuitJson);
  const { witness } = await noir.execute(inputs);
  const proofData = await backend.generateProof(witness);

  onProgress?.("Converting proof to on-chain calldata…");
  const piBytes = encodePublicInputs(
    Array.isArray(proofData.publicInputs)
      ? (proofData.publicInputs as string[])
      : [],
  );
  const calldata = garaga.getZKHonkCallData(proofData.proof, piBytes, vkBytes);
  return calldata.map((x: bigint) => "0x" + x.toString(16));
}

/**
 * POST /api/prove/membership
 *
 * Server-side membership proof generation.
 * Accepts circuit inputs (including pre-computed Merkle path and Poseidon2 root),
 * runs nargo execute + bb prove via CLI, converts to Garaga calldata.
 *
 * Body (JSON):
 *   secret           : string       (hex felt, private)
 *   nullifier_secret : string       (hex felt, private)
 *   merkle_path      : string[]     (20 hex felts, private)
 *   path_indices     : string[]     (20 "0"/"1" strings, private)
 *   merkle_root      : string       (hex felt, public)
 *   nullifier        : string       (hex felt, public)
 *   bet_commitment   : string       (hex felt, public)
 *   market_id        : string       (hex felt, public)
 *
 * Response (JSON):
 *   { calldata: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const CIRCUITS_ROOT      = join(process.cwd(), "..", "circuits");
const MEMBERSHIP_CIRCUIT  = join(CIRCUITS_ROOT, "membership_proof");
const WORKSPACE_TARGET   = join(process.cwd(), "..", "target");
const VK_PATH = join(WORKSPACE_TARGET, "membership_vk", "vk");

export async function POST(req: NextRequest) {
  let tmpDir: string | null = null;
  try {
    const body = await req.json();
    const {
      secret, nullifier_secret,
      merkle_path, path_indices,
      merkle_root, nullifier, bet_commitment, market_id,
    } = body;

    if (!secret || !nullifier_secret || !merkle_path || !path_indices ||
        !merkle_root || !nullifier || !bet_commitment || !market_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!Array.isArray(merkle_path) || merkle_path.length !== 20) {
      return NextResponse.json({ error: "merkle_path must be array of 20 elements" }, { status: 400 });
    }

    tmpDir = mkdtempSync(join(tmpdir(), "shroud-membership-"));

    // Write Prover.toml
    const pathArr  = merkle_path.map((v: string) => `"${v}"`).join(", ");
    const idxArr   = path_indices.map((v: string) => `"${v}"`).join(", ");
    const proverToml = `secret = "${secret}"
nullifier_secret = "${nullifier_secret}"
merkle_path = [${pathArr}]
path_indices = [${idxArr}]
merkle_root = "${merkle_root}"
nullifier = "${nullifier}"
bet_commitment = "${bet_commitment}"
market_id = "${market_id}"
`;
    writeFileSync(join(MEMBERSHIP_CIRCUIT, "Prover.toml"), proverToml);

    // nargo execute
    execSync(
      `nargo execute --program-dir "${MEMBERSHIP_CIRCUIT}" --silence-warnings`,
      { stdio: "pipe", timeout: 120_000 }
    );

    // Workspace compiles all artifacts to the root target/ directory
    const witnessPath = join(WORKSPACE_TARGET, "membership_proof.gz");
    const circuitPath = join(WORKSPACE_TARGET, "membership_proof.json");
    const proofOutDir = join(tmpDir, "proof");

    // bb prove
    execSync(
      `bb prove --scheme ultra_honk --oracle_hash keccak ` +
      `-b "${circuitPath}" -w "${witnessPath}" -k "${VK_PATH}" -o "${proofOutDir}"`,
      { stdio: "pipe", timeout: 300_000 }
    );

    const proofBytes = readFileSync(join(proofOutDir, "proof"));
    const piBytes    = readFileSync(join(proofOutDir, "public_inputs"));
    const vkBytes    = readFileSync(VK_PATH);

    const garaga = await import("garaga");
    await garaga.init();

    const calldata = garaga.getZKHonkCallData(
      new Uint8Array(proofBytes),
      new Uint8Array(piBytes),
      new Uint8Array(vkBytes),
    );

    return NextResponse.json({
      calldata: (calldata as bigint[]).map((x) => "0x" + x.toString(16)),
    });
  } catch (err: any) {
    const msg = err?.stderr?.toString() || err?.message || String(err);
    console.error("[/api/prove/membership] Error:", msg);
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 });
  } finally {
    if (tmpDir) {
      try { rmSync(tmpDir, { recursive: true }); } catch {}
    }
  }
}

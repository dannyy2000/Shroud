/**
 * POST /api/prove/claim
 *
 * Server-side claim proof generation.
 * Accepts circuit inputs, runs nargo execute + bb prove via CLI,
 * then converts the proof to Garaga calldata using the garaga npm package.
 *
 * Body (JSON):
 *   nonce            : string  (hex felt)
 *   nullifier_secret : string  (hex felt)
 *   bet_commitment   : string  (hex felt, public)
 *   winning_outcome  : string  ("1" = Yes, "2" = No, public)
 *   market_id        : string  (hex felt, public)
 *   nullifier        : string  (hex felt, public)
 *
 * Response (JSON):
 *   { calldata: string[] }  — array of hex felt252 values ready for Starknet
 */

import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const CIRCUITS_ROOT    = join(process.cwd(), "..", "circuits");
const CLAIM_CIRCUIT    = join(CIRCUITS_ROOT, "claim_proof");
const WORKSPACE_TARGET = join(process.cwd(), "..", "target");
const VK_PATH = join(WORKSPACE_TARGET, "claim_vk", "vk");

export async function POST(req: NextRequest) {
  let tmpDir: string | null = null;
  try {
    const body = await req.json();
    const { nonce, nullifier_secret, bet_commitment, winning_outcome, market_id, nullifier } = body;

    if (!nonce || !nullifier_secret || !bet_commitment || !winning_outcome || !market_id || !nullifier) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create a temp directory for the witness + proof outputs
    tmpDir = mkdtempSync(join(tmpdir(), "shroud-claim-"));

    // Write Prover.toml for nargo execute
    const proverToml = `nonce = "${nonce}"
nullifier_secret = "${nullifier_secret}"
bet_commitment = "${bet_commitment}"
winning_outcome = "${winning_outcome}"
market_id = "${market_id}"
nullifier = "${nullifier}"
`;
    writeFileSync(join(CLAIM_CIRCUIT, "Prover.toml"), proverToml);

    // Run nargo execute to generate the witness
    execSync(
      `nargo execute --program-dir "${CLAIM_CIRCUIT}" --silence-warnings`,
      { stdio: "pipe", timeout: 120_000 }
    );

    // Workspace compiles all artifacts to the root target/ directory
    const witnessPath = join(WORKSPACE_TARGET, "claim_proof.gz");
    const circuitPath = join(WORKSPACE_TARGET, "claim_proof.json");
    const proofOutDir = join(tmpDir, "proof");

    // Run bb prove to generate the proof
    execSync(
      `bb prove --scheme ultra_honk --oracle_hash keccak ` +
      `-b "${circuitPath}" -w "${witnessPath}" -k "${VK_PATH}" -o "${proofOutDir}"`,
      { stdio: "pipe", timeout: 300_000 }
    );

    const proofBytes = readFileSync(join(proofOutDir, "proof"));
    const piBytes    = readFileSync(join(proofOutDir, "public_inputs"));
    const vkBytes    = readFileSync(VK_PATH);

    // Convert to Garaga calldata
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
    console.error("[/api/prove/claim] Error:", msg);
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 500 });
  } finally {
    if (tmpDir) {
      try { rmSync(tmpDir, { recursive: true }); } catch {}
    }
  }
}

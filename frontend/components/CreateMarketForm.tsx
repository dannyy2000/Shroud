"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@starknet-react/core";
import { CallData, cairo, byteArray } from "starknet";
import toast from "react-hot-toast";
import { POOL_TIERS, CONTRACTS, CATEGORY_ICONS } from "~~/lib/constants";

export const CreateMarketForm = () => {
  const router = useRouter();
  const { account, address, status } = useAccount();
  const [submitting, setSubmitting] = useState(false);

  const [question, setQuestion] = useState("");
  const [resolutionSource, setResolutionSource] = useState<"oracle" | "creator">("creator");
  const [poolTier, setPoolTier] = useState(0);
  const [betDeadlineDate, setBetDeadlineDate] = useState("");
  const [revealDeadlineDate, setRevealDeadlineDate] = useState("");
  const [creatorStake, setCreatorStake] = useState("10");
  const [category, setCategory] = useState("Crypto");
  const [pragmaPairId, setPragmaPairId] = useState("");
  const [targetPrice, setTargetPrice] = useState("");

  const MARKET_CATEGORIES = ["Crypto", "Sports", "Politics", "Entertainment"];

  const handleSubmit = async () => {
    if (status !== "connected" || !account || !address) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!question.trim()) {
      toast.error("Enter a question");
      return;
    }
    if (!betDeadlineDate || !revealDeadlineDate) {
      toast.error("Set both deadlines");
      return;
    }

    const betDeadline = Math.floor(new Date(betDeadlineDate).getTime() / 1000);
    const revealDeadline = Math.floor(new Date(revealDeadlineDate).getTime() / 1000);

    if (revealDeadline <= betDeadline) {
      toast.error("Reveal deadline must be after bet deadline");
      return;
    }

    const stakeWei = BigInt(Math.floor(parseFloat(creatorStake || "0") * 1e18));

    setSubmitting(true);
    try {
      // Build the ByteArray calldata for the question
      const questionByteArray = byteArray.byteArrayFromString(question);

      // Encode resolution_source enum: 0 = PragmaOracle, 1 = CreatorResolve
      const resSourceIndex = resolutionSource === "oracle" ? 0 : 1;

      // Encode pragma_pair_id as felt252 (hash of pair string, or 0 for creator)
      let pairIdFelt = "0";
      if (resolutionSource === "oracle" && pragmaPairId) {
        // Convert pair ID string (e.g. "BTC/USD") to felt252
        const encoder = new TextEncoder();
        const bytes = encoder.encode(pragmaPairId);
        let hex = "0x";
        for (const b of bytes) hex += b.toString(16).padStart(2, "0");
        pairIdFelt = hex;
      }

      const targetPriceWei = resolutionSource === "oracle" && targetPrice
        ? BigInt(Math.floor(parseFloat(targetPrice) * 1e18))
        : 0n;

      // Build calldata manually for create_market
      // create_market(question: ByteArray, bet_deadline: u64, reveal_deadline: u64,
      //   resolution_source: ResolutionSource, pool_tier: PoolTier,
      //   pragma_pair_id: felt252, target_price: u256, creator_stake: u256, min_bets: u32)
      const createCalldata: string[] = [
        // ByteArray: data_len, ...data, pending_word, pending_word_len
        ...CallData.compile({ question: questionByteArray }),
        // bet_deadline
        betDeadline.toString(),
        // reveal_deadline
        revealDeadline.toString(),
        // resolution_source enum variant index
        resSourceIndex.toString(),
        // pool_tier enum variant index
        poolTier.toString(),
        // pragma_pair_id
        pairIdFelt,
        // target_price u256 (low, high)
        ...CallData.compile({ target_price: cairo.uint256(targetPriceWei) }),
        // creator_stake u256 (low, high)
        ...CallData.compile({ creator_stake: cairo.uint256(stakeWei) }),
        // min_bets
        "0",
      ];

      // Build transaction calls
      const calls: any[] = [];

      // If creator stake > 0, approve STRK first
      if (stakeWei > 0n) {
        calls.push({
          contractAddress: CONTRACTS.STRK_TOKEN,
          entrypoint: "approve",
          calldata: CallData.compile({
            spender: CONTRACTS.MARKET_FACTORY,
            amount: cairo.uint256(stakeWei),
          }),
        });
      }

      calls.push({
        contractAddress: CONTRACTS.MARKET_FACTORY,
        entrypoint: "create_market",
        calldata: createCalldata,
      });

      const tx = await account.execute(calls);

      toast.loading("Waiting for confirmation...", { id: "create-tx" });
      const { RpcProvider } = await import("starknet");
      const provider = new RpcProvider({ nodeUrl: process.env.NEXT_PUBLIC_SEPOLIA_PROVIDER_URL || "https://starknet-sepolia-rpc.publicnode.com" });
      await provider.waitForTransaction(tx.transaction_hash);
      toast.dismiss("create-tx");

      // Save category to localStorage (contract doesn't store it)
      try {
        const cats = JSON.parse(localStorage.getItem("shroud_market_categories") || "{}");
        // We don't know the exact market_id yet, but we'll match by question
        cats[question.trim()] = category;
        localStorage.setItem("shroud_market_categories", JSON.stringify(cats));
      } catch {}

      toast.success("Market created successfully!");
      // Redirect to home to see the new market
      router.push("/");
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("User abort") || msg.includes("rejected")) {
        toast.error("Transaction rejected");
      } else {
        toast.error("Failed to create market: " + msg.slice(0, 100));
      }
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shroud-card p-6 space-y-6">
      {/* Question */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "#e6edf3" }}>
          Question
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Will BTC break $200K by end of 2026?"
          rows={3}
          className="shroud-input w-full text-sm resize-none"
        />
        <p className="text-xs mt-1" style={{ color: "#8b949e" }}>
          Write a clear yes/no question about a future event.
        </p>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "#e6edf3" }}>
          Category
        </label>
        <div className="grid grid-cols-4 gap-2">
          {MARKET_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="p-2 rounded-lg text-sm text-center transition-all"
              style={{
                backgroundColor: category === cat ? "#161b22" : "#0d1117",
                border: `1px solid ${category === cat ? "#58a6ff" : "#30363d"}`,
                color: "#e6edf3",
              }}
            >
              <span className="block text-lg">{CATEGORY_ICONS[cat] || ""}</span>
              <span className="text-xs">{cat}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Resolution Source */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "#e6edf3" }}>
          Resolution Source
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setResolutionSource("creator")}
            className="p-3 rounded-lg text-sm text-left transition-all"
            style={{
              backgroundColor: resolutionSource === "creator" ? "#161b22" : "#0d1117",
              border: `1px solid ${resolutionSource === "creator" ? "#58a6ff" : "#30363d"}`,
              color: "#e6edf3",
            }}
          >
            <span className="block font-semibold mb-1">Creator Resolve</span>
            <span className="text-xs" style={{ color: "#8b949e" }}>
              You determine the outcome with a dispute window
            </span>
          </button>
          <button
            onClick={() => setResolutionSource("oracle")}
            className="p-3 rounded-lg text-sm text-left transition-all"
            style={{
              backgroundColor: resolutionSource === "oracle" ? "#161b22" : "#0d1117",
              border: `1px solid ${resolutionSource === "oracle" ? "#58a6ff" : "#30363d"}`,
              color: "#e6edf3",
            }}
          >
            <span className="block font-semibold mb-1">Pragma Oracle</span>
            <span className="text-xs" style={{ color: "#8b949e" }}>
              Automated price feed resolution
            </span>
          </button>
        </div>
      </div>

      {/* Oracle params (conditional) */}
      {resolutionSource === "oracle" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
              Pragma Pair ID
            </label>
            <input
              type="text"
              value={pragmaPairId}
              onChange={(e) => setPragmaPairId(e.target.value)}
              placeholder="e.g. BTC/USD"
              className="shroud-input w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
              Target Price (USD)
            </label>
            <input
              type="number"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="150000"
              className="shroud-input w-full text-sm"
            />
          </div>
        </div>
      )}

      {/* Pool Tier */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "#e6edf3" }}>
          Pool Tier
        </label>
        <div className="grid grid-cols-3 gap-3">
          {POOL_TIERS.map((tier) => (
            <button
              key={tier.id}
              onClick={() => setPoolTier(tier.id)}
              className="p-3 rounded-lg text-center transition-all"
              style={{
                backgroundColor: poolTier === tier.id ? "#161b22" : "#0d1117",
                border: `1px solid ${poolTier === tier.id ? "#58a6ff" : "#30363d"}`,
                color: "#e6edf3",
              }}
            >
              <span className="block text-lg font-bold">{tier.amount}</span>
              <span className="text-xs" style={{ color: "#8b949e" }}>
                STRK
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Deadlines */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
            Bet Deadline
          </label>
          <input
            type="datetime-local"
            value={betDeadlineDate}
            onChange={(e) => setBetDeadlineDate(e.target.value)}
            className="shroud-input w-full text-sm"
          />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
            Reveal Deadline
          </label>
          <input
            type="datetime-local"
            value={revealDeadlineDate}
            onChange={(e) => setRevealDeadlineDate(e.target.value)}
            className="shroud-input w-full text-sm"
          />
        </div>
      </div>

      {/* Creator Stake */}
      <div>
        <label className="block text-xs mb-1.5" style={{ color: "#8b949e" }}>
          Creator Stake (STRK)
        </label>
        <input
          type="number"
          value={creatorStake}
          onChange={(e) => setCreatorStake(e.target.value)}
          placeholder="10"
          className="shroud-input w-full text-sm"
        />
        <p className="text-xs mt-1" style={{ color: "#8b949e" }}>
          A bond you lock to create this market. It guarantees you'll resolve it honestly.
          Returned to you after the dispute window closes (if nobody disputes).
          The creator does NOT participate as a bettor.
        </p>
      </div>

      {/* Cost summary */}
      <div
        className="p-4 rounded-lg space-y-2"
        style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}
      >
        <h4 className="text-xs font-semibold" style={{ color: "#8b949e" }}>
          COST SUMMARY
        </h4>
        <div className="flex justify-between text-sm">
          <span style={{ color: "#8b949e" }}>Creator stake</span>
          <span style={{ color: "#e6edf3" }}>{creatorStake || "0"} STRK</span>
        </div>
        <div className="flex justify-between text-sm font-semibold pt-2 border-t" style={{ borderColor: "#30363d" }}>
          <span style={{ color: "#e6edf3" }}>Total</span>
          <span style={{ color: "#58a6ff" }}>{creatorStake || "0"} STRK</span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!question.trim() || !betDeadlineDate || !revealDeadlineDate || submitting || status !== "connected"}
        className="w-full py-3 rounded-xl font-semibold text-sm shroud-btn-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting
          ? "Creating Market..."
          : status !== "connected"
            ? "Connect Wallet to Create"
            : "Create Market"}
      </button>
    </div>
  );
};

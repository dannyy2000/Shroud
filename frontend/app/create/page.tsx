"use client";

import dynamic from "next/dynamic";

const CreateMarketForm = dynamic(
  () => import("~~/components/CreateMarketForm").then((mod) => mod.CreateMarketForm),
  { ssr: false },
);

export default function CreateMarketPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#e6edf3" }}>
          Create Market
        </h1>
        <p className="text-sm" style={{ color: "#8b949e" }}>
          Launch a new prediction market. Bettors will place anonymous bets using ZK proofs
          from the deposit pool.
        </p>
      </div>
      <CreateMarketForm />
    </div>
  );
}

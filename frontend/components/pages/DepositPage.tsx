"use client";

import { DepositCard } from "~~/components/DepositCard";
import { POOL_TIERS } from "~~/lib/constants";
import { useSecretNotes } from "~~/hooks/useSecretNotes";
import { useDepositCounts } from "~~/hooks/useDepositPool";

export default function DepositPage() {
  const { notes, exportNotes } = useSecretNotes();
  const { counts: depositCounts, refetch: refetchCounts } = useDepositCounts();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#e6edf3" }}>
          Deposit Pool
        </h1>
        <p className="text-sm" style={{ color: "#8b949e" }}>
          Deposit STRK into a fixed-size anonymity pool. All depositors in a tier are
          indistinguishable — this is how Shroud protects your betting identity.
        </p>
      </div>

      <div className="shroud-card p-6 mb-8">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#e6edf3" }}>
          How it works
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StepItem step={1} title="Choose a tier" desc="Select 10, 100, or 1000 STRK. Larger pools have stronger anonymity." />
          <StepItem step={2} title="Approve & Deposit" desc="Approve STRK spending then deposit. A secret note is generated client-side." />
          <StepItem step={3} title="Save your note" desc="Your secret note is saved to your browser. Back it up — it's your proof of membership." />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {POOL_TIERS.map((tier, idx) => (
          <DepositCard key={tier.id} tier={tier} depositCount={depositCounts[idx]} onDeposited={refetchCounts} />
        ))}
      </div>

      {notes.length > 0 && (
        <div className="shroud-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
              Your Secret Notes ({notes.length})
            </h3>
            <button onClick={exportNotes} className="text-xs px-3 py-1.5 rounded-lg transition-colors" style={{ backgroundColor: "#30363d", color: "#e6edf3" }}>
              Download Backup
            </button>
          </div>
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="flex items-center justify-between p-3 rounded-lg text-xs" style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: note.used ? "#8b949e" : "#3fb950" }} />
                  <span style={{ color: "#e6edf3" }}>{POOL_TIERS[note.tier]?.label} Pool — {POOL_TIERS[note.tier]?.amount} STRK</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: note.used ? "#f85149" : "#3fb950" }}>{note.used ? "Used" : "Available"}</span>
                  <span style={{ color: "#8b949e" }}>{new Date(note.timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepItem({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: "linear-gradient(135deg, #58a6ff, #8b45fd)", color: "#0d1117" }}>
        {step}
      </div>
      <div>
        <h4 className="text-sm font-medium mb-1" style={{ color: "#e6edf3" }}>{title}</h4>
        <p className="text-xs" style={{ color: "#8b949e" }}>{desc}</p>
      </div>
    </div>
  );
}

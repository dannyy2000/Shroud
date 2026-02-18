"use client";

import Link from "next/link";
import { useSecretNotes } from "~~/hooks/useSecretNotes";
import { POOL_TIERS } from "~~/lib/constants";
import { useAccount } from "@starknet-react/core";

export default function PortfolioPage() {
  const { status } = useAccount();
  const { notes, unusedNotes, usedNotes, exportNotes, removeNote } = useSecretNotes();

  if (status !== "connected") {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
        <div className="text-center py-20 rounded-xl border" style={{ borderColor: "#30363d", backgroundColor: "#161b22" }}>
          <div className="text-4xl mb-4">🔐</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#e6edf3" }}>Connect your wallet</h3>
          <p className="text-sm" style={{ color: "#8b949e" }}>Connect your wallet to view your portfolio</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#e6edf3" }}>Portfolio</h1>
          <p className="text-sm" style={{ color: "#8b949e" }}>Your deposit notes, active bets, and claimable winnings</p>
        </div>
        {notes.length > 0 && (
          <button onClick={exportNotes} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: "#30363d", color: "#e6edf3" }}>
            Export All Notes
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Available Notes" value={String(unusedNotes.length)} color="#3fb950" />
        <StatCard label="Active Bets" value={String(usedNotes.length)} color="#58a6ff" />
        <StatCard label="Total Deposits" value={String(notes.length)} color="#8b949e" />
      </div>

      <Section title="Available Deposit Notes" count={unusedNotes.length}>
        {unusedNotes.length === 0 ? (
          <EmptyState icon="💰" title="No deposit notes" desc="Deposit STRK into a pool to get started" linkText="Go to Deposit" linkHref="/deposit" />
        ) : (
          <div className="space-y-3">
            {unusedNotes.map((note) => (
              <NoteRow key={note.id} note={note} onRemove={removeNote} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Active Bets" count={usedNotes.length}>
        {usedNotes.length === 0 ? (
          <EmptyState icon="🎯" title="No active bets" desc="Place a bet on any open market" linkText="Browse Markets" linkHref="/" />
        ) : (
          <div className="space-y-3">
            {usedNotes.map((note) => (
              <div key={note.id} className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#58a6ff" }} />
                  <div>
                    <span className="text-sm" style={{ color: "#e6edf3" }}>Market #{note.marketId}</span>
                    <span className="text-xs block" style={{ color: "#8b949e" }}>{POOL_TIERS[note.tier]?.label} Pool — {POOL_TIERS[note.tier]?.amount} STRK</span>
                  </div>
                </div>
                <Link href={`/market/${note.marketId}`} className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#30363d", color: "#e6edf3" }}>
                  View Market
                </Link>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="shroud-card p-5">
      <span className="text-xs block mb-1" style={{ color: "#8b949e" }}>{label}</span>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4" style={{ color: "#e6edf3" }}>
        {title} <span className="text-sm font-normal" style={{ color: "#8b949e" }}>({count})</span>
      </h2>
      {children}
    </div>
  );
}

function NoteRow({ note, onRemove }: { note: { id: string; tier: number; timestamp: number; commitment: string }; onRemove: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: "#0d1117", border: "1px solid #30363d" }}>
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#3fb950" }} />
        <div>
          <span className="text-sm" style={{ color: "#e6edf3" }}>{POOL_TIERS[note.tier]?.label} Pool — {POOL_TIERS[note.tier]?.amount} STRK</span>
          <span className="text-xs block font-mono" style={{ color: "#8b949e" }}>{note.commitment.slice(0, 10)}...{note.commitment.slice(-6)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "#8b949e" }}>{new Date(note.timestamp).toLocaleDateString()}</span>
        <button onClick={() => onRemove(note.id)} className="text-xs px-2 py-1 rounded transition-colors" style={{ color: "#f85149" }}>Remove</button>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc, linkText, linkHref }: { icon: string; title: string; desc: string; linkText: string; linkHref: string }) {
  return (
    <div className="text-center py-10 rounded-xl border" style={{ borderColor: "#30363d", backgroundColor: "#161b22" }}>
      <div className="text-3xl mb-3">{icon}</div>
      <h4 className="text-sm font-semibold mb-1" style={{ color: "#e6edf3" }}>{title}</h4>
      <p className="text-xs mb-3" style={{ color: "#8b949e" }}>{desc}</p>
      <Link href={linkHref} className="text-xs shroud-btn-primary px-4 py-2 rounded-lg inline-block">{linkText}</Link>
    </div>
  );
}

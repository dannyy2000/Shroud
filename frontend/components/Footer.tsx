"use client";

export const Footer = () => {
  return (
    <footer
      className="border-t py-6 px-4"
      style={{ backgroundColor: "#0d1117", borderColor: "#30363d" }}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
            style={{ background: "linear-gradient(135deg, #58a6ff, #8b45fd)", color: "#0d1117" }}
          >
            S
          </div>
          <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
            Shroud
          </span>
          <span className="text-xs" style={{ color: "#8b949e" }}>
            — Anonymous prediction markets on Starknet
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: "#8b949e" }}>
          <span>Built with Scaffold-Stark 2</span>
          <span style={{ color: "#30363d" }}>|</span>
          <span>Powered by ZK proofs</span>
        </div>
      </div>
    </footer>
  );
};

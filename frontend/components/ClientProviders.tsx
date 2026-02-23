"use client";

import dynamic from "next/dynamic";

function AppShell() {
  return (
    <div style={{ backgroundColor: "#0d1117", minHeight: "100vh" }}>
      <div style={{ backgroundColor: "#161b22", borderBottom: "1px solid #30363d", height: "64px" }} />
    </div>
  );
}

const ScaffoldStarkAppWithProviders = dynamic(
  () =>
    import("~~/components/ScaffoldStarkAppWithProviders").then(
      (mod) => mod.ScaffoldStarkAppWithProviders,
    ),
  { ssr: false, loading: () => <AppShell /> },
);

export const ClientProviders = ({ children }: { children: React.ReactNode }) => {
  return <ScaffoldStarkAppWithProviders>{children}</ScaffoldStarkAppWithProviders>;
};

"use client";

import dynamic from "next/dynamic";

const ScaffoldStarkAppWithProviders = dynamic(
  () =>
    import("~~/components/ScaffoldStarkAppWithProviders").then(
      (mod) => mod.ScaffoldStarkAppWithProviders,
    ),
  { ssr: false },
);

export const ClientProviders = ({ children }: { children: React.ReactNode }) => {
  return <ScaffoldStarkAppWithProviders>{children}</ScaffoldStarkAppWithProviders>;
};

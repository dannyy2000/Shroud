import type { Metadata } from "next";
import "~~/styles/globals.css";
import { ClientProviders } from "~~/components/ClientProviders";

export const metadata: Metadata = {
  title: "Shroud - Anonymous Prediction Markets",
  description: "Privacy-preserving prediction markets on Starknet with ZK proofs",
  icons: "/logo.ico",
};

const ScaffoldStarkApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning data-theme="shroud">
      <body suppressHydrationWarning>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
};

export default ScaffoldStarkApp;

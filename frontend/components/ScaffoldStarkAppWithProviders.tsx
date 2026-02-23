"use client";

import React, { useEffect, useState, Component } from "react";
import { Toaster } from "react-hot-toast";
import { StarknetConfig, starkscan } from "@starknet-react/core";
import { Header } from "~~/components/Header";
import { Footer } from "~~/components/Footer";
import { appChains, connectors } from "~~/services/web3/connectors";
import provider from "~~/services/web3/provider";
import { useNativeCurrencyPrice } from "~~/hooks/scaffold-stark/useNativeCurrencyPrice";

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "40px", color: "#f85149", background: "#0d1117", minHeight: "100vh", fontFamily: "monospace" }}>
          <h2 style={{ marginBottom: "16px" }}>App Error</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "13px", color: "#e6edf3" }}>
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const ScaffoldStarkApp = ({ children }: { children: React.ReactNode }) => {
  useNativeCurrencyPrice();
  return (
    <>
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#0d1117" }}>
        <Header />
        <main className="flex flex-col flex-1">{children}</main>
        <Footer />
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#161b22",
            color: "#e6edf3",
            border: "1px solid #30363d",
          },
        }}
      />
    </>
  );
};

export const ScaffoldStarkAppWithProviders = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return (
    <div style={{ backgroundColor: "#0d1117", minHeight: "100vh" }}>
      <div style={{ backgroundColor: "#161b22", borderBottom: "1px solid #30363d", height: "64px" }} />
    </div>
  );

  return (
    <ErrorBoundary>
      <StarknetConfig
        chains={appChains}
        provider={provider}
        connectors={connectors}
        explorer={starkscan}
      >
        <ScaffoldStarkApp>{children}</ScaffoldStarkApp>
      </StarknetConfig>
    </ErrorBoundary>
  );
};

"use client";

import { useState } from "react";
import { Address } from "@starknet-react/chains";
import { useGlobalState } from "~~/services/store/store";
import useScaffoldStrkBalance from "~~/hooks/scaffold-stark/useScaffoldStrkBalance";

type BalanceProps = {
  address?: Address;
  className?: string;
  usdMode?: boolean;
};

/**
 * Display (STRK & USD) balance of an address.
 */
export const Balance = ({ address, className = "", usdMode }: BalanceProps) => {
  const strkPrice = useGlobalState((state) => state.nativeCurrencyPrice);
  const {
    formatted: strkFormatted,
    isLoading: strkIsLoading,
    isError: strkIsError,
    symbol: strkSymbol,
  } = useScaffoldStrkBalance({
    address,
  });
  const [displayUsdMode, setDisplayUsdMode] = useState(
    strkPrice > 0 ? Boolean(usdMode) : false,
  );

  const toggleBalanceMode = () => {
    if (strkPrice > 0) {
      setDisplayUsdMode((prevMode) => !prevMode);
    }
  };

  if (!address || strkIsLoading || strkFormatted === null) {
    return (
      <div className="animate-pulse h-4 w-20 rounded" style={{ backgroundColor: "#30363d" }} />
    );
  }

  if (strkIsError) {
    return null;
  }

  // Calculate the balance in USD
  const strkBalanceInUsd = parseFloat(strkFormatted) * strkPrice;

  return (
    <button
      onClick={toggleBalanceMode}
      className={`flex items-baseline gap-1 leading-none ${className}`}
      style={{ background: "none", border: "none", padding: 0, cursor: strkPrice > 0 ? "pointer" : "default" }}
    >
      {displayUsdMode ? (
        <>
          <span className="text-xs font-medium" style={{ color: "#8b949e" }}>$</span>
          <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
            {strkBalanceInUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </>
      ) : (
        <>
          <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>
            {parseFloat(strkFormatted).toFixed(4)}
          </span>
          <span className="text-xs font-medium" style={{ color: "#8b949e" }}>{strkSymbol}</span>
        </>
      )}
    </button>
  );
};

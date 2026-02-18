import React, { useEffect, useMemo, useState } from "react";
import { Connector } from "@starknet-react/core";
import Image from "next/image";

const loader = ({ src }: { src: string }) => src;

const Wallet = ({
  handleConnectWallet,
  connector,
}: {
  connector: Connector;
  loader: ({ src }: { src: string }) => string;
  handleConnectWallet: (
    e: React.MouseEvent<HTMLButtonElement>,
    connector: Connector,
  ) => void;
}) => {
  const [clicked, setClicked] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  const icon = useMemo(() => {
    return typeof connector.icon === "object"
      ? (connector.icon.dark as string)
      : (connector.icon as string);
  }, [connector]);

  useEffect(() => {
    setIsMounted(true);
    // Check if the wallet extension is available in the browser
    const checkAvailability = () => {
      if (typeof window !== "undefined") {
        const global_object: Record<string, any> = globalThis;
        const wallet = global_object?.[`starknet_${connector.id}`];
        setIsAvailable(!!wallet);
      }
    };
    checkAvailability();
    // Re-check after a short delay (extensions may inject late)
    const timer = setTimeout(checkAvailability, 1000);
    return () => clearTimeout(timer);
  }, [connector.id]);

  if (!isMounted) return null;

  return (
    <button
      className="flex gap-4 items-center rounded-lg p-4 transition-all border w-full"
      style={{
        backgroundColor: clicked ? "#30363d" : "#0d1117",
        borderColor: "#30363d",
        color: "#e6edf3",
        opacity: 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#30363d";
        e.currentTarget.style.borderColor = "#58a6ff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = clicked ? "#30363d" : "#0d1117";
        e.currentTarget.style.borderColor = "#30363d";
      }}
      onClick={(e) => {
        if (!isAvailable) {
          // Open install link for the wallet
          const urls: Record<string, string> = {
            argentX: "https://www.argent.xyz/argent-x/",
            braavos: "https://braavos.app/",
          };
          const url = urls[connector.id];
          if (url) window.open(url, "_blank");
          return;
        }
        setClicked(true);
        handleConnectWallet(e, connector);
      }}
    >
      <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0">
        <Image
          alt={connector.name}
          loader={loader}
          src={icon}
          width={70}
          height={70}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-col items-start">
        <span className="text-sm font-medium">
          {connector.id === "argentX" ? "Argent X" : connector.name}
        </span>
        {!isAvailable && (
          <span className="text-xs" style={{ color: "#8b949e" }}>
            Not installed — click to install
          </span>
        )}
      </div>
      {isAvailable && (
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded"
          style={{ backgroundColor: "rgba(63, 185, 80, 0.15)", color: "#3fb950" }}
        >
          Detected
        </span>
      )}
    </button>
  );
};

export default Wallet;

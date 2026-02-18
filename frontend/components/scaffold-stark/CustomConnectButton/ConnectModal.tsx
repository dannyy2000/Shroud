"use client";

import { Connector, useConnect } from "@starknet-react/core";
import { useRef, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import GenericModal from "./GenericModal";
import Wallet from "~~/components/scaffold-stark/CustomConnectButton/Wallet";
import { LAST_CONNECTED_TIME_LOCALSTORAGE_KEY } from "~~/utils/Constants";

const loader = ({ src }: { src: string }) => src;

const ConnectModal = () => {
  const modalRef = useRef<HTMLInputElement>(null);
  const { connectors, connectAsync, pendingConnector } = useConnect();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [, setLastConnector] = useLocalStorage<{ id: string; ix?: number }>(
    "lastUsedConnector",
    { id: "" },
  );
  const [, setLastConnectionTime] = useLocalStorage<number>(
    LAST_CONNECTED_TIME_LOCALSTORAGE_KEY,
    0,
  );
  const [, setWasDisconnectedManually] = useLocalStorage<boolean>(
    "wasDisconnectedManually",
    false,
  );

  const handleCloseModal = () => {
    if (modalRef.current) modalRef.current.checked = false;
  };

  async function handleConnectWallet(
    e: React.MouseEvent<HTMLButtonElement>,
    connector: Connector,
  ) {
    setConnectError(null);
    setWasDisconnectedManually(false);

    try {
      await connectAsync({ connector });
      setLastConnector({ id: connector.id });
      setLastConnectionTime(Date.now());
      handleCloseModal();
    } catch (err: any) {
      console.error("Wallet connect error:", err);
      const msg = err?.message || String(err);
      if (msg.includes("not found") || msg.includes("not installed")) {
        setConnectError(
          `${connector.name} is not installed. Please install the browser extension.`,
        );
      } else if (msg.includes("rejected") || msg.includes("User abort")) {
        setConnectError("Connection rejected by user.");
      } else if (msg.includes("wallet_switchStarknetChain") || msg.includes("Unsupported")) {
        setConnectError(
          "Please switch your wallet network to Starknet Sepolia manually, then try connecting again.",
        );
      } else {
        setConnectError(msg || "Failed to connect. Please try again.");
      }
    }
  }

  return (
    <div>
      <label
        htmlFor="connect-modal"
        className="rounded-lg font-semibold px-5 py-2.5 cursor-pointer text-sm transition-all inline-flex items-center"
        style={{
          background: "linear-gradient(135deg, #58a6ff, #8b45fd)",
          color: "#0d1117",
        }}
      >
        <span>Connect</span>
      </label>
      <input
        ref={modalRef}
        type="checkbox"
        id="connect-modal"
        className="modal-toggle"
      />
      <GenericModal modalId="connect-modal">
        <>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold" style={{ color: "#e6edf3" }}>
              Connect Wallet
            </h3>
            <label
              htmlFor="connect-modal"
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              style={{ color: "#8b949e", backgroundColor: "#30363d" }}
              onClick={() => setConnectError(null)}
            >
              ✕
            </label>
          </div>

          <div className="flex flex-col gap-3">
            {connectors.map((connector, index) => (
              <div key={connector.id || index} className="relative">
                <Wallet
                  connector={connector}
                  loader={loader}
                  handleConnectWallet={handleConnectWallet}
                />
                {pendingConnector?.id === connector.id && (
                  <div
                    className="absolute inset-0 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "rgba(13, 17, 23, 0.8)" }}
                  >
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#58a6ff" }}>
                      <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: "#58a6ff" }} />
                      Connecting...
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {connectError && (
            <div
              className="mt-4 p-3 rounded-lg text-xs"
              style={{ backgroundColor: "rgba(248, 81, 73, 0.1)", border: "1px solid #f85149", color: "#f85149" }}
            >
              {connectError}
            </div>
          )}

          <p className="text-xs mt-5 text-center" style={{ color: "#8b949e" }}>
            Install{" "}
            <a href="https://www.argent.xyz/argent-x/" target="_blank" rel="noopener noreferrer" style={{ color: "#58a6ff" }}>
              ArgentX
            </a>{" "}
            or{" "}
            <a href="https://braavos.app/" target="_blank" rel="noopener noreferrer" style={{ color: "#58a6ff" }}>
              Braavos
            </a>{" "}
            to connect
          </p>
        </>
      </GenericModal>
    </div>
  );
};

export default ConnectModal;

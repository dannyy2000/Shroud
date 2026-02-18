import { injected, braavos, InjectedConnector } from "@starknet-react/core";
import { getTargetNetworks } from "~~/utils/scaffold-stark";
import { LAST_CONNECTED_TIME_LOCALSTORAGE_KEY } from "~~/utils/Constants";

const targetNetworks = getTargetNetworks();

export const connectors = getConnectors();

function withDisconnectWrapper(connector: InjectedConnector) {
  const connectorDisconnect = connector.disconnect;
  const _disconnect = (): Promise<void> => {
    localStorage.removeItem("lastUsedConnector");
    localStorage.removeItem(LAST_CONNECTED_TIME_LOCALSTORAGE_KEY);
    return connectorDisconnect();
  };
  connector.disconnect = _disconnect.bind(connector);
  return connector;
}

function withChainSwitchFallback(connector: InjectedConnector) {
  const originalConnect = connector.connect.bind(connector);
  // Override connect to handle wallets that don't support wallet_switchStarknetChain
  connector.connect = async (args: any = {}) => {
    try {
      return await originalConnect(args);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("wallet_switchStarknetChain") || msg.includes("Unsupported")) {
        // Retry without chainIdHint so it doesn't try to switch networks
        return await originalConnect({});
      }
      throw err;
    }
  };
  return connector;
}

function getConnectors() {
  const argentX = injected({ id: "argentX" });
  const connectors: InjectedConnector[] = [argentX, braavos()];
  return connectors
    .map(withChainSwitchFallback)
    .map(withDisconnectWrapper);
}

export const appChains = targetNetworks;

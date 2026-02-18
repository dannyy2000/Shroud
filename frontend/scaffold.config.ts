import { Chain } from "@starknet-react/chains";
import { supportedChains as chains } from "./supportedChains";

export type ScaffoldConfig = {
  targetNetworks: readonly Chain[];
  pollingInterval: number;
  onlyLocalBurnerWallet: boolean;
  walletAutoConnect: boolean;
  autoConnectTTL: number;
};

const scaffoldConfig = {
  targetNetworks: [chains.sepolia],
  onlyLocalBurnerWallet: false,
  pollingInterval: 30_000,
  autoConnectTTL: 60000,
  walletAutoConnect: true,
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;

import { Address } from "@starknet-react/chains";
import { useReadContract } from "@starknet-react/core";
import { BlockNumber } from "starknet";
import { formatUnits } from "ethers";
import {
  universalStrkAddress,
  strkAbi,
} from "~~/utils/Constants";

type UseScaffoldStrkBalanceProps = {
  address?: Address | string;
};

const useScaffoldStrkBalance = ({ address }: UseScaffoldStrkBalanceProps) => {
  // Use the known STRK token address directly instead of useDeployedContractInfo
  // to avoid class hash check failures on some RPCs
  const { data, ...props } = useReadContract({
    functionName: "balance_of",
    address: universalStrkAddress,
    abi: strkAbi as unknown as any[],
    watch: true,
    enabled: !!address,
    args: address ? [address] : [],
    blockIdentifier: "latest" as BlockNumber,
  });

  return {
    value: data as unknown as bigint,
    decimals: 18,
    symbol: "STRK",
    formatted: data ? formatUnits(data as unknown as bigint) : "0",
    ...props,
  };
};

export default useScaffoldStrkBalance;

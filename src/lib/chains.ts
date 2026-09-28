import { localnet, studionet, testnetAsimov, testnetBradbury } from "genlayer-js/chains";
import type { GenLayerChain } from "genlayer-js/types";

export type NetworkKey = "studionet" | "localnet" | "testnetAsimov" | "testnetBradbury";

const NETWORK_KEY = (import.meta.env.VITE_GENLAYER_NETWORK || "studionet") as NetworkKey;

const NETWORK_LABELS: Record<NetworkKey, string> = {
  studionet: "GenLayer Studio (StudioNet)",
  localnet: "GenLayer Localnet",
  testnetAsimov: "GenLayer Testnet Asimov",
  testnetBradbury: "GenLayer Testnet Bradbury",
};

function resolveChain(): GenLayerChain {
  switch (NETWORK_KEY) {
    case "localnet":
      return localnet;
    case "testnetAsimov":
      return testnetAsimov;
    case "testnetBradbury":
      return testnetBradbury;
    case "studionet":
    default:
      return studionet;
  }
}

export const activeChain = resolveChain();
export const activeNetworkKey = NETWORK_KEY;
export const activeNetworkLabel = NETWORK_LABELS[NETWORK_KEY] ?? NETWORK_KEY;

export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ||
  "") as `0x${string}`;

export const isContractConfigured =
  !!CONTRACT_ADDRESS && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

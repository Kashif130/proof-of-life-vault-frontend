/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS: string;
  readonly VITE_GENLAYER_NETWORK: string;
  readonly VITE_LOCALNET_RPC_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on?: (event: string, cb: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
    isMetaMask?: boolean;
    providers?: unknown[];
  };
}

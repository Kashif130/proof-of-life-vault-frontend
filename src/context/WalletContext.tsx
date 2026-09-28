import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  addressFromPrivateKey,
  clearStoredWallet,
  encryptAndStore,
  generateNewPrivateKey,
  getStoredWalletMeta,
  hasStoredWallet,
  unlockStoredWallet,
} from "../lib/wallet";
import type { Signer, WalletMode } from "../lib/types";
import { readClientBalance } from "../lib/client";
import { discoverInjectedWallets } from "../lib/injectedWallets";
import type { Eip1193Provider, InjectedWallet } from "../lib/injectedWallets";

interface WalletContextValue {
  mode: WalletMode;
  address: `0x${string}` | null;
  lockedAddress: `0x${string}` | null;
  balanceWei: bigint | null;
  isBusy: boolean;
  error: string | null;
  hasBurnerOnDevice: boolean;
  signer: Signer | null;
  injectedWallets: InjectedWallet[];
  injectedWalletName: string | null;
  refreshInjectedWallets: () => Promise<InjectedWallet[]>;
  createBurnerWallet: (password: string) => Promise<void>;
  importBurnerWallet: (privateKey: string, password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  forgetBurnerWallet: () => void;
  connectInjected: (walletId?: string) => Promise<void>;
  disconnectInjected: () => void;
  exportPrivateKey: () => `0x${string}` | null;
  refreshBalance: () => Promise<void>;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<WalletMode>("none");
  // `address` is only ever set once a signer is actually usable (unlocked burner key in
  // memory, or a live injected-wallet connection) — never for a merely-locked wallet, so
  // the rest of the app can gate real actions on "is address set" without a false positive.
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [lockedAddress, setLockedAddress] = useState<`0x${string}` | null>(null);
  const [privateKey, setPrivateKey] = useState<`0x${string}` | null>(null);
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [injectedWallets, setInjectedWallets] = useState<InjectedWallet[]>([]);
  const [injectedProvider, setInjectedProvider] = useState<Eip1193Provider | null>(null);
  const [injectedWalletName, setInjectedWalletName] = useState<string | null>(null);

  const refreshInjectedWallets = useCallback(async () => {
    const list = await discoverInjectedWallets();
    setInjectedWallets(list);
    return list;
  }, []);

  // Discover installed wallets up front so the connect dialog can list them immediately.
  useEffect(() => {
    void refreshInjectedWallets();
  }, [refreshInjectedWallets]);

  // Follow account switches made inside the connected extension.
  useEffect(() => {
    if (mode !== "injected" || !injectedProvider?.on) return;
    const onAccountsChanged = (accounts: unknown) => {
      const next = (accounts as string[] | undefined)?.[0];
      if (next) {
        setAddress(next as `0x${string}`);
      } else {
        setAddress(null);
        setBalanceWei(null);
        setInjectedProvider(null);
        setInjectedWalletName(null);
        setMode(hasStoredWallet() ? "burner-locked" : "none");
      }
    };
    injectedProvider.on("accountsChanged", onAccountsChanged);
    return () => injectedProvider.removeListener?.("accountsChanged", onAccountsChanged);
  }, [mode, injectedProvider]);

  useEffect(() => {
    if (hasStoredWallet()) {
      setMode("burner-locked");
      const meta = getStoredWalletMeta();
      if (meta) setLockedAddress(meta.address);
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!address) {
      setBalanceWei(null);
      return;
    }
    try {
      const bal = await readClientBalance(address);
      setBalanceWei(bal);
    } catch {
      // Balance is a nice-to-have; a failed RPC read shouldn't break the wallet UI.
    }
  }, [address]);

  useEffect(() => {
    void refreshBalance();
    const id = setInterval(() => void refreshBalance(), 15000);
    return () => clearInterval(id);
  }, [refreshBalance]);

  const clearError = useCallback(() => setError(null), []);

  const createBurnerWallet = useCallback(async (password: string) => {
    setIsBusy(true);
    setError(null);
    try {
      if (password.length < 6) throw new Error("Choose a password with at least 6 characters.");
      const pk = generateNewPrivateKey();
      await encryptAndStore(pk, password);
      setPrivateKey(pk);
      const addr = addressFromPrivateKey(pk);
      setAddress(addr);
      setLockedAddress(addr);
      setMode("burner-unlocked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a wallet.");
      throw e;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const importBurnerWallet = useCallback(async (rawKey: string, password: string) => {
    setIsBusy(true);
    setError(null);
    try {
      if (password.length < 6) throw new Error("Choose a password with at least 6 characters.");
      const pk = rawKey.trim() as `0x${string}`;
      await encryptAndStore(pk, password);
      setPrivateKey(pk);
      const addr = addressFromPrivateKey(pk);
      setAddress(addr);
      setLockedAddress(addr);
      setMode("burner-unlocked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import that key.");
      throw e;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const unlock = useCallback(async (password: string) => {
    setIsBusy(true);
    setError(null);
    try {
      const pk = await unlockStoredWallet(password);
      setPrivateKey(pk);
      setAddress(addressFromPrivateKey(pk));
      // lockedAddress is already set from the stored meta; keep it as-is.
      setMode("burner-unlocked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlock the wallet.");
      throw e;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const lock = useCallback(() => {
    setPrivateKey(null);
    setAddress(null);
    setMode("burner-locked");
  }, []);

  const forgetBurnerWallet = useCallback(() => {
    clearStoredWallet();
    setPrivateKey(null);
    setAddress(null);
    setLockedAddress(null);
    setBalanceWei(null);
    setMode("none");
  }, []);

  const connectInjected = useCallback(
    async (walletId?: string) => {
      setIsBusy(true);
      setError(null);
      try {
        // Re-scan in case the wallet finished injecting after the page loaded.
        const list = injectedWallets.length ? injectedWallets : await refreshInjectedWallets();
        const chosen = walletId ? list.find((w) => w.id === walletId) : list[0];
        if (!chosen) {
          throw new Error(
            "No browser wallet was found. Install an EVM wallet extension (MetaMask, Rabby, Coinbase Wallet, Trust, OKX...) or use the built-in wallet.",
          );
        }
        const accounts = (await chosen.provider.request({
          method: "eth_requestAccounts",
        })) as string[];
        if (!accounts?.[0]) throw new Error("No account was returned by the wallet.");
        setAddress(accounts[0] as `0x${string}`);
        setPrivateKey(null);
        setInjectedProvider(chosen.provider);
        setInjectedWalletName(chosen.name);
        setMode("injected");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not connect a browser wallet.");
        throw e;
      } finally {
        setIsBusy(false);
      }
    },
    [injectedWallets, refreshInjectedWallets],
  );

  const disconnectInjected = useCallback(() => {
    setAddress(null);
    setBalanceWei(null);
    setInjectedProvider(null);
    setInjectedWalletName(null);
    setMode(hasStoredWallet() ? "burner-locked" : "none");
  }, []);

  const exportPrivateKey = useCallback((): `0x${string}` | null => privateKey, [privateKey]);

  const signer: Signer | null = useMemo(() => {
    if (!address) return null;
    if (privateKey) return { address, privateKey };
    return injectedProvider ? { address, provider: injectedProvider } : { address };
  }, [address, privateKey, injectedProvider]);

  const value: WalletContextValue = {
    mode,
    address,
    lockedAddress,
    balanceWei,
    isBusy,
    error,
    hasBurnerOnDevice: hasStoredWallet(),
    signer,
    injectedWallets,
    injectedWalletName,
    refreshInjectedWallets,
    createBurnerWallet,
    importBurnerWallet,
    unlock,
    lock,
    forgetBurnerWallet,
    connectInjected,
    disconnectInjected,
    exportPrivateKey,
    refreshBalance,
    clearError,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}

/**
 * Discovery + activation of browser-injected EVM wallets.
 *
 * Works with any wallet that follows either standard:
 *  - EIP-6963 (multi-wallet discovery: MetaMask, Rabby, Coinbase Wallet, Trust, OKX, Phantom EVM, ...)
 *  - legacy `window.ethereum` (and the older `window.ethereum.providers` array some wallets expose
 *    when several extensions are installed at once)
 *
 * The built-in burner wallet is unaffected; this module only concerns extension/injected wallets.
 */

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
}

export interface InjectedWallet {
  /** Stable id: the EIP-6963 rdns when available, otherwise a synthetic legacy id. */
  id: string;
  name: string;
  icon?: string; // data URI from EIP-6963
  provider: Eip1193Provider;
}

interface Eip6963Detail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Eip1193Provider;
}

/** Collects announced wallets for a short window, then resolves with the merged list. */
export function discoverInjectedWallets(waitMs = 300): Promise<InjectedWallet[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve([]);
    const found = new Map<string, InjectedWallet>();

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963Detail>).detail;
      if (!detail?.info || !detail.provider) return;
      found.set(detail.info.rdns || detail.info.uuid, {
        id: detail.info.rdns || detail.info.uuid,
        name: detail.info.name,
        icon: detail.info.icon,
        provider: detail.provider,
      });
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);

      // Legacy fallback for wallets that don't announce via EIP-6963.
      const eth = window.ethereum as
        | (Eip1193Provider & { providers?: Eip1193Provider[]; isMetaMask?: boolean })
        | undefined;
      const legacy: Eip1193Provider[] = eth?.providers?.length ? eth.providers : eth ? [eth] : [];
      const alreadyCovered = (p: Eip1193Provider) =>
        [...found.values()].some((w) => w.provider === p);
      legacy.forEach((p, i) => {
        if (alreadyCovered(p)) return;
        found.set(`legacy-${i}`, {
          id: `legacy-${i}`,
          name: legacyName(p),
          provider: p,
        });
      });

      resolve([...found.values()]);
    }, waitMs);
  });
}

function legacyName(p: Eip1193Provider): string {
  const flags = p as unknown as Record<string, unknown>;
  if (flags.isRabby) return "Rabby";
  if (flags.isCoinbaseWallet) return "Coinbase Wallet";
  if (flags.isTrust || flags.isTrustWallet) return "Trust Wallet";
  if (flags.isOkxWallet || flags.isOKExWallet) return "OKX Wallet";
  if (flags.isMetaMask) return "MetaMask";
  return "Browser wallet";
}

/**
 * genlayer-js signs injected-wallet transactions through `window.ethereum`. With several
 * wallets installed, that global may point at a different wallet than the one the user picked,
 * so for the duration of one call we point it at the chosen provider, then restore it.
 * If a wallet locks `window.ethereum` as read-only we fall back to the default behaviour.
 */
export async function withActiveProvider<T>(
  provider: Eip1193Provider | null,
  fn: () => Promise<T>,
): Promise<T> {
  if (!provider || typeof window === "undefined" || window.ethereum === provider) return fn();
  const desc = Object.getOwnPropertyDescriptor(window, "ethereum");
  const canOverride = !desc || desc.configurable || desc.writable;
  if (!canOverride) return fn();
  try {
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      writable: true,
      value: provider,
    });
  } catch {
    return fn();
  }
  try {
    return await fn();
  } finally {
    try {
      if (desc) Object.defineProperty(window, "ethereum", desc);
      else delete (window as { ethereum?: unknown }).ethereum;
    } catch {
      /* best effort restore */
    }
  }
}

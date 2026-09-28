import { createClient, createAccount } from "genlayer-js";
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";
import { activeChain, CONTRACT_ADDRESS } from "./chains";
import type { VaultData, Beneficiary, Signer } from "./types";
import { withActiveProvider } from "./injectedWallets";
import type { Eip1193Provider } from "./injectedWallets";

// A read-only client needs no signer at all — every view method on ProofOfLifeVault is a
// free call with no wallet interaction, so the app can show data before any wallet exists.
const readClient = createClient({ chain: activeChain });

/**
 * Builds a write-capable client bound to a specific signer for exactly one transaction.
 * `signer` is either a raw private key (burner wallet) or an already-connected injected
 * address string (MetaMask etc, per genlayer-js's own account-as-address pattern).
 */
function writeClientFor(signer: `0x${string}`, isPrivateKey: boolean) {
  const account: unknown = isPrivateKey ? createAccount(signer) : signer;
  return createClient({ chain: activeChain, account } as Parameters<typeof createClient>[0]);
}

export type { Signer };

/** Native-token balance for a wallet address (for a "have I got gas" hint in the UI). */
export async function readClientBalance(address: `0x${string}`): Promise<bigint> {
  const client = readClient as unknown as {
    getBalance: (args: { address: `0x${string}` }) => Promise<bigint>;
  };
  return client.getBalance({ address });
}

async function read<T>(functionName: string, args: unknown[] = []): Promise<T> {
  return readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    stateStatus: "accepted",
  }) as Promise<T>;
}


/**
 * Turns the raw RPC "NonceTooHigh(expected=X,actual=Y)" failure into something a person can act
 * on. This error means the wallet stamped the transaction with a nonce (Y) that is ahead of what
 * the GenLayer node has for that account (X). It is never a contract problem: it happens when a
 * wallet's cached transaction count for this network is stale -- typically after a Studio/local
 * network reset, or when the same account was used on another network that shares this chain id.
 * The transaction never reached the contract, so nothing was written and it is safe to retry.
 */
function explainTxError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.match(/NonceTooHigh\(\s*expected\s*=\s*(\d+)\s*,\s*actual\s*=\s*(\d+)\s*\)/i);
  if (!m && !/nonce too high/i.test(msg)) return e instanceof Error ? e : new Error(msg);
  const detail = m ? ` (network expects nonce ${m[1]}, your wallet sent ${m[2]})` : "";
  return new Error(
    `Your wallet's transaction counter is out of sync with the network${detail}. Nothing was sent. ` +
      "Fix: in your wallet, reset the account's activity/nonce data for this network " +
      "(MetaMask: Settings > Advanced > Clear activity tab data; Rabby: Settings > Clear Pending), " +
      "make sure it is connected to the GenLayer network this app uses, then try again. " +
      "With the built-in wallet, just retry.",
  );
}


/**
 * Makes sure the injected wallet is on the GenLayer network this app targets before it signs.
 * Without this the wallet signs with whatever network happens to be selected in it -- and its
 * nonce for *that* network (e.g. an account with ~1700 txs elsewhere) gets stamped on a
 * transaction the GenLayer node then rejects with NonceTooHigh. This is why the app can work
 * perfectly for one person (wallet already on the right network) and fail for another.
 */
export async function ensureWalletOnActiveChain(provider: Eip1193Provider | null): Promise<void> {
  const p = provider ?? (typeof window !== "undefined" ? (window.ethereum as Eip1193Provider | undefined) : undefined);
  if (!p) return;
  const wantHex = `0x${activeChain.id.toString(16)}`;
  const current = String(await p.request({ method: "eth_chainId" }));
  if (current.toLowerCase() === wantHex.toLowerCase()) return;
  try {
    await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: wantHex }] });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    // 4902 / -32603: the wallet doesn't know this network yet -> add it, which also switches to it.
    if (code !== 4902 && code !== -32603) {
      throw new Error(
        `Please switch your wallet to ${activeChain.name} (chain id ${activeChain.id}) and try again.`,
      );
    }
    await p.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: wantHex,
          chainName: activeChain.name,
          nativeCurrency: activeChain.nativeCurrency,
          rpcUrls: activeChain.rpcUrls.default.http,
          blockExplorerUrls: activeChain.blockExplorers?.default?.url
            ? [activeChain.blockExplorers.default.url]
            : undefined,
        },
      ],
    });
  }
}

/** Shape of the fields we care about on a transaction receipt -- kept loose/`unknown`-cast at
 * the call site since we don't depend on genlayer-js's exact receipt type surface. */
interface ReceiptExecutionInfo {
  txExecutionResultName?: string;
  stderr?: string;
  result?: { stderr?: string };
  data?: { stderr?: string };
}

async function write(
  signer: Signer,
  functionName: string,
  args: unknown[],
  valueWei?: bigint,
): Promise<string> {
  const isPrivateKey = !!signer.privateKey;
  const client = writeClientFor(signer.privateKey ?? signer.address, isPrivateKey);
  // For an injected wallet, make sure the wallet the user actually picked is the one that signs
  // (matters when several extensions are installed). No-op for the burner wallet.
  let hash: Awaited<ReturnType<typeof client.writeContract>>;
  try {
    if (!isPrivateKey) await ensureWalletOnActiveChain(signer.provider ?? null);
    hash = await withActiveProvider(isPrivateKey ? null : (signer.provider ?? null), () =>
      client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
        value: valueWei ?? 0n,
      }),
    );
  } catch (e) {
    throw explainTxError(e);
  }
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    retries: 60,
    interval: 3000,
    fullTransaction: true,
  });

  // Consensus reaching ACCEPTED only means validators agreed on an outcome -- that outcome can
  // itself be a failed execution (a contract-side validation error, for instance). Treating
  // ACCEPTED alone as success was the source of a real bug: a rejected transaction would still
  // show a false "success" toast while nothing was actually written to the vault. We surface the
  // real failure here instead, with whatever detail the receipt gives us.
  const r = receipt as unknown as ReceiptExecutionInfo;
  if (r.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
    const detail = r.stderr || r.result?.stderr || r.data?.stderr;
    throw new Error(
      detail
        ? `The contract rejected this transaction: ${detail}`
        : "The contract rejected this transaction (execution failed). Double-check your inputs.",
    );
  }
  if (r.txExecutionResultName === ExecutionResult.NOT_VOTED) {
    throw new Error(
      "The network hasn't finished voting on this transaction yet. Wait a moment and check whether it went through before retrying.",
    );
  }
  return hash;
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export const getVault = (owner: string) => read<VaultData>("get_vault", [owner]);
export const getBeneficiaries = (owner: string) =>
  read<Beneficiary[]>("get_beneficiaries", [owner]);
export const getClaimableAmount = (owner: string, beneficiary: string) =>
  read<string>("get_claimable_amount", [owner, beneficiary]);
export const isRegistered = (owner: string) => read<boolean>("is_registered", [owner]);
export const secondsUntilTriggerable = (owner: string) =>
  read<string>("seconds_until_triggerable", [owner]);
export const secondsUntilFinalizable = (owner: string) =>
  read<string>("seconds_until_finalizable", [owner]);
export const listVaults = (offset: number, limit: number) =>
  read<VaultData[]>("list_vaults", [offset, limit]);

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const createVault = (
  signer: Signer,
  params: {
    checkInIntervalSeconds: number;
    beneficiaryAddresses: string[];
    beneficiaryBps: number[];
    githubUrl: string;
    twitterUrl: string;
    websiteUrl: string;
  },
) =>
  write(signer, "create_vault", [
    params.checkInIntervalSeconds,
    params.beneficiaryAddresses,
    params.beneficiaryBps,
    params.githubUrl,
    params.twitterUrl,
    params.websiteUrl,
  ]);

export const updateBeneficiaries = (
  signer: Signer,
  beneficiaryAddresses: string[],
  beneficiaryBps: number[],
) => write(signer, "update_beneficiaries", [beneficiaryAddresses, beneficiaryBps]);

export const updateLifeSignals = (
  signer: Signer,
  githubUrl: string,
  twitterUrl: string,
  websiteUrl: string,
) => write(signer, "update_life_signals", [githubUrl, twitterUrl, websiteUrl]);

export const updateCheckInInterval = (signer: Signer, seconds: number) =>
  write(signer, "update_check_in_interval", [seconds]);

export const updateBackupSigner = (signer: Signer, backupSigner: string, enabled: boolean) =>
  write(signer, "update_backup_signer", [backupSigner, enabled]);

export const deposit = (signer: Signer, owner: string, amountWei: bigint) =>
  write(signer, "deposit", [owner], amountWei);

export const ownerWithdraw = (signer: Signer, amountWei: bigint) =>
  write(signer, "owner_withdraw", [amountWei]);

export const checkIn = (signer: Signer, owner: string) => write(signer, "check_in", [owner]);

export const triggerInheritance = (signer: Signer, owner: string) =>
  write(signer, "trigger_inheritance", [owner]);

export const runLifeSignalCheck = (signer: Signer, owner: string) =>
  write(signer, "run_life_signal_check", [owner]);

export const finalizeInheritance = (signer: Signer, owner: string) =>
  write(signer, "finalize_inheritance", [owner]);

export const claimShare = (signer: Signer, owner: string) =>
  write(signer, "claim_share", [owner]);

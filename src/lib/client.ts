import { createClient, createAccount } from "genlayer-js";
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";
import { activeChain, CONTRACT_ADDRESS } from "./chains";
import type { VaultData, Beneficiary, Signer } from "./types";
import { withActiveProvider } from "./injectedWallets";

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
  const hash = await withActiveProvider(isPrivateKey ? null : (signer.provider ?? null), () =>
    client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName,
      args,
      value: valueWei ?? 0n,
    }),
  );
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

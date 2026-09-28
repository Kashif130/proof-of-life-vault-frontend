import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../context/ToastContext";
import { useVault } from "../hooks/useVault";
import {
  claimShare,
  deposit,
  finalizeInheritance,
  getClaimableAmount,
  runLifeSignalCheck,
  secondsUntilFinalizable,
  secondsUntilTriggerable,
  triggerInheritance,
} from "../lib/client";
import { Button, Card, HelperText, Input, Label } from "../components/ui";
import { BeneficiaryList, CountdownDial, StatusBadge } from "../components/vault";
import { formatIsoTimestamp, fromWei, isoToUnixSeconds, toWei, NATIVE_SYMBOL } from "../lib/format";

export function VaultDetail() {
  const { owner } = useParams<{ owner: string }>();
  const wallet = useWallet();
  const toast = useToast();
  const { vault, beneficiaries, registered, loading, error, refresh } = useVault(owner ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [triggerReady, setTriggerReady] = useState<number | null>(null);
  const [finalizeReady, setFinalizeReady] = useState<number | null>(null);
  const [claimable, setClaimable] = useState<string | null>(null);

  useEffect(() => {
    if (!owner || !registered) return;
    void secondsUntilTriggerable(owner).then((s) => setTriggerReady(Number(s)));
    void secondsUntilFinalizable(owner).then((s) => setFinalizeReady(Number(s)));
  }, [owner, registered, vault?.status]);

  useEffect(() => {
    if (!owner || !wallet.address || !registered) {
      setClaimable(null);
      return;
    }
    void getClaimableAmount(owner, wallet.address).then(setClaimable);
  }, [owner, wallet.address, registered, vault?.status]);

  if (!owner) return <p className="text-[14px] text-bone-400">No address given.</p>;

  const run = async (label: string, fn: () => Promise<unknown>, successMsg: string) => {
    if (!wallet.signer) {
      toast.push("error", "Connect a wallet first.");
      return;
    }
    setBusy(label);
    try {
      await fn();
      toast.push("success", successMsg);
      refresh();
    } catch (e) {
      toast.push("error", "Transaction failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-[14px] text-bone-400">Loading vault…</p>;
  if (error)
    return (
      <Card className="p-6">
        <HelperText tone="error">{error}</HelperText>
      </Card>
    );
  if (!registered || !vault)
    return (
      <Card className="p-6">
        <p className="text-[14px] text-bone-300">No vault is registered for this address.</p>
      </Card>
    );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[13px] text-bone-500">{owner}</p>
          <div className="mt-1 flex items-center gap-3">
            <StatusBadge status={vault.status} />
            <span className="text-[13px] text-bone-500">
              {fromWei(vault.balance)} {NATIVE_SYMBOL} held
            </span>
          </div>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-md border border-vault-600 px-2.5 py-1.5 text-[12px] text-bone-400 hover:border-brass-400"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <Card className="p-6">
        {vault.status === "ACTIVE" && (
          <>
            <p className="text-[13px] text-bone-400">
              Active and owned. Last checked in {formatIsoTimestamp(vault.last_check_in_at)}.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                loading={busy === "trigger"}
                disabled={triggerReady !== 0}
                onClick={() =>
                  run(
                    "trigger",
                    () => triggerInheritance(wallet.signer!, owner),
                    "Contestation window started.",
                  )
                }
              >
                {triggerReady === 0
                  ? "Start contestation window"
                  : "Not yet triggerable"}
              </Button>
              <HelperText>
                Anyone may call this once the owner's check-in interval has lapsed.
              </HelperText>
            </div>
          </>
        )}
        {vault.status === "TRIGGERED" && vault.contestation_deadline && (
          <>
            <CountdownDial
              targetUnixSeconds={isoToUnixSeconds(vault.contestation_deadline)}
              totalSeconds={30 * 86400}
              urgent
              caption="Contestation window in progress. A fresh check-in from the owner cancels this instantly."
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="secondary"
                loading={busy === "lifesignal"}
                disabled={!vault.github_url && !vault.twitter_url && !vault.website_url}
                onClick={() =>
                  run(
                    "lifesignal",
                    () => runLifeSignalCheck(wallet.signer!, owner),
                    "Life-signal check submitted.",
                  )
                }
              >
                Run life-signal check
              </Button>
              <Button
                loading={busy === "finalize"}
                disabled={finalizeReady !== 0}
                onClick={() =>
                  run("finalize", () => finalizeInheritance(wallet.signer!, owner), "Finalized.")
                }
              >
                {finalizeReady === 0 ? "Finalize inheritance" : "Not yet finalizable"}
              </Button>
            </div>
            {vault.life_signal_verdict && (
              <p className="mt-3 text-[12px] text-bone-500">
                Last verdict: {vault.life_signal_verdict} — {vault.life_signal_rationale}
              </p>
            )}
          </>
        )}
        {vault.status === "INHERITABLE" && (
          <p className="text-[13px] text-bone-300">
            Finalized on {formatIsoTimestamp(vault.finalized_at)}. Distributable balance:{" "}
            {fromWei(vault.distributable_balance)} {NATIVE_SYMBOL}. {vault.claimed_count}/
            {vault.beneficiary_count} shares claimed.
          </p>
        )}
      </Card>

      {claimable && claimable !== "0" && (
        <Card className="border-verdigris-500/40 bg-verdigris-500/10 p-6">
          <p className="text-[14px] text-bone-100">
            You can claim {fromWei(claimable)} {NATIVE_SYMBOL} from this vault.
          </p>
          <Button
            className="mt-3"
            loading={busy === "claim"}
            onClick={() => run("claim", () => claimShare(wallet.signer!, owner), "Share claimed.")}
          >
            Claim my share
          </Button>
        </Card>
      )}

      <Card className="space-y-4 p-6">
        <Label>Deposit funds</Label>
        <p className="text-[12px] text-bone-500">
          Depositing is permissionless — anyone can add funds to this vault.
        </p>
        <div className="flex gap-2">
          <Input
            inputMode="decimal"
            placeholder={`Amount in ${NATIVE_SYMBOL}`}
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          <Button
            loading={busy === "deposit"}
            onClick={() =>
              run("deposit", () => deposit(wallet.signer!, owner, toWei(depositAmount)), "Deposit confirmed.")
            }
          >
            Deposit
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <Label>Beneficiaries</Label>
        <BeneficiaryList beneficiaries={beneficiaries} />
      </Card>
    </div>
  );
}

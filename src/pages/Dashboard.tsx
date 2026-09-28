import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../context/ToastContext";
import { useVault } from "../hooks/useVault";
import {
  checkIn,
  deposit,
  finalizeInheritance,
  ownerWithdraw,
  runLifeSignalCheck,
  updateBackupSigner,
  updateBeneficiaries,
  updateCheckInInterval,
  updateLifeSignals,
} from "../lib/client";
import { Button, Card, HelperText, Input, Label } from "../components/ui";
import {
  BeneficiaryEditor,
  BeneficiaryList,
  BeneficiaryRow,
  CountdownDial,
  StatusBadge,
  percentToBps,
} from "../components/vault";
import { WalletPanel } from "../components/WalletPanel";
import { formatIsoTimestamp, fromWei, isoToUnixSeconds, toWei, NATIVE_SYMBOL } from "../lib/format";

const DAY = 86400;
const CONTESTATION_WINDOW_SECONDS = 30 * DAY;

export function Dashboard() {
  const wallet = useWallet();
  const toast = useToast();
  const { vault, beneficiaries, registered, loading, error, refresh } = useVault(
    wallet.address ?? null,
  );

  if (!wallet.address) {
    return (
      <Card className="mx-auto flex max-w-md flex-col items-start gap-4 p-6">
        <p className="text-[14px] text-bone-200">Connect or create a wallet to see your vault.</p>
        <WalletPanel />
      </Card>
    );
  }

  if (loading) {
    return <p className="text-[14px] text-bone-400">Loading your vault…</p>;
  }

  if (error) {
    return (
      <Card className="p-6">
        <HelperText tone="error">{error}</HelperText>
        <Button variant="secondary" className="mt-4" onClick={() => void refresh()}>
          Try again
        </Button>
      </Card>
    );
  }

  if (!registered || !vault) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <p className="text-[14px] text-bone-200">You don't have a vault yet.</p>
        <Link
          to="/create"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-brass-400 px-5 py-2.5 text-[14px] font-medium text-vault-950 hover:bg-brass-300"
        >
          Create your vault <ArrowUpRight className="h-4 w-4" />
        </Link>
      </Card>
    );
  }

  return <OwnerDashboard owner={wallet.address} onChanged={refresh} vaultInitial={vault} beneficiariesInitial={beneficiaries} />;
}

function OwnerDashboard({
  owner,
  onChanged,
  vaultInitial,
  beneficiariesInitial,
}: {
  owner: `0x${string}`;
  onChanged: () => void;
  vaultInitial: NonNullable<ReturnType<typeof useVault>["vault"]>;
  beneficiariesInitial: ReturnType<typeof useVault>["beneficiaries"];
}) {
  const wallet = useWallet();
  const toast = useToast();
  const vault = vaultInitial;
  const beneficiaries = beneficiariesInitial;

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [editingBeneficiaries, setEditingBeneficiaries] = useState(false);
  const [rows, setRows] = useState<BeneficiaryRow[]>(
    beneficiaries.length
      ? beneficiaries.map((b) => ({ address: b.address, percent: String(b.bps / 100) }))
      : [{ address: "", percent: "" }],
  );
  const [editingInterval, setEditingInterval] = useState(false);
  const [intervalDays, setIntervalDays] = useState(String(vault.check_in_interval_seconds / DAY));
  const [editingSignals, setEditingSignals] = useState(false);
  const [githubUrl, setGithubUrl] = useState(vault.github_url);
  const [twitterUrl, setTwitterUrl] = useState(vault.twitter_url);
  const [websiteUrl, setWebsiteUrl] = useState(vault.website_url);
  const [backupSignerAddr, setBackupSignerAddr] = useState(vault.backup_signer || "");
  const [formError, setFormError] = useState<string | null>(null);

  const signer = wallet.signer;
  const isActive = vault.status === "ACTIVE";
  const isTriggered = vault.status === "TRIGGERED";
  const isInheritable = vault.status === "INHERITABLE";

  const run = async (label: string, fn: () => Promise<unknown>, successMsg: string) => {
    if (!signer) {
      toast.push("error", "Connect a wallet to do this.");
      return;
    }
    setBusyAction(label);
    setFormError(null);
    try {
      await fn();
      toast.push("success", successMsg);
      onChanged();
    } catch (e) {
      const message = e instanceof Error ? e.message : "The transaction failed.";
      toast.push("error", "Transaction failed", message);
    } finally {
      setBusyAction(null);
    }
  };

  const checkInDeadline = isoToUnixSeconds(vault.last_check_in_at) + vault.check_in_interval_seconds;
  const contestationDeadline = vault.contestation_deadline
    ? isoToUnixSeconds(vault.contestation_deadline)
    : null;

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
        <div className="flex items-center gap-2">
          <Link
            to={`/vault/${owner}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-bone-400 hover:text-brass-300"
          >
            View public page <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={onChanged}
            className="inline-flex items-center gap-1.5 rounded-md border border-vault-600 px-2.5 py-1.5 text-[12px] text-bone-400 hover:border-brass-400"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      <Card className="p-6">
        {isActive && (
          <CountdownDial
            targetUnixSeconds={checkInDeadline}
            totalSeconds={vault.check_in_interval_seconds}
            caption="Time left before anyone can start a contestation window. Check in any time to reset the clock."
          />
        )}
        {isTriggered && (
          <CountdownDial
            targetUnixSeconds={contestationDeadline}
            totalSeconds={CONTESTATION_WINDOW_SECONDS}
            urgent
            caption="A contestation window is open. Check in now to cancel it immediately — this is the last word, no matter what."
          />
        )}
        {isInheritable && (
          <div className="text-[14px] text-bone-300">
            This vault was finalized on {formatIsoTimestamp(vault.finalized_at)}. It can no longer
            be reactivated — beneficiaries can now claim their shares.
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            loading={busyAction === "checkin"}
            disabled={isInheritable}
            onClick={() => run("checkin", () => checkIn(signer!, owner), "Checked in — the clock is reset.")}
          >
            Check in now
          </Button>
          {isTriggered && (
            <Button
              variant="secondary"
              loading={busyAction === "lifesignal"}
              disabled={!vault.github_url && !vault.twitter_url && !vault.website_url}
              onClick={() =>
                run(
                  "lifesignal",
                  () => runLifeSignalCheck(signer!, owner),
                  "Life-signal check submitted for consensus.",
                )
              }
            >
              Run life-signal check
            </Button>
          )}
          {isTriggered && (
            <Button
              variant="secondary"
              loading={busyAction === "finalize"}
              onClick={() =>
                run("finalize", () => finalizeInheritance(signer!, owner), "Vault finalized.")
              }
            >
              Finalize now
            </Button>
          )}
        </div>
        {isTriggered && vault.life_signal_verdict && (
          <p className="mt-4 text-[12px] text-bone-500">
            Last life-signal verdict: <span className="text-bone-300">{vault.life_signal_verdict}</span>
            {vault.life_signal_rationale ? ` — ${vault.life_signal_rationale}` : ""}
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <Label>Deposit funds</Label>
          <div className="flex gap-2">
            <Input
              inputMode="decimal"
              placeholder={`Amount in ${NATIVE_SYMBOL}`}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <Button
              loading={busyAction === "deposit"}
              onClick={() =>
                run(
                  "deposit",
                  () => deposit(signer!, owner, toWei(depositAmount)),
                  "Deposit confirmed.",
                )
              }
            >
              Deposit
            </Button>
          </div>
          <HelperText>Anyone can deposit — family or friends can top this vault up too.</HelperText>
        </Card>

        <Card className="space-y-4 p-6">
          <Label>Withdraw (owner only, while active)</Label>
          <div className="flex gap-2">
            <Input
              inputMode="decimal"
              placeholder={`Amount in ${NATIVE_SYMBOL}`}
              value={withdrawAmount}
              disabled={!isActive}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
            <Button
              variant="secondary"
              disabled={!isActive}
              loading={busyAction === "withdraw"}
              onClick={() =>
                run(
                  "withdraw",
                  () => ownerWithdraw(signer!, toWei(withdrawAmount)),
                  "Withdrawal confirmed.",
                )
              }
            >
              Withdraw
            </Button>
          </div>
          <HelperText>This is not a one-way lock — take funds out any time you're active.</HelperText>
        </Card>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <Label>Beneficiaries</Label>
          {isActive && (
            <button
              onClick={() => setEditingBeneficiaries((v) => !v)}
              className="text-[12px] text-brass-300 hover:text-brass-200"
            >
              {editingBeneficiaries ? "Cancel" : "Edit"}
            </button>
          )}
        </div>
        {editingBeneficiaries ? (
          <div className="space-y-3">
            <BeneficiaryEditor rows={rows} onChange={setRows} />
            {formError && <HelperText tone="error">{formError}</HelperText>}
            <Button
              loading={busyAction === "beneficiaries"}
              onClick={() => {
                const addrs = rows.map((r) => r.address.trim());
                const bps = rows.map((r) => percentToBps(r.percent));
                if (bps.reduce((a, b) => a + b, 0) !== 10000) {
                  setFormError("Shares must add up to exactly 100%.");
                  return;
                }
                if (addrs.some((a) => !/^0x[0-9a-fA-F]{40}$/.test(a))) {
                  setFormError("Every beneficiary needs a valid address.");
                  return;
                }
                void run(
                  "beneficiaries",
                  () => updateBeneficiaries(signer!, addrs, bps),
                  "Beneficiaries updated.",
                ).then(() => setEditingBeneficiaries(false));
              }}
            >
              Save beneficiaries
            </Button>
          </div>
        ) : (
          <BeneficiaryList beneficiaries={beneficiaries} />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <Label hint={isActive ? undefined : "only while active"}>Check-in interval</Label>
            {isActive && (
              <button
                onClick={() => setEditingInterval((v) => !v)}
                className="text-[12px] text-brass-300 hover:text-brass-200"
              >
                {editingInterval ? "Cancel" : "Edit"}
              </button>
            )}
          </div>
          {editingInterval ? (
            <div className="flex gap-2">
              <Input
                type="number"
                min={30}
                max={730}
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
                className="w-28"
              />
              <Button
                loading={busyAction === "interval"}
                onClick={() =>
                  run(
                    "interval",
                    () => updateCheckInInterval(signer!, Number(intervalDays) * DAY),
                    "Check-in interval updated.",
                  ).then(() => setEditingInterval(false))
                }
              >
                Save
              </Button>
            </div>
          ) : (
            <p className="text-[14px] text-bone-200">
              {vault.check_in_interval_seconds / DAY} days
            </p>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <Label>Backup signer</Label>
          <p className="text-[12px] text-bone-500">
            Can call check-in on your behalf. Cannot touch funds or settings.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="0x…"
              className="font-mono"
              value={backupSignerAddr}
              onChange={(e) => setBackupSignerAddr(e.target.value)}
            />
            <Button
              variant="secondary"
              loading={busyAction === "backup-enable"}
              disabled={!/^0x[0-9a-fA-F]{40}$/.test(backupSignerAddr.trim())}
              onClick={() =>
                run(
                  "backup-enable",
                  () => updateBackupSigner(signer!, backupSignerAddr.trim(), true),
                  "Backup signer enabled.",
                )
              }
            >
              Enable
            </Button>
          </div>
          {vault.has_backup_signer && (
            <Button
              variant="ghost"
              loading={busyAction === "backup-disable"}
              onClick={() =>
                run(
                  "backup-disable",
                  () => updateBackupSigner(signer!, vault.backup_signer, false),
                  "Backup signer disabled.",
                )
              }
            >
              Disable current backup signer ({vault.backup_signer.slice(0, 8)}…)
            </Button>
          )}
        </Card>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <Label hint={isActive ? "optional" : "only while active"}>Life-signal URLs</Label>
          {isActive && (
            <button
              onClick={() => setEditingSignals((v) => !v)}
              className="text-[12px] text-brass-300 hover:text-brass-200"
            >
              {editingSignals ? "Cancel" : "Edit"}
            </button>
          )}
        </div>
        {editingSignals ? (
          <div className="space-y-3">
            <Input
              placeholder="https://github.com/yourhandle"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
            />
            <Input
              placeholder="https://x.com/yourhandle"
              value={twitterUrl}
              onChange={(e) => setTwitterUrl(e.target.value)}
            />
            <Input
              placeholder="https://yourdomain.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
            <Button
              loading={busyAction === "signals"}
              onClick={() =>
                run(
                  "signals",
                  () => updateLifeSignals(signer!, githubUrl, twitterUrl, websiteUrl),
                  "Life-signal URLs updated.",
                ).then(() => setEditingSignals(false))
              }
            >
              Save
            </Button>
          </div>
        ) : (
          <div className="space-y-1 text-[13px] text-bone-300">
            <p>GitHub: {vault.github_url || "—"}</p>
            <p>X / Twitter: {vault.twitter_url || "—"}</p>
            <p>Website: {vault.website_url || "—"}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

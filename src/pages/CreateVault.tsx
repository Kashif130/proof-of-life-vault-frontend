import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../context/ToastContext";
import { createVault } from "../lib/client";
import { isContractConfigured } from "../lib/chains";
import { Button, Card, HelperText, Input, Label } from "../components/ui";
import { BeneficiaryEditor, BeneficiaryRow, percentToBps } from "../components/vault";
import { WalletPanel } from "../components/WalletPanel";

const DAY = 86400;
const MIN_DAYS = 30;
const MAX_DAYS = 730;

export function CreateVault() {
  const wallet = useWallet();
  const toast = useToast();
  const navigate = useNavigate();

  const [intervalDays, setIntervalDays] = useState("90");
  const [rows, setRows] = useState<BeneficiaryRow[]>([{ address: "", percent: "" }]);
  const [githubUrl, setGithubUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const validate = (): string | null => {
    const days = Number(intervalDays);
    if (!Number.isFinite(days) || days < MIN_DAYS || days > MAX_DAYS) {
      return `Check-in interval must be between ${MIN_DAYS} and ${MAX_DAYS} days.`;
    }
    if (rows.length < 1 || rows.length > 10) return "You need between 1 and 10 beneficiaries.";
    const addrs = rows.map((r) => r.address.trim());
    if (addrs.some((a) => !/^0x[0-9a-fA-F]{40}$/.test(a))) {
      return "Every beneficiary needs a valid address (0x… , 40 hex characters).";
    }
    if (new Set(addrs.map((a) => a.toLowerCase())).size !== addrs.length) {
      return "Beneficiary addresses must be unique.";
    }
    const totalBps = rows.reduce((sum, r) => sum + percentToBps(r.percent), 0);
    if (totalBps !== 10000) return "Beneficiary shares must add up to exactly 100%.";
    if (rows.some((r) => percentToBps(r.percent) <= 0)) {
      return "Each beneficiary's share must be greater than 0%.";
    }
    if (githubUrl && !/^https?:\/\/(www\.)?github\.com\/.+/i.test(githubUrl)) {
      return "GitHub URL must be hosted on github.com.";
    }
    if (twitterUrl && !/^https?:\/\/(www\.)?(twitter|x)\.com\/.+/i.test(twitterUrl)) {
      return "X/Twitter URL must be hosted on twitter.com or x.com.";
    }
    if (websiteUrl && (websiteUrl.length < 10 || websiteUrl.length > 300)) {
      return "Website URL must be between 10 and 300 characters.";
    }
    if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
      return "Website URL must start with http:// or https://";
    }
    return null;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    if (!wallet.signer) {
      setFormError("Connect a wallet first.");
      return;
    }
    setSubmitting(true);
    try {
      await createVault(wallet.signer, {
        checkInIntervalSeconds: Number(intervalDays) * DAY,
        beneficiaryAddresses: rows.map((r) => r.address.trim()),
        beneficiaryBps: rows.map((r) => percentToBps(r.percent)),
        githubUrl,
        twitterUrl,
        websiteUrl,
      });
      toast.push("success", "Vault created", "Fund it and check in periodically to keep it yours.");
      navigate("/dashboard");
    } catch (e2) {
      toast.push("error", "Could not create the vault", e2 instanceof Error ? e2.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-[28px] text-bone-100">Create a vault</h1>
        <p className="mt-2 text-[14px] text-bone-400">
          One vault per address. Configure it now — you can change beneficiaries, life-signal
          URLs, and the check-in interval later, any time the vault is active.
        </p>
      </div>

      {!isContractConfigured && (
        <Card className="p-4">
          <HelperText tone="error">
            No contract address is configured. Set VITE_CONTRACT_ADDRESS before deploying.
          </HelperText>
        </Card>
      )}

      {!wallet.address ? (
        <Card className="flex flex-col items-start gap-4 p-6">
          <p className="text-[14px] text-bone-200">Connect or create a wallet to continue.</p>
          <WalletPanel />
        </Card>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <Card className="space-y-4 p-6">
            <div>
              <Label hint={`${MIN_DAYS}-${MAX_DAYS} days`}>Check-in interval</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={MIN_DAYS}
                  max={MAX_DAYS}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  className="w-32"
                />
                <span className="text-[13px] text-bone-400">days between required check-ins</span>
              </div>
              <HelperText>
                A long flight or hospital stay shouldn't look like disappearance — choose a
                comfortable margin.
              </HelperText>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <Label>Beneficiaries and shares</Label>
            <BeneficiaryEditor rows={rows} onChange={setRows} />
          </Card>

          <Card className="space-y-4 p-6">
            <Label hint="optional">Life-signal URLs</Label>
            <p className="text-[13px] text-bone-400">
              If you ever lose the wallet this vault listens to, anyone can ask the network to
              check these public pages for activity since your last check-in. Leave any of them
              blank to skip.
            </p>
            <div>
              <Label hint="github.com only">GitHub profile</Label>
              <Input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/yourhandle"
              />
            </div>
            <div>
              <Label hint="twitter.com or x.com only">X / Twitter profile</Label>
              <Input
                value={twitterUrl}
                onChange={(e) => setTwitterUrl(e.target.value)}
                placeholder="https://x.com/yourhandle"
              />
            </div>
            <div>
              <Label hint="any public https:// site">Personal website</Label>
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourdomain.com"
              />
            </div>
          </Card>

          {formError && <HelperText tone="error">{formError}</HelperText>}

          <Button type="submit" loading={submitting} className="w-full">
            Create vault
          </Button>
        </form>
      )}
    </div>
  );
}

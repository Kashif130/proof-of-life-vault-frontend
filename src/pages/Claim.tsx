import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../context/ToastContext";
import { useVault } from "../hooks/useVault";
import { claimShare, getClaimableAmount } from "../lib/client";
import { Button, Card, HelperText, Input, Label } from "../components/ui";
import { StatusBadge } from "../components/vault";
import { WalletPanel } from "../components/WalletPanel";
import { fromWei, NATIVE_SYMBOL } from "../lib/format";

export function Claim() {
  const params = useParams<{ owner?: string }>();
  const navigate = useNavigate();
  const wallet = useWallet();
  const toast = useToast();
  const [ownerInput, setOwnerInput] = useState(params.owner ?? "");
  const [claimable, setClaimable] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);

  const owner = params.owner ?? null;
  const { vault, registered, loading } = useVault(owner);

  useEffect(() => {
    setOwnerInput(params.owner ?? "");
  }, [params.owner]);

  useEffect(() => {
    if (!owner || !wallet.address) {
      setClaimable(null);
      return;
    }
    setChecking(true);
    void getClaimableAmount(owner, wallet.address)
      .then(setClaimable)
      .finally(() => setChecking(false));
  }, [owner, wallet.address]);

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="font-display text-[28px] text-bone-100">Claim a share</h1>
        <p className="mt-2 text-[14px] text-bone-400">
          Once a vault has been finalized for inheritance, each named beneficiary can claim their
          own percentage share directly — permissionless, and only once.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <Label>Vault owner's address</Label>
        <div className="flex gap-2">
          <Input
            placeholder="0x…"
            className="font-mono"
            value={ownerInput}
            onChange={(e) => setOwnerInput(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={!/^0x[0-9a-fA-F]{40}$/.test(ownerInput.trim())}
            onClick={() => navigate(`/claim/${ownerInput.trim()}`)}
          >
            Look up
          </Button>
        </div>
      </Card>

      {owner && loading && <p className="text-[13px] text-bone-500">Looking up vault…</p>}

      {owner && !loading && !registered && (
        <HelperText tone="error">No vault is registered for that address.</HelperText>
      )}

      {owner && !loading && registered && vault && (
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[12px] text-bone-500">{owner}</span>
            <StatusBadge status={vault.status} />
          </div>

          {vault.status !== "INHERITABLE" && (
            <HelperText>
              This vault hasn't been finalized yet — shares can only be claimed after its
              contestation window elapses uncancelled.
            </HelperText>
          )}

          {!wallet.address ? (
            <div className="space-y-3">
              <p className="text-[13px] text-bone-300">
                Connect the wallet that was named as a beneficiary to check your share.
              </p>
              <WalletPanel />
            </div>
          ) : (
            <>
              <p className="text-[13px] text-bone-400">
                Connected as <span className="font-mono text-bone-200">{wallet.address}</span>
              </p>
              {checking ? (
                <p className="text-[13px] text-bone-500">Checking your claimable amount…</p>
              ) : claimable && claimable !== "0" ? (
                <div className="space-y-3 rounded-md border border-verdigris-500/40 bg-verdigris-500/10 p-4">
                  <p className="text-[14px] text-bone-100">
                    You can claim {fromWei(claimable)} {NATIVE_SYMBOL}.
                  </p>
                  <Button
                    loading={busy}
                    onClick={async () => {
                      if (!wallet.signer) return;
                      setBusy(true);
                      try {
                        await claimShare(wallet.signer, owner);
                        toast.push("success", "Share claimed.");
                        setClaimable("0");
                      } catch (e) {
                        toast.push(
                          "error",
                          "Claim failed",
                          e instanceof Error ? e.message : undefined,
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Claim my share
                  </Button>
                </div>
              ) : (
                <p className="text-[13px] text-bone-500">
                  Nothing to claim for this address right now — either you aren't a beneficiary
                  of this vault, the vault isn't finalized yet, or your share was already claimed.
                </p>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}

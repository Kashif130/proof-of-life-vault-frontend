import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { listVaults } from "../lib/client";
import { isContractConfigured } from "../lib/chains";
import type { VaultData } from "../lib/types";
import { Button, Card, HelperText, Input } from "../components/ui";
import { VaultListCard } from "../components/vault";

const PAGE_SIZE = 12;

export function Explore() {
  const navigate = useNavigate();
  const [vaults, setVaults] = useState<VaultData[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchAddress, setSearchAddress] = useState("");

  const load = async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const page = await listVaults(nextOffset, PAGE_SIZE);
      setVaults((prev) => (nextOffset === 0 ? page : [...prev, ...page]));
      setHasMore(page.length === PAGE_SIZE);
      setOffset(nextOffset + page.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load vaults from the network.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isContractConfigured) void load(0);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-[28px] text-bone-100">Explore vaults</h1>
        <p className="mt-2 text-[14px] text-bone-400">
          Every vault is public and permissionless to fund, trigger, and finalize. Browse
          registered vaults, or jump straight to one you know the address for.
        </p>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Look up a vault by owner address (0x…)"
            value={searchAddress}
            className="font-mono"
            onChange={(e) => setSearchAddress(e.target.value)}
          />
        </div>
        <Button
          icon={<Search className="h-4 w-4" />}
          disabled={!/^0x[0-9a-fA-F]{40}$/.test(searchAddress.trim())}
          onClick={() => navigate(`/vault/${searchAddress.trim()}`)}
        >
          Open
        </Button>
      </Card>

      {!isContractConfigured && (
        <HelperText tone="error">
          No contract address is configured, so there is nothing to browse yet.
        </HelperText>
      )}
      {error && <HelperText tone="error">{error}</HelperText>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vaults.map((v) => (
          <VaultListCard
            key={v.owner}
            owner={v.owner}
            status={v.status}
            balance={v.balance}
            beneficiaryCount={v.beneficiary_count}
            onClick={() => navigate(`/vault/${v.owner}`)}
          />
        ))}
      </div>

      {!loading && vaults.length === 0 && isContractConfigured && (
        <p className="text-[13px] text-bone-500">No vaults have been created yet.</p>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={loading} onClick={() => void load(offset)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

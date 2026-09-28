import { useCallback, useEffect, useRef, useState } from "react";
import { getBeneficiaries, getVault, isRegistered } from "../lib/client";
import type { Beneficiary, VaultData } from "../lib/types";
import { isContractConfigured } from "../lib/chains";

interface UseVaultResult {
  vault: VaultData | null;
  beneficiaries: Beneficiary[];
  registered: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const POLL_MS = 12_000;

export function useVault(owner: string | null): UseVaultResult {
  const [vault, setVault] = useState<VaultData | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!owner || !isContractConfigured) {
      setLoading(false);
      return;
    }
    try {
      const isReg = await isRegistered(owner);
      if (!mounted.current) return;
      setRegistered(isReg);
      if (!isReg) {
        setVault(null);
        setBeneficiaries([]);
        setError(null);
        return;
      }
      const [v, b] = await Promise.all([getVault(owner), getBeneficiaries(owner)]);
      if (!mounted.current) return;
      setVault(v);
      setBeneficiaries(b);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : "Could not read the vault from the network.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { vault, beneficiaries, registered, loading, error, refresh };
}

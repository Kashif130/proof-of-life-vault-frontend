import { useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import type { Beneficiary, VaultStatus } from "../lib/types";
import { bpsToPercent, formatCountdown, fromWei, shortAddress, NATIVE_SYMBOL } from "../lib/format";
import { useCountdown } from "../hooks/useCountdown";
import { AddressPill, Input } from "./ui";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<VaultStatus, { label: string; dot: string; text: string }> = {
  ACTIVE: { label: "Active — owned", dot: "bg-verdigris-400", text: "text-verdigris-400" },
  TRIGGERED: { label: "Contested", dot: "bg-brass-400", text: "text-brass-300" },
  INHERITABLE: { label: "Inheritable", dot: "bg-clay-400", text: "text-clay-400" },
};

export function StatusBadge({ status }: { status: VaultStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Countdown dial — the one deliberate, bold visual moment in this app.
// A closing ring reads as a vault's time-lock: full and calm while ACTIVE,
// draining toward the accent color as a trigger or finalization approaches.
// ---------------------------------------------------------------------------

export function CountdownDial({
  targetUnixSeconds,
  totalSeconds,
  caption,
  urgent = false,
}: {
  targetUnixSeconds: number | null;
  totalSeconds: number;
  caption: string;
  urgent?: boolean;
}) {
  const remaining = useCountdown(targetUnixSeconds);
  const fraction = totalSeconds > 0 ? Math.min(1, Math.max(0, remaining / totalSeconds)) : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - fraction);
  const ringColor = urgent ? "#D46A44" : "#C9A24B";

  return (
    <div className="flex items-center gap-5">
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 -rotate-90">
        <circle cx="64" cy="64" r={radius} stroke="#1E2430" strokeWidth="8" fill="none" />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          stroke={ringColor}
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="-ml-[92px] flex h-32 w-24 flex-col items-center justify-center text-center">
        <span className="font-display text-[20px] leading-tight text-bone-100">
          {formatCountdown(remaining)}
        </span>
      </div>
      <div className="max-w-[16rem]">
        <p className="text-[13px] leading-relaxed text-bone-400">{caption}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Beneficiary editor — dynamic address + share rows, enforcing the contract's
// own invariants client-side (1-10 rows, unique addresses, bps summing to 10000).
// ---------------------------------------------------------------------------

export interface BeneficiaryRow {
  address: string;
  percent: string; // human-entered percent, e.g. "33.33"
}

export function percentToBps(percent: string): number {
  const n = Number(percent);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function BeneficiaryEditor({
  rows,
  onChange,
}: {
  rows: BeneficiaryRow[];
  onChange: (rows: BeneficiaryRow[]) => void;
}) {
  const totalBps = useMemo(
    () => rows.reduce((sum, r) => sum + percentToBps(r.percent), 0),
    [rows],
  );
  const addresses = rows.map((r) => r.address.trim().toLowerCase()).filter(Boolean);
  const hasDuplicate = new Set(addresses).size !== addresses.length;

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            <Input
              placeholder="Beneficiary address (0x…)"
              value={row.address}
              className="font-mono"
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], address: e.target.value };
                onChange(next);
              }}
            />
          </div>
          <div className="w-28">
            <div className="relative">
              <Input
                inputMode="decimal"
                placeholder="Share"
                value={row.percent}
                onChange={(e) => {
                  const next = [...rows];
                  next[i] = { ...next[i], percent: e.target.value };
                  onChange(next);
                }}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-bone-500">
                %
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            disabled={rows.length <= 1}
            className="mt-2.5 text-bone-500 hover:text-clay-400 disabled:opacity-30"
            aria-label="Remove beneficiary"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        disabled={rows.length >= 10}
        onClick={() => onChange([...rows, { address: "", percent: "" }])}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brass-300 hover:text-brass-200 disabled:opacity-30"
      >
        <Plus className="h-4 w-4" /> Add beneficiary
      </button>

      <div className="flex items-center justify-between border-t border-vault-700 pt-3 text-[13px]">
        <span className="text-bone-400">Total share</span>
        <span className={totalBps === 10000 ? "text-verdigris-400" : "text-clay-400"}>
          {(totalBps / 100).toFixed(2)}% {totalBps === 10000 ? "" : "(must equal 100%)"}
        </span>
      </div>
      {hasDuplicate && (
        <p className="text-[12px] text-clay-400">Each beneficiary address must be unique.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vault card for listings
// ---------------------------------------------------------------------------

export function BeneficiaryList({ beneficiaries }: { beneficiaries: Beneficiary[] }) {
  if (beneficiaries.length === 0) {
    return <p className="text-[13px] text-bone-500">No beneficiaries configured.</p>;
  }
  return (
    <ul className="space-y-2">
      {beneficiaries.map((b) => (
        <li
          key={b.address}
          className="flex items-center justify-between rounded-md border border-vault-700 bg-vault-950/40 px-3 py-2"
        >
          <AddressPill address={b.address} />
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-bone-200">{bpsToPercent(b.bps)}</span>
            <span
              className={`text-[11px] ${b.claimed ? "text-verdigris-400" : "text-bone-500"}`}
            >
              {b.claimed ? "Claimed" : "Unclaimed"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function VaultListCard({
  owner,
  status,
  balance,
  beneficiaryCount,
  onClick,
}: {
  owner: string;
  status: VaultStatus;
  balance: string;
  beneficiaryCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-vault-700 bg-vault-900/70 p-4 text-left transition-colors hover:border-brass-400"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[13px] text-bone-100">{shortAddress(owner, 6)}</span>
        <StatusBadge status={status} />
      </div>
      <div className="mt-3 flex items-center justify-between text-[12px] text-bone-500">
        <span>
          {fromWei(balance)} {NATIVE_SYMBOL} held
        </span>
        <span>
          {beneficiaryCount} beneficiar{beneficiaryCount === 1 ? "y" : "ies"}
        </span>
      </div>
    </button>
  );
}

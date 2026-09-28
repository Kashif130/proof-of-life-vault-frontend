export const NATIVE_SYMBOL = "GEN";
const WEI_PER_NATIVE = 1_000_000_000_000_000_000n;

export function toWei(nativeAmount: string): bigint {
  const trimmed = nativeAmount.trim();
  if (trimmed === "") return 0n;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "000000000000000000").slice(0, 18);
  const wholeBig = BigInt(whole === "" ? "0" : whole);
  return wholeBig * WEI_PER_NATIVE + BigInt(fracPadded || "0");
}

export function fromWei(weiString: string | number | bigint, decimals = 4): string {
  let wei: bigint;
  try {
    wei = BigInt(weiString);
  } catch {
    return "0";
  }
  const whole = wei / WEI_PER_NATIVE;
  const remainder = wei % WEI_PER_NATIVE;
  if (decimals === 0) return whole.toString();
  const fracStr = remainder.toString().padStart(18, "0").slice(0, decimals);
  const trimmedFrac = fracStr.replace(/0+$/, "");
  return trimmedFrac ? `${whole}.${trimmedFrac}` : whole.toString();
}

export function shortAddress(address?: string | null, chars = 4): string {
  if (!address) return "—";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function bpsToPercent(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}

export function secondsToDaysLabel(seconds: number): string {
  const days = seconds / 86400;
  if (days >= 1 && Number.isInteger(days)) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 1) {
    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${days.toFixed(1)} days`;
}

export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0s";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  if (days === 0) parts.push(`${minutes}m`);
  if (days === 0 && hours === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

export function formatIsoTimestamp(iso: string): string {
  if (!iso) return "—";
  const normalized = iso.endsWith("Z") ? iso : `${iso}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isoToUnixSeconds(iso: string): number {
  if (!iso) return 0;
  const normalized = iso.endsWith("Z") ? iso : `${iso}Z`;
  const t = new Date(normalized).getTime();
  return Number.isNaN(t) ? 0 : Math.floor(t / 1000);
}

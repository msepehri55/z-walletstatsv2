import { format } from "date-fns";
import { ENDPOINTS } from "./constants";

export function msRangePreset(preset: "24h" | "7d" | "30d") {
  const now = Date.now();
  const span =
    preset === "24h" ? 24 * 3600 * 1000 :
    preset === "7d" ? 7 * 24 * 3600 * 1000 :
    30 * 24 * 3600 * 1000;
  return { from: now - span, to: now };
}

export function toInputDateTime(ms: number) {
  const dt = new Date(ms);
  // yyyy-MM-ddTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = dt.getFullYear();
  const m = pad(dt.getMonth() + 1);
  const d = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mm = pad(dt.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function fromInputDateTime(v: string) {
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : Date.now();
}

export function explorerTxUrl(hash: string) {
  const base = ENDPOINTS.explorerBase || "https://zentrace.io";
  return `${base}/tx/${hash}`;
}

export function explorerAddressUrl(addr: string) {
  const base = ENDPOINTS.explorerBase || "https://zentrace.io";
  return `${base}/address/${addr}`;
}

export function cls(...a: (string | false | undefined | null)[]) {
  return a.filter(Boolean).join(" ");
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat().format(n);
}

export function formatZTC(v: string) {
  // keep small amounts readable
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function formatDateTime(ms: number) {
  try {
    return format(new Date(ms), "MM/dd/yyyy, h:mm:ss a");
  } catch {
    return new Date(ms).toISOString();
  }
}
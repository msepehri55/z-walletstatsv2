import { format } from "date-fns";

export function formatTime(ms: number) {
  try {
    return format(new Date(ms), "MM/dd/yyyy, h:mm:ss a");
  } catch {
    return new Date(ms).toISOString();
  }
}

export function weiToEther(wei: string, decimals = 18) {
  if (!wei) return "0";
  const neg = wei.startsWith("-");
  const s = neg ? wei.slice(1) : wei;
  const pad = s.padStart(decimals + 1, "0");
  const int = pad.slice(0, -decimals);
  const frac = pad.slice(-decimals).replace(/0+$/, "");
  const out = frac ? `${int}.${frac}` : int;
  return neg ? `-${out}` : out;
}
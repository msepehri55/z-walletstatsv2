import { Category } from "./constants";

type Meta = {
  label: string;
  emoji: string;
  color: string; // text color
  bg: string;    // bg color
};

export const CATEGORY_META: Record<Category, Meta> = {
  stake: { label: "Stake", emoji: "🪙", color: "text-zen-badge-stake", bg: "bg-zen-badge-stake/15" },
  native_send: { label: "Native send", emoji: "📤", color: "text-zen-badge-native", bg: "bg-zen-badge-native/15" },
  nft_mint: { label: "NFT mint", emoji: "🖼️", color: "text-zen-badge-nft", bg: "bg-zen-badge-nft/15" },
  domain_mint: { label: "Domain mint", emoji: "🌐", color: "text-zen-badge-domain", bg: "bg-zen-badge-domain/15" },
  cc_deploy: { label: "CC (deploy)", emoji: "🛠️", color: "text-zen-badge-cc", bg: "bg-zen-badge-cc/15" },
  cco_deploy: { label: "CCO (deploy via 0x2f96…)", emoji: "🧰", color: "text-zen-badge-cco", bg: "bg-zen-badge-cco/15" },
  gm: { label: "GM", emoji: "🌞", color: "text-zen-badge-gm", bg: "bg-zen-badge-gm/15" },
  swap: { label: "Swap", emoji: "🔁", color: "text-zen-badge-swap", bg: "bg-zen-badge-swap/15" },
  add_liquidity: { label: "Add Liquidity", emoji: "💧+", color: "text-zen-badge-add", bg: "bg-zen-badge-add/15" },
  remove_liquidity: { label: "Remove Liquidity", emoji: "💧−", color: "text-zen-badge-remove", bg: "bg-zen-badge-remove/15" },
  approve: { label: "Approve", emoji: "✅", color: "text-zen-badge-approve", bg: "bg-zen-badge-approve/15" },
  fail: { label: "Fail", emoji: "⛔", color: "text-zen-badge-fail", bg: "bg-zen-badge-fail/15" },
  other: { label: "Other", emoji: "📦", color: "text-zen-badge-other", bg: "bg-zen-badge-other/15" }
};

export const CATEGORY_OPTIONS: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "Category: All" },
  ...Object.entries(CATEGORY_META).map(([k, v]) => ({
    key: k as Category,
    label: `Category: ${v.label}`
  }))
];

export function shortHash(h: string, left = 6, right = 6) {
  return h.length > left + right + 2 ? `${h.slice(0, left)}…${h.slice(-right)}` : h;
}
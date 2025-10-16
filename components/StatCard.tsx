"use client";

export default function StatCard({
  title,
  emoji,
  value
}: {
  title: string;
  emoji: string;
  value: number | string;
}) {
  return (
    <div className="relative rounded-2xl p-[1px] animate-borderGlow bg-[conic-gradient(from_0deg,transparent_0%,#21E1A880_20%,#00EBC780_40%,#7CFFB280_60%,#21E1A880_80%,transparent_100%)]">
      <div className="relative rounded-2xl p-4 bg-gradient-to-br from-[#0f172a] to-[#0b1220] border border-white/5">
        <div className="flex items-center gap-2 text-xs text-zen-sub">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-400/10 text-base">{emoji}</span>
          <span className="tracking-wide">{title}</span>
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
      </div>
    </div>
  );
}
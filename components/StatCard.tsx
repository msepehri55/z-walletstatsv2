"use client";

import { cls, formatNumber } from "@/lib/utils";

export default function StatCard({
  title,
  emoji,
  value,
  color,
}: {
  title: string;
  emoji: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-zen-sub text-xs uppercase tracking-wide">{title}</div>
      <div className={cls("mt-2 text-2xl font-semibold", color || "")}>
        <span className="mr-2">{emoji}</span>
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
    </div>
  );
}
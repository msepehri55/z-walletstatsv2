"use client";

import { CATEGORY_META } from "@/lib/categoryMeta";
import { Category } from "@/lib/constants";
import { cls } from "@/lib/utils";

export default function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  const meta = CATEGORY_META[category];
  return (
    <span className={cls("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", meta.bg, meta.color, className)}>
      <span className="text-base leading-none">{meta.emoji}</span>
      <span>{meta.label.toLowerCase()}</span>
    </span>
  );
}
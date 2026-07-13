import type { ReactNode } from "react";

export function GStat({
  label,
  value,
  tone,
  sub,
  hint,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
  sub?: string;
  hint?: ReactNode;
}) {
  const c =
    tone === "bad"
      ? "text-rose-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "good"
          ? "text-emerald-700"
          : "text-slate-800";
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      <p className="flex items-center gap-1 text-xs text-slate-400">
        {label}
        {hint}
      </p>
      <p className={`text-lg font-semibold ${c}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 leading-tight">{sub}</p>}
    </div>
  );
}


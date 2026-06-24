import type { ReactNode } from "react";
import { formatDate } from "../../utils/formatters";

export interface ActivityItem {
  date: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}

const dotTone = {
  neutral: "bg-slate-300",
  blue: "bg-brand-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
};

/** Historial de actividad / auditoría básica en formato línea de tiempo. */
export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">Sin actividad registrada.</p>;
  }

  return (
    <ol className="relative ml-2">
      {items.map((it, i) => (
        <li key={i} className="relative pl-6 pb-4 last:pb-0">
          {i < items.length - 1 && (
            <span className="absolute left-[5px] top-3 bottom-0 w-px bg-slate-200" />
          )}
          <span
            className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
              dotTone[it.tone ?? "neutral"]
            }`}
          />
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">{it.title}</p>
            <span className="text-xs text-slate-400 flex-shrink-0">{formatDate(it.date)}</span>
          </div>
          {it.description && (
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{it.description}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

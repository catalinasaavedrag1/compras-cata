import { cn } from "../../utils/cn";

export interface BarItem {
  label: string;
  value: number;
  /** Texto a mostrar a la derecha (ej. valor formateado). */
  display: string;
  tone?: "blue" | "green" | "amber" | "red" | "violet" | "slate";
}

interface BarListProps {
  items: BarItem[];
}

const toneClass = {
  blue: "bg-brand-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  violet: "bg-violet-500",
  slate: "bg-slate-400",
};

export function BarList({ items }: BarListProps) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm text-slate-600 truncate">{item.label}</span>
            <span className="text-sm font-medium text-slate-800 flex-shrink-0">{item.display}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={cn("h-full rounded-full", toneClass[item.tone ?? "blue"])}
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

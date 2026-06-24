import { cn } from "../../utils/cn";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex gap-1 border-b border-slate-200 overflow-x-auto scrollbar-thin", className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "text-brand-700"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs",
                    active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </span>
            {active && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}

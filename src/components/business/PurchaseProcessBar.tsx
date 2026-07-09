import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { cn } from "../../utils/cn";

export interface PurchaseProcessStage {
  label: string;
  detail: string;
  count: number;
  to: string;
  active?: boolean;
  tone?: "blue" | "amber" | "green" | "red" | "neutral";
}

export function PurchaseProcessBar({ stages }: { stages: PurchaseProcessStage[] }) {
  return (
    <section className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-card">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Proceso de compra
        </p>
        <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-1 lg:pb-0">
          {stages.map((stage, index) => (
            <Link
              key={stage.label}
              to={stage.to}
              className={cn(
                "group relative inline-flex min-h-10 min-w-max items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors",
                stage.active
                  ? "border-brand-300 bg-brand-50"
                  : "border-slate-200 bg-slate-50 hover:border-brand-200 hover:bg-white"
              )}
            >
              {index < stages.length - 1 && (
                <span className="hidden text-slate-300 lg:absolute lg:right-[-12px] lg:block">
                  →
                </span>
              )}
              <span
                className={cn(
                  "text-xs font-semibold",
                  stage.active ? "text-brand-700" : "text-slate-600"
                )}
              >
                {stage.label}
              </span>
              <Badge tone={stage.tone ?? "neutral"}>{stage.count > 99 ? "99+" : stage.count}</Badge>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

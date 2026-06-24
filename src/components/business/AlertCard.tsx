import { cn } from "../../utils/cn";
import type { CommercialAlert } from "../../types/purchasing";
import { formatDate } from "../../utils/formatters";
import { SeverityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";
import { ALERT_TYPE_LABELS } from "./alertLabels";

interface AlertCardProps {
  alert: CommercialAlert;
  onReview?: (id: string) => void;
  onResolve?: (id: string) => void;
  compact?: boolean;
  /** Acción sugerida principal (ej. "Agregar a OC", "Ver producto"). */
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
}

const severityBar = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-slate-300",
};

export function AlertCard({
  alert,
  onReview,
  onResolve,
  compact,
  primaryAction,
}: AlertCardProps) {
  return (
    <div className="relative bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
      <span
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          severityBar[alert.severity]
        )}
      />
      <div className="pl-4 pr-4 py-3.5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={alert.severity} />
            <span className="text-xs font-medium text-slate-500">
              {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge kind="alert" value={alert.status} dot={false} />
            <span className="text-xs text-slate-400">{formatDate(alert.date)}</span>
          </div>
        </div>

        <p className="mt-2 text-sm font-semibold text-slate-800">
          {alert.relatedEntity}
        </p>
        <p className="mt-1 text-sm text-slate-600 leading-snug">{alert.description}</p>

        {!compact && (
          <div className="mt-2.5 rounded-lg bg-brand-50/60 border border-brand-100 px-3 py-2">
            <p className="text-xs font-medium text-brand-700">Recomendación</p>
            <p className="text-sm text-slate-700 mt-0.5">{alert.recommendation}</p>
            {primaryAction && (
              <button
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {primaryAction.label}
              </button>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-slate-400">
            Responsable: {alert.responsible}
          </span>
          {(onReview || onResolve) &&
            alert.status !== "resolved" &&
            alert.status !== "ignored" && (
              <div className="flex gap-2">
                {onReview && alert.status === "new" && (
                  <button
                    onClick={() => onReview(alert.id)}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    Marcar en revisión
                  </button>
                )}
                {onResolve && (
                  <button
                    onClick={() => onResolve(alert.id)}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Marcar resuelta
                  </button>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

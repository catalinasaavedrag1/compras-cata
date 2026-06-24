import { Link } from "react-router-dom";
import { Badge, type BadgeTone } from "../ui/Badge";
import { IconArrowRight, IconCheck } from "../ui/icons";
import { cn } from "../../utils/cn";

export interface GuideStep {
  title: string;
  detail: string;
  /** Cantidad de items que requieren esta acción. */
  count: number;
  /** Texto del contador, ej. "3 productos". */
  countLabel: string;
  to: string;
  tone: BadgeTone;
}

/**
 * Guía priorizada "Qué revisar primero". Ordena las acciones por urgencia y
 * muestra cuántos elementos hay en cada una. Si no hay nada, lo indica en verde.
 */
export function PriorityGuide({ steps }: { steps: GuideStep[] }) {
  // Primero lo que tiene pendientes; lo resuelto al final.
  const ordered = [...steps].sort((a, b) => (b.count > 0 ? 1 : 0) - (a.count > 0 ? 1 : 0));

  return (
    <div className="divide-y divide-slate-100">
      {ordered.map((step, i) => {
        const done = step.count === 0;
        return (
          <Link
            key={step.title}
            to={step.to}
            className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <span
              className={cn(
                "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"
              )}
            >
              {done ? <IconCheck className="w-4 h-4" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 group-hover:text-brand-700">
                {step.title}
              </p>
              <p className="text-xs text-slate-500">{step.detail}</p>
            </div>
            {done ? (
              <Badge tone="green" dot>
                Al día
              </Badge>
            ) : (
              <Badge tone={step.tone} dot>
                {step.countLabel}
              </Badge>
            )}
            <IconArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 flex-shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}

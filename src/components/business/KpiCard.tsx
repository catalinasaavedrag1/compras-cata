import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/cn";
import { IconArrowDown, IconArrowUp, IconChevronRight } from "../ui/icons";

type Tone = "neutral" | "good" | "warn" | "bad" | "info";

interface KpiCardProps {
  title: string;
  value: string;
  description?: string;
  /** Variación en %, positiva o negativa. */
  delta?: number;
  /** Si true, una variación positiva es buena (verde). Si false, al revés. */
  deltaPositiveIsGood?: boolean;
  tone?: Tone;
  icon?: ReactNode;
  /** Si se pasa, la card es cliqueable y navega a esa ruta. */
  to?: string;
  /** Si se pasa, la card es cliqueable y ejecuta esta acción (ej. filtrar). */
  onClick?: () => void;
  /** Marca visual de seleccionado (para KPIs que actúan como filtro). */
  active?: boolean;
}

const toneAccent: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  good: "bg-emerald-50 text-emerald-600",
  warn: "bg-amber-50 text-amber-600",
  bad: "bg-rose-50 text-rose-600",
  info: "bg-brand-50 text-brand-600",
};

const toneValue: Record<Tone, string> = {
  neutral: "text-slate-900",
  good: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-rose-700",
  info: "text-slate-900",
};

export function KpiCard({
  title,
  value,
  description,
  delta,
  deltaPositiveIsGood = true,
  tone = "neutral",
  icon,
  to,
  onClick,
  active,
}: KpiCardProps) {
  const hasDelta = delta !== undefined && Number.isFinite(delta);
  const up = (delta ?? 0) >= 0;
  const good = up === deltaPositiveIsGood;

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        {icon && (
          <span
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
              toneAccent[tone]
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={cn("text-2xl font-semibold tracking-tight", toneValue[tone])}>
          {value}
        </span>
        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              good ? "text-emerald-600" : "text-rose-600"
            )}
          >
            {up ? (
              <IconArrowUp className="w-3.5 h-3.5" />
            ) : (
              <IconArrowDown className="w-3.5 h-3.5" />
            )}
            {Math.abs(delta!).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs text-slate-500 leading-snug flex items-center gap-1">
          {description}
          {to && <IconChevronRight className="w-3 h-3 text-brand-400 inline" />}
        </p>
      )}
    </>
  );

  const baseClass =
    "bg-white border border-slate-200 rounded-xl shadow-card p-4 flex flex-col gap-2";

  if (to) {
    return (
      <Link
        to={to}
        className={cn(baseClass, "transition-colors hover:border-brand-300 hover:bg-brand-50/30")}
      >
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={cn(
          baseClass,
          "text-left transition-colors hover:border-brand-300 hover:bg-brand-50/30",
          active && "border-brand-400 ring-2 ring-brand-100"
        )}
      >
        {inner}
      </button>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}

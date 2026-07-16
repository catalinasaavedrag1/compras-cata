import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconCheck, IconChevronRight } from "../../components/ui/icons";
import { cn } from "../../utils/cn";
import type { AgendaItem } from "./types";

type Tone = "red" | "amber" | "blue" | "violet" | "slate" | "green";

export interface AgendaEntry {
  id: string;
  icon: (props: { className?: string }) => JSX.Element;
  title: string;
  detail: string;
  when: string;
  tone: Tone;
  to: string;
}

export interface PortadaSummary {
  categorias: number;
  quiebres: number;
  riesgos: number;
  sobrestock: string;
  ocAtrasadas: number;
}

export interface PendingWork {
  id: string;
  label: string;
  detail: string;
  count: number;
  tone: Tone;
  to: string;
}

interface InicioPortadaProps {
  priorities: AgendaItem[];
  agenda: AgendaEntry[];
  summary: PortadaSummary;
  pending: PendingWork[];
}

const cardTone: Record<AgendaItem["tone"], string> = {
  red: "border-rose-200 bg-rose-50/70",
  amber: "border-amber-200 bg-amber-50/60",
  blue: "border-brand-200 bg-brand-50/60",
  violet: "border-violet-200 bg-violet-50/60",
};

const numberTone: Record<AgendaItem["tone"], string> = {
  red: "bg-rose-600 text-white",
  amber: "bg-amber-500 text-white",
  blue: "bg-brand-600 text-white",
  violet: "bg-violet-600 text-white",
};

const dotTone: Record<Tone, string> = {
  red: "bg-rose-500",
  amber: "bg-amber-500",
  blue: "bg-brand-500",
  violet: "bg-violet-500",
  slate: "bg-slate-400",
  green: "bg-emerald-500",
};

const pillTone: Record<Tone, string> = {
  red: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-brand-100 text-brand-700",
  violet: "bg-violet-100 text-violet-700",
  slate: "bg-slate-100 text-slate-600",
  green: "bg-emerald-100 text-emerald-700",
};

/**
 * Portada de Inicio: la bandeja de entrada diaria del comprador. No es un
 * dashboard — dice, en orden, qué resolver hoy, por qué importa, cuánto está en
 * juego y qué acción tomar. El detalle profundo vive más abajo o en otras vistas.
 */
export function InicioPortada({ priorities, agenda, summary, pending }: InicioPortadaProps) {
  return (
    <section className="mb-4 space-y-4">
      {/* 3 · Resumen rápido de categorías — una sola línea, sin robar el centro */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 shadow-card">
        <SummaryChip value={summary.categorias} label={plural(summary.categorias, "categoría", "categorías")} />
        <Sep />
        <SummaryChip
          value={summary.quiebres}
          label={plural(summary.quiebres, "quiebre", "quiebres")}
          tone={summary.quiebres > 0 ? "red" : "slate"}
        />
        <Sep />
        <SummaryChip
          value={summary.riesgos}
          label={plural(summary.riesgos, "riesgo de quiebre", "riesgos de quiebre")}
          tone={summary.riesgos > 0 ? "amber" : "slate"}
        />
        <Sep />
        <span className="inline-flex items-baseline gap-1">
          <span className={cn("font-semibold", summary.sobrestock !== "$0" ? "text-violet-700" : "text-slate-700")}>
            {summary.sobrestock}
          </span>
          <span className="text-slate-500">sobrestock</span>
        </span>
        <Sep />
        <SummaryChip
          value={summary.ocAtrasadas}
          label={plural(summary.ocAtrasadas, "OC atrasada", "OC atrasadas")}
          tone={summary.ocAtrasadas > 0 ? "red" : "slate"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1 · Prioridades del día */}
        <div className="lg:col-span-2">
          <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Prioridades del día
            {priorities.length > 0 && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">
                {priorities.length}
              </span>
            )}
          </h2>

          {priorities.length === 0 ? (
            <EmptyState
              icon={<IconCheck className="h-6 w-6" />}
              title="Nada urgente por ahora"
              description="No tienes decisiones críticas pendientes. Revisa la agenda o adelántate a la próxima temporada."
            />
          ) : (
            <ol className="space-y-2">
              {priorities.map((item, i) => (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3.5 transition-colors hover:shadow-sm",
                      i === 0 ? cardTone[item.tone] : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        i === 0 ? numberTone[item.tone] : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.tone} dot>
                          {item.kind}
                        </Badge>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {item.urgency}
                        </span>
                      </div>
                      {/* Qué ocurrió */}
                      <h3 className="mt-1.5 text-sm font-semibold leading-snug text-slate-900">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">{item.meta}</p>
                      {/* Cuánto está en juego + qué hacer */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-xs font-semibold text-slate-800">{item.impact}</span>
                        <span className="text-xs text-slate-500">· {item.recommendation}</span>
                      </div>
                    </div>
                    <span className="flex flex-shrink-0 items-center gap-1 self-center text-xs font-semibold text-brand-600">
                      {item.actionLabel}
                      <IconChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* 2 · Agenda del comprador + 4 · Trabajo pendiente (al costado) */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Tu agenda
            </h2>
            {agenda.length === 0 ? (
              <p className="py-2 text-xs text-slate-400">Sin vencimientos ni eventos próximos.</p>
            ) : (
              <ul className="space-y-1">
                {agenda.map((e) => (
                  <li key={e.id}>
                    <Link
                      to={e.to}
                      className="flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-slate-50"
                    >
                      <span className={cn("mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full", dotTone[e.tone])} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <e.icon className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                          <span className="truncate text-xs font-medium text-slate-800">{e.title}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                          {e.detail}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          pillTone[e.tone]
                        )}
                      >
                        {e.when}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-card">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Trabajo pendiente
            </h2>
            <ul className="space-y-1">
              {pending.map((w) => (
                <li key={w.id}>
                  <Link
                    to={w.to}
                    className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-800">
                        {w.label}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">{w.detail}</span>
                    </span>
                    <span
                      className={cn(
                        "flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                        w.count > 0 ? pillTone[w.tone] : "bg-slate-100 text-slate-400"
                      )}
                    >
                      {w.count}
                    </span>
                    <IconChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Sep() {
  return <span className="text-slate-300">·</span>;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function SummaryChip({ value, label, tone = "slate" }: { value: number; label: string; tone?: Tone }) {
  const strong: Record<Tone, string> = {
    red: "text-rose-700",
    amber: "text-amber-700",
    blue: "text-brand-700",
    violet: "text-violet-700",
    slate: "text-slate-700",
    green: "text-emerald-700",
  };
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={cn("font-semibold", strong[tone])}>{value}</span>
      <span className="text-slate-500">{label}</span>
    </span>
  );
}

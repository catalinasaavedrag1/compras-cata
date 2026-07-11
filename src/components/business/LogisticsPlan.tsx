import { useMemo } from "react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { IconTruck, IconAlerts, IconBulb, IconCalendar, IconInfo } from "../ui/icons";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "../../utils/formatters";
import { cn } from "../../utils/cn";
import {
  resolvePickupLines,
  planPickup,
  comparePickupScenarios,
  type PickupLineInput,
  type PickupPlan,
  type TruckLoad,
} from "../../utils/logistics";

// ============================================================================
//  UI del plan de retiro
//  Tres niveles, tal como se planificó:
//    1. Resumen compacto (camiones, peso, volumen, costo, fecha).
//    2. Detalle por vehículo (qué productos van en cada camión + ocupación).
//    3. Comparador de escenarios (retiro inmediato vs consolidado).
// ============================================================================

/** Hook: calcula el plan de retiro a partir de las líneas de la compra. */
export function usePickupPlan(lines: PickupLineInput[]): PickupPlan {
  return useMemo(() => planPickup(resolvePickupLines(lines)), [lines]);
}

// ----------------------------------------------------------------------------
//  Barra de capacidad
// ----------------------------------------------------------------------------

function fillTone(pct: number): { bar: string; text: string } {
  if (pct > 100) return { bar: "bg-rose-500", text: "text-rose-600" };
  if (pct >= 85) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-emerald-500", text: "text-emerald-600" };
}

export function CapacityBar({
  label,
  pct,
  detail,
}: {
  label: string;
  pct: number;
  detail?: string;
}) {
  const tone = fillTone(pct);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-slate-500">{label}</span>
        <span className={cn("font-semibold tabular-nums", tone.text)}>{pct}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", tone.bar)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {detail && <p className="mt-0.5 text-[11px] text-slate-400">{detail}</p>}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Nivel 1 — Resumen compacto
// ----------------------------------------------------------------------------

function SummaryMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-slate-900">{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function LogisticsSummary({ plan }: { plan: PickupPlan }) {
  const vehicleMix = useMemo(() => {
    const m = new Map<string, number>();
    plan.trucks.forEach((t) => m.set(t.vehicleLabel, (m.get(t.vehicleLabel) ?? 0) + 1));
    return [...m.entries()].map(([label, n]) => (n > 1 ? `${n} ${label}` : label)).join(" · ");
  }, [plan.trucks]);

  if (plan.truckCount === 0) {
    return (
      <p className="text-sm text-slate-500">
        Agrega productos con datos logísticos para estimar el retiro.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      <SummaryMetric
        label="Camiones"
        value={formatNumber(plan.truckCount)}
        hint={vehicleMix || undefined}
      />
      <SummaryMetric label="Peso total" value={`${formatNumber(plan.totalWeightKg)} kg`} />
      <SummaryMetric label="Volumen" value={`${formatNumber(plan.totalVolumeM3)} m³`} />
      <SummaryMetric
        label="Centros"
        value={formatNumber(plan.centers.length)}
        hint={plan.centers.join(" · ")}
      />
      <SummaryMetric
        label="Costo estimado"
        value={formatCurrencyCompact(plan.estimatedCost)}
        hint={`${formatCurrency(plan.costPerUnit)}/u.`}
      />
      <SummaryMetric
        label="Primera fecha"
        value={plan.firstDate ? formatDate(plan.firstDate) : "—"}
        hint={
          plan.lastDate && plan.lastDate !== plan.firstDate
            ? `última ${formatDate(plan.lastDate)}`
            : undefined
        }
      />
    </div>
  );
}

/** Resumen en una línea de chips, para cabeceras y tarjetas compactas. */
export function LogisticsInlineSummary({ plan }: { plan: PickupPlan }) {
  if (plan.truckCount === 0) return null;
  const chips = [
    `${plan.truckCount} camión${plan.truckCount === 1 ? "" : "es"}`,
    `${formatNumber(plan.totalWeightKg)} kg`,
    `${formatNumber(plan.totalVolumeM3)} m³`,
    formatCurrencyCompact(plan.estimatedCost),
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <IconTruck className="w-4 h-4 text-brand-600" />
      {chips.map((c) => (
        <Badge key={c} tone="blue">
          {c}
        </Badge>
      ))}
      {plan.centers.length > 1 && <Badge tone="amber">{plan.centers.length} centros</Badge>}
      {plan.dates.length > 1 && <Badge tone="amber">{plan.dates.length} fechas</Badge>}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Nivel 2 — Detalle por vehículo
// ----------------------------------------------------------------------------

export function TruckLoadCard({ truck }: { truck: TruckLoad }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <IconTruck className="w-4 h-4 text-brand-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-800">
            Camión {truck.id} · {truck.vehicleLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {truck.requiresPluma && <Badge tone="violet">Pluma</Badge>}
          {truck.hasOversized && <Badge tone="amber">Sobredim.</Badge>}
          <Badge tone="neutral">{truck.center}</Badge>
        </div>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <CapacityBar
          label="Peso"
          pct={truck.weightPct}
          detail={`${formatNumber(truck.weightKg)} / ${formatNumber(truck.capacityKg)} kg`}
        />
        <CapacityBar
          label="Volumen"
          pct={truck.volumePct}
          detail={`${formatNumber(truck.volumeM3)} / ${formatNumber(truck.capacityM3)} m³`}
        />
      </div>
      <div className="border-t border-slate-100 divide-y divide-slate-50">
        {truck.items.map((it) => (
          <div key={it.sku} className="flex items-center justify-between gap-2 px-3 py-1.5">
            <div className="min-w-0">
              <p className="text-sm text-slate-700 truncate">{it.productName}</p>
              <p className="text-[11px] text-slate-400 font-mono">{it.sku}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-medium text-slate-800">{formatNumber(it.units)} u.</p>
              <p className="text-[11px] text-slate-400">
                {formatNumber(Math.round(it.weightKg))} kg · {Math.round(it.volumeM3 * 10) / 10} m³
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="bg-slate-50/70 px-3 py-1.5 text-[11px] text-slate-400">
        Se llena antes por <b className="text-slate-600">{truck.limitedBy}</b>.
      </p>
    </div>
  );
}

export function TrucksDetail({ plan }: { plan: PickupPlan }) {
  if (plan.truckCount === 0) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {plan.trucks.map((t) => (
        <TruckLoadCard key={t.id} truck={t} />
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Nivel 3 — Alertas y recomendaciones
// ----------------------------------------------------------------------------

export function LogisticsAdvice({ plan }: { plan: PickupPlan }) {
  if (plan.alerts.length === 0 && plan.suggestions.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <IconInfo className="w-4 h-4 flex-shrink-0" />
        Sin restricciones logísticas: la carga se retira en un solo viaje sin conflictos.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {plan.alerts.length > 0 && (
        <div className="space-y-1.5">
          {plan.alerts.map((a, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                a.level === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              )}
            >
              {a.level === "warning" ? (
                <IconAlerts className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
              ) : (
                <IconInfo className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
              )}
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}
      {plan.suggestions.length > 0 && (
        <div className="space-y-1.5">
          {plan.suggestions.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50/70 px-3 py-2 text-sm text-brand-900"
            >
              <IconBulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-500" />
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Comparador de escenarios (retiro inmediato vs consolidado)
// ----------------------------------------------------------------------------

export function ScenarioComparator({ lines }: { lines: PickupLineInput[] }) {
  const { immediate, consolidated, worthConsolidating } = useMemo(
    () => comparePickupScenarios(resolvePickupLines(lines)),
    [lines]
  );

  if (immediate.truckCount === 0) return null;
  if (!worthConsolidating) {
    return (
      <p className="text-sm text-slate-500">
        El retiro ya es óptimo: un solo centro y un solo viaje. No hay un escenario consolidado
        mejor.
      </p>
    );
  }

  const rows: { label: string; a: string; b: string; better: "b" | null }[] = [
    {
      label: "Camiones",
      a: formatNumber(immediate.truckCount),
      b: formatNumber(consolidated.truckCount),
      better: consolidated.truckCount < immediate.truckCount ? "b" : null,
    },
    {
      label: "Centros de retiro",
      a: formatNumber(immediate.centers.length),
      b: formatNumber(consolidated.centers.length),
      better: consolidated.centers.length < immediate.centers.length ? "b" : null,
    },
    {
      label: "Costo logístico",
      a: formatCurrency(immediate.estimatedCost),
      b: formatCurrency(consolidated.estimatedCost),
      better: consolidated.estimatedCost < immediate.estimatedCost ? "b" : null,
    },
    {
      label: "Fecha de retiro",
      a: immediate.firstDate ? formatDate(immediate.firstDate) : "—",
      b: consolidated.firstDate ? formatDate(consolidated.firstDate) : "—",
      better: null,
    },
  ];

  const saving = immediate.estimatedCost - consolidated.estimatedCost;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 font-medium">Concepto</th>
              <th className="px-3 py-2 font-medium">
                <span className="flex items-center gap-1.5">
                  <IconTruck className="w-3.5 h-3.5" /> Retiro inmediato
                </span>
              </th>
              <th className="px-3 py-2 font-medium">
                <span className="flex items-center gap-1.5">
                  <IconCalendar className="w-3.5 h-3.5" /> Retiro consolidado
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="px-3 py-2 text-slate-500">{r.label}</td>
                <td className="px-3 py-2 font-medium text-slate-700">{r.a}</td>
                <td
                  className={cn(
                    "px-3 py-2 font-semibold",
                    r.better === "b" ? "text-emerald-600" : "text-slate-700"
                  )}
                >
                  {r.b}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {saving > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <IconBulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Consolidar el retiro ahorra <b>{formatCurrency(saving)}</b> en transporte
            {consolidated.lastDate && immediate.dates.length > 1
              ? `, esperando a que todo esté disponible el ${formatDate(consolidated.lastDate)}`
              : ""}
            . Recuerda contrastarlo con el mayor precio de compra si cambias de proveedor.
          </span>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Vista completa (3 niveles) — para la página y el drawer
// ----------------------------------------------------------------------------

export function LogisticsPlanView({
  lines,
  showComparator = true,
}: {
  lines: PickupLineInput[];
  showComparator?: boolean;
}) {
  const plan = usePickupPlan(lines);

  if (plan.truckCount === 0) {
    return (
      <Card className="p-6 text-center text-sm text-slate-500">
        Aún no hay carga que planificar. Agrega productos a la compra para simular el retiro.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Section title="Resumen de retiro" subtitle="Camiones, peso, volumen, centros y costo estimado">
        <LogisticsSummary plan={plan} />
      </Section>

      <Section
        title="Detalle por camión"
        subtitle="Qué productos van en cada vehículo y cómo queda su ocupación"
      >
        <TrucksDetail plan={plan} />
      </Section>

      <Section title="Alertas y recomendaciones" subtitle="Qué revisar antes de emitir la orden">
        <LogisticsAdvice plan={plan} />
      </Section>

      {showComparator && (
        <Section
          title="Comparador de escenarios"
          subtitle="Costo total de abastecimiento: retirar ya vs consolidar"
        >
          <ScenarioComparator lines={lines} />
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

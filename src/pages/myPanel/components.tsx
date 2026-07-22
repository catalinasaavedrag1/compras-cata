import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { DataTable, type Column } from "../../components/ui/Table";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatusBadge } from "../../components/business/StatusBadge";
import { CollapsibleSection } from "../../components/ui/CollapsibleSection";
import { SIGNAL_STATUS, SIGNAL_PRIORITY, signalKindMeta } from "../../components/business/signalLabels";
import { IconCheck, IconPlus, IconSignal } from "../../components/ui/icons";
import {
  formatCurrencyCompact,
  formatDate,
  formatDays,
  formatNumber,
  formatPercent,
} from "../../utils/formatters";
import { coverageSentence } from "../../utils/calculations";
import { cn } from "../../utils/cn";
import type { PurchaseOrder } from "../../types/purchasing";
import type {
  CategoryPanelRow,
  GoalKind,
  GoalView,
  MyPerformanceView,
  SignalView,
  SupplierPanelRow,
} from "../../services/purchaseBff";
import type { ReplenishmentRecommendation } from "../../hooks/useReplenishment";
import type {
  OpportunitySummaryItem,
  PortfolioFoco,
  PortfolioFocus,
  PortfolioOpportunity,
  RiskRow,
  SalesPaceRow,
} from "./types";

// ============================================================================
//  Componentes de presentación de "Mi cartera".
//  Piezas puras (sin estado ni cálculo): reciben filas ya derivadas de las
//  fuentes reales del purchase-bff y las pintan. Las secciones cuyo dato no
//  existe en el contrato degradan a "—" o a un estado vacío honesto.
// ============================================================================

/** Nota de sección sin fuente en el contrato actual (degradación honesta). */
function NoDataCard({ title, description, note }: { title: string; description: string; note: string }) {
  return (
    <section className="mb-4">
      <Card>
        <CardHeader title={title} description={description} />
        <CardBody>
          <EmptyState title="Sin datos disponibles" description={note} />
        </CardBody>
      </Card>
    </section>
  );
}

export function PortfolioFocusWorkspace({
  focus,
  supplierRows,
  opportunities,
}: {
  focus: Exclude<PortfolioFocus, "resumen">;
  supplierRows: SupplierPanelRow[];
  opportunities: PortfolioOpportunity[];
}) {
  if (focus === "productos-clave") {
    return (
      <NoDataCard
        title="Productos clave"
        description="Clasifica qué SKU mueven venta, margen, tráfico, crecimiento o riesgo."
        note="El servicio de compras aún no entrega venta, margen ni GMROI por SKU de la cartera, así que esta clasificación no puede calcularse con datos reales."
      />
    );
  }

  if (focus === "marcas") {
    return (
      <NoDataCard
        title="Marcas"
        description="Participación, crecimiento y margen por marca."
        note="El servicio de compras aún no entrega venta ni margen por marca, así que esta lectura no puede calcularse con datos reales."
      />
    );
  }

  if (focus === "proveedores") {
    const watched = supplierRows.filter(
      (row) => row.status === "on_watch" || row.status === "blocked"
    ).length;
    const openOrders = supplierRows.reduce((sum, row) => sum + (row.openOrders ?? 0), 0);

    return (
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader
            title="Prioridad de revisión"
            description="Qué proveedores requieren atención según el panel real."
          />
          <CardBody className="space-y-3">
            <PortfolioMetric label="Proveedores" value={formatNumber(supplierRows.length)} />
            <PortfolioMetric label="En observación o bloqueados" value={formatNumber(watched)} />
            <PortfolioMetric label="OC abiertas" value={formatNumber(openOrders)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Proveedores de cartera"
            description="Entra al proveedor para preparar costo, cumplimiento y negociación."
          />
          <CardBody className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {supplierRows.length === 0 ? (
              <EmptyState
                title="Sin proveedores"
                description="El panel de proveedores no devolvió filas para tu cartera."
              />
            ) : (
              supplierRows.map((row) => <SupplierPortfolioItem key={row.supplierId} row={row} />)
            )}
          </CardBody>
        </Card>
      </section>
    );
  }

  return (
    <section className="mb-4">
      <Card>
        <CardHeader
          title="Radar de oportunidades"
          description="Oportunidades de compra detectadas por el motor de reposición."
        />
        <CardBody>
          {opportunities.length === 0 ? (
            <EmptyState
              title="Sin oportunidades del motor"
              description="El motor de reposición no tiene recomendaciones de tipo oportunidad en este momento."
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
              {opportunities.map((item) => (
                <OpportunityItem key={`${item.label}-${item.title}`} item={item} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</p>
  );
}

export function PortfolioCountLink({
  to,
  label,
  count,
}: {
  to: string;
  label: string;
  count: number | null;
}) {
  return (
    <Link
      to={to}
      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 hover:border-brand-300 hover:text-brand-700"
    >
      {label} ({count ?? "—"})
    </Link>
  );
}

/** KPI con tendencia (↑/↓ vs mes anterior). `invert` = bajar es bueno. */
export function TrendKpi({
  label,
  value,
  delta,
  unit = "",
  invert,
}: {
  label: string;
  value: string;
  delta?: number;
  unit?: string;
  invert?: boolean;
}) {
  const hasDelta = delta !== undefined && Math.abs(delta) >= 0.05;
  const positive = (delta ?? 0) >= 0;
  const good = invert ? !positive : positive;
  const arrow = positive ? "↑" : "↓";
  const deltaText =
    unit === "%" || unit === "pp"
      ? `${Math.abs(delta ?? 0).toFixed(1)}${unit === "pp" ? "pp" : "%"}`
      : unit === "d"
        ? `${Math.round(Math.abs(delta ?? 0))} d`
        : Math.abs(delta ?? 0).toFixed(1);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
      {hasDelta ? (
        <p className={cn("text-xs font-medium", good ? "text-emerald-600" : "text-rose-600")}>
          {arrow} {deltaText}
        </p>
      ) : (
        <p className="text-xs text-slate-300">—</p>
      )}
    </div>
  );
}

export function GoalBar({
  label,
  valueText,
  metaText,
  pct,
  good,
}: {
  label: string;
  valueText: string;
  metaText: string;
  pct: number;
  good: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, Math.round(pct)));
  const bar = good ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-[11px] text-slate-400">{metaText}</span>
      </div>
      <p className="mt-0.5 text-base font-semibold text-slate-900">{valueText}</p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${clamped}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{`${clamped}% de la meta`}</p>
    </div>
  );
}

export function FocoCard({ dot, text, to }: { dot: string; text: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span className={cn("h-2.5 w-2.5 flex-shrink-0 rounded-full", dot)} />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{text}</span>
      <span className="flex-shrink-0 text-xs font-medium text-brand-600">Ir →</span>
    </Link>
  );
}

export function TrendRow({ row, up }: { row: SalesPaceRow; up?: boolean }) {
  return (
    <Link
      to={`/productos/${row.rec.sku}`}
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-50"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{row.rec.productName}</span>
      <span
        className={cn(
          "flex-shrink-0 text-xs font-medium",
          up ? "text-emerald-600" : "text-amber-600"
        )}
      >
        {up ? "+" : ""}
        {formatPercent(row.diffPct * 100, 0)}
      </span>
    </Link>
  );
}

function SupplierPortfolioItem({ row }: { row: SupplierPanelRow }) {
  return (
    <Link
      to={`/proveedores/${row.supplierId}`}
      className="block rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{row.name}</p>
          <p className="text-xs text-slate-500">
            {row.skuCount !== null ? `${formatNumber(row.skuCount)} SKU` : "SKU —"}
            {row.categories.length > 0 ? ` · ${row.categories.slice(0, 2).join(", ")}` : ""}
          </p>
        </div>
        <StatusBadge kind="supplier" value={row.status} dot={false} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <span>
          <b className="block text-slate-800">
            {row.purchased90Clp !== null ? formatCurrencyCompact(row.purchased90Clp) : "—"}
          </b>
          compra 90d
        </span>
        <span>
          <b className="block text-slate-800">
            {row.compliancePct !== null ? formatPercent(row.compliancePct, 0) : "—"}
          </b>
          cumplimiento
        </span>
        <span>
          <b className="block text-slate-800">
            {row.openOrders !== null ? formatNumber(row.openOrders) : "—"}
          </b>
          OC abiertas
        </span>
      </div>
    </Link>
  );
}

function OpportunityItem({ item }: { item: PortfolioOpportunity }) {
  return (
    <Link
      to={item.to}
      className="block rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <div className="flex items-center gap-2">
        <Badge tone={item.tone}>{item.label}</Badge>
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-800">{item.title}</p>
      <p className="text-xs text-slate-500">{item.detail}</p>
    </Link>
  );
}

function PortfolioMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

/**
 * Cabecera de "Mi cartera": categorías asignadas (panel real F12) y accesos
 * rápidos. Subcategorías y marcas no existen en el contrato → se omiten.
 */
export function PortfolioHeaderCard({
  catNames,
  skuCount,
  supplierCount,
}: {
  catNames: string[];
  skuCount: number | null;
  supplierCount: number | null;
}) {
  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mi cartera</p>
          <h2 className="mt-0.5 truncate text-lg font-semibold text-slate-900">
            {catNames.join(" • ") || "Sin categorías asignadas"}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {skuCount !== null ? formatNumber(skuCount) : "—"} SKU ·{" "}
            {supplierCount !== null ? formatNumber(supplierCount) : "—"} proveedores
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <PortfolioCountLink to="/categorias" label="Categorías" count={catNames.length} />
          <PortfolioCountLink to="/proveedores" label="Proveedores" count={supplierCount} />
          <Link
            to="/mi-cartera/oportunidades"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Ver detalle →
          </Link>
        </div>
      </div>
    </section>
  );
}

const GOAL_LABEL: Record<GoalKind, string> = {
  order_count: "Órdenes emitidas",
  hit_rate: "Tasa de acierto",
  claims_resolved: "Reclamos resueltos",
  signals_actioned: "Señales gestionadas",
};

function goalValueText(kind: GoalKind, value: number | undefined): string {
  if (value === undefined) return "—";
  return kind === "hit_rate" ? formatPercent(value, 0) : formatNumber(value);
}

/**
 * "Objetivos del mes": metas reales del comprador (F19, GET /performance/me).
 * Reemplaza las metas inventadas de venta/margen del prototipo.
 */
export function MonthGoalsCard({ goals }: { goals: GoalView[] }) {
  return (
    <Card className="mb-4">
      <CardHeader
        title="Objetivos del mes"
        description="Un comprador trabaja contra metas, no solo mirando el estado actual."
      />
      {goals.length === 0 ? (
        <CardBody>
          <EmptyState
            title="Sin metas para este período"
            description="Tu líder aún no define metas en el servicio de compras."
          />
        </CardBody>
      ) : (
        <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {goals.map((goal) => {
            const value = goal.progress?.value;
            const target = goal.target?.value;
            const label = GOAL_LABEL[goal.kind] ?? goal.kind;
            const pct =
              value !== undefined && target !== undefined && target > 0
                ? (value / target) * 100
                : 0;
            return (
              <GoalBar
                key={goal.id}
                label={label}
                valueText={goalValueText(goal.kind, value)}
                metaText={
                  target !== undefined ? `meta ${goalValueText(goal.kind, target)}` : "sin meta"
                }
                pct={pct}
                good={goal.status === "on_track" || goal.status === "achieved"}
              />
            );
          })}
        </CardBody>
      )}
    </Card>
  );
}

/**
 * "Resumen ejecutivo": el contrato actual solo permite calcular los quiebres
 * (motor de reposición). Venta, margen, GMROI, rotación, cobertura, sobrestock
 * e inventario valorizado no existen en el BFF y se muestran como "—".
 */
export function ExecutiveSummary({ riskCount }: { riskCount: number | null }) {
  return (
    <section className="mb-4">
      <SectionLabel>Resumen ejecutivo</SectionLabel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <TrendKpi label="Venta 30d" value="—" />
        <TrendKpi label="Margen" value="—" />
        <TrendKpi label="GMROI" value="—" />
        <TrendKpi label="Rotación" value="—" />
        <TrendKpi label="Cobertura" value="—" />
        <TrendKpi label="Sobrestock" value="—" />
        <TrendKpi
          label="Quiebres"
          value={riskCount !== null ? `${formatNumber(riskCount)} SKU` : "—"}
        />
        <TrendKpi label="Inventario" value="—" />
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Venta, margen, rotación e inventario valorizado de la cartera aún no están disponibles en
        el servicio de compras.
      </p>
    </section>
  );
}

/**
 * "Mi puntaje del mes" (score real de F19, con delta vs mes anterior) junto a
 * "Principales focos" (conteos reales calculables; los no calculables se omiten).
 */
export function PortfolioHealthFocus({
  performance,
  focos,
}: {
  performance: MyPerformanceView | null;
  focos: PortfolioFoco[];
}) {
  const metrics = performance?.current?.metrics ?? null;
  const prevScore = performance?.previous?.metrics?.score ?? null;
  const delta = metrics !== null && prevScore !== null ? metrics.score - prevScore : null;

  return (
    <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader
          title="Mi puntaje del mes"
          description="Score de desempeño del servicio de compras (actividad + calidad)."
        />
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold leading-none text-slate-900">
                {metrics !== null ? formatNumber(metrics.score) : "—"}
                <span className="text-base font-normal text-slate-400">/100</span>
              </p>
              {delta !== null ? (
                <p
                  className={cn(
                    "mt-1 text-xs font-medium",
                    delta >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {delta >= 0 ? "↑ +" : "↓ "}
                  {formatNumber(Math.abs(delta))} vs mes anterior
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">Sin mes anterior comparable</p>
              )}
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-emerald-700">Actividad</p>
                <p className="text-sm font-semibold text-emerald-800">
                  {metrics !== null ? `${formatNumber(metrics.activityPoints)} pts` : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-brand-700">Calidad</p>
                <p className="text-sm font-semibold text-brand-800">
                  {metrics !== null ? `${formatNumber(metrics.qualityPoints)} pts` : "—"}
                </p>
              </div>
            </div>
          </div>
          {metrics === null && (
            <p className="mt-3 text-xs text-slate-400">
              El puntaje del mes no está disponible por ahora.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Principales focos" description="Dónde actuar primero, en un solo lugar." />
        <CardBody className="space-y-2">
          {focos.length === 0 ? (
            <p className="py-2 text-sm text-slate-400">Sin focos calculables por ahora.</p>
          ) : (
            focos.map((foco) => (
              <FocoCard key={foco.text} dot={foco.dot} text={foco.text} to={foco.to} />
            ))
          )}
        </CardBody>
      </Card>
    </section>
  );
}

/**
 * Tablas compactas de "Marcas" y "Proveedores". La de proveedores usa el panel
 * real (F12); la de marcas no tiene fuente en el contrato y lo dice.
 */
export function BrandsSuppliersTables({ supplierRows }: { supplierRows: SupplierPanelRow[] }) {
  return (
    <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Marcas" description="Venta, margen y crecimiento." />
        <CardBody>
          <EmptyState
            title="Sin datos de marcas"
            description="El servicio de compras no entrega venta ni margen por marca."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Proveedores"
          description="Compra 90 días, cumplimiento y estado."
          action={
            <Link
              to="/mi-cartera/proveedores"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Ver todos
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Proveedor</th>
                <th className="px-2 py-2 text-right font-medium">Compra 90d</th>
                <th className="px-2 py-2 text-right font-medium">Cumpl.</th>
                <th className="px-4 py-2 text-right font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {supplierRows.slice(0, 5).map((r) => (
                <tr key={r.supplierId} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium text-slate-800">{r.name}</td>
                  <td className="px-2 py-2 text-right text-slate-700">
                    {r.purchased90Clp !== null ? formatCurrencyCompact(r.purchased90Clp) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-700">
                    {r.compliancePct !== null ? formatPercent(r.compliancePct, 0) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <StatusBadge kind="supplier" value={r.status} dot={false} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

/** Resumen de oportunidades y pendientes reales en 4 contadores. */
export function OpportunitiesSummary({ items }: { items: OpportunitySummaryItem[] }) {
  return (
    <section className="mb-4">
      <SectionLabel>Oportunidades</SectionLabel>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((o) => (
          <Link
            key={o.label}
            to={o.to}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-card hover:border-brand-300 hover:bg-brand-50/40"
          >
            <p className="text-2xl font-bold text-slate-900">
              {o.count !== null ? formatNumber(o.count) : "—"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{o.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * "Tendencias": SKU acelerando vs desacelerando, derivado de la venta real
 * 30d vs 90d de las filas del motor de reposición.
 */
export function TrendsCard({
  faster,
  slower,
}: {
  faster: SalesPaceRow[];
  slower: SalesPaceRow[];
}) {
  return (
    <Card className="mb-4">
      <CardHeader
        title="Tendencias"
        description="Qué acelera y qué se frena entre tus SKU con recomendación del motor."
        action={
          <Link to="/ventas" className="text-xs font-medium text-brand-600 hover:text-brand-700">
            Ver análisis →
          </Link>
        }
      />
      <CardBody className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-medium text-emerald-700">
            ⬆ {formatNumber(faster.length)} acelerando
          </p>
          {faster.length === 0 ? (
            <p className="text-sm text-slate-400">Sin aceleraciones relevantes.</p>
          ) : (
            <div className="space-y-1">
              {faster.slice(0, 3).map((r) => (
                <TrendRow key={r.rec.sku} row={r} up />
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-amber-700">
            ⬇ {formatNumber(slower.length)} desacelerando
          </p>
          {slower.length === 0 ? (
            <p className="text-sm text-slate-400">Sin frenos relevantes.</p>
          ) : (
            <div className="space-y-1">
              {slower.slice(0, 3).map((r) => (
                <TrendRow key={r.rec.sku} row={r} />
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * "Categorías": tarjetas comparables desde el panel real (F12): pendientes del
 * motor, quiebres/stock bajo, venta 30d en unidades y margen promedio.
 */
export function CategoriesCard({ cats }: { cats: CategoryPanelRow[] }) {
  return (
    <Card className="mb-4">
      <CardHeader
        title="Categorías"
        description="Compara tus categorías: venta, margen, quiebres y riesgo."
      />
      <CardBody>
        {cats.length === 0 ? (
          <EmptyState
            title="Sin categorías asignadas"
            description="El panel de categorías no devolvió filas para tu sesión."
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cats.map((c) => (
              <Link
                key={c.categoryId}
                to={`/categorias/${c.categoryId}`}
                className="group rounded-lg border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{c.name}</span>
                  {c.pendingCount > 0 && <Badge tone="blue">{c.pendingCount} pend.</Badge>}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex gap-4 text-sm">
                    <span>
                      <span className="text-xs text-slate-400">Venta 30d </span>
                      <b className="text-slate-800">
                        {c.sales30Units !== null ? `${formatNumber(c.sales30Units)} u.` : "—"}
                      </b>
                    </span>
                    <span>
                      <span className="text-xs text-slate-400">Margen </span>
                      <b className="text-slate-800">
                        {c.avgMarginPct !== null ? formatPercent(c.avgMarginPct, 0) : "—"}
                      </b>
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {c.byPriority.stockout_imminent > 0 && (
                      <Badge tone="red">{c.byPriority.stockout_imminent}</Badge>
                    )}
                    {c.byPriority.low_stock > 0 && (
                      <Badge tone="amber">{c.byPriority.low_stock}</Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** "Órdenes de compra sin recibir": lista con proveedor, fecha y atraso. */
export function OpenOrdersList({ orders }: { orders: PurchaseOrder[] }) {
  return (
    <div id="ordenes">
      <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Órdenes de compra sin recibir</h3>
      <Card>
        <CardBody className="space-y-2">
          {orders.length === 0 ? (
            <EmptyState
              icon={<IconCheck className="w-6 h-6" />}
              title="Sin órdenes pendientes"
              description="No tienes mercadería por recibir."
            />
          ) : (
            [...orders]
              .sort((a, b) => b.delayedDays - a.delayedDays)
              .map((o) => (
                <Link
                  key={o.id}
                  to={`/comprar/seguimiento?oc=${encodeURIComponent(o.number)}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{o.number}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {o.supplierName}
                      {o.expectedDate ? ` · espera ${formatDate(o.expectedDate)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {o.delayedDays > 0 && <Badge tone="red">{o.delayedDays} d atraso</Badge>}
                    <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
                  </div>
                </Link>
              ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** "Proveedores por revisar": panel real (F12), en observación o bloqueados. */
export function SuppliersToReviewList({ suppliers }: { suppliers: SupplierPanelRow[] }) {
  return (
    <div id="proveedores">
      <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Proveedores por revisar</h3>
      <Card>
        <CardBody className="space-y-2">
          {suppliers.length === 0 ? (
            <EmptyState
              icon={<IconCheck className="w-6 h-6" />}
              title="Proveedores al día"
              description="Ninguno de tus proveedores está en observación ni bloqueado."
            />
          ) : (
            suppliers.map((s) => (
              <Link
                key={s.supplierId}
                to={`/proveedores/${s.supplierId}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {s.compliancePct !== null
                      ? `Cumple ${formatPercent(s.compliancePct, 0)}`
                      : "Cumplimiento —"}
                    {s.openOrders !== null ? ` · ${formatNumber(s.openOrders)} OC abiertas` : ""}
                  </p>
                </div>
                <StatusBadge kind="supplier" value={s.status} dot={false} />
              </Link>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** "Señales de ventas pendientes": lo que ventas reportó (backend) y espera decisión. */
export function SalesSignalsCard({ signals }: { signals: SignalView[] }) {
  return (
    <CollapsibleSection
      id="panel-senales"
      className="mb-4"
      title="Señales de ventas pendientes"
      description="Lo que ventas reportó desde el terreno y aún espera decisión"
      hint={`${signals.length} pendiente${signals.length === 1 ? "" : "s"}`}
      action={
        <Link to="/senales-ventas" className="text-xs font-medium text-brand-600 hover:text-brand-700">
          Ver todas
        </Link>
      }
    >
      {signals.length === 0 ? (
        <EmptyState
          title="Todo al día"
          description="No hay señales de ventas pendientes de decisión."
          icon={<IconCheck className="w-6 h-6" />}
        />
      ) : (
        <div className="space-y-2">
          {signals.map((s) => (
            <Link
              key={s.id}
              to={`/senales-ventas?sig=${encodeURIComponent(s.id)}`}
              className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <IconSignal className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge tone={SIGNAL_PRIORITY[s.priority].tone}>
                    {SIGNAL_PRIORITY[s.priority].label}
                  </Badge>
                  <Badge tone={signalKindMeta(s.kind).tone}>{signalKindMeta(s.kind).short}</Badge>
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {s.sku ?? signalKindMeta(s.kind).label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{s.body}</p>
              </div>
              <Badge tone={SIGNAL_STATUS[s.status].tone} dot>
                {SIGNAL_STATUS[s.status].label}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}

/**
 * "Mis productos en riesgo de quiebre": tabla sobre las recomendaciones reales
 * del motor (prioridades quiebre inminente / stock bajo) con acción de agregar
 * la cantidad sugerida por el motor al borrador de OC.
 */
export function StockoutRiskCard({
  rows,
  hasItem,
  onAdd,
  onOpenProduct,
}: {
  rows: RiskRow[];
  hasItem: (sku: string) => boolean;
  onAdd: (rec: ReplenishmentRecommendation, qty: number) => void;
  onOpenProduct: (sku: string) => void;
}) {
  const columns: Column<RiskRow>[] = [
    {
      key: "product",
      header: "Producto",
      render: ({ rec }) => (
        <div className="min-w-[150px]">
          <span className="text-xs font-mono text-slate-400">{rec.sku}</span>
          <p className="font-medium text-slate-800 leading-snug">{rec.productName}</p>
          <p className="text-xs text-slate-500">
            {rec.category} · {rec.supplierName}
          </p>
          <p className="text-xs mt-0.5 leading-snug text-rose-600">
            {coverageSentence(rec.availableStock, rec.salesLast30Days)}
          </p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock disp.",
      align: "right",
      render: ({ rec }) => (
        <span className={rec.availableStock <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>
          {formatNumber(rec.availableStock)}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Venta 30d",
      align: "right",
      hideOnMobile: true,
      render: ({ rec }) => formatNumber(rec.salesLast30Days),
    },
    {
      key: "stockout",
      header: "Quiebre estimado",
      align: "right",
      render: (r) => (
        <div className="text-sm">
          <p
            className={
              r.coverage <= r.rec.supplierLeadTimeDays
                ? "text-rose-600 font-semibold"
                : "text-amber-600 font-medium"
            }
          >
            {r.rec.availableStock <= 0
              ? "En quiebre"
              : r.stockoutDate
                ? formatDate(r.stockoutDate)
                : "—"}
          </p>
          <p className="text-xs text-slate-400">
            cubre {formatDays(r.coverage)} · lead {formatDays(r.rec.supplierLeadTimeDays)}
          </p>
        </div>
      ),
    },
    {
      key: "suggested",
      header: "Compra sugerida",
      align: "right",
      render: (r) => (
        <div className="text-sm">
          <p className="font-semibold text-slate-900">{formatNumber(r.suggestedQty)} u.</p>
          <p className="text-xs text-slate-400">para ~{formatDays(r.coverageAfter)}</p>
        </div>
      ),
    },
    {
      key: "action",
      header: "",
      render: (r) => (
        <div className="flex flex-col items-end gap-1">
          <Button
            size="sm"
            variant={hasItem(r.rec.sku) ? "secondary" : "primary"}
            disabled={hasItem(r.rec.sku) || r.suggestedQty <= 0}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(r.rec, r.suggestedQty);
            }}
            icon={
              hasItem(r.rec.sku) ? (
                <IconCheck className="w-3.5 h-3.5" />
              ) : (
                <IconPlus className="w-3.5 h-3.5" />
              )
            }
          >
            {hasItem(r.rec.sku) ? "En OC" : "Agregar a OC"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div id="riesgo">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-sm font-semibold text-slate-800">Mis productos en riesgo de quiebre</h3>
        <Link
          to="/comprar/decisiones"
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Ver reposición
        </Link>
      </div>
      <Card>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.rec.sku}
          onRowClick={(r) => onOpenProduct(r.rec.sku)}
          rowClassName={(r) => (r.rec.availableStock <= 0 ? "bg-rose-50/40" : undefined)}
          emptyMessage="No tienes productos en riesgo de quiebre. ¡Bien!"
          mobileCard={(r) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-slate-400">{r.rec.sku}</span>
                  <p className="font-medium text-slate-800 leading-snug">{r.rec.productName}</p>
                  <p className="text-xs text-slate-500">
                    {r.rec.category} · {r.rec.supplierName}
                  </p>
                  <p className="text-xs mt-0.5 leading-snug text-rose-600 font-medium">
                    {coverageSentence(r.rec.availableStock, r.rec.salesLast30Days)}
                  </p>
                </div>
                <Badge tone="red" dot>
                  {r.rec.availableStock <= 0 ? "Quiebre" : "Riesgo"}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Stock</p>
                  <p
                    className={
                      r.rec.availableStock <= 0
                        ? "text-rose-600 font-semibold"
                        : "text-slate-700"
                    }
                  >
                    {formatNumber(r.rec.availableStock)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Quiebre</p>
                  <p className="text-slate-700">
                    {r.rec.availableStock <= 0
                      ? "hoy"
                      : r.stockoutDate
                        ? formatDate(r.stockoutDate)
                        : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Comprar</p>
                  <p className="font-semibold text-slate-900">{formatNumber(r.suggestedQty)} u.</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Cubre ~{formatDays(r.coverageAfter)} · lead {formatDays(r.rec.supplierLeadTimeDays)}
              </p>
              <Button
                size="sm"
                className="mt-2 w-full"
                variant={hasItem(r.rec.sku) ? "secondary" : "primary"}
                disabled={hasItem(r.rec.sku) || r.suggestedQty <= 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(r.rec, r.suggestedQty);
                }}
                icon={
                  hasItem(r.rec.sku) ? (
                    <IconCheck className="w-3.5 h-3.5" />
                  ) : (
                    <IconPlus className="w-3.5 h-3.5" />
                  )
                }
              >
                {hasItem(r.rec.sku) ? "En OC" : "Agregar a OC"}
              </Button>
            </div>
          )}
        />
      </Card>
    </div>
  );
}

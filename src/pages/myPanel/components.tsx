import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatusBadge } from "../../components/business/StatusBadge";
import {
  capitalize,
  formatCurrencyCompact,
  formatDays,
  formatNumber,
  formatPercent,
} from "../../utils/formatters";
import { cn } from "../../utils/cn";
import type { Category } from "../../types/purchasing";
import type {
  BrandPortfolioRow,
  KeyProductRow,
  PortfolioFocus,
  PortfolioOpportunity,
  PortfolioProductRole,
  SalesPaceRow,
  SupplierPortfolioRow,
} from "./types";

// ============================================================================
//  Componentes de presentación de "Mi cartera".
//  Piezas puras (sin estado ni cálculo): reciben filas ya derivadas y las
//  pintan. El cálculo vive en el orquestador de la página.
// ============================================================================

export function PortfolioFocusWorkspace({
  focus,
  productRows,
  brandRows,
  supplierRows,
  opportunities,
}: {
  focus: Exclude<PortfolioFocus, "resumen">;
  productRows: KeyProductRow[];
  brandRows: BrandPortfolioRow[];
  supplierRows: SupplierPortfolioRow[];
  opportunities: PortfolioOpportunity[];
}) {
  if (focus === "productos-clave") {
    const roles: PortfolioProductRole[] = [
      "Estrella",
      "Tractor",
      "Margen",
      "Emergente",
      "Deterioro",
      "Detenido",
      "Riesgo",
    ];
    const topSales = [...productRows].sort((a, b) => b.salesValue - a.salesValue).slice(0, 5);
    const topProfit = [...productRows].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 5);
    const topGmroi = [...productRows].sort((a, b) => b.gmroi - a.gmroi).slice(0, 5);

    return (
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader
            title="Mapa de roles comerciales"
            description="El mismo SKU puede ser importante por venta, margen, tráfico, crecimiento o riesgo."
          />
          <CardBody>
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {roles.map((role) => (
                <div
                  key={role}
                  className="min-w-[128px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <Badge tone={roleTone(role)}>{role}</Badge>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {productRows.filter((row) => row.role === role).length}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {productRows.slice(0, 10).map((row) => (
                <KeyProductItem key={row.product.sku} row={row} />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Rankings para decidir"
            description="Cada lista responde una pregunta distinta antes de comprar o negociar."
          />
          <CardBody className="space-y-4">
            <ProductRank title="Más vendidos" rows={topSales} metric="sales" />
            <ProductRank title="Mayor utilidad" rows={topProfit} metric="profit" />
            <ProductRank title="Mayor GMROI" rows={topGmroi} metric="gmroi" />
          </CardBody>
        </Card>
      </section>
    );
  }

  if (focus === "marcas") {
    const growing = brandRows.filter((row) => row.growth > 0.08).length;
    const pressured = brandRows.filter((row) => row.growth < -0.08 || row.stockouts > 0).length;

    return (
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader
            title="Lectura de marcas"
            description="Participación, crecimiento, margen e inventario para decidir qué proteger."
          />
          <CardBody className="grid grid-cols-2 gap-3">
            <PortfolioMetric label="Marcas activas" value={formatNumber(brandRows.length)} />
            <PortfolioMetric label="Creciendo" value={formatNumber(growing)} />
            <PortfolioMetric label="Con presión" value={formatNumber(pressured)} />
            <PortfolioMetric
              label="Venta líder"
              value={formatCurrencyCompact(brandRows[0]?.sales ?? 0)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Desempeño por marca"
            description="Detecta marcas que crecen consumiendo capital o que sostienen margen."
          />
          <CardBody className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {brandRows.map((row) => (
              <BrandHealthItem key={row.brand} row={row} />
            ))}
          </CardBody>
        </Card>
      </section>
    );
  }

  if (focus === "proveedores") {
    const highDependency = supplierRows.filter((row) => row.dependency > 0.35).length;
    const withAlternatives = supplierRows.filter((row) => row.alternatives > 0).length;
    const stalled = supplierRows.reduce((sum, row) => sum + row.stalled, 0);

    return (
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader
            title="Prioridad de negociación"
            description="Dónde hay dependencia, alternativas y productos que llevar a reunión."
          />
          <CardBody className="space-y-3">
            <PortfolioMetric label="Dependencia alta" value={formatNumber(highDependency)} />
            <PortfolioMetric label="Con alternativas" value={formatNumber(withAlternatives)} />
            <PortfolioMetric label="SKU detenidos" value={formatNumber(stalled)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Proveedores de cartera"
            description="Entra al proveedor para preparar costo, detenidos, cumplimiento y oportunidad."
          />
          <CardBody className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {supplierRows.map((row) => (
              <SupplierPortfolioItem key={row.supplier.id} row={row} />
            ))}
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
          description="Crecimiento con poca cobertura, margen por potenciar y alternativas para negociar."
        />
        <CardBody>
          {opportunities.length === 0 ? (
            <EmptyState
              title="Sin oportunidades fuertes"
              description="No hay señales comerciales destacadas en este momento."
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

function ProductRank({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: KeyProductRow[];
  metric: "sales" | "profit" | "gmroi";
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="space-y-1.5">
        {rows.map((row) => {
          const value =
            metric === "gmroi"
              ? row.gmroi.toFixed(1).replace(".", ",")
              : formatCurrencyCompact(metric === "sales" ? row.salesValue : row.grossProfit);
          return (
            <Link
              key={`${title}-${row.product.sku}`}
              to={`/productos/${row.product.sku}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800">
                  {row.product.name}
                </span>
                <span className="text-xs text-slate-500">{row.role}</span>
              </span>
              <span className="flex-shrink-0 text-sm font-semibold text-slate-900">{value}</span>
            </Link>
          );
        })}
      </div>
    </div>
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
  count: number;
}) {
  return (
    <Link
      to={to}
      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 hover:border-brand-300 hover:text-brand-700"
    >
      {label} ({count})
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
  invert,
}: {
  label: string;
  valueText: string;
  metaText: string;
  pct: number;
  good: boolean;
  invert?: boolean;
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
      <p className="mt-1 text-[11px] text-slate-400">
        {invert ? (good ? "Dentro de la meta" : "Sobre la meta") : `${clamped}% de la meta`}
      </p>
    </div>
  );
}

export function MiniDim({ label, value }: { label: string; value: number }) {
  const tone = value >= 75 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-slate-500">{capitalize(label)}</span>
        <span className="text-xs font-semibold text-slate-700">{value}</span>
      </div>
      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
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

export function Delta({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className={cn("text-xs font-medium", up ? "text-emerald-600" : "text-rose-600")}>
      {up ? "+" : ""}
      {formatPercent(pct, 0)}
    </span>
  );
}

export function TrendRow({ row, up }: { row: SalesPaceRow; up?: boolean }) {
  return (
    <Link
      to={`/productos/${row.product.sku}`}
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-50"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{row.product.name}</span>
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

export function QualityItem({
  label,
  value,
  hint,
  to,
}: {
  label: string;
  value: number;
  hint: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <p className={cn("text-2xl font-bold", value > 0 ? "text-slate-900" : "text-slate-300")}>
        {formatNumber(value)}
      </p>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="text-[11px] text-slate-400">{hint}</p>
    </Link>
  );
}

function roleTone(role: PortfolioProductRole): "green" | "blue" | "amber" | "red" | "violet" {
  if (role === "Estrella") return "green";
  if (role === "Tractor") return "blue";
  if (role === "Margen") return "violet";
  if (role === "Emergente") return "blue";
  if (role === "Detenido" || role === "Deterioro") return "red";
  return "amber";
}

function KeyProductItem({ row }: { row: KeyProductRow }) {
  return (
    <Link
      to={`/productos/${row.product.sku}`}
      className="block rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone={roleTone(row.role)}>{row.role}</Badge>
            <span className="text-xs font-mono text-slate-400">{row.product.sku}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-800">{row.product.name}</p>
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{row.reason}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-semibold text-slate-900">
            {formatCurrencyCompact(row.salesValue)}
          </p>
          <p className="text-xs text-slate-500">
            margen {formatPercent(row.product.margin, 0)} · GMROI {row.gmroi.toFixed(1)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function BrandHealthItem({ row }: { row: BrandPortfolioRow }) {
  const conclusion =
    row.growth > 0.15 && row.inventory > row.sales
      ? "crece, pero consume capital"
      : row.growth < -0.12
        ? "se está frenando"
        : row.margin >= 34
          ? "protege rentabilidad"
          : "monitorear mix";
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{row.brand}</p>
          <p className="text-xs text-slate-500">
            {row.skus} SKU · {conclusion}
          </p>
        </div>
        {row.stockouts > 0 && <Badge tone="red">{row.stockouts} quiebre</Badge>}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <span>
          <b className="block text-slate-800">{formatCurrencyCompact(row.sales)}</b>
          venta
        </span>
        <span>
          <b className="block text-slate-800">{formatPercent(row.margin, 0)}</b>
          margen
        </span>
        <span>
          <b className={row.growth >= 0 ? "block text-emerald-700" : "block text-rose-600"}>
            {formatPercent(row.growth * 100, 0)}
          </b>
          crecimiento
        </span>
      </div>
    </div>
  );
}

function SupplierPortfolioItem({ row }: { row: SupplierPortfolioRow }) {
  const position =
    row.dependency > 0.35 && row.alternatives / Math.max(1, row.skus) > 0.4
      ? "posición negociadora media-alta"
      : row.dependency > 0.35
        ? "dependencia alta"
        : "relación diversificada";
  return (
    <Link
      to={`/proveedores/${row.supplier.id}?tab=negociacion`}
      className="block rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{row.supplier.name}</p>
          <p className="text-xs text-slate-500">{position}</p>
        </div>
        <StatusBadge kind="supplier" value={row.supplier.status} dot={false} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <span>
          <b className="block text-slate-800">{formatCurrencyCompact(row.sales)}</b>
          venta
        </span>
        <span>
          <b className="block text-slate-800">{formatPercent(row.dependency * 100, 0)}</b>
          dependencia
        </span>
        <span>
          <b className={row.stalled > 0 ? "block text-rose-600" : "block text-emerald-700"}>
            {row.stalled}
          </b>
          detenidos
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

export function AgendaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function SignalSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "amber" | "blue" | "violet";
}) {
  const toneClass = {
    red: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-brand-200 bg-brand-50 text-brand-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-none">{value}</p>
    </div>
  );
}

/**
 * Cabecera de "Mi cartera": categorías administradas y accesos rápidos a
 * categorías / marcas / proveedores. (Extraído de MyPanelPage.)
 */
export function PortfolioHeaderCard({
  catNames,
  skuCount,
  subcatCount,
  supplierCount,
  brandCount,
}: {
  catNames: string[];
  skuCount: number;
  subcatCount: number;
  supplierCount: number;
  brandCount: number;
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
            {skuCount} SKU · {subcatCount} subcategorías · {supplierCount} proveedores ·{" "}
            {brandCount} marcas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <PortfolioCountLink to="/categorias" label="Categorías" count={catNames.length} />
          <PortfolioCountLink to="/productos" label="Marcas" count={brandCount} />
          <PortfolioCountLink to="/proveedores" label="Proveedores" count={supplierCount} />
          <Link
            to="/mi-cartera/productos-clave"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Ver detalle →
          </Link>
        </div>
      </div>
    </section>
  );
}

interface Goal {
  actual: number;
  meta: number;
}

/**
 * "Objetivos del mes": venta, margen, sobrestock y disponibilidad vs su meta.
 * (Extraído de MyPanelPage.)
 */
export function MonthGoalsCard({
  goals,
}: {
  goals: { venta: Goal; margen: Goal; sobrestock: Goal; disponibilidad: Goal };
}) {
  return (
    <Card className="mb-4">
      <CardHeader
        title="Objetivos del mes"
        description="Un comprador trabaja contra metas, no solo mirando el estado actual."
      />
      <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <GoalBar
          label="Venta"
          valueText={formatCurrencyCompact(goals.venta.actual)}
          metaText={`meta ${formatCurrencyCompact(goals.venta.meta)}`}
          pct={goals.venta.meta > 0 ? (goals.venta.actual / goals.venta.meta) * 100 : 0}
          good={goals.venta.actual >= goals.venta.meta * 0.9}
        />
        <GoalBar
          label="Margen"
          valueText={formatPercent(goals.margen.actual)}
          metaText={`meta ${goals.margen.meta}%`}
          pct={(goals.margen.actual / goals.margen.meta) * 100}
          good={goals.margen.actual >= goals.margen.meta}
        />
        <GoalBar
          label="Sobrestock"
          valueText={formatCurrencyCompact(goals.sobrestock.actual)}
          metaText={`meta < ${formatCurrencyCompact(goals.sobrestock.meta)}`}
          pct={Math.min(100, (goals.sobrestock.actual / goals.sobrestock.meta) * 100)}
          good={goals.sobrestock.actual <= goals.sobrestock.meta}
          invert
        />
        <GoalBar
          label="Disponibilidad"
          valueText={formatPercent(goals.disponibilidad.actual, 0)}
          metaText={`meta ${goals.disponibilidad.meta}%`}
          pct={(goals.disponibilidad.actual / goals.disponibilidad.meta) * 100}
          good={goals.disponibilidad.actual >= goals.disponibilidad.meta}
        />
      </CardBody>
    </Card>
  );
}

/**
 * "Resumen ejecutivo": KPIs de cartera con tendencia (venta, margen, GMROI,
 * rotación, cobertura, sobrestock, quiebres, inventario). (Extraído de MyPanelPage.)
 */
export function ExecutiveSummary({
  portfolio,
  story,
  riskCount,
}: {
  portfolio: {
    salesValue: number;
    marginPct: number;
    gmroi: number;
    rotation: number;
    coverageWeighted: number;
    overstockValue: number;
    inventoryValue: number;
  };
  story: {
    salesTrendPct: number;
    marginDelta: number;
    gmroiDelta: number;
    rotationDelta: number;
    coverageDelta: number;
  };
  riskCount: number;
}) {
  return (
    <section className="mb-4">
      <SectionLabel>Resumen ejecutivo</SectionLabel>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <TrendKpi
          label="Venta 30d"
          value={formatCurrencyCompact(portfolio.salesValue)}
          delta={story.salesTrendPct}
          unit="%"
        />
        <TrendKpi
          label="Margen"
          value={formatPercent(portfolio.marginPct)}
          delta={story.marginDelta}
          unit="pp"
        />
        <TrendKpi
          label="GMROI"
          value={portfolio.gmroi.toFixed(1).replace(".", ",")}
          delta={story.gmroiDelta}
        />
        <TrendKpi
          label="Rotación"
          value={`${formatNumber(portfolio.rotation)}x`}
          delta={story.rotationDelta}
        />
        <TrendKpi
          label="Cobertura"
          value={formatDays(Math.round(portfolio.coverageWeighted))}
          delta={story.coverageDelta}
          unit="d"
          invert
        />
        <TrendKpi label="Sobrestock" value={formatCurrencyCompact(portfolio.overstockValue)} />
        <TrendKpi label="Quiebres" value={`${formatNumber(riskCount)} SKU`} />
        <TrendKpi label="Inventario" value={formatCurrencyCompact(portfolio.inventoryValue)} />
      </div>
    </section>
  );
}

/**
 * "Productos estratégicos": top 3 por aporte a la utilidad, con GMROI y margen.
 * (Extraído de MyPanelPage.)
 */
export function StrategicProductsCard({
  strategic,
}: {
  strategic: { row: KeyProductRow; utilShare: number }[];
}) {
  return (
    <Card className="mb-4">
      <CardHeader
        title="Productos estratégicos"
        description="Los que más aportan a tu utilidad."
        action={
          <Link
            to="/mi-cartera/productos-clave"
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Ver todos
          </Link>
        }
      />
      <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {strategic.map(({ row, utilShare }) => (
          <Link
            key={row.product.sku}
            to={`/productos/${row.product.sku}`}
            className="rounded-lg border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50/40"
          >
            <p className="truncate text-sm font-medium text-slate-800">{row.product.name}</p>
            <p className="mt-0.5 text-xs text-slate-400">{row.role}</p>
            <div className="mt-2 grid grid-cols-3 gap-1 text-center">
              <div>
                <p className="text-sm font-semibold text-slate-900">{formatPercent(utilShare, 0)}</p>
                <p className="text-[10px] text-slate-400">utilidad</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{row.gmroi.toFixed(1)}</p>
                <p className="text-[10px] text-slate-400">GMROI</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {formatPercent(row.product.margin, 0)}
                </p>
                <p className="text-[10px] text-slate-400">margen</p>
              </div>
            </div>
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}

/**
 * "Salud de cartera" (score + fortaleza/problema + dimensiones) junto a
 * "Principales focos" (dónde actuar primero). (Extraído de MyPanelPage.)
 */
export function PortfolioHealthFocus({
  score,
  best,
  worst,
  health,
  riskCount,
  overstockValue,
  opportunityCount,
  suppliersToReviewCount,
  newProductsCount,
}: {
  score: number;
  best: [string, number];
  worst: [string, number];
  health: Record<string, number>;
  riskCount: number;
  overstockValue: number;
  opportunityCount: number;
  suppliersToReviewCount: number;
  newProductsCount: number;
}) {
  return (
    <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader title="Salud de cartera" description="Qué está sano y cuál es tu mayor problema." />
        <CardBody>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold leading-none text-slate-900">
                {score}
                <span className="text-base font-normal text-slate-400">/100</span>
              </p>
              <p className="mt-1 text-xs font-medium text-emerald-600">↑ +3 vs mes anterior</p>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-emerald-700">Fortaleza</p>
                <p className="text-sm font-semibold text-emerald-800">
                  {capitalize(best[0])} · {best[1]}
                </p>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-rose-700">Mayor problema</p>
                <p className="text-sm font-semibold text-rose-800">
                  {capitalize(worst[0])} · {worst[1]}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {Object.entries(health).map(([label, value]) => (
              <MiniDim key={label} label={label} value={value} />
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Principales focos" description="Dónde actuar primero, en un solo lugar." />
        <CardBody className="space-y-2">
          <FocoCard
            dot="bg-rose-500"
            text={`${formatNumber(riskCount)} SKU con riesgo de quiebre`}
            to="/comprar/decisiones"
          />
          <FocoCard
            dot="bg-amber-500"
            text={`${formatCurrencyCompact(overstockValue)} en sobrestock`}
            to="/inventario"
          />
          <FocoCard
            dot="bg-emerald-500"
            text={`${formatNumber(opportunityCount)} oportunidades comerciales`}
            to="/mi-cartera/oportunidades"
          />
          <FocoCard
            dot="bg-orange-500"
            text={`${formatNumber(suppliersToReviewCount)} proveedores por revisar`}
            to="/proveedores"
          />
          <FocoCard
            dot="bg-brand-500"
            text={`${formatNumber(newProductsCount)} productos nuevos por evaluar`}
            to="/productos"
          />
        </CardBody>
      </Card>
    </section>
  );
}

/**
 * Tablas compactas de "Marcas" y "Proveedores" de la cartera (top 5 cada una).
 * (Extraído de MyPanelPage.)
 */
export function BrandsSuppliersTables({
  brandRows,
  supplierRows,
}: {
  brandRows: BrandPortfolioRow[];
  supplierRows: SupplierPortfolioRow[];
}) {
  return (
    <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Marcas"
          description="Venta, margen y crecimiento."
          action={
            <Link
              to="/mi-cartera/marcas"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Ver todas
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Marca</th>
                <th className="px-2 py-2 text-right font-medium">Venta</th>
                <th className="px-2 py-2 text-right font-medium">Margen</th>
                <th className="px-4 py-2 text-right font-medium">Crec.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {brandRows.slice(0, 5).map((r) => (
                <tr key={r.brand} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium text-slate-800">{r.brand}</td>
                  <td className="px-2 py-2 text-right text-slate-700">
                    {formatCurrencyCompact(r.sales)}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-700">
                    {formatPercent(r.margin, 0)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Delta pct={r.growth * 100} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Proveedores"
          description="Venta, dependencia y estado."
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
                <th className="px-2 py-2 text-right font-medium">Venta</th>
                <th className="px-2 py-2 text-right font-medium">Depend.</th>
                <th className="px-4 py-2 text-right font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {supplierRows.slice(0, 5).map((r) => (
                <tr key={r.supplier.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium text-slate-800">{r.supplier.name}</td>
                  <td className="px-2 py-2 text-right text-slate-700">
                    {formatCurrencyCompact(r.sales)}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-700">
                    {formatPercent(r.dependency * 100, 0)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <StatusBadge kind="supplier" value={r.supplier.status} dot={false} />
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

/** Resumen de oportunidades de cartera en 4 contadores. (Extraído de MyPanelPage.) */
export function OpportunitiesSummary({
  oppSummary,
}: {
  oppSummary: { label: string; count: number }[];
}) {
  return (
    <section className="mb-4">
      <SectionLabel>Oportunidades</SectionLabel>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {oppSummary.map((o) => (
          <Link
            key={o.label}
            to="/mi-cartera/oportunidades"
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-card hover:border-brand-300 hover:bg-brand-50/40"
          >
            <p className="text-2xl font-bold text-slate-900">{formatNumber(o.count)}</p>
            <p className="mt-0.5 text-xs text-slate-500">{o.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * "Tendencias": productos acelerando vs desacelerando (top 3 cada uno).
 * (Extraído de MyPanelPage.)
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
        description="Qué acelera y qué se frena en tus categorías."
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
                <TrendRow key={r.product.sku} row={r} up />
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
                <TrendRow key={r.product.sku} row={r} />
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * "Categorías": tarjetas comparables (venta, margen, quiebres y riesgo) con
 * enlace a la ficha de cada categoría. (Extraído de MyPanelPage.)
 */
export function CategoriesCard({ cats }: { cats: Category[] }) {
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
            description="Cambia de comprador en la barra superior para ver sus categorías."
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cats.map((c) => (
              <Link
                key={c.id}
                to={`/categorias/${c.id}`}
                className="group rounded-lg border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{c.name}</span>
                  <StatusBadge kind="category" value={c.status} dot={false} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex gap-4 text-sm">
                    <span>
                      <span className="text-xs text-slate-400">Venta </span>
                      <b className="text-slate-800">{formatCurrencyCompact(c.salesLast30Days)}</b>
                    </span>
                    <span>
                      <span className="text-xs text-slate-400">Margen </span>
                      <b className="text-slate-800">{formatPercent(c.averageMargin, 0)}</b>
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {c.stockoutSkus > 0 && <Badge tone="red">{c.stockoutSkus}</Badge>}
                    {c.riskSkus > 0 && <Badge tone="amber">{c.riskSkus}</Badge>}
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

/**
 * "Calidad de cartera": mantenimiento de datos (costo sin actualizar, margen
 * bajo, productos nuevos, atributos incompletos). (Extraído de MyPanelPage.)
 */
export function PortfolioQualityCard({
  outdatedCostCount,
  lowMarginCount,
  newProductsCount,
  incompleteAttributes,
}: {
  outdatedCostCount: number;
  lowMarginCount: number;
  newProductsCount: number;
  incompleteAttributes: number;
}) {
  return (
    <Card className="mb-4">
      <CardHeader
        title="Calidad de cartera"
        description="Mantenimiento de datos: lo que conviene corregir para decidir mejor."
      />
      <CardBody className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QualityItem
          label="Costo sin actualizar"
          value={outdatedCostCount}
          hint="más de 90 días"
          to="/productos"
        />
        <QualityItem
          label="Margen bajo"
          value={lowMarginCount}
          hint="bajo 20%"
          to="/analisis-compra"
        />
        <QualityItem
          label="Productos nuevos"
          value={newProductsCount}
          hint="por revisar surtido"
          to="/productos"
        />
        <QualityItem
          label="Atributos incompletos"
          value={incompleteAttributes}
          hint="sin código o unidad"
          to="/productos"
        />
      </CardBody>
    </Card>
  );
}

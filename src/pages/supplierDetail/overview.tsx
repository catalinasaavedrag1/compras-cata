import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { IconAlerts, IconChevronRight, IconSales, IconBox } from "../../components/ui/icons";
import type { Product } from "../../types/purchasing";
import {
  formatCurrencyCompact,
  formatDays,
  formatDate,
  formatNumber,
  formatPercent,
} from "../../utils/formatters";
import { SUPPLIER_CLASS, type SupplierScore } from "../../utils/supplierScore";
import {
  SUPPLIER_COMPLIANCE_CRITICAL,
  SUPPLIER_LEAD_TIME_WARN_DAYS,
} from "../../utils/constants";
import type { Supplier } from "../../types/purchasing";

/** Un dato de la evaluación de desempeño (label, valor coloreado y pista). */
function ScoreStat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const color =
    tone === "bad"
      ? "text-rose-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "good"
          ? "text-emerald-700"
          : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`text-base font-semibold ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/** Botón-alerta de reclamos del proveedor (abiertos en rojo, histórico en gris). */
export function SupplierClaimsAlert({
  totalClaims,
  openCount,
  claimsValue,
  onNavigate,
}: {
  totalClaims: number;
  openCount: number;
  claimsValue: number;
  onNavigate: () => void;
}) {
  if (totalClaims === 0) return null;
  return (
    <button
      type="button"
      onClick={onNavigate}
      className={`mb-4 flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
        openCount > 0
          ? "border-rose-200 bg-rose-50 hover:bg-rose-100/60"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <IconAlerts
        className={`h-5 w-5 flex-shrink-0 ${openCount > 0 ? "text-rose-600" : "text-slate-400"}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800">
          {openCount > 0
            ? `${openCount} reclamo${openCount === 1 ? "" : "s"} abierto${openCount === 1 ? "" : "s"} · ${formatCurrencyCompact(claimsValue)} en juego`
            : "Sin reclamos abiertos"}
        </span>
        <span className="block text-xs text-slate-500">
          {totalClaims} reclamo{totalClaims === 1 ? "" : "s"} histórico
          {totalClaims === 1 ? "" : "s"} — buen precio no compensa pérdidas operativas.
        </span>
      </span>
      <IconChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
    </button>
  );
}

/** Tarjeta de evaluación de desempeño: OTIF, fill rate, lead time y reclamos. */
export function PerformanceScoreCard({ score }: { score: SupplierScore }) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">Evaluación de desempeño</p>
        <Badge tone={SUPPLIER_CLASS[score.classification].tone} dot>
          {SUPPLIER_CLASS[score.classification].label}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ScoreStat
          label="OTIF"
          value={`${score.otif}%`}
          tone={score.otif >= 90 ? "good" : score.otif >= 80 ? "warn" : "bad"}
          hint="A tiempo y completo"
        />
        <ScoreStat label="Fill rate" value={`${score.fillRate}%`} hint="Despacho completo" />
        <ScoreStat
          label="Lead time prometido→real"
          value={
            score.leadPromised !== null
              ? `${score.leadPromised}→${score.leadReal} d`
              : `${score.leadReal} d`
          }
          tone={score.leadGap >= 5 ? "bad" : score.leadGap >= 2 ? "warn" : "good"}
          hint={score.leadGap > 0 ? `+${score.leadGap} d más lento` : "En plazo"}
        />
        <ScoreStat
          label="Reclamos abiertos"
          value={
            score.claimsOpen > 0
              ? `${score.claimsOpen} · ${formatCurrencyCompact(score.claimsValue)}`
              : "0"
          }
          tone={score.claimsOpen > 0 ? "bad" : "good"}
          hint="Pérdidas operativas"
        />
      </div>
      {score.reasons.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">{score.reasons.join(" ")}</p>
      )}
    </div>
  );
}

/** Banner ámbar de "revisar proveedor" cuando el cumplimiento o el estado lo ameritan. */
export function SupplierReviewBanner({
  supplier,
  riskProducts,
}: {
  supplier: Supplier;
  riskProducts: number;
}) {
  const show =
    supplier.status === "delayed" ||
    supplier.status === "review" ||
    supplier.deliveryCompliance < SUPPLIER_COMPLIANCE_CRITICAL;
  if (!show) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <b>Revisar proveedor:</b> cumplimiento {formatPercent(supplier.deliveryCompliance, 0)}
      {supplier.averageLeadTimeDays >= SUPPLIER_LEAD_TIME_WARN_DAYS && (
        <> · lead time alto ({formatDays(supplier.averageLeadTimeDays)})</>
      )}
      {riskProducts > 0 && <> · {riskProducts} SKU en quiebre</>}
      {" · "}última compra {formatDate(supplier.lastPurchaseDate)}.
    </div>
  );
}

/** Franja "Para atender al proveedor": importancia, venta, margen, utilidad y OC atrasadas. */
export function SupplierSummaryStrip({
  importance,
  ventas30,
  margenProm,
  utilidad30,
  delayedCount,
  onOpenOrders,
}: {
  importance: { label: string; tone: BadgeTone };
  ventas30: number;
  margenProm: number;
  utilidad30: number;
  delayedCount: number;
  onOpenOrders: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card p-4 mb-4">
      <p className="text-sm font-semibold text-slate-800 mb-3">Para atender al proveedor</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-400">Importancia</p>
          <div className="mt-1">
            <Badge tone={importance.tone}>{importance.label}</Badge>
          </div>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-400">Venta 30 días</p>
          <p className="text-lg font-semibold text-slate-800">{formatCurrencyCompact(ventas30)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-400">Margen promedio</p>
          <p className="text-lg font-semibold text-emerald-700">{formatPercent(margenProm, 1)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-400">Utilidad 30 días</p>
          <p className="text-lg font-semibold text-emerald-700">
            {formatCurrencyCompact(utilidad30)}
          </p>
        </div>
        <button
          onClick={onOpenOrders}
          className="rounded-lg bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100"
        >
          <p className="text-xs text-slate-400">OC atrasadas</p>
          <p
            className={`text-lg font-semibold ${delayedCount > 0 ? "text-rose-600" : "text-slate-800"}`}
          >
            {formatNumber(delayedCount)}
          </p>
        </button>
      </div>
    </div>
  );
}

/** Un punto de la agenda del cockpit de negociación (índice, título, detalle y pedido). */
function NegotiationAgendaItem({
  index,
  title,
  detail,
  ask,
  tone,
}: {
  index: number;
  title: string;
  detail: string;
  ask: string;
  tone: "green" | "amber" | "red" | "blue" | "neutral";
}) {
  const toneClass = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-brand-200 bg-brand-50 text-brand-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
  }[tone];

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold">
          {index}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-sm text-slate-700">{detail}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Pedir: {ask}</p>
        </div>
      </div>
    </div>
  );
}

/** Métrica compacta de la posición negociadora (label + valor). */
function SupplierCockpitMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

/** Cockpit de negociación + posición negociadora (dos tarjetas lado a lado). */
export function NegotiationCockpit({
  costIncreaseCount,
  costImpact,
  detenidosCount,
  stalledCapital,
  compliance,
  delayedCount,
  growingCount,
  negotiationPower,
  altCount,
  activeCount,
  purchased90,
  topCount,
  topSalesShare,
  topProfitShare,
  complianceWarn,
}: {
  costIncreaseCount: number;
  costImpact: number;
  detenidosCount: number;
  stalledCapital: number;
  compliance: number;
  delayedCount: number;
  growingCount: number;
  negotiationPower: string;
  altCount: number;
  activeCount: number;
  purchased90: number;
  topCount: number;
  topSalesShare: number;
  topProfitShare: number;
  complianceWarn: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 mb-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader
          title="Cockpit de negociación"
          description="Lo que conviene llevar preparado a la reunión con este proveedor."
        />
        <CardBody className="space-y-3">
          <NegotiationAgendaItem
            index={1}
            title="Costo"
            detail={`${costIncreaseCount} SKU subieron más de 5%. Impacto potencial en margen: ${formatCurrencyCompact(costImpact)}.`}
            ask="Pedir recuperación de margen, descuento por volumen o lista escalonada."
            tone={costIncreaseCount > 0 ? "amber" : "green"}
          />
          <NegotiationAgendaItem
            index={2}
            title="Productos detenidos"
            detail={`${detenidosCount} SKU · ${formatCurrencyCompact(stalledCapital)} inmovilizados.`}
            ask="Solicitar devolución, nota de crédito, apoyo promocional o cambio por otros SKU."
            tone={detenidosCount > 0 ? "red" : "green"}
          />
          <NegotiationAgendaItem
            index={3}
            title="Cumplimiento"
            detail={`OTIF ${formatPercent(compliance, 0)} · ${delayedCount} OC atrasadas.`}
            ask="Acordar objetivo de servicio, lead time realista y plan para atrasos."
            tone={delayedCount > 0 || compliance < complianceWarn ? "amber" : "green"}
          />
          <NegotiationAgendaItem
            index={4}
            title="Oportunidad"
            detail={`${growingCount} SKU crecen sobre 25% con cobertura corta.`}
            ask="Negociar capacidad, prioridad de despacho y precio por volumen."
            tone={growingCount > 0 ? "blue" : "neutral"}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Posición negociadora"
          description="Dependencia, alternativas y concentración real del proveedor."
        />
        <CardBody className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Posición</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-xl font-semibold text-slate-900">{negotiationPower}</p>
              <Badge tone={negotiationPower === "Media-alta" ? "green" : "amber"}>
                {formatPercent((altCount / Math.max(1, activeCount)) * 100, 0)} con alternativa
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {topCount} productos concentran {formatPercent(topSalesShare * 100, 0)} de la venta y{" "}
              {formatPercent(topProfitShare * 100, 0)} de la utilidad del proveedor.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SupplierCockpitMetric label="Compras 90d" value={formatCurrencyCompact(purchased90)} />
            <SupplierCockpitMetric label="Productos activos" value={formatNumber(activeCount)} />
            <SupplierCockpitMetric label="Alternativas" value={formatNumber(altCount)} />
            <SupplierCockpitMetric label="Detenidos" value={formatNumber(detenidosCount)} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/** Más vendidos (30 días) y productos detenidos del proveedor, lado a lado. */
export function SupplierTopProducts({
  topSold,
  detenidos,
}: {
  topSold: Product[];
  detenidos: Product[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <Card>
        <CardBody>
          <div className="flex items-center gap-2 mb-2.5">
            <IconSales className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-slate-800">Más vendidos (30 días)</p>
          </div>
          {topSold.length === 0 ? (
            <p className="text-sm text-slate-400">Sin ventas registradas.</p>
          ) : (
            <div className="space-y-1.5">
              {topSold.map((p, i) => (
                <Link
                  key={p.sku}
                  to={`/productos/${p.sku}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <span className="w-5 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">
                      {p.name}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {formatNumber(p.salesLast30Days)} u. · margen {formatPercent(p.margin, 0)}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">
                    {formatCurrencyCompact(p.salesLast30Days * p.price)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center gap-2 mb-2.5">
            <IconBox className="w-4 h-4 text-violet-600" />
            <p className="text-sm font-semibold text-slate-800">Productos detenidos</p>
            {detenidos.length > 0 && <Badge tone="violet">{detenidos.length}</Badge>}
          </div>
          {detenidos.length === 0 ? (
            <p className="text-sm text-slate-400">Sin sobrestock ni productos sin venta. 👍</p>
          ) : (
            <div className="space-y-1.5">
              {detenidos.slice(0, 5).map((p) => (
                <Link
                  key={p.sku}
                  to={`/productos/${p.sku}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">
                      {p.name}
                    </span>
                    <span className="block text-xs text-slate-400">
                      disp. {formatNumber(p.availableStock)} · vende{" "}
                      {formatNumber(p.salesLast30Days)}/mes
                    </span>
                  </span>
                  <Badge tone={p.salesLast30Days === 0 ? "red" : "violet"}>
                    {p.salesLast30Days === 0 ? "Sin venta" : "Sobrestock"}
                  </Badge>
                </Link>
              ))}
              {detenidos.length > 5 && (
                <p className="text-xs text-slate-400 pt-0.5">
                  +{detenidos.length - 5} más · ver pestaña Productos
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { IconAlerts, IconChevronRight, IconSales, IconBox } from "../../components/ui/icons";
import type { SupplierCatalogRow, SupplierFichaData } from "../../services/purchaseBff";
import {
  formatCurrencyCompact,
  formatDays,
  formatNumber,
  formatPercent,
} from "../../utils/formatters";
import { SUPPLIER_CLASS, type SupplierScore } from "../../utils/supplierScore";
import {
  SUPPLIER_COMPLIANCE_CRITICAL,
  SUPPLIER_COMPLIANCE_WARN,
  SUPPLIER_LEAD_TIME_WARN_DAYS,
} from "../../utils/constants";
import { productPath } from "../../utils/entityLinks";

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
  onNavigate,
}: {
  totalClaims: number;
  openCount: number;
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
            ? `${openCount} reclamo${openCount === 1 ? "" : "s"} abierto${openCount === 1 ? "" : "s"}`
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

/** Tarjeta de evaluación de desempeño sobre la ficha real (F11). */
export function PerformanceScoreCard({
  score,
  hasEvaluation,
}: {
  score: SupplierScore;
  hasEvaluation: boolean;
}) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">
          Evaluación de desempeño
          {score.period && (
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              período {score.period}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {score.score !== null && (
            <Badge
              tone={score.score >= 85 ? "green" : score.score >= 70 ? "amber" : "red"}
            >
              {score.score}/100
            </Badge>
          )}
          <Badge tone={SUPPLIER_CLASS[score.classification].tone} dot>
            {SUPPLIER_CLASS[score.classification].label}
          </Badge>
        </div>
      </div>
      {!hasEvaluation && (
        <p className="mb-3 text-sm text-slate-500">
          Evaluación del período no disponible. Se muestran las métricas observadas.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ScoreStat
          label="Cumplimiento"
          value={score.compliancePct !== null ? formatPercent(score.compliancePct, 0) : "—"}
          tone={
            score.compliancePct === null
              ? "neutral"
              : score.compliancePct >= 90
                ? "good"
                : score.compliancePct >= 80
                  ? "warn"
                  : "bad"
          }
          hint="Entregas a tiempo"
        />
        <ScoreStat
          label="Lead time observado"
          value={score.leadTimeDays !== null ? formatDays(score.leadTimeDays) : "—"}
          tone={
            score.leadTimeDays !== null && score.leadTimeDays >= SUPPLIER_LEAD_TIME_WARN_DAYS
              ? "warn"
              : "neutral"
          }
          hint="Promedio de entrega"
        />
        <ScoreStat
          label="Reclamos abiertos"
          value={score.claimsOpen !== null ? formatNumber(score.claimsOpen) : "—"}
          tone={(score.claimsOpen ?? 0) > 0 ? "bad" : "good"}
          hint="Pérdidas operativas"
        />
        {score.dimensions.map((d) => (
          <ScoreStat
            key={d.key}
            label={d.label}
            value={formatPercent(d.value, 0)}
            tone={d.value >= 85 ? "good" : d.value >= 70 ? "warn" : "bad"}
            hint="Evaluación del período"
          />
        ))}
      </div>
      {score.reasons.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">{score.reasons.join(" ")}</p>
      )}
    </div>
  );
}

/** Banner ámbar de "revisar proveedor" cuando el cumplimiento real lo amerita. */
export function SupplierReviewBanner({ data }: { data: SupplierFichaData }) {
  const compliance = data.metrics.compliancePct;
  const lead = data.metrics.leadTimeDaysObserved;
  const show =
    data.status === "blocked" ||
    (compliance !== null && compliance < SUPPLIER_COMPLIANCE_CRITICAL);
  if (!show) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <b>Revisar proveedor:</b>{" "}
      {compliance !== null ? `cumplimiento ${formatPercent(compliance, 0)}` : "sin cumplimiento medido"}
      {lead !== null && lead >= SUPPLIER_LEAD_TIME_WARN_DAYS && (
        <> · lead time alto ({formatDays(lead)})</>
      )}
      {data.status === "blocked" && <> · proveedor bloqueado</>}.
    </div>
  );
}

/** Franja "Para atender al proveedor": importancia, venta en unidades, margen y OC atrasadas. */
export function SupplierSummaryStrip({
  importance,
  sales30Units,
  avgMarginPct,
  delayedCount,
  onOpenOrders,
}: {
  importance: { label: string; tone: BadgeTone };
  sales30Units: number | null;
  avgMarginPct: number | null;
  delayedCount: number | null;
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
          <p className="text-xs text-slate-400">Venta 30 días (unid.)</p>
          <p className="text-lg font-semibold text-slate-800">
            {sales30Units !== null ? formatNumber(sales30Units) : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-400">Margen promedio</p>
          <p className="text-lg font-semibold text-emerald-700">
            {avgMarginPct !== null ? formatPercent(avgMarginPct, 1) : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-slate-400">Utilidad 30 días</p>
          <p className="text-lg font-semibold text-slate-400">—</p>
          <p className="text-[11px] text-slate-400">Se publica desde analytics</p>
        </div>
        <button
          onClick={onOpenOrders}
          className="rounded-lg bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100"
        >
          <p className="text-xs text-slate-400">OC atrasadas</p>
          <p
            className={`text-lg font-semibold ${(delayedCount ?? 0) > 0 ? "text-rose-600" : "text-slate-800"}`}
          >
            {delayedCount !== null ? formatNumber(delayedCount) : "—"}
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

/** Cockpit de negociación + posición negociadora, alimentados con la ficha real. */
export function NegotiationCockpit({
  stalledCount,
  stalledCapital,
  compliancePct,
  delayedCount,
  negotiationPower,
  skuCount,
  purchased90Clp,
  purchased90Share,
}: {
  stalledCount: number;
  /** Capital inmovilizado a costo (stock × costo de los detenidos); null si no hay costos. */
  stalledCapital: number | null;
  compliancePct: number | null;
  delayedCount: number | null;
  negotiationPower: string;
  skuCount: number;
  purchased90Clp: number | null;
  purchased90Share: number | null;
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
            detail="Alzas de costo aún sin fuente: el historial de listas de precio no está publicado."
            ask="Revisar la lista vigente y acordar preaviso formal ante cambios de costo."
            tone="neutral"
          />
          <NegotiationAgendaItem
            index={2}
            title="Productos detenidos"
            detail={`${formatNumber(stalledCount)} SKU sin venta con stock${
              stalledCapital !== null
                ? ` · ${formatCurrencyCompact(stalledCapital)} inmovilizados a costo`
                : ""
            }.`}
            ask="Solicitar devolución, nota de crédito, apoyo promocional o cambio por otros SKU."
            tone={stalledCount > 0 ? "red" : "green"}
          />
          <NegotiationAgendaItem
            index={3}
            title="Cumplimiento"
            detail={`Cumplimiento ${
              compliancePct !== null ? formatPercent(compliancePct, 0) : "—"
            } · ${delayedCount !== null ? formatNumber(delayedCount) : "—"} OC atrasadas.`}
            ask="Acordar objetivo de servicio, lead time realista y plan para atrasos."
            tone={
              (delayedCount ?? 0) > 0 ||
              (compliancePct !== null && compliancePct < SUPPLIER_COMPLIANCE_WARN)
                ? "amber"
                : "green"
            }
          />
          <NegotiationAgendaItem
            index={4}
            title="Oportunidad"
            detail="Crecimientos por SKU aún sin fuente: la serie de ventas se publica desde analytics."
            ask="Repasar en la reunión los SKU que el proveedor ve creciendo en el canal."
            tone="neutral"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Posición negociadora"
          description="Dependencia y concentración real del proveedor."
        />
        <CardBody className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Posición</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-xl font-semibold text-slate-900">{negotiationPower}</p>
              {purchased90Share !== null && (
                <Badge tone={purchased90Share > 0.3 ? "amber" : "green"}>
                  {formatPercent(purchased90Share * 100, 0)} de la compra 90d
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Orientativa: derivada solo de la participación en la compra de los últimos 90 días.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SupplierCockpitMetric
              label="Compras 90d"
              value={purchased90Clp !== null ? formatCurrencyCompact(purchased90Clp) : "—"}
            />
            <SupplierCockpitMetric label="SKUs conocidos" value={formatNumber(skuCount)} />
            <SupplierCockpitMetric
              label="Participación 90d"
              value={
                purchased90Share !== null ? formatPercent(purchased90Share * 100, 0) : "—"
              }
            />
            <SupplierCockpitMetric label="Detenidos" value={formatNumber(stalledCount)} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/** Más vendidos (30 días, unidades) y productos detenidos del proveedor, lado a lado. */
export function SupplierTopProducts({
  topSold,
  detenidos,
}: {
  topSold: SupplierCatalogRow[];
  detenidos: SupplierCatalogRow[];
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
                  to={productPath(p.sku)}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <span className="w-5 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">
                      {p.name ?? p.sku}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {formatNumber(p.salesLast30d ?? 0)} u.
                      {p.marginPct !== null && <> · margen {formatPercent(p.marginPct, 0)}</>}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">
                    {p.unitCostClp !== null
                      ? `≈ ${formatCurrencyCompact((p.salesLast30d ?? 0) * p.unitCostClp)} a costo`
                      : "—"}
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
            <p className="text-sm text-slate-400">Sin productos con stock y venta detenida. 👍</p>
          ) : (
            <div className="space-y-1.5">
              {detenidos.slice(0, 5).map((p) => (
                <Link
                  key={p.sku}
                  to={productPath(p.sku)}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">
                      {p.name ?? p.sku}
                    </span>
                    <span className="block text-xs text-slate-400">
                      disp. {formatNumber(p.stockAvailable ?? 0)} · sin venta 30d
                    </span>
                  </span>
                  <Badge tone="red">Sin venta</Badge>
                </Link>
              ))}
              {detenidos.length > 5 && (
                <p className="text-xs text-slate-400 pt-0.5">
                  +{detenidos.length - 5} más · ver pestaña Catálogo
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

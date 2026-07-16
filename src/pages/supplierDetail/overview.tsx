import { Badge, type BadgeTone } from "../../components/ui/Badge";
import { IconAlerts, IconChevronRight } from "../../components/ui/icons";
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

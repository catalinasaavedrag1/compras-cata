import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Drawer } from "../../components/ui/Drawer";
import { RecommendationBadge } from "../../components/business/RecommendationBadge";
import { IconPlus } from "../../components/ui/icons";
import { suppliers } from "../../data/mockSuppliers";
import { coverageDays, coverageSentence } from "../../utils/calculations";
import { cn } from "../../utils/cn";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDays,
  formatNumber,
  formatPercent,
} from "../../utils/formatters";
import type { PurchaseRecommendation } from "../../types/purchasing";
import type { DecisionGroup, DecisionViewMode, OpenPoSignal } from "./types";
import { decisionTypeLabel, purchaseMultiple, salesTrendPct } from "./helpers";
import { buildRecommendationReasoning } from "../../utils/recommendationReasoning";
import { buildBuyingAlerts, type BuyingAlert } from "../../utils/buyingAlerts";
import {
  skuProfileOf,
  ABC_LABEL,
  ABC_DESCRIPTION,
  XYZ_LABEL,
  XYZ_DESCRIPTION,
} from "../../utils/skuProfile";

// ============================================================================
//  Componentes de la vista de Reposición: agrupación, tarjetas, drawer de
//  decisión con simulación y celdas de tabla.
// ============================================================================

export function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: DecisionViewMode;
  onChange: (value: DecisionViewMode) => void;
  options: { value: DecisionViewMode; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-white text-brand-700 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function GroupedDecisionCards({
  title,
  groups,
  onSelectGroup,
  onReviewFirst,
}: {
  title: string;
  groups: DecisionGroup[];
  onSelectGroup: (group: DecisionGroup) => void;
  onReviewFirst: (group: DecisionGroup) => void;
}) {
  return (
    <Card>
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">
          Agrupa antes de crear borradores para no mezclar proveedores, categorías ni restricciones.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.key} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{group.label}</p>
                <p className="text-xs text-slate-500">
                  {group.items.length} decisión{group.items.length === 1 ? "" : "es"} ·{" "}
                  {formatCurrencyCompact(group.total)}
                </p>
              </div>
              {group.hasOpenPo && <Badge tone="blue">OC abierta</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <span>
                <b className="block text-rose-600">{group.critical}</b>
                críticos
              </span>
              <span>
                <b className="block text-amber-600">{group.review}</b>
                revisar
              </span>
              <span>
                <b className="block text-slate-700">{group.overstock}</b>
                no comprar
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => onReviewFirst(group)}>
                Revisar grupo
              </Button>
              <Button size="sm" onClick={() => onSelectGroup(group)}>
                Seleccionar SKU
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function RecommendationMobileCard({
  rec,
  openPo,
  alreadyInOc,
  onReview,
  onAdd,
}: {
  rec: PurchaseRecommendation;
  openPo?: OpenPoSignal;
  alreadyInOc: boolean;
  onReview: (rec: PurchaseRecommendation) => void;
  onAdd: (rec: PurchaseRecommendation) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-800 leading-snug">{rec.productName}</p>
          <p className="text-xs text-slate-500">
            <span className="font-mono text-slate-400">{rec.sku}</span> · {rec.brand}
          </p>
          <p className="text-xs text-slate-500">
            {rec.supplierName} · LT {formatDays(rec.supplierLeadTimeDays)}
          </p>
        </div>
        <RecommendationBadge status={rec.status} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-slate-400">Stock</p>
          <p className={rec.availableStock <= 0 ? "font-semibold text-rose-600" : "text-slate-700"}>
            {formatNumber(rec.availableStock)} disp.
          </p>
          <p className="text-xs text-slate-400">{formatNumber(rec.committedStock)} comp.</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Sugerido</p>
          <p className="font-semibold text-slate-900">{formatNumber(rec.suggestedQuantity)} u.</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Capital</p>
          <p className="font-semibold text-slate-900">
            {formatCurrency(rec.suggestedPurchaseAmount)}
          </p>
        </div>
      </div>
      {openPo && (
        <p className="mt-2 rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
          OC abierta {openPo.number} · {formatNumber(openPo.quantity)} u. · entrega{" "}
          {openPo.expectedDate}
        </p>
      )}
      <p className={cn("mt-1.5 text-xs font-medium leading-snug", coverageToneText(rec))}>
        {coverageSentence(rec.availableStock, rec.salesLast30Days)}
      </p>
      <p className="mt-0.5 text-xs leading-snug text-slate-500">{rec.reason}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            onReview(rec);
          }}
        >
          Revisar decisión
        </Button>
        {rec.suggestedQuantity > 0 && (
          <Button
            size="sm"
            variant={alreadyInOc ? "secondary" : "primary"}
            disabled={alreadyInOc}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(rec);
            }}
            icon={<IconPlus className="w-3.5 h-3.5" />}
          >
            {alreadyInOc ? "En borrador" : "Agregar"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function RecommendationDecisionDrawer({
  rec,
  quantity,
  onQuantityChange,
  onClose,
  onAdd,
  onEdit,
  onIgnore,
  onViewSku,
  alreadyInOc,
  openPo,
  budgetAvailable,
  onViewOpenPo,
}: {
  rec: PurchaseRecommendation | null;
  quantity: number;
  onQuantityChange: (value: number) => void;
  onClose: () => void;
  onAdd: (rec: PurchaseRecommendation, quantity: number) => void;
  onEdit: (rec: PurchaseRecommendation) => void;
  onIgnore: (rec: PurchaseRecommendation) => void;
  onViewSku: (rec: PurchaseRecommendation) => void;
  alreadyInOc: boolean;
  openPo?: OpenPoSignal;
  budgetAvailable: number;
  onViewOpenPo: (openPo: OpenPoSignal) => void;
}) {
  if (!rec) {
    return (
      <Drawer open={false} onClose={onClose} title="Recomendación">
        <span />
      </Drawer>
    );
  }

  const safeQty = Math.max(0, quantity);
  const multiple = purchaseMultiple(rec);
  const packSize = multiple * 2;
  const dailySales = rec.salesLast30Days > 0 ? rec.salesLast30Days / 30 : 0;
  const avg90 = Math.round(rec.salesLast90Days / 3);
  const trend = salesTrendPct(rec);
  const forecast30 = Math.max(
    0,
    Math.round(rec.salesLast30Days * (1 + Math.max(-0.2, Math.min(0.2, trend / 100))))
  );
  const incomingQty = openPo?.quantity ?? 0;
  const effectiveIncomingQty =
    openPo?.status === "delayed" ? Math.round(incomingQty * 0.4) : incomingQty;
  const projectedCoverage =
    dailySales > 0
      ? Math.round(((rec.availableStock + safeQty + effectiveIncomingQty) / dailySales) * 10) / 10
      : rec.inventoryDays;
  const currentCoverage = coverageDays(rec.availableStock, rec.salesLast30Days);
  const capital = safeQty * rec.unitCost;
  const unitPriceEstimate = rec.margin < 95 ? rec.unitCost / (1 - rec.margin / 100) : rec.unitCost;
  const protectedUnits = Math.min(forecast30, rec.availableStock + safeQty + effectiveIncomingQty);
  const protectedSales = protectedUnits * unitPriceEstimate;
  const expectedGrossMargin = protectedSales * (rec.margin / 100);
  const estimatedGmroi = capital > 0 ? (expectedGrossMargin * 12) / capital : 0;
  const budgetUsePct = budgetAvailable > 0 ? (capital / budgetAvailable) * 100 : 100;
  const stockoutRisk =
    projectedCoverage <= rec.supplierLeadTimeDays
      ? "Alto"
      : projectedCoverage <= rec.supplierLeadTimeDays * 2
        ? "Medio"
        : "Bajo";
  const maxQty = Math.max(rec.suggestedQuantity * 2, rec.maxStock - rec.availableStock, 1);
  const recommendationConfidence = Math.max(62, Math.round(90 - Math.abs(trend) * 0.4));
  const scenarios = [
    {
      label: "Conservador",
      qty: Math.max(0, roundToMultiple(rec.suggestedQuantity * 0.7, multiple)),
    },
    { label: "Recomendado", qty: roundToMultiple(rec.suggestedQuantity, multiple) },
    { label: "Agresivo", qty: roundToMultiple(rec.suggestedQuantity * 1.3, multiple) },
  ].map((scenario) =>
    buildSimulationScenario(rec, scenario.label, scenario.qty, effectiveIncomingQty)
  );
  const supplierOptions = buildSupplierComparison(rec, safeQty);

  // Razonamiento de la cantidad recomendada (anclado a la sugerencia, no a la
  // simulación) y alertas inteligentes de la cantidad que se agregará ahora.
  const reasoning = buildRecommendationReasoning(rec, effectiveIncomingQty);
  const alerts = buildBuyingAlerts({
    sku: rec.sku,
    supplierName: rec.supplierName,
    quantity: safeQty,
    availableStock: rec.availableStock,
    incoming: effectiveIncomingQty,
    salesLast30Days: rec.salesLast30Days,
    openPo,
  });

  return (
    <Drawer
      open={!!rec}
      onClose={onClose}
      title="Recomendación de abastecimiento"
      description={`${rec.sku} · ${rec.productName}`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onIgnore(rec)}>
            Postergar
          </Button>
          <Button variant="secondary" onClick={() => onEdit(rec)}>
            Modificar cantidad
          </Button>
          {openPo && (
            <Button variant="secondary" onClick={() => onViewOpenPo(openPo)}>
              Ver OC relacionada
            </Button>
          )}
          <Button variant="secondary" onClick={() => onEdit(rec)}>
            Comparar proveedores
          </Button>
          <Button
            disabled={alreadyInOc || safeQty <= 0}
            onClick={() => onAdd(rec, safeQty)}
            icon={<IconPlus className="w-4 h-4" />}
          >
            {alreadyInOc
              ? "Ya está en borrador"
              : `Agregar ${formatNumber(safeQty)} u. al borrador`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Decisión sugerida
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            {decisionTypeLabel(rec)} · {formatNumber(rec.suggestedQuantity)} unidades
          </h3>
          <p className="mt-1 text-sm text-slate-600">{reasoning.summary}</p>
          <SkuProfileChips rec={rec} />
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-white/70 px-3 py-2 text-sm">
              <p className="text-xs text-slate-500">Venta perdida en riesgo</p>
              <p className="font-semibold text-rose-700">{extractRiskAmount(rec.risk)}</p>
            </div>
            <div className="rounded-lg bg-white/70 px-3 py-2 text-sm">
              <p className="text-xs text-slate-500">Confianza recomendación</p>
              <p className="font-semibold text-slate-900">{recommendationConfidence}%</p>
            </div>
          </div>
        </section>

        {alerts.length > 0 && <BuyingAlertsStrip alerts={alerts} />}

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Situación</p>
          <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <DecisionMetric
              label="Stock"
              value={`${formatNumber(rec.availableStock)} u.`}
              tone={rec.availableStock <= 0 ? "red" : "blue"}
            />
            <DecisionMetric
              label="Cobertura actual"
              value={formatDays(currentCoverage)}
              tone={currentCoverage <= rec.supplierLeadTimeDays ? "red" : "amber"}
            />
            <DecisionMetric
              label="Venta 30d"
              value={`${formatNumber(rec.salesLast30Days)} u.`}
              tone="blue"
            />
            <DecisionMetric
              label="Forecast 30d"
              value={`${formatNumber(forecast30)} u.`}
              tone="blue"
            />
            <DecisionMetric
              label="Lead time"
              value={formatDays(rec.supplierLeadTimeDays)}
              tone="amber"
            />
            <DecisionMetric
              label="En tránsito"
              value={`${formatNumber(incomingQty)} u.`}
              tone={openPo?.status === "delayed" ? "amber" : incomingQty > 0 ? "green" : "blue"}
            />
          </div>
          <p className={cn("mt-2 text-sm font-medium", coverageToneText(rec))}>
            {coverageSentence(rec.availableStock, rec.salesLast30Days)}
          </p>
        </section>

        {openPo && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Abastecimiento en curso
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{openPo.number}</p>
                <p className="text-sm text-slate-600">
                  {formatNumber(openPo.quantity)} unidades · entrega esperada {openPo.expectedDate}
                </p>
                {openPo.status === "delayed" && (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    OC atrasada: para cobertura se considera solo 40% de llegada.
                  </p>
                )}
              </div>
              <Badge tone={openPo.status === "delayed" ? "amber" : "blue"}>
                {openPo.status === "delayed" ? "Atrasada" : "En curso"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Cobertura total proyectada con esta simulación: <b>{formatDays(projectedCoverage)}</b>
              .
            </p>
          </section>
        )}

        <CoverageTargetBar current={currentCoverage} simulated={projectedCoverage} />

        <section className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Simular cantidad
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Múltiplo de compra: {formatNumber(multiple)} u. · caja/pallet:{" "}
                {formatNumber(packSize)} u. · mínimo operacional {formatNumber(rec.minStock)} u.
              </p>
            </div>
            <div className="inline-flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onQuantityChange(Math.max(0, safeQty - multiple))}
              >
                -{formatNumber(multiple)}
              </Button>
              <span className="min-w-[96px] rounded-lg bg-slate-100 px-3 py-2 text-center text-lg font-semibold text-slate-900">
                {formatNumber(safeQty)} u.
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onQuantityChange(Math.min(maxQty, safeQty + multiple))}
              >
                +{formatNumber(multiple)}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <DecisionMetric
              label="Cobertura total"
              value={formatDays(projectedCoverage)}
              tone={stockoutRisk === "Alto" ? "red" : stockoutRisk === "Medio" ? "amber" : "green"}
            />
            <DecisionMetric label="Capital" value={formatCurrencyCompact(capital)} tone="blue" />
            <DecisionMetric
              label="Venta protegida"
              value={formatCurrencyCompact(protectedSales)}
              tone="green"
            />
            <DecisionMetric
              label="Margen esperado"
              value={formatCurrencyCompact(expectedGrossMargin)}
              tone="green"
            />
            <DecisionMetric
              label="GMROI estimado"
              value={estimatedGmroi.toFixed(1).replace(".", ",")}
              tone={estimatedGmroi >= 4 ? "green" : "amber"}
            />
            <DecisionMetric
              label="Presupuesto"
              value={`${formatPercent(budgetUsePct, 0)} disp.`}
              tone={capital <= budgetAvailable ? "green" : "red"}
            />
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Comparar escenarios
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
            {scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.label}
                scenario={scenario}
                selected={scenario.qty === safeQty}
                recommended={scenario.label === "Recomendado"}
                onUse={() => onQuantityChange(scenario.qty)}
              />
            ))}
          </div>
        </section>

        <ReasoningSection reasoning={reasoning} capital={rec.suggestedPurchaseAmount} />

        <section className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Demanda</p>
          <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <DecisionMetric
              label="30d"
              value={`${formatNumber(rec.salesLast30Days)} u.`}
              tone="blue"
            />
            <DecisionMetric label="Prom. 90d" value={`${formatNumber(avg90)} u.`} tone="blue" />
            <DecisionMetric
              label="Tendencia"
              value={`${trend >= 0 ? "+" : ""}${formatPercent(trend, 0)}`}
              tone={trend >= 0 ? "green" : "amber"}
            />
            <DecisionMetric label="Forecast" value={`${formatNumber(forecast30)} u.`} tone="blue" />
          </div>
        </section>

        <section>
          <details className="rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Probar sensibilidad de demanda
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[-20, 0, 20].map((change) => (
                <SensitivityCard
                  key={change}
                  change={change}
                  rec={rec}
                  qty={safeQty + effectiveIncomingQty}
                />
              ))}
            </div>
          </details>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Comparar proveedores
          </p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Proveedor</th>
                  <th className="px-3 py-2 text-right">Costo</th>
                  <th className="px-3 py-2 text-right">Lead time</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {supplierOptions.map((option) => (
                  <tr key={option.name} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{option.name}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(option.cost)}</td>
                    <td className="px-3 py-2 text-right">{formatDays(option.leadTime)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {formatCurrencyCompact(option.total)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatDays(option.coverage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Un proveedor más rápido puede costar algo más, pero reduce riesgo de quiebre por llegada
            anticipada.
          </p>
        </section>

        <Button variant="secondary" className="w-full" onClick={() => onViewSku(rec)}>
          Ver SKU 360
        </Button>
      </div>
    </Drawer>
  );
}

/** Chips de perfil del SKU: clase ABC, XYZ, rotación y rentabilidad. */
function SkuProfileChips({ rec }: { rec: PurchaseRecommendation }) {
  const profile = skuProfileOf(rec.sku);
  const velocity =
    rec.salesLast30Days >= 60
      ? "Vende a diario"
      : rec.salesLast30Days >= 12
        ? "Vende cada semana"
        : rec.salesLast30Days > 0
          ? "Venta esporádica"
          : "Sin venta reciente";
  const marginTone = rec.margin >= 30 ? "green" : rec.margin >= 20 ? "amber" : "red";
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {profile && (
        <span
          title={ABC_DESCRIPTION[profile.abc]}
          className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700"
        >
          {ABC_LABEL[profile.abc]} · {Math.round(profile.abcShare * 100)}% venta
        </span>
      )}
      {profile && (
        <span
          title={XYZ_DESCRIPTION[profile.xyz]}
          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
        >
          {profile.xyz} · {XYZ_LABEL[profile.xyz]}
        </span>
      )}
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        {velocity}
      </span>
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
          marginTone === "green"
            ? "bg-emerald-50 text-emerald-700"
            : marginTone === "amber"
              ? "bg-amber-50 text-amber-700"
              : "bg-rose-50 text-rose-700"
        )}
      >
        Margen {formatPercent(rec.margin, 0)}
      </span>
    </div>
  );
}

const ALERT_STYLE: Record<BuyingAlert["tone"], { box: string; dot: string; title: string }> = {
  bad: { box: "border-rose-200 bg-rose-50", dot: "bg-rose-500", title: "text-rose-800" },
  warn: { box: "border-amber-200 bg-amber-50", dot: "bg-amber-500", title: "text-amber-800" },
  info: { box: "border-brand-200 bg-brand-50", dot: "bg-brand-500", title: "text-brand-800" },
};

/** Tira de alertas inteligentes sobre la decisión de compra. */
function BuyingAlertsStrip({ alerts }: { alerts: BuyingAlert[] }) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Alertas ({alerts.length})
      </p>
      <div className="mt-2 space-y-2">
        {alerts.map((alert) => {
          const style = ALERT_STYLE[alert.tone];
          return (
            <div key={alert.id} className={cn("flex gap-2.5 rounded-lg border p-3", style.box)}>
              <span className={cn("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", style.dot)} />
              <div>
                <p className={cn("text-sm font-semibold", style.title)}>{alert.title}</p>
                {alert.detail && <p className="mt-0.5 text-xs text-slate-600">{alert.detail}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Desglose "por qué N unidades": factores que suman la cantidad recomendada. */
function ReasoningSection({
  reasoning,
  capital,
}: {
  reasoning: ReturnType<typeof buildRecommendationReasoning>;
  capital: number;
}) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Por qué {formatNumber(reasoning.suggested)} u.
      </p>

      <p className="mt-2 text-xs font-medium text-slate-500">Cuánto necesitas tener</p>
      <ul className="mt-1 space-y-1">
        {reasoning.needFactors.map((f) => (
          <ReasoningRow key={f.key} label={f.label} detail={f.detail} sign={f.sign} units={f.units} />
        ))}
        <li className="flex items-baseline justify-between border-t border-emerald-200 pt-1.5 text-sm">
          <span className="font-semibold text-slate-800">
            Necesitas ≈ {formatNumber(reasoning.needUnits)} u.
          </span>
          <span className="text-xs text-slate-500">
            ~{formatDays(Math.round(reasoning.projectedCoverageDays))} de cobertura
          </span>
        </li>
      </ul>

      <p className="mt-3 text-xs font-medium text-slate-500">Con qué ya cuentas</p>
      <ul className="mt-1 space-y-1">
        {reasoning.haveFactors.map((f) => (
          <ReasoningRow key={f.key} label={f.label} detail={f.detail} sign={f.sign} units={f.units} />
        ))}
        <li className="flex items-baseline justify-between border-t border-emerald-300 pt-1.5">
          <span className="text-base font-semibold text-emerald-800">
            = Comprar {formatNumber(reasoning.suggested)} u.
          </span>
          <span className="text-xs text-slate-500">{formatCurrencyCompact(capital)}</span>
        </li>
      </ul>

      {reasoning.promo && (
        <div className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
          <b className="text-slate-800">Promoción «{reasoning.promo.name}»</b> en{" "}
          {formatDays(reasoning.promo.daysTo)}: +{formatPercent(reasoning.promo.upliftPct, 0)} de
          demanda esperada, ya considerada en la cobertura objetivo.
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
        <p>
          <b>Por qué no menos:</b> menor colchón ante una aceleración de venta.
        </p>
        <p>
          <b>Por qué no más:</b> aumenta capital inmovilizado y baja retorno de inventario.
        </p>
      </div>
    </section>
  );
}

function ReasoningRow({
  label,
  detail,
  sign,
  units,
}: {
  label: string;
  detail: string;
  sign: "+" | "−";
  units: number;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span className="flex items-baseline gap-1.5">
        <span className={cn("font-semibold", sign === "+" ? "text-emerald-600" : "text-slate-400")}>
          {sign}
        </span>
        <span className="text-slate-700">{label}</span>
        <span className="text-xs text-slate-400">· {detail}</span>
      </span>
      <span className="flex-shrink-0 font-medium text-slate-800">{formatNumber(units)} u.</span>
    </li>
  );
}

interface SimulationScenario {
  label: string;
  qty: number;
  coverage: number;
  capital: number;
  stockoutRisk: "Alto" | "Medio" | "Bajo";
  overstockRisk: "Medio" | "Bajo";
  gmroi: number;
}

function roundToMultiple(value: number, multiple: number) {
  if (multiple <= 1) return Math.max(0, Math.round(value));
  return Math.max(0, Math.round(value / multiple) * multiple);
}

function buildSimulationScenario(
  rec: PurchaseRecommendation,
  label: string,
  qty: number,
  incomingQty: number
): SimulationScenario {
  const dailySales = rec.salesLast30Days > 0 ? rec.salesLast30Days / 30 : 0;
  const coverage =
    dailySales > 0
      ? Math.round(((rec.availableStock + qty + incomingQty) / dailySales) * 10) / 10
      : rec.inventoryDays;
  const capital = qty * rec.unitCost;
  const unitPriceEstimate = rec.margin < 95 ? rec.unitCost / (1 - rec.margin / 100) : rec.unitCost;
  const protectedSales =
    Math.min(rec.salesLast30Days, rec.availableStock + qty + incomingQty) * unitPriceEstimate;
  const grossMargin = protectedSales * (rec.margin / 100);
  const gmroi = capital > 0 ? (grossMargin * 12) / capital : 0;
  const stockoutRisk =
    coverage <= rec.supplierLeadTimeDays
      ? "Alto"
      : coverage <= rec.supplierLeadTimeDays * 2
        ? "Medio"
        : "Bajo";
  const overstockRisk =
    coverage > 60 || rec.availableStock + qty + incomingQty > rec.maxStock ? "Medio" : "Bajo";
  return { label, qty, coverage, capital, stockoutRisk, overstockRisk, gmroi };
}

function buildSupplierComparison(rec: PurchaseRecommendation, qty: number) {
  const related = suppliers.filter((supplier) => supplier.categories.includes(rec.category));
  const fallback = suppliers.filter((supplier) => supplier.name !== rec.supplierName);
  const candidates = [
    { name: rec.supplierName, leadTime: rec.supplierLeadTimeDays, costFactor: 1 },
    ...[...related, ...fallback]
      .filter((supplier) => supplier.name !== rec.supplierName)
      .slice(0, 2)
      .map((supplier, index) => ({
        name: supplier.name,
        leadTime: supplier.averageLeadTimeDays,
        costFactor: index === 0 ? 1.04 : 0.96,
      })),
  ];

  return candidates.map((candidate) => {
    const cost = Math.round(rec.unitCost * candidate.costFactor);
    const coverage =
      rec.salesLast30Days > 0
        ? Math.round(((rec.availableStock + qty) / (rec.salesLast30Days / 30)) * 10) / 10
        : rec.inventoryDays;
    return {
      ...candidate,
      cost,
      total: cost * qty,
      coverage,
    };
  });
}

function extractRiskAmount(risk: string) {
  const match = risk.match(/\$[\d.,]+(?:\s?[MK])?/i);
  return match?.[0] ?? "No estimada";
}

function CoverageTargetBar({ current, simulated }: { current: number; simulated: number }) {
  const currentPct = Math.min(100, Math.max(0, current));
  const simulatedPct = Math.min(100, Math.max(0, simulated));
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Cobertura después de comprar
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <span>
          <b className="block text-slate-900">{formatDays(current)}</b>
          actual
        </span>
        <span>
          <b className="block text-slate-900">45-60 d</b>
          objetivo
        </span>
        <span>
          <b className="block text-slate-900">{formatDays(simulated)}</b>
          simulada
        </span>
      </div>
      <div className="relative mt-4 h-4 rounded-full bg-slate-100">
        <div className="absolute left-[45%] h-full w-[15%] rounded-full bg-emerald-200" />
        <span
          className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-slate-400"
          style={{ left: `${currentPct}%` }}
          title="Cobertura actual"
        />
        <span
          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow"
          style={{ left: `${simulatedPct}%` }}
          title="Cobertura simulada"
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">La zona verde marca el rango objetivo.</p>
    </section>
  );
}

function ScenarioCard({
  scenario,
  selected,
  recommended,
  onUse,
}: {
  scenario: SimulationScenario;
  selected: boolean;
  recommended: boolean;
  onUse: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        selected ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{scenario.label}</p>
          <p className="text-lg font-semibold text-slate-900">{formatNumber(scenario.qty)} u.</p>
        </div>
        {recommended && <Badge tone="blue">Recomendado</Badge>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <span>
          <b className="block text-slate-900">{formatDays(scenario.coverage)}</b>
          cobertura
        </span>
        <span>
          <b className="block text-slate-900">{formatCurrencyCompact(scenario.capital)}</b>
          capital
        </span>
        <span>
          <b
            className={
              scenario.stockoutRisk === "Bajo" ? "block text-emerald-700" : "block text-amber-700"
            }
          >
            {scenario.stockoutRisk}
          </b>
          quiebre
        </span>
        <span>
          <b
            className={
              scenario.overstockRisk === "Bajo" ? "block text-emerald-700" : "block text-amber-700"
            }
          >
            {scenario.overstockRisk}
          </b>
          sobrestock
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        GMROI est. {scenario.gmroi.toFixed(1).replace(".", ",")}
      </p>
      <Button
        className="mt-3 w-full"
        size="sm"
        variant={selected ? "secondary" : "primary"}
        onClick={onUse}
      >
        {selected ? "Seleccionado" : "Usar escenario"}
      </Button>
    </div>
  );
}

function SensitivityCard({
  change,
  rec,
  qty,
}: {
  change: number;
  rec: PurchaseRecommendation;
  qty: number;
}) {
  const adjustedSales = Math.max(1, rec.salesLast30Days * (1 + change / 100));
  const coverage = Math.round((qty / (adjustedSales / 30)) * 10) / 10;
  const overstock = coverage > 60 ? "Medio" : "Bajo";
  const stockout = coverage <= rec.supplierLeadTimeDays * 2 ? "Medio" : "Bajo";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="font-semibold text-slate-800">
        {change > 0 ? "+" : ""}
        {change}% demanda
      </p>
      <p className="mt-1 text-xs text-slate-500">Cobertura {formatDays(coverage)}</p>
      <p className="text-xs text-slate-500">Quiebre {stockout}</p>
      <p className="text-xs text-slate-500">Sobrestock {overstock}</p>
    </div>
  );
}

export function DecisionMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "amber" | "blue" | "green";
}) {
  const toneClass = {
    red: "border-rose-200 bg-rose-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-brand-200 bg-brand-50",
    green: "border-emerald-200 bg-emerald-50",
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

/** Color de la frase de cobertura según urgencia frente al lead time. */
function coverageToneText(rec: PurchaseRecommendation): string {
  if (rec.salesLast30Days <= 0) return "text-slate-400";
  const cover = coverageDays(rec.availableStock, rec.salesLast30Days);
  const lead = rec.supplierLeadTimeDays;
  if (rec.availableStock <= 0 || cover <= lead) return "text-rose-600";
  if (cover <= lead * 2) return "text-amber-600";
  return "text-emerald-600";
}

/** Celda de cobertura en días con barra y color según el lead time. */
export function CoverageCell({ rec }: { rec: PurchaseRecommendation }) {
  const cover = coverageDays(rec.availableStock, rec.salesLast30Days);
  const lead = rec.supplierLeadTimeDays;

  // Sin venta: no aplica cobertura por riesgo de quiebre
  if (rec.salesLast30Days <= 0) {
    return <span className="text-xs text-slate-400">sin venta</span>;
  }

  const tone = cover <= lead ? "rose" : cover <= lead * 2 ? "amber" : "emerald";
  const toneText = { rose: "text-rose-600", amber: "text-amber-600", emerald: "text-emerald-600" };
  const toneBar = { rose: "bg-rose-500", amber: "bg-amber-500", emerald: "bg-emerald-500" };
  // Escala visual sobre 60 días
  const pct = Math.min(100, (cover / 60) * 100);

  return (
    <div className="inline-flex flex-col items-end gap-1 min-w-[64px]">
      <span className={`text-sm font-medium ${toneText[tone]}`}>
        {cover >= 999 ? "+999" : formatNumber(cover)} d
      </span>
      <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${toneBar[tone]}`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
    </div>
  );
}

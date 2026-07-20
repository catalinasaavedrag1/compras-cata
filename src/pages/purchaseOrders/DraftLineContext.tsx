import { Button } from "../../components/ui/Button";
import { Tabs } from "../../components/ui/Tabs";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { coverageDays } from "../../utils/calculations";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../../utils/formatters";
import { lineNet, type OcDraftItem } from "../../context/OcDraftContext";
import { buyScenarios, type RiskLevel } from "../../utils/buyScenarios";
import { cn } from "../../utils/cn";
import type { ReplenishmentRow, SupplierPanelRow } from "../../services/purchaseBff";
import type { Product, PurchaseOrder } from "../../types/purchasing";
import { CLOSED_ORDER_STATUSES } from "../../types/purchasing";

const RISK_TONE: Record<RiskLevel, "green" | "amber" | "red"> = {
  bajo: "green",
  medio: "amber",
  alto: "red",
};

/**
 * Contexto de línea del borrador sobre FUENTES REALES:
 * - `row`: fila del motor de reposición para el SKU (stock, venta, cobertura,
 *   sugerido, lead time). null = el SKU no está en el universo del motor.
 * - `supplierPanel`: fila real del panel de proveedores (cumplimiento, lead
 *   time observado). null = sin match en el panel.
 * Cualquier dato sin fuente real se muestra como "—" ("…" mientras carga):
 * jamás un número inventado.
 */
export function DraftLineContext({
  item,
  row,
  supplierPanel,
  contextLoading,
  orders,
  tab,
  onTabChange,
  onQuantityChange,
  onOpenProduct,
}: {
  item: OcDraftItem;
  row: ReplenishmentRow | null;
  supplierPanel: SupplierPanelRow | null;
  contextLoading: boolean;
  orders: PurchaseOrder[];
  tab: string;
  onTabChange: (value: string) => void;
  onQuantityChange: (quantity: number) => void;
  onOpenProduct: () => void;
}) {
  // "—" = sin fuente real; "…" = el dato del motor aún viene en camino.
  const ph = contextLoading ? "…" : "—";
  const stockAvailable = row?.stock?.available ?? null;
  const sales30 = row?.salesLast30d ?? null;
  const currentCoverage =
    row?.coverageDays ??
    (stockAvailable !== null && sales30 !== null && sales30 > 0
      ? coverageDays(stockAvailable, sales30)
      : null);
  const futureCoverage =
    stockAvailable !== null && sales30 !== null && sales30 > 0
      ? coverageDays(stockAvailable + item.quantity, sales30)
      : null;
  const suggestedQty = row && row.suggestedQty > 0 ? row.suggestedQty : null;
  const deltaVsSuggested = suggestedQty !== null ? item.quantity - suggestedQty : null;
  const leadTimeDays = row?.leadTimeDays ?? supplierPanel?.leadTimeDaysObserved ?? null;
  const openOrders = orders.filter(
    (o) =>
      o.supplierName === item.supplierName &&
      !CLOSED_ORDER_STATUSES.includes(o.status) &&
      o.lines?.some((line) => line.sku === item.sku)
  );
  // Escenarios solo con datos reales: buyScenarios usa únicamente estos campos
  // del producto (venta 30d, stock disponible, lead time y múltiplo de compra).
  const scenarioProduct =
    stockAvailable !== null && sales30 !== null && sales30 > 0 && leadTimeDays !== null
      ? ({
          availableStock: stockAvailable,
          salesLast30Days: sales30,
          supplierLeadTimeDays: leadTimeDays,
          multiploCompra: row?.packMultiple ?? item.packMultiple ?? undefined,
        } as Product)
      : null;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Contexto de línea
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900 truncate">
            {item.productName}
          </h3>
          <p className="text-xs text-slate-500">
            {item.sku} · cantidad OC {formatNumber(item.quantity)} u. · sugerido{" "}
            {suggestedQty !== null ? `${formatNumber(suggestedQty)} u.` : ph}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onOpenProduct}>
          Ver SKU 360
        </Button>
      </div>

      <Tabs
        className="mt-3"
        value={tab}
        onChange={onTabChange}
        tabs={[
          { value: "resumen", label: "Resumen" },
          { value: "escenarios", label: "Escenarios" },
          { value: "inventario", label: "Inventario" },
          { value: "venta", label: "Venta" },
          { value: "proveedor", label: "Proveedor" },
        ]}
      />

      {tab === "resumen" && (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DraftMetric
            label="Stock"
            value={stockAvailable !== null ? `${formatNumber(stockAvailable)} u.` : ph}
          />
          <DraftMetric
            label="Cobertura actual"
            value={currentCoverage !== null ? `${currentCoverage} d` : ph}
          />
          <DraftMetric
            label="Cobertura futura"
            value={futureCoverage !== null ? `${futureCoverage} d` : ph}
          />
          <DraftMetric
            label="OC abiertas"
            value={
              openOrders.length > 0
                ? `${formatNumber(openOrders.reduce((sum, o) => sum + (o.lines?.find((l) => l.sku === item.sku)?.quantity ?? 0), 0))} u.`
                : "0 u."
            }
          />
        </div>
      )}

      {tab === "escenarios" && (
        <div className="mt-3">
          {scenarioProduct ? (
            <>
              <p className="mb-2 text-xs text-slate-500">
                Compara el costo completo de cada opción antes de decidir. Un descuento por volumen
                inmoviliza más capital y arriesga sobrestock.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {buyScenarios(
                  scenarioProduct,
                  suggestedQty ?? item.quantity,
                  item.unitCost,
                  item.discountPct ?? 0
                ).map((s) => {
                  const active = item.quantity === s.qty;
                  return (
                    <div
                      key={s.key}
                      className={cn(
                        "flex flex-col rounded-lg border p-3",
                        s.recommended
                          ? "border-brand-300 bg-white ring-1 ring-brand-100"
                          : "border-slate-200 bg-white"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{s.label}</p>
                        {s.recommended && <Badge tone="blue">Sugerido</Badge>}
                      </div>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatNumber(s.qty)} u.
                      </p>
                      <dl className="mt-2 space-y-1 text-xs">
                        <ScenarioRow label="Inversión" value={formatCurrencyCompact(s.investment)} />
                        <ScenarioRow label="Cobertura" value={`${s.coverageDays} d`} />
                        <div className="flex items-center justify-between">
                          <dt className="text-slate-500">Riesgo quiebre</dt>
                          <Badge tone={RISK_TONE[s.stockoutRisk]}>{s.stockoutRisk}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <dt className="text-slate-500">Riesgo sobrestock</dt>
                          <Badge tone={RISK_TONE[s.overstockRisk]}>{s.overstockRisk}</Badge>
                        </div>
                        <ScenarioRow
                          label="Descuento"
                          value={s.discountPct > 0 ? `${s.discountPct}%` : "—"}
                        />
                        {s.volumeSaving > 0 && (
                          <ScenarioRow
                            label="Ahorro volumen"
                            value={formatCurrencyCompact(s.volumeSaving)}
                          />
                        )}
                      </dl>
                      <p className="mt-2 text-[11px] leading-snug text-slate-400">{s.note}</p>
                      <Button
                        size="sm"
                        variant={active ? "secondary" : "primary"}
                        disabled={active}
                        className="mt-2"
                        onClick={() => onQuantityChange(s.qty)}
                      >
                        {active ? "Aplicado" : "Aplicar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              {contextLoading
                ? "Cargando datos del motor…"
                : "Sin datos reales de venta, stock o lead time del motor para simular escenarios de este SKU."}
            </p>
          )}
        </div>
      )}

      {tab === "inventario" && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "Disponible", value: row?.stock?.available ?? null },
            { label: "En tránsito", value: row?.stock?.inTransit ?? null },
            { label: "Stock de seguridad", value: row?.stock?.security ?? null },
          ].map((slot) => (
            <div key={slot.label} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium text-slate-500">{slot.label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {slot.value !== null ? `${formatNumber(slot.value)} u.` : ph}
              </p>
            </div>
          ))}
          {openOrders.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-3">
              <p className="text-sm font-medium text-amber-800">
                Hay {openOrders.length} OC abierta{openOrders.length === 1 ? "" : "s"} con este SKU.
              </p>
              <p className="text-xs text-amber-700">
                Revisa antes de duplicar compra o elevar cobertura.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "venta" && (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DraftMetric
            label="Venta 30d"
            value={sales30 !== null ? `${formatNumber(sales30)} u.` : ph}
          />
          <DraftMetric
            label="Venta 90d"
            value={row?.salesLast90d != null ? `${formatNumber(row.salesLast90d)} u.` : ph}
          />
          <DraftMetric
            label="Rotación"
            value={row?.rotation != null ? `${formatNumber(row.rotation)}x` : ph}
          />
          <DraftMetric
            label="Variación OC"
            value={
              deltaVsSuggested !== null
                ? `${deltaVsSuggested > 0 ? "+" : ""}${formatNumber(deltaVsSuggested)} u.`
                : ph
            }
          />
        </div>
      )}

      {tab === "proveedor" && (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Proveedor
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{item.supplierName}</p>
            <p className="text-xs text-slate-500">
              Cumplimiento{" "}
              {supplierPanel?.compliancePct != null
                ? `${formatNumber(supplierPanel.compliancePct)}%`
                : ph}{" "}
              · lead time {leadTimeDays !== null ? `${leadTimeDays} d` : ph}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Rentabilidad
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              Costo {formatCurrency(item.unitCost)} · línea {formatCurrency(lineNet(item))}
            </p>
            <p className="text-xs text-slate-500">
              Margen {row?.marginPct != null ? `${formatNumber(row.marginPct)}%` : ph}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-end">
        <label className="block flex-1 text-xs font-medium text-slate-600">
          Cantidad OC
          <Input
            type="number"
            min={0}
            value={item.quantity}
            onChange={(e) => onQuantityChange(Number(e.target.value))}
          />
        </label>
        <div className="text-sm text-slate-500">
          Después de comprar:{" "}
          <span className="font-semibold text-slate-900">
            {futureCoverage !== null ? `${futureCoverage} días` : "sin datos de venta"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ScenarioRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

export function DraftMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function DraftWarning({
  count,
  text,
  currency,
}: {
  count: number;
  text: string;
  currency?: boolean;
}) {
  const active = count > 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
      <span className={active ? "text-slate-700" : "text-slate-400"}>{text}</span>
      <Badge tone={active ? "amber" : "green"}>
        {currency ? (active ? formatCurrencyCompact(count) : "$0") : count}
      </Badge>
    </div>
  );
}

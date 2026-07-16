import { Button } from "../../components/ui/Button";
import { Tabs } from "../../components/ui/Tabs";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { LandedCostBreakdown } from "../../components/business/LandedCost";
import { getProductBySku } from "../../data/mockProducts";
import { recommendations } from "../../data/mockRecommendations";
import { suppliers as mockSuppliers } from "../../data/mockSuppliers";
import { coverageDays } from "../../utils/calculations";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../../utils/formatters";
import { lineNet, type OcDraftItem } from "../../context/OcDraftContext";
import { buyScenarios, type RiskLevel } from "../../utils/buyScenarios";
import { cn } from "../../utils/cn";
import type { PurchaseOrder } from "../../types/purchasing";

const RISK_TONE: Record<RiskLevel, "green" | "amber" | "red"> = {
  bajo: "green",
  medio: "amber",
  alto: "red",
};

export function DraftLineContext({
  item,
  orders,
  tab,
  onTabChange,
  onQuantityChange,
  onOpenProduct,
}: {
  item: OcDraftItem;
  orders: PurchaseOrder[];
  tab: string;
  onTabChange: (value: string) => void;
  onQuantityChange: (quantity: number) => void;
  onOpenProduct: () => void;
}) {
  const product = getProductBySku(item.sku);
  const rec = recommendations.find((r) => r.sku === item.sku);
  const supplier = mockSuppliers.find((s) => s.name === item.supplierName);
  const openOrders = orders.filter(
    (o) =>
      o.supplierName === item.supplierName &&
      !["received", "closed", "cancelled"].includes(o.status) &&
      o.lines?.some((line) => line.sku === item.sku)
  );
  const currentCoverage = product
    ? coverageDays(product.availableStock, product.salesLast30Days)
    : 0;
  const futureCoverage =
    product && product.salesLast30Days > 0
      ? coverageDays(product.availableStock + item.quantity, product.salesLast30Days)
      : 0;
  const suggestedQty = rec?.suggestedQuantity ?? item.quantity;
  const deltaVsSuggested = item.quantity - suggestedQty;

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
            {formatNumber(suggestedQty)} u.
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
            value={product ? `${formatNumber(product.availableStock)} u.` : "n/a"}
          />
          <DraftMetric label="Cobertura actual" value={product ? `${currentCoverage} d` : "n/a"} />
          <DraftMetric label="Cobertura futura" value={product ? `${futureCoverage} d` : "n/a"} />
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

      {tab === "escenarios" && product && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500">
            Compara el costo completo de cada opción antes de decidir. Un descuento por volumen
            inmoviliza más capital y arriesga sobrestock.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {buyScenarios(product, suggestedQty, item.unitCost, item.discountPct ?? 0).map((s) => {
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
        </div>
      )}

      {tab === "inventario" && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(product?.stockByLocation ?? []).slice(0, 3).map((loc) => (
            <div key={loc.locationName} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium text-slate-500">{loc.locationName}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatNumber(loc.available)} u.
              </p>
              <p className="text-xs text-slate-400">comprometido {formatNumber(loc.committed)}</p>
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
            value={product ? `${formatNumber(product.salesLast30Days)} u.` : "n/a"}
          />
          <DraftMetric
            label="Venta 90d"
            value={product ? `${formatNumber(product.salesLast90Days)} u.` : "n/a"}
          />
          <DraftMetric
            label="Rotación"
            value={product ? `${formatNumber(product.rotation)}x` : "n/a"}
          />
          <DraftMetric
            label="Variación OC"
            value={`${deltaVsSuggested > 0 ? "+" : ""}${formatNumber(deltaVsSuggested)} u.`}
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
              Cumplimiento {supplier ? `${supplier.deliveryCompliance}%` : "n/a"} · lead time{" "}
              {supplier ? `${supplier.averageLeadTimeDays} d` : "n/a"}
            </p>
          </div>
          {product ? (
            <LandedCostBreakdown product={product} unitCost={item.unitCost} />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Rentabilidad
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Costo {formatCurrency(item.unitCost)} · línea {formatCurrency(lineNet(item))}
              </p>
            </div>
          )}
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
            {product ? `${futureCoverage} días` : "sin cálculo"}
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

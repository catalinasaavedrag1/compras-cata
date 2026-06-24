import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { StatusBadge } from "../components/business/StatusBadge";
import { RecommendationBadge } from "../components/business/RecommendationBadge";
import { AlertCard } from "../components/business/AlertCard";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { BarList } from "../components/business/BarList";
import { IconPlus } from "../components/ui/icons";
import { getProductBySku } from "../data/mockProducts";
import { recommendations } from "../data/mockRecommendations";
import { alerts } from "../data/mockAlerts";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { useOcDraft } from "../context/OcDraftContext";
import { coverageDays } from "../utils/calculations";
import { IconCheck } from "../components/ui/icons";
import type { Product, PurchaseRecommendation } from "../types/purchasing";
import {
  formatCurrency,
  formatDate,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";

export function ProductDetailPage() {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const { addItem, hasItem } = useOcDraft();

  const product = sku ? getProductBySku(sku) : undefined;

  if (!product) {
    return (
      <div className="py-10">
        <EmptyState
          title="Producto no encontrado"
          description={`No existe un SKU "${sku}" en el catálogo.`}
          action={<Button onClick={() => navigate("/productos")}>Volver a productos</Button>}
        />
      </div>
    );
  }

  const rec = recommendations.find((r) => r.sku === product.sku);
  const relatedAlerts = alerts.filter((a) => a.relatedSku === product.sku);
  const relatedPOs = purchaseOrders.filter((o) =>
    o.lines?.some((l) => l.sku === product.sku)
  );

  // Historiales simples (mock)
  const salesHistory = [
    { period: "Junio 2026", units: product.salesLast30Days },
    { period: "Mayo 2026", units: Math.round(product.salesLast90Days / 3) },
    { period: "Abril 2026", units: Math.round((product.salesLast90Days - product.salesLast30Days) / 2.2) },
  ];
  const purchaseHistory = relatedPOs.map((o) => {
    const line = o.lines?.find((l) => l.sku === product.sku);
    return { date: o.createdAt, number: o.number, qty: line?.quantity ?? 0, cost: line?.unitCost ?? product.cost };
  });
  const costHistory = [
    { date: product.costUpdatedAt, cost: product.cost, note: "Costo vigente" },
    { date: "2026-03-15", cost: Math.round(product.cost * 0.94), note: "Lista anterior" },
    { date: "2025-12-01", cost: Math.round(product.cost * 0.89), note: "Lista 2025" },
  ];

  const handleAdd = () => {
    if (!rec) return;
    addItem({
      sku: product.sku,
      productName: product.name,
      supplierName: product.supplierName,
      quantity: rec.suggestedQuantity || product.reorderPoint,
      unitCost: product.cost,
    });
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Productos", to: "/productos" },
          { label: product.sku },
        ]}
        title={product.name}
        description={`${product.category} · ${product.subcategory} · ${product.brand}`}
        action={
          rec && rec.suggestedQuantity > 0 ? (
            <Button
              onClick={handleAdd}
              disabled={hasItem(product.sku)}
              variant={hasItem(product.sku) ? "secondary" : "primary"}
              icon={<IconPlus className="w-4 h-4" />}
            >
              {hasItem(product.sku) ? "Agregado a OC" : "Agregar a OC"}
            </Button>
          ) : undefined
        }
      />

      {/* Encabezado: chips */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs font-mono text-slate-500 bg-slate-100 rounded px-2 py-1">{product.sku}</span>
        <StatusBadge kind="product" value={product.productStatus} />
        <StatusBadge kind="purchase" value={product.purchaseStatus} dot={false} />
        {product.supplierName ? (
          <Link to="/proveedores" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
            Proveedor: {product.supplierName}
          </Link>
        ) : (
          <Badge tone="red">Sin proveedor asignado</Badge>
        )}
      </div>

      {/* Decisión recomendada — lo primero que debe ver el comprador */}
      <DecisionBanner
        product={product}
        rec={rec}
        added={hasItem(product.sku)}
        onAdd={handleAdd}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard title="Stock total" value={formatNumber(product.totalStock)} tone="neutral" />
        <KpiCard title="Stock disponible" value={formatNumber(product.availableStock)} tone={product.availableStock <= 0 ? "bad" : "good"} description={`${formatNumber(product.committedStock)} comprometido`} />
        <KpiCard title="Venta 30 días" value={formatNumber(product.salesLast30Days)} tone="info" description={`${formatNumber(product.salesLast90Days)} en 90 días`} />
        <KpiCard title="Días de inventario" value={formatNumber(product.inventoryDays)} tone={product.inventoryDays < 7 ? "bad" : product.inventoryDays > 120 ? "warn" : "good"} />
        <KpiCard title="Margen" value={formatPercent(product.margin)} tone={product.margin < 25 ? "warn" : "good"} />
        <KpiCard title="Costo actual" value={formatCurrency(product.cost)} tone="neutral" description={`Actualizado ${formatDate(product.costUpdatedAt)}`} />
        <KpiCard title="Precio venta" value={formatCurrency(product.price)} tone="neutral" />
        <KpiCard title="Cantidad sugerida" value={rec ? `${formatNumber(rec.suggestedQuantity)} u.` : "—"} tone="info" description={rec ? formatCurrency(rec.suggestedPurchaseAmount) : "Sin recomendación activa"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* Recomendación de compra */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Recomendación de compra" description="Qué hacer con este producto y por qué" />
            <CardBody>
              {rec ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <RecommendationBadge status={rec.status} />
                    <div>
                      <p className="text-2xl font-semibold text-slate-900">
                        {formatNumber(rec.suggestedQuantity)} unidades
                      </p>
                      <p className="text-sm text-slate-500">
                        {formatCurrency(rec.suggestedPurchaseAmount)} · {rec.supplierName} (lead time {rec.supplierLeadTimeDays} días)
                      </p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-medium text-slate-500 mb-1">Motivo</p>
                      <p className="text-sm text-slate-700">{rec.reason}</p>
                    </div>
                    <div className="rounded-lg bg-rose-50 border border-rose-100 p-3">
                      <p className="text-xs font-medium text-rose-600 mb-1">Riesgo si no se compra</p>
                      <p className="text-sm text-slate-700">{rec.risk}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <MiniStat label="Stock mínimo" value={formatNumber(rec.minStock)} />
                    <MiniStat label="Punto reposición" value={formatNumber(rec.reorderPoint)} />
                    <MiniStat label="Stock máximo" value={formatNumber(rec.maxStock)} />
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Sin recomendación activa"
                  description="Este producto no tiene una recomendación de compra pendiente. Su stock cubre la venta esperada."
                />
              )}
            </CardBody>
          </Card>
        </div>

        {/* Stock por ubicación */}
        <Card>
          <CardHeader title="Stock por ubicación" description="Disponible vs comprometido" />
          <CardBody className="space-y-3">
            {product.stockByLocation.map((loc) => (
              <div key={loc.locationName}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">{loc.locationName}</span>
                  <span className="text-sm font-medium text-slate-900">{formatNumber(loc.stock)}</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                  <div className="bg-emerald-500 h-full" style={{ width: `${(loc.available / Math.max(loc.stock, 1)) * 100}%` }} />
                  <div className="bg-amber-400 h-full" style={{ width: `${(loc.committed / Math.max(loc.stock, 1)) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                  <span>Disp. {formatNumber(loc.available)}</span>
                  <span>Comp. {formatNumber(loc.committed)}</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* Historial ventas */}
        <Card>
          <CardHeader title="Últimas ventas" description="Unidades por mes" />
          <CardBody>
            <BarList
              items={salesHistory.map((s) => ({
                label: s.period,
                value: s.units,
                display: `${formatNumber(s.units)} u.`,
                tone: "blue",
              }))}
            />
          </CardBody>
        </Card>

        {/* Historial compras */}
        <Card>
          <CardHeader title="Últimas compras" description="Órdenes con este SKU" />
          <CardBody className="space-y-2">
            {purchaseHistory.length > 0 ? (
              purchaseHistory.map((h) => (
                <div key={h.number} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="font-medium text-slate-700">{h.number}</p>
                    <p className="text-xs text-slate-400">{formatDate(h.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-700">{formatNumber(h.qty)} u.</p>
                    <p className="text-xs text-slate-400">{formatCurrency(h.cost)} c/u</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">Sin compras recientes registradas.</p>
            )}
          </CardBody>
        </Card>

        {/* Historial costo */}
        <Card>
          <CardHeader title="Cambios de costo" description="Evolución del costo unitario" />
          <CardBody className="space-y-2">
            {costHistory.map((c, i) => (
              <div key={c.date} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-medium text-slate-700">{formatCurrency(c.cost)}</p>
                  <p className="text-xs text-slate-400">{c.note}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{formatDate(c.date)}</p>
                  {i === 0 && <Badge tone="green">Vigente</Badge>}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alertas relacionadas */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Alertas relacionadas</h3>
          {relatedAlerts.length > 0 ? (
            <div className="space-y-3">
              {relatedAlerts.map((a) => (
                <AlertCard key={a.id} alert={a} compact />
              ))}
            </div>
          ) : (
            <Card>
              <CardBody>
                <EmptyState title="Sin alertas" description="Este producto no tiene alertas comerciales activas." />
              </CardBody>
            </Card>
          )}
        </div>

        {/* OC relacionadas */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Órdenes de compra relacionadas</h3>
          <Card>
            <CardBody className="space-y-2">
              {relatedPOs.length > 0 ? (
                relatedPOs.map((o) => (
                  <Link
                    key={o.id}
                    to="/ordenes-compra"
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{o.number}</p>
                      <p className="text-xs text-slate-500">{o.supplierName} · espera {formatDate(o.expectedDate)}</p>
                    </div>
                    <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
                  </Link>
                ))
              ) : (
                <EmptyState title="Sin órdenes" description="No hay órdenes de compra con este producto." />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-800">{value}</p>
    </div>
  );
}

/**
 * Banner "Decisión recomendada": resume en una frase qué hacer y por qué,
 * con la acción a un clic. Es lo primero que debe ver el comprador.
 */
function DecisionBanner({
  product,
  rec,
  added,
  onAdd,
}: {
  product: Product;
  rec?: PurchaseRecommendation;
  added: boolean;
  onAdd: () => void;
}) {
  const cover = coverageDays(product.availableStock, product.salesLast30Days);
  const lead = product.supplierLeadTimeDays;

  // Caso 1: hay recomendación de compra
  if (rec && rec.suggestedQuantity > 0) {
    const urgent = rec.status === "critical";
    return (
      <div
        className={`mb-5 rounded-xl border p-4 ${
          urgent ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Decisión recomendada
              </span>
              <RecommendationBadge status={rec.status} />
            </div>
            <p className="text-base font-semibold text-slate-900">
              Comprar {formatNumber(rec.suggestedQuantity)} unidades a {rec.supplierName} ·{" "}
              {formatCurrency(rec.suggestedPurchaseAmount)}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              El stock disponible cubre {product.salesLast30Days > 0 ? formatDays(cover) : "—"} y el
              proveedor demora {formatDays(lead)} en entregar. {rec.reason}
            </p>
          </div>
          <Button
            onClick={onAdd}
            disabled={added}
            variant={added ? "secondary" : "primary"}
            icon={added ? <IconCheck className="w-4 h-4" /> : <IconPlus className="w-4 h-4" />}
          >
            {added ? "Agregado a OC" : "Agregar a OC"}
          </Button>
        </div>
      </div>
    );
  }

  // Caso 2: sobrestock — no comprar
  if (product.purchaseStatus === "overstock" || (rec && rec.status === "overstock")) {
    return (
      <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Decisión recomendada
        </span>
        <p className="text-base font-semibold text-slate-900 mt-1">No comprar — hay sobrestock</p>
        <p className="text-sm text-slate-600 mt-0.5">
          Hay {formatNumber(product.availableStock)} unidades disponibles para{" "}
          {formatNumber(product.inventoryDays)} días de venta. Conviene esperar y, si la rotación
          sigue baja, evaluar promoción o redistribución.
        </p>
      </div>
    );
  }

  // Caso 3: sin proveedor con venta activa
  if (!product.supplierName && product.salesLast30Days > 0) {
    return (
      <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Decisión recomendada
        </span>
        <p className="text-base font-semibold text-slate-900 mt-1">Asignar proveedor</p>
        <p className="text-sm text-slate-600 mt-0.5">
          Este producto vende {formatNumber(product.salesLast30Days)} unidades al mes pero no tiene
          proveedor asignado, por lo que no se puede generar reposición.
        </p>
      </div>
    );
  }

  // Caso 4: todo en orden
  return (
    <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Decisión recomendada
      </span>
      <p className="text-base font-semibold text-slate-900 mt-1">Sin acción por ahora</p>
      <p className="text-sm text-slate-600 mt-0.5">
        El stock disponible cubre la venta esperada{" "}
        {product.salesLast30Days > 0 && `(${formatDays(cover)} de cobertura)`}. No requiere compra.
      </p>
    </div>
  );
}

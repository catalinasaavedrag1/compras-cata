import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusBadge } from "../components/business/StatusBadge";
import { RecommendationBadge } from "../components/business/RecommendationBadge";
import { AlertCard } from "../components/business/AlertCard";
import { CatalogRedundancy } from "../components/business/CatalogRedundancy";
import { analyzeCatalog } from "../utils/catalogOptimization";
import { categories } from "../data/mockCategories";
import { products } from "../data/mockProducts";
import { suppliers } from "../data/mockSuppliers";
import { recommendations } from "../data/mockRecommendations";
import { alerts } from "../data/mockAlerts";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconProducts, IconAlerts, IconReplenish, IconSales } from "../components/ui/icons";

export function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, hasItem } = useOcDraft();
  const toast = useToast();
  const [tab, setTab] = useState("productos");

  const category = categories.find((c) => c.id === id);

  if (!category) {
    return (
      <div className="py-10">
        <EmptyState title="Categoría no encontrada" action={<Button onClick={() => navigate("/categorias")}>Volver a categorías</Button>} />
      </div>
    );
  }

  const catProducts = products.filter((p) => p.category === category.name);
  const catSuppliers = suppliers.filter((s) => s.categories.includes(category.name));
  const catRecs = recommendations.filter((r) => r.category === category.name);
  const catSkus = new Set(catProducts.map((p) => p.sku));
  const catAlerts = alerts.filter((a) => a.relatedEntity === category.name || (a.relatedSku && catSkus.has(a.relatedSku)));
  const redundantCount = analyzeCatalog(catProducts).candidateCount;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Categorías", to: "/categorias" }, { label: category.name }]}
        title={category.name}
        description={`Comprador: ${category.buyer}`}
        action={<StatusBadge kind="category" value={category.status} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard title="Compra sugerida" value={formatCurrencyCompact(category.suggestedPurchase)} tone="info" icon={<IconReplenish className="w-4 h-4" />} description="Ver reposición" onClick={() => setTab("reposicion")} active={tab === "reposicion"} />
        <KpiCard title="SKUs en quiebre" value={formatNumber(category.stockoutSkus)} tone="bad" icon={<IconAlerts className="w-4 h-4" />} description={`${category.riskSkus} en riesgo`} />
        <KpiCard title="Venta 30 días" value={formatCurrencyCompact(category.salesLast30Days)} tone="good" icon={<IconSales className="w-4 h-4" />} description={`margen ${formatPercent(category.averageMargin)}`} />
        <KpiCard title="Inventario" value={formatCurrencyCompact(category.inventoryValue)} tone="neutral" icon={<IconProducts className="w-4 h-4" />} description={`${category.overstockSkus} sobrestock`} />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "productos", label: "Productos", count: catProducts.length },
          { value: "optimizar", label: "Optimizar surtido", count: redundantCount },
          { value: "reposicion", label: "Reposición", count: catRecs.length },
          { value: "proveedores", label: "Proveedores", count: catSuppliers.length },
          { value: "alertas", label: "Alertas", count: catAlerts.length },
        ]}
      />

      {tab === "productos" && (
        <Card>
          <CardBody className="space-y-2">
            {catProducts.length === 0 ? (
              <EmptyState title="Sin productos" description="Esta categoría no tiene SKUs." />
            ) : (
              catProducts.map((p) => (
                <Link key={p.sku} to={`/productos/${p.sku}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">disp. {formatNumber(p.availableStock)} · vende {formatNumber(p.salesLast30Days)}/mes · margen {formatPercent(p.margin)}</p>
                  </div>
                  <StatusBadge kind="purchase" value={p.purchaseStatus} dot={false} />
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {tab === "optimizar" && <CatalogRedundancy products={catProducts} scopeLabel={category.name} />}

      {tab === "reposicion" && (
        <Card>
          <CardBody className="space-y-2">
            {catRecs.length === 0 ? (
              <EmptyState title="Sin sugerencias" description="No hay reposición sugerida en esta categoría." />
            ) : (
              catRecs.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <Link to={`/productos/${r.sku}`} className="min-w-0 hover:text-brand-700">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.productName}</p>
                    <p className="text-xs text-slate-500">{formatNumber(r.suggestedQuantity)} u. · {formatCurrency(r.suggestedPurchaseAmount)} · {r.supplierName}</p>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <RecommendationBadge status={r.status} />
                    {r.suggestedQuantity > 0 && (
                      <Button
                        size="sm"
                        variant={hasItem(r.sku) ? "secondary" : "primary"}
                        disabled={hasItem(r.sku)}
                        onClick={() => {
                          addItem({ sku: r.sku, productName: r.productName, supplierName: r.supplierName, quantity: r.suggestedQuantity, unitCost: r.unitCost });
                          toast.success(`${r.productName} agregado al borrador de OC`, { label: "Ver borrador OC", onClick: () => navigate("/ordenes-compra") });
                        }}
                      >
                        {hasItem(r.sku) ? "En OC" : "Agregar"}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {tab === "proveedores" && (
        <Card>
          <CardBody className="space-y-2">
            {catSuppliers.length === 0 ? (
              <EmptyState title="Sin proveedores" description="No hay proveedores asociados." />
            ) : (
              catSuppliers.map((s) => (
                <Link key={s.id} to={`/proveedores/${s.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                    <p className="text-xs text-slate-500">cumple {formatPercent(s.deliveryCompliance, 0)} · lead {s.averageLeadTimeDays}d · {s.openPurchaseOrders} OC abiertas</p>
                  </div>
                  <StatusBadge kind="supplier" value={s.status} dot={false} />
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {tab === "alertas" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {catAlerts.length === 0 ? (
            <Card><CardBody><EmptyState title="Sin alertas" description="Esta categoría no tiene alertas." /></CardBody></Card>
          ) : (
            catAlerts.map((a) => <AlertCard key={a.id} alert={a} compact entityTo={a.relatedSku ? `/productos/${a.relatedSku}` : undefined} />)
          )}
        </div>
      )}
    </div>
  );
}

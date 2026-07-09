import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
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
        <EmptyState
          title="Categoría no encontrada"
          action={<Button onClick={() => navigate("/categorias")}>Volver a categorías</Button>}
        />
      </div>
    );
  }

  const catProducts = products.filter((p) => p.category === category.name);
  const catSuppliers = suppliers.filter((s) => s.categories.includes(category.name));
  const catRecs = recommendations.filter((r) => r.category === category.name);
  const catSkus = new Set(catProducts.map((p) => p.sku));
  const catAlerts = alerts.filter(
    (a) => a.relatedEntity === category.name || (a.relatedSku && catSkus.has(a.relatedSku))
  );
  const redundantCount = analyzeCatalog(catProducts).candidateCount;
  const productRoles = catProducts
    .map((p) => {
      const sales = p.salesLast30Days * p.price;
      const profit = p.salesLast30Days * (p.price - p.cost);
      const expected = p.salesLast90Days / 3;
      const growth = expected > 0 ? (p.salesLast30Days - expected) / expected : 0;
      const role =
        p.salesLast30Days === 0 && p.availableStock > 0
          ? "Detenido"
          : growth >= 0.25
            ? "Emergente"
            : growth <= -0.25 && p.availableStock > 0
              ? "Deterioro"
              : p.margin >= 34 && sales > 0
                ? "Margen"
                : p.salesLast30Days >= 40
                  ? "Tractor"
                  : "Riesgo";
      return { product: p, sales, profit, growth, role };
    })
    .sort((a, b) => b.sales - a.sales);
  const catBrandRows = Array.from(new Set(catProducts.map((p) => p.brand).filter(Boolean)))
    .map((brand) => {
      const rows = catProducts.filter((p) => p.brand === brand);
      const sales = rows.reduce((sum, p) => sum + p.salesLast30Days * p.price, 0);
      const profit = rows.reduce((sum, p) => sum + p.salesLast30Days * (p.price - p.cost), 0);
      const stockouts = rows.filter((p) => p.availableStock <= 0 && p.salesLast30Days > 0).length;
      return {
        brand,
        sales,
        margin: sales > 0 ? (profit / sales) * 100 : 0,
        skus: rows.length,
        stockouts,
      };
    })
    .sort((a, b) => b.sales - a.sales);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Categorías", to: "/categorias" }, { label: category.name }]}
        title={category.name}
        description={`Comprador: ${category.buyer}`}
        action={<StatusBadge kind="category" value={category.status} />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Compra sugerida"
          value={formatCurrencyCompact(category.suggestedPurchase)}
          tone="info"
          icon={<IconReplenish className="w-4 h-4" />}
          description="Ver reposición"
          onClick={() => setTab("reposicion")}
          active={tab === "reposicion"}
        />
        <KpiCard
          title="SKUs en quiebre"
          value={formatNumber(category.stockoutSkus)}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
          description={`${category.riskSkus} en riesgo`}
        />
        <KpiCard
          title="Venta 30 días"
          value={formatCurrencyCompact(category.salesLast30Days)}
          tone="good"
          icon={<IconSales className="w-4 h-4" />}
          description={`margen ${formatPercent(category.averageMargin)}`}
        />
        <KpiCard
          title="Inventario"
          value={formatCurrencyCompact(category.inventoryValue)}
          tone="neutral"
          icon={<IconProducts className="w-4 h-4" />}
          description={`${category.overstockSkus} sobrestock`}
        />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "productos", label: "Productos", count: catProducts.length },
          { value: "clave", label: "Productos clave", count: productRoles.length },
          {
            value: "crecimiento",
            label: "Crecimiento",
            count: productRoles.filter((r) => r.growth >= 0.25).length,
          },
          {
            value: "detenidos",
            label: "Detenidos",
            count: productRoles.filter((r) => r.role === "Detenido").length,
          },
          { value: "marcas", label: "Marcas", count: catBrandRows.length },
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
                <Link
                  key={p.sku}
                  to={`/productos/${p.sku}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      disp. {formatNumber(p.availableStock)} · vende{" "}
                      {formatNumber(p.salesLast30Days)}/mes · margen {formatPercent(p.margin)}
                    </p>
                  </div>
                  <StatusBadge kind="purchase" value={p.purchaseStatus} dot={false} />
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {tab === "clave" && (
        <Card>
          <CardBody className="space-y-2">
            {productRoles.slice(0, 12).map((r) => (
              <Link
                key={r.product.sku}
                to={`/productos/${r.product.sku}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        r.role === "Detenido" || r.role === "Deterioro"
                          ? "red"
                          : r.role === "Margen"
                            ? "violet"
                            : "blue"
                      }
                    >
                      {r.role}
                    </Badge>
                    <span className="text-xs font-mono text-slate-400">{r.product.sku}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800 truncate">
                    {r.product.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    venta {formatCurrencyCompact(r.sales)} · margen{" "}
                    {formatPercent(r.product.margin)} · utilidad {formatCurrencyCompact(r.profit)}
                  </p>
                </div>
                <StatusBadge kind="purchase" value={r.product.purchaseStatus} dot={false} />
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      {tab === "crecimiento" && (
        <Card>
          <CardBody className="space-y-2">
            {productRoles.filter((r) => r.growth >= 0.25).length === 0 ? (
              <EmptyState
                title="Sin aceleraciones fuertes"
                description="No hay productos con crecimiento sobre 25% contra su ritmo reciente."
              />
            ) : (
              productRoles
                .filter((r) => r.growth >= 0.25)
                .map((r) => (
                  <Link
                    key={r.product.sku}
                    to={`/productos/${r.product.sku}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {r.product.name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        cobertura {formatNumber(r.product.inventoryDays)} d · stock{" "}
                        {formatNumber(r.product.availableStock)}
                      </span>
                    </span>
                    <Badge tone="blue">{formatPercent(r.growth * 100, 0)}</Badge>
                  </Link>
                ))
            )}
          </CardBody>
        </Card>
      )}

      {tab === "detenidos" && (
        <Card>
          <CardBody className="space-y-2">
            {productRoles.filter((r) => r.role === "Detenido").length === 0 ? (
              <EmptyState
                title="Sin productos detenidos"
                description="No hay productos con venta detenida y stock expuesto en esta categoría."
              />
            ) : (
              productRoles
                .filter((r) => r.role === "Detenido")
                .map((r) => (
                  <Link
                    key={r.product.sku}
                    to={`/productos/${r.product.sku}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50/40 px-3 py-2 hover:border-rose-300"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {r.product.name}
                      </span>
                      <span className="block text-xs text-slate-500">
                        stock {formatNumber(r.product.availableStock)} · capital{" "}
                        {formatCurrencyCompact(r.product.availableStock * r.product.cost)}
                      </span>
                    </span>
                    <Badge tone="red">Detenido</Badge>
                  </Link>
                ))
            )}
          </CardBody>
        </Card>
      )}

      {tab === "marcas" && (
        <Card>
          <CardBody className="space-y-2">
            {catBrandRows.map((b) => (
              <div key={b.brand} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{b.brand}</p>
                    <p className="text-xs text-slate-500">
                      {b.skus} SKU · margen {formatPercent(b.margin)}
                    </p>
                  </div>
                  {b.stockouts > 0 && <Badge tone="red">{b.stockouts} quiebre</Badge>}
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrencyCompact(b.sales)}
                </p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {tab === "optimizar" && (
        <CatalogRedundancy products={catProducts} scopeLabel={category.name} />
      )}

      {tab === "reposicion" && (
        <Card>
          <CardBody className="space-y-2">
            {catRecs.length === 0 ? (
              <EmptyState
                title="Sin sugerencias"
                description="No hay reposición sugerida en esta categoría."
              />
            ) : (
              catRecs.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <Link to={`/productos/${r.sku}`} className="min-w-0 hover:text-brand-700">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.productName}</p>
                    <p className="text-xs text-slate-500">
                      {formatNumber(r.suggestedQuantity)} u. ·{" "}
                      {formatCurrency(r.suggestedPurchaseAmount)} · {r.supplierName}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <RecommendationBadge status={r.status} />
                    {r.suggestedQuantity > 0 && (
                      <Button
                        size="sm"
                        variant={hasItem(r.sku) ? "secondary" : "primary"}
                        disabled={hasItem(r.sku)}
                        onClick={() => {
                          addItem({
                            sku: r.sku,
                            productName: r.productName,
                            supplierName: r.supplierName,
                            quantity: r.suggestedQuantity,
                            unitCost: r.unitCost,
                          });
                          toast.success(`${r.productName} agregado al borrador de OC`, {
                            label: "Ver borrador OC",
                            onClick: () => navigate("/comprar/borradores"),
                          });
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
                <Link
                  key={s.id}
                  to={`/proveedores/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      cumple {formatPercent(s.deliveryCompliance, 0)} · lead {s.averageLeadTimeDays}
                      d · {s.openPurchaseOrders} OC abiertas
                    </p>
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
            <Card>
              <CardBody>
                <EmptyState title="Sin alertas" description="Esta categoría no tiene alertas." />
              </CardBody>
            </Card>
          ) : (
            catAlerts.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                compact
                entityTo={a.relatedSku ? `/productos/${a.relatedSku}` : undefined}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

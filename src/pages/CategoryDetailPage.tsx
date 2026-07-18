import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useCategoryFicha } from "../hooks/useFichas";
import { supplierPath, productPath } from "../utils/entityLinks";
import {
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconProducts, IconReplenish, IconSales, IconSuppliers } from "../components/ui/icons";

// ============================================================================
//  Ficha de categoría (F11) conectada al purchase-bff-service: el :id de la
//  ruta es el categoryId real (cat-…). GET /categories/:id compone productos
//  conocidos por el motor, reposición pendiente, presupuesto OTB del mes y
//  proveedores de la categoría. Las secciones del mock sin fuente (venta CLP,
//  tendencias, marcas) quedan como estados vacíos honestos.
// ============================================================================

/** Prioridad del motor → chip (tolerante a valores nuevos). */
const PRIORITY_UI: Record<string, { label: string; tone: BadgeTone }> = {
  stockout_imminent: { label: "Quiebre inminente", tone: "red" },
  low_stock: { label: "Stock bajo", tone: "amber" },
  opportunity: { label: "Oportunidad", tone: "blue" },
};

function priorityUi(priority: string): { label: string; tone: BadgeTone } {
  return PRIORITY_UI[priority] ?? { label: priority, tone: "neutral" };
}

export function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState("productos");

  const { data, loading, error, notFound, configured, refetch } = useCategoryFicha(id);

  const pageTitle = data?.name ?? id ?? "Categoría";
  const breadcrumbs = [{ label: "Categorías", to: "/categorias" }, { label: pageTitle }];

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando, error y 404 (patrón F1).
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        <PageHeader breadcrumbs={breadcrumbs} title={pageTitle} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver la ficha real de la categoría.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader breadcrumbs={breadcrumbs} title={pageTitle} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando ficha de la categoría">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="py-10">
        <EmptyState
          title="Categoría no encontrada"
          description={`El servicio de compras no conoce la categoría "${id}".`}
          action={<Button onClick={() => navigate("/categorias")}>Volver a categorías</Button>}
        />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader breadcrumbs={breadcrumbs} title={pageTitle} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar la ficha de la categoría
            </p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { replenishment, budget } = data;
  const byPriority = replenishment.byPriority;

  return (
    <div>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={data.name}
        description={`Comprador: ${data.buyerId ?? "Sin asignar"}`}
      />

      {/* Aviso discreto de composición parcial (secciones degradadas del BFF) */}
      {data.warnings && data.warnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Ficha con datos parciales: {data.warnings.map((w) => w.message).join(" · ")}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="SKUs conocidos"
          value={formatNumber(data.products.length)}
          tone="neutral"
          icon={<IconProducts className="w-4 h-4" />}
          description="Según el motor de reposición"
        />
        <KpiCard
          title="Pendientes de reposición"
          value={formatNumber(replenishment.pendingCount)}
          tone={byPriority.stockout_imminent > 0 ? "bad" : "info"}
          icon={<IconReplenish className="w-4 h-4" />}
          description={`${formatNumber(byPriority.stockout_imminent)} quiebre · ${formatNumber(
            byPriority.low_stock
          )} bajo · ${formatNumber(byPriority.opportunity)} oportunidad`}
        />
        <KpiCard
          title="Monto sugerido"
          value={formatCurrencyCompact(replenishment.suggestedAmountClp)}
          tone="info"
          icon={<IconSales className="w-4 h-4" />}
          description={
            replenishment.sales30Units !== null
              ? `Venta 30d: ${formatNumber(replenishment.sales30Units)} u.`
              : undefined
          }
        />
        <KpiCard
          title="Presupuesto disponible"
          value={budget ? formatCurrencyCompact(budget.availableClp) : "—"}
          tone={budget ? (budget.availableClp <= 0 ? "bad" : "good") : "neutral"}
          icon={<IconSales className="w-4 h-4" />}
          description={budget ? `OTB ${budget.month}` : "Presupuesto no configurado"}
        />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "productos", label: "Productos", count: data.products.length },
          { value: "proveedores", label: "Proveedores", count: data.suppliers.length },
          { value: "tendencias", label: "Tendencias" },
        ]}
      />

      {tab === "productos" && (
        <Card>
          <CardHeader
            title="Productos de la categoría"
            description="SKUs conocidos por el motor: stock, cobertura, venta en unidades y prioridad."
          />
          <CardBody>
            {data.products.length === 0 ? (
              <EmptyState
                title="Sin productos"
                description="El motor no conoce SKUs de esta categoría."
              />
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs">
                      <th className="text-left font-medium text-slate-500 py-2 pl-1">Producto</th>
                      <th className="text-left font-medium text-slate-500 py-2 px-2">Proveedor</th>
                      <th className="text-right font-medium text-slate-500 py-2 px-2">Stock</th>
                      <th className="text-right font-medium text-slate-500 py-2 px-2">Cobertura</th>
                      <th className="text-right font-medium text-slate-500 py-2 px-2">
                        Venta 30d (u.)
                      </th>
                      <th className="text-right font-medium text-slate-500 py-2 px-2">Margen</th>
                      <th className="text-right font-medium text-slate-500 py-2 pr-1">Prioridad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.products.map((p) => {
                      const prio = priorityUi(p.priority);
                      return (
                        <tr key={p.sku} className="hover:bg-slate-50">
                          <td className="py-2 pl-1 min-w-0">
                            <Link to={productPath(p.sku)} className="group block">
                              <span className="text-slate-800 group-hover:text-brand-700 group-hover:underline">
                                {p.name ?? p.sku}
                              </span>
                              <span className="block text-xs text-slate-400">
                                {p.sku}
                                {p.brand && <> · {p.brand}</>}
                              </span>
                            </Link>
                          </td>
                          <td className="py-2 px-2">
                            {p.supplierId || p.supplierName ? (
                              <Link
                                to={supplierPath(p.supplierId)}
                                className="text-slate-600 hover:text-brand-700 hover:underline"
                              >
                                {p.supplierName ?? p.supplierId}
                              </Link>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                            {p.stockAvailable !== null ? formatNumber(p.stockAvailable) : "—"}
                          </td>
                          <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                            {p.coverageDays !== null ? `${formatNumber(p.coverageDays)} d` : "—"}
                          </td>
                          <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                            {p.salesLast30d !== null ? formatNumber(p.salesLast30d) : "—"}
                          </td>
                          <td className="text-right py-2 px-2 tabular-nums text-slate-600">
                            {p.marginPct !== null ? formatPercent(p.marginPct, 0) : "—"}
                          </td>
                          <td className="text-right py-2 pr-1">
                            <Badge tone={prio.tone}>{prio.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {tab === "proveedores" && (
        <Card>
          <CardHeader
            title="Proveedores de la categoría"
            description="Con cuántos SKUs participan y cuánto sugiere comprarles el motor."
          />
          <CardBody className="space-y-2">
            {data.suppliers.length === 0 ? (
              <EmptyState title="Sin proveedores" description="No hay proveedores asociados." />
            ) : (
              data.suppliers.map((s) => (
                <Link
                  key={s.supplierId}
                  to={supplierPath(s.supplierId)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <IconSuppliers className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {s.supplierName ?? s.supplierId}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatNumber(s.skuCount)} SKU en la categoría
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">
                    {formatCurrencyCompact(s.suggestedAmountClp)} sugerido
                  </span>
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      )}

      {tab === "tendencias" && (
        <Card>
          <CardBody>
            <EmptyState
              title="Tendencias y venta en CLP"
              description="La venta valorizada, marcas y tendencias de la categoría se publican desde analytics; pendiente de conexión."
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

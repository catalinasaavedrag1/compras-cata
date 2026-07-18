import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { categoryPath, productPath, supplierPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import { PriorityBadge } from "../components/business/PriorityBadge";
import { KpiCard } from "../components/business/KpiCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { MoreActions } from "../components/ui/MoreActions";
import { exportToCsv } from "../utils/exportCsv";
import { useToast } from "../context/ToastContext";
import { useProductsCatalog, type ProductCatalogRow } from "../hooks/useProductsCatalog";
import { mapPriority } from "../hooks/useReplenishment";
import { useUrlState, useUrlToggle } from "../utils/useUrlState";
import { formatCurrency, formatDays, formatNumber, formatPercent } from "../utils/formatters";
import { IconProducts, IconAlerts, IconSales } from "../components/ui/icons";

// ============================================================================
//  Productos conectados al purchase-bff: universo = SKUs que conoce el motor
//  de compras (POST /replenishment/search sin filtro de estado, ver
//  useProductsCatalog). Filtros q/categoría/marca/proveedor y toggles se
//  aplican client-side sobre la página cargada. Columnas mock sin fuente real
//  (precio, subcategoría, rotación, estados comercial/compra, costo
//  desactualizado) se eliminaron.
// ============================================================================

/** Umbral de margen bajo (%) para KPI y toggle. */
const LOW_MARGIN_PCT = 25;

const PRODUCT_CSV_COLUMNS = [
  { label: "SKU", value: (p: ProductCatalogRow) => p.sku },
  { label: "Nombre", value: (p: ProductCatalogRow) => p.name },
  { label: "Marca", value: (p: ProductCatalogRow) => p.brand ?? "" },
  { label: "Categoría", value: (p: ProductCatalogRow) => p.categoryName ?? "" },
  { label: "Proveedor", value: (p: ProductCatalogRow) => p.supplierName ?? "" },
  { label: "Stock disponible", value: (p: ProductCatalogRow) => p.stockAvailable ?? "" },
  { label: "Costo", value: (p: ProductCatalogRow) => p.unitCost ?? "" },
  { label: "Margen %", value: (p: ProductCatalogRow) => p.marginPct ?? "" },
  { label: "Venta 30 días (unid.)", value: (p: ProductCatalogRow) => p.sales30Units ?? "" },
  { label: "Prioridad motor", value: (p: ProductCatalogRow) => p.priority },
  { label: "Estado motor", value: (p: ProductCatalogRow) => p.engineStatus },
  { label: "Cobertura (días)", value: (p: ProductCatalogRow) => p.coverageDays ?? "" },
];

export function ProductsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  // El alcance "mi cartera / todas" lo resuelve el backend (scope del hook).
  const { scope, setScope } = useCategoryScope();
  const { rows, meta, loading, error, configured, refetch } = useProductsCatalog();

  const [query, setQuery] = useUrlState("q");
  const [category, setCategory] = useUrlState("cat");
  const [brand, setBrand] = useUrlState("marca");
  const [supplier, setSupplier] = useUrlState("prov");
  const [outOfStock, toggleOutOfStock] = useUrlToggle("stock");
  const [toggles, setToggles] = useState({ lowMargin: false, noSales: false });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((p) => {
      if (q && !`${p.sku} ${p.name} ${p.brand ?? ""}`.toLowerCase().includes(q)) return false;
      if (category && p.categoryName !== category) return false;
      if (brand && p.brand !== brand) return false;
      if (supplier && p.supplierName !== supplier) return false;
      if (outOfStock && !(p.stockAvailable !== null && p.stockAvailable <= 0)) return false;
      if (toggles.lowMargin && !(p.marginPct !== null && p.marginPct < LOW_MARGIN_PCT))
        return false;
      if (toggles.noSales && p.sales30Units !== 0) return false;
      return true;
    });
  }, [rows, query, category, brand, supplier, outOfStock, toggles]);

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setBrand("");
    setSupplier("");
    setToggles({ lowMargin: false, noSales: false });
    if (outOfStock) toggleOutOfStock();
  };

  const uniqueOptions = (pick: (p: ProductCatalogRow) => string | null) =>
    Array.from(new Set(rows.map(pick).filter((v): v is string => !!v)))
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((v) => ({ value: v, label: v }));

  // KPIs según el resultado filtrado (se actualizan con los filtros)
  const lowMarginCount = filtered.filter(
    (p) => p.marginPct !== null && p.marginPct < LOW_MARGIN_PCT
  ).length;
  const noSalesCount = filtered.filter((p) => p.sales30Units === 0).length;
  const stockoutCount = filtered.filter(
    (p) => p.stockAvailable !== null && p.stockAvailable <= 0
  ).length;

  const pageTitle = "Productos / SKUs";
  const pageDescription = "Revisa stock, margen, venta y prioridad del motor de compras.";

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, primera carga y error (patrón flujo 1).
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver el catálogo real de SKUs del motor de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && meta === null && !error) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando productos">
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

  if (error && meta === null) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar los productos
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

  const columns: Column<ProductCatalogRow>[] = [
    {
      key: "product",
      header: "Producto",
      render: (p) => (
        <div className="min-w-[200px]">
          <span className="text-xs font-mono text-slate-400">{p.sku}</span>
          <p className="font-medium text-slate-800 leading-snug">{p.name}</p>
        </div>
      ),
    },
    {
      key: "brand",
      header: "Marca",
      hideOnMobile: true,
      render: (p) =>
        p.brand ? (
          <span className="text-sm text-slate-700">{p.brand}</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: "category",
      header: "Categoría",
      hideOnMobile: true,
      render: (p) =>
        p.categoryName ? (
          <Link
            to={categoryPath(p.categoryId ?? p.categoryName)}
            className="text-sm text-slate-700 hover:text-brand-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {p.categoryName}
          </Link>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      hideOnMobile: true,
      render: (p) =>
        p.supplierName ? (
          <Link
            to={supplierPath(p.supplierId)}
            className="text-sm text-slate-700 hover:text-brand-700 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {p.supplierName}
          </Link>
        ) : (
          <span className="text-xs text-rose-500 font-medium">Sin proveedor</span>
        ),
    },
    {
      key: "stock",
      header: "Stock disp.",
      align: "right",
      render: (p) => (
        <div className="text-sm">
          <p
            className={
              p.stockAvailable !== null && p.stockAvailable <= 0
                ? "text-rose-600 font-semibold"
                : "text-slate-700"
            }
          >
            {p.stockAvailable === null ? "—" : formatNumber(p.stockAvailable)}
          </p>
          {p.coverageDays !== null && (
            <p className="text-xs text-slate-400">{formatDays(p.coverageDays)} cobertura</p>
          )}
        </div>
      ),
    },
    {
      key: "cost",
      header: "Costo",
      align: "right",
      hideOnMobile: true,
      render: (p) =>
        p.unitCost === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className="text-sm text-slate-700">{formatCurrency(p.unitCost)}</span>
        ),
    },
    {
      key: "margin",
      header: "Margen",
      align: "right",
      render: (p) =>
        p.marginPct === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span
            className={
              p.marginPct < LOW_MARGIN_PCT ? "text-amber-600 font-medium" : "text-slate-700"
            }
          >
            {formatPercent(p.marginPct)}
          </span>
        ),
    },
    {
      key: "sales",
      header: "Venta 30d (unid.)",
      align: "right",
      hideOnMobile: true,
      render: (p) =>
        p.sales30Units === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className="text-slate-700">{formatNumber(p.sales30Units)}</span>
        ),
    },
    {
      key: "priority",
      header: "Prioridad",
      render: (p) => <PriorityBadge priority={mapPriority(p.priority)} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={
          <div className="flex items-center gap-2">
            <ScopeToggle scope={scope} onChange={setScope} />
            <MoreActions
              actions={[
                {
                  label: "Exportar a CSV",
                  onClick: () => {
                    exportToCsv("productos", filtered, PRODUCT_CSV_COLUMNS);
                    toast.success(`Se exportaron ${filtered.length} productos a productos.csv`);
                  },
                },
              ]}
            />
          </div>
        }
      />
      <p className="-mt-3 mb-4 text-xs text-slate-400">
        Universo: SKUs conocidos por el motor de compras.
      </p>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar SKU, producto o marca"
          resultCount={filtered.length}
          summary={`${filtered.length} productos · ${stockoutCount} sin stock · ${lowMarginCount} margen bajo · ${noSalesCount} sin venta`}
          onClear={clearFilters}
          selects={[
            {
              key: "cat",
              placeholder: "Categoría",
              value: category,
              onChange: setCategory,
              options: uniqueOptions((p) => p.categoryName),
            },
            {
              key: "brand",
              placeholder: "Marca",
              value: brand,
              onChange: setBrand,
              options: uniqueOptions((p) => p.brand),
            },
            {
              key: "sup",
              placeholder: "Proveedor",
              value: supplier,
              onChange: setSupplier,
              options: uniqueOptions((p) => p.supplierName),
            },
          ]}
          toggles={[
            {
              key: "outOfStock",
              label: "Sin stock",
              active: outOfStock,
              onToggle: toggleOutOfStock,
            },
            {
              key: "lowMargin",
              label: "Margen bajo",
              active: toggles.lowMargin,
              onToggle: () => setToggles((t) => ({ ...t, lowMargin: !t.lowMargin })),
            },
            {
              key: "noSales",
              label: "Sin venta",
              active: toggles.noSales,
              onToggle: () => setToggles((t) => ({ ...t, noSales: !t.noSales })),
            },
          ]}
        />
      </div>

      {meta?.partial && (meta.warnings?.length ?? 0) > 0 && (
        <Card className="mb-3 border-amber-200 bg-amber-50/60">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-xs text-amber-800">
            <Badge tone="amber">Datos parciales</Badge>
            {meta.warnings!.map((w) => (
              <span key={w.code}>{w.message}</span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="SKUs en vista"
          value={formatNumber(filtered.length)}
          tone="info"
          icon={<IconProducts className="w-4 h-4" />}
          description="Según filtros"
        />
        <KpiCard
          title={`Margen bajo (<${LOW_MARGIN_PCT}%)`}
          value={formatNumber(lowMarginCount)}
          tone="warn"
          icon={<IconSales className="w-4 h-4" />}
          description="Filtrar"
          active={toggles.lowMargin}
          onClick={() => setToggles((t) => ({ ...t, lowMargin: !t.lowMargin }))}
        />
        <KpiCard
          title="Sin venta (30d)"
          value={formatNumber(noSalesCount)}
          tone="warn"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Filtrar"
          active={toggles.noSales}
          onClick={() => setToggles((t) => ({ ...t, noSales: !t.noSales }))}
        />
        <KpiCard
          title="En quiebre"
          value={formatNumber(stockoutCount)}
          tone={stockoutCount ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="Filtrar"
          active={outOfStock}
          onClick={toggleOutOfStock}
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(p) => p.sku}
          onRowClick={(p) => navigate(productPath(p.sku))}
          emptyMessage={
            scope === "mine"
              ? 'Sin productos con estos filtros en tu cartera. Cambia a "Todas" arriba o limpia los filtros.'
              : "Sin productos que coincidan con los filtros."
          }
          mobileCard={(p) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                  <p className="font-medium text-slate-800 leading-snug">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    {[p.categoryName, p.brand].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <PriorityBadge priority={mapPriority(p.priority)} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Stock disp.</p>
                  <p
                    className={
                      p.stockAvailable !== null && p.stockAvailable <= 0
                        ? "text-rose-600 font-semibold"
                        : "text-slate-700"
                    }
                  >
                    {p.stockAvailable === null ? "—" : formatNumber(p.stockAvailable)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Venta 30d</p>
                  <p className="text-slate-700">
                    {p.sales30Units === null ? "—" : formatNumber(p.sales30Units)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Margen</p>
                  <p
                    className={
                      p.marginPct !== null && p.marginPct < LOW_MARGIN_PCT
                        ? "text-amber-600 font-medium"
                        : "text-slate-700"
                    }
                  >
                    {p.marginPct === null ? "—" : formatPercent(p.marginPct)}
                  </p>
                </div>
              </div>
            </div>
          )}
        />
      </Card>
    </div>
  );
}

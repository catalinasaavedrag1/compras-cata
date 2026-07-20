import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { BarList } from "../components/business/BarList";
import { DataTable, type Column } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { HelpNote } from "../components/business/HelpNote";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import { useProductsCatalog, type ProductCatalogRow } from "../hooks/useProductsCatalog";
import { productPath } from "../utils/entityLinks";
import { formatCurrency, formatCurrencyCompact, formatDays, formatNumber } from "../utils/formatters";
import { IconInventory, IconBox, IconAlerts } from "../components/ui/icons";

// ============================================================================
//  Análisis de inventario — conectado al motor de compras.
//  ---------------------------------------------------------------------------
//  REAL: valor de inventario A COSTO (stock × costo unitario), cobertura,
//  sobrestock (cobertura alta), sin rotación (0 venta 30d con stock) y quiebres
//  (sin stock con venta). Todo por SKU y agregado por categoría.
//  DEGRADA (no hay fuente real): valorización a precio de venta, corte por
//  tienda/bodega y por buckets de rotación, "sobre el máximo" (stock máximo) y
//  el estado comercial/compra. Antes venían de un mock de inventario.
// ============================================================================

// Sobrestock: cobertura muy alta (capital que conviene liberar).
const OVERSTOCK_COVERAGE_DAYS = 120;

/** Capital a costo inmovilizado (stock × costo). null si falta stock o costo. */
function stockCostValue(p: ProductCatalogRow): number | null {
  if (p.stockAvailable === null || p.unitCost === null) return null;
  return p.stockAvailable * p.unitCost;
}

const isOverstock = (p: ProductCatalogRow) =>
  p.coverageDays !== null && p.coverageDays >= OVERSTOCK_COVERAGE_DAYS;
const isNoRotation = (p: ProductCatalogRow) =>
  p.sales30Units === 0 && (p.stockAvailable ?? 0) > 0;
const isStockout = (p: ProductCatalogRow) =>
  (p.stockAvailable ?? 0) <= 0 && (p.sales30Units ?? 0) > 0;

interface CategoryValue {
  label: string;
  inventoryValue: number;
  overstockValue: number;
}

export function InventoryAnalysisPage() {
  const navigate = useNavigate();
  const { scope, setScope } = useCategoryScope();
  const { rows, meta, loading, error, configured, refetch } = useProductsCatalog();

  const totalCostValue = useMemo(
    () => rows.reduce((acc, p) => acc + (stockCostValue(p) ?? 0), 0),
    [rows]
  );
  const overstockValue = useMemo(
    () => rows.reduce((acc, p) => acc + (isOverstock(p) ? stockCostValue(p) ?? 0 : 0), 0),
    [rows]
  );
  const overstock = useMemo(() => rows.filter(isOverstock), [rows]);
  const noRotation = useMemo(() => rows.filter(isNoRotation), [rows]);
  const stockouts = useMemo(() => rows.filter(isStockout), [rows]);

  const byCategory = useMemo<CategoryValue[]>(() => {
    const map = new Map<string, CategoryValue>();
    for (const p of rows) {
      const label = p.categoryName ?? "Sin categoría";
      const cur = map.get(label) ?? { label, inventoryValue: 0, overstockValue: 0 };
      const v = stockCostValue(p) ?? 0;
      cur.inventoryValue += v;
      if (isOverstock(p)) cur.overstockValue += v;
      map.set(label, cur);
    }
    return Array.from(map.values())
      .filter((c) => c.inventoryValue > 0)
      .sort((a, b) => b.inventoryValue - a.inventoryValue);
  }, [rows]);

  const frozen = useMemo(
    () =>
      [...rows]
        .map((p) => ({ p, value: stockCostValue(p) ?? 0 }))
        .filter((f) => f.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
        .map((f) => f.p),
    [rows]
  );

  const pageTitle = "Análisis de inventario";
  const pageDescription = "Valor a costo, sobrestock, stock sin rotación y quiebres.";

  // --------------------------------------------------------------------------
  //  Estados de conexión (patrón flujo 1 / Productos).
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
              ver el inventario real del motor de compras.
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
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando inventario">
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
              No se pudo cargar el inventario
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

  const frozenColumns: Column<ProductCatalogRow>[] = [
    {
      key: "product",
      header: "Producto",
      render: (p) => (
        <Link to={productPath(p.sku)} className="block hover:text-brand-700">
          <span className="text-xs font-mono text-slate-400">{p.sku}</span>
          <p className="font-medium text-slate-800">{p.name}</p>
        </Link>
      ),
    },
    {
      key: "stock",
      header: "Stock disp.",
      align: "right",
      render: (p) => (p.stockAvailable === null ? "—" : formatNumber(p.stockAvailable)),
    },
    {
      key: "sales",
      header: "Venta 30d (u.)",
      align: "right",
      hideOnMobile: true,
      render: (p) => (p.sales30Units === null ? "—" : formatNumber(p.sales30Units)),
    },
    {
      key: "coverage",
      header: "Cobertura",
      align: "right",
      render: (p) => (p.coverageDays === null ? "—" : formatDays(p.coverageDays)),
    },
    {
      key: "capital",
      header: "Capital a costo",
      align: "right",
      render: (p) => {
        const v = stockCostValue(p);
        return v === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className="font-semibold text-slate-900">{formatCurrency(v)}</span>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={<ScopeToggle scope={scope} onChange={setScope} />}
      />

      <HelpNote className="mb-4" title="Valorización a costo:">
        El inventario se valoriza a <b>costo</b> (stock × costo unitario), no a precio de venta: el
        motor no entrega precio de venta. La <b>cobertura</b> y la venta en <b>unidades</b> son
        reales. El corte por <b>tienda/bodega</b> y por <b>buckets de rotación</b> requiere una
        fuente adicional que hoy no existe.
      </HelpNote>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Inventario a costo"
          value={formatCurrencyCompact(totalCostValue)}
          tone="info"
          icon={<IconInventory className="w-4 h-4" />}
          description="Stock × costo"
        />
        <KpiCard
          title="Sobrestock a costo"
          value={formatCurrencyCompact(overstockValue)}
          tone={overstock.length ? "warn" : "good"}
          icon={<IconBox className="w-4 h-4" />}
          description={`Cobertura > ${OVERSTOCK_COVERAGE_DAYS} d`}
        />
        <KpiCard
          title="Sin rotación (30d)"
          value={formatNumber(noRotation.length)}
          tone={noRotation.length ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="0 ventas con stock"
        />
        <KpiCard
          title="SKUs con quiebre"
          value={formatNumber(stockouts.length)}
          tone={stockouts.length ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="Sin stock con venta"
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Inventario a costo por categoría"
          description="Distribución del capital inmovilizado y el sobrestock por categoría."
        />
        <CardBody>
          {byCategory.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-400">
              Sin valor de inventario calculable (falta stock o costo en las filas del motor).
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-3">Inventario a costo</p>
                <BarList
                  items={byCategory.map((g) => ({
                    label: g.label,
                    value: g.inventoryValue,
                    display: formatCurrencyCompact(g.inventoryValue),
                    tone: "blue",
                  }))}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-3">
                  Sobrestock (capital a liberar)
                </p>
                <BarList
                  items={byCategory.map((g) => ({
                    label: g.label,
                    value: g.overstockValue,
                    display: formatCurrencyCompact(g.overstockValue),
                    tone: "violet",
                  }))}
                />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader
          title="Productos con más capital inmovilizado"
          description="Capital a costo detenido en stock. Prioridad para liberar caja."
        />
        <DataTable
          columns={frozenColumns}
          data={frozen}
          rowKey={(p) => p.sku}
          onRowClick={(p) => navigate(productPath(p.sku))}
          emptyMessage="Sin capital inmovilizado calculable en el alcance actual."
          mobileCard={(p) => {
            const v = stockCostValue(p);
            return (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                  <p className="font-medium text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    Disp. {p.stockAvailable === null ? "—" : formatNumber(p.stockAvailable)}
                    {p.coverageDays !== null && <> · {formatDays(p.coverageDays)} cobertura</>}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                  {v === null ? "—" : formatCurrencyCompact(v)}
                </span>
              </div>
            );
          }}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ListCard
          title="Sobrestock"
          subtitle={`Cobertura sobre ${OVERSTOCK_COVERAGE_DAYS} días`}
          products={overstock}
          tone="violet"
        />
        <ListCard
          title="Sin rotación (30d)"
          subtitle="0 ventas con stock disponible"
          products={noRotation}
          tone="amber"
        />
        <ListCard
          title="Stock crítico"
          subtitle="Quiebre con venta activa"
          products={stockouts}
          tone="red"
        />
      </div>
    </div>
  );
}

function ListCard({
  title,
  subtitle,
  products,
  tone,
}: {
  title: string;
  subtitle: string;
  products: ProductCatalogRow[];
  tone: "violet" | "amber" | "red";
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        description={subtitle}
        action={<Badge tone={tone}>{products.length}</Badge>}
      />
      <CardBody className="space-y-2">
        {products.length > 0 ? (
          products.slice(0, 20).map((p) => {
            const v = stockCostValue(p);
            return (
              <Link
                key={p.sku}
                to={productPath(p.sku)}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    Disp. {p.stockAvailable === null ? "—" : formatNumber(p.stockAvailable)}
                    {p.coverageDays !== null && <> · {formatDays(p.coverageDays)} cobertura</>}
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-700 flex-shrink-0">
                  {v === null ? "—" : formatCurrencyCompact(v)}
                </span>
              </Link>
            );
          })
        ) : (
          <p className="text-sm text-slate-400 py-3 text-center">Sin productos en este grupo.</p>
        )}
      </CardBody>
    </Card>
  );
}

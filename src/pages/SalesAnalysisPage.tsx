import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { HelpNote } from "../components/business/HelpNote";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import { useProductsCatalog, type ProductCatalogRow } from "../hooks/useProductsCatalog";
import { categoryPath, productPath } from "../utils/entityLinks";
import { formatDays, formatNumber, formatPercent } from "../utils/formatters";
import { IconSales, IconAlerts, IconProducts } from "../components/ui/icons";

// ============================================================================
//  Análisis de venta (unidades) — conectado al motor de compras.
//  ---------------------------------------------------------------------------
//  La única venta REAL disponible es la de los últimos 30 días en UNIDADES por
//  SKU (sales30Units) y su agregación por categoría. NO existe fuente de:
//    · venta en $ (no hay precio de venta),
//    · ticket / venta perdida en $,
//    · series diarias/semanales ni comparaciones de período (90/180 d),
//    · márgenes ni venta por canal.
//  Todo eso se degrada con nota honesta en vez de inventar cifras. El alcance
//  "mi cartera / todas" lo resuelve el backend (scope de useProductsCatalog).
// ============================================================================

const TOP_LIMIT = 100;

interface CategoryAgg {
  name: string;
  categoryId: string | null;
  skuCount: number;
  units30: number;
  noSales: number;
  marginSum: number;
  marginCount: number;
}

export function SalesAnalysisPage() {
  const { scope, setScope } = useCategoryScope();
  const { rows, meta, loading, error, configured, refetch } = useProductsCatalog();
  const [tab, setTab] = useState("productos");

  const totalUnits = useMemo(
    () => rows.reduce((acc, p) => acc + (p.sales30Units ?? 0), 0),
    [rows]
  );
  const withSales = useMemo(
    () => rows.filter((p) => (p.sales30Units ?? 0) > 0).length,
    [rows]
  );
  const noRotation = useMemo(
    () =>
      rows.filter((p) => p.sales30Units === 0 && (p.stockAvailable ?? 0) > 0).length,
    [rows]
  );

  const topProducts = useMemo(
    () =>
      [...rows]
        .sort((a, b) => (b.sales30Units ?? 0) - (a.sales30Units ?? 0))
        .slice(0, TOP_LIMIT),
    [rows]
  );

  const categories = useMemo(() => {
    const map = new Map<string, CategoryAgg>();
    for (const p of rows) {
      const name = p.categoryName ?? "Sin categoría";
      const cur =
        map.get(name) ??
        {
          name,
          categoryId: p.categoryId,
          skuCount: 0,
          units30: 0,
          noSales: 0,
          marginSum: 0,
          marginCount: 0,
        };
      cur.skuCount += 1;
      cur.units30 += p.sales30Units ?? 0;
      if (p.sales30Units === 0 && (p.stockAvailable ?? 0) > 0) cur.noSales += 1;
      if (p.marginPct !== null) {
        cur.marginSum += p.marginPct;
        cur.marginCount += 1;
      }
      map.set(name, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.units30 - a.units30);
  }, [rows]);

  const pageTitle = "Análisis de venta (unidades)";
  const pageDescription =
    "Qué se vende y qué no, en unidades de los últimos 30 días, por producto y categoría.";

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
              ver la venta real en unidades del motor de compras.
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
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando venta">
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
            <p className="text-sm font-semibold text-slate-800">No se pudo cargar la venta</p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const productColumns: Column<ProductCatalogRow>[] = [
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
      key: "category",
      header: "Categoría",
      hideOnMobile: true,
      render: (p) =>
        p.categoryName ? (
          <span className="text-sm text-slate-600">{p.categoryName}</span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: "sales",
      header: "Venta 30d (u.)",
      align: "right",
      render: (p) => (
        <span className="font-semibold text-slate-900">
          {p.sales30Units === null ? "—" : formatNumber(p.sales30Units)}
        </span>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      hideOnMobile: true,
      render: (p) =>
        p.stockAvailable === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className={p.stockAvailable <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>
            {formatNumber(p.stockAvailable)}
          </span>
        ),
    },
    {
      key: "coverage",
      header: "Cobertura",
      align: "right",
      hideOnMobile: true,
      render: (p) =>
        p.coverageDays === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className="text-slate-700">{formatDays(p.coverageDays)}</span>
        ),
    },
    {
      key: "margin",
      header: "Margen %",
      align: "right",
      hideOnMobile: true,
      render: (p) =>
        p.marginPct === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className="text-slate-700">{formatPercent(p.marginPct)}</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={<ScopeToggle scope={scope} onChange={setScope} />}
      />

      <HelpNote className="mb-4" title="Qué es real y qué no:">
        La venta que muestra el motor es en <b>unidades de los últimos 30 días</b>. La venta en{" "}
        <b>$</b>, el <b>ticket</b>, la <b>venta perdida en $</b>, las <b>series diarias/semanales</b>{" "}
        y las comparaciones de <b>90/180 días</b> requieren una fuente de venta que hoy no existe;
        estarán disponibles cuando exista la fuente de venta.
      </HelpNote>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Unidades vendidas 30d"
          value={formatNumber(totalUnits)}
          tone="good"
          icon={<IconSales className="w-4 h-4" />}
          description="Suma del alcance"
        />
        <KpiCard
          title="SKUs con venta"
          value={formatNumber(withSales)}
          tone="info"
          icon={<IconProducts className="w-4 h-4" />}
          description="Vendieron en 30 días"
        />
        <KpiCard
          title="Sin rotación (30d)"
          value={formatNumber(noRotation)}
          tone={noRotation ? "warn" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="0 ventas con stock"
        />
        <KpiCard
          title="SKUs en alcance"
          value={formatNumber(rows.length)}
          tone="neutral"
          icon={<IconProducts className="w-4 h-4" />}
          description={scope === "mine" ? "Mi cartera" : "Todas"}
        />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "productos", label: "Productos", count: Math.min(rows.length, TOP_LIMIT) },
          { value: "categorias", label: "Categorías", count: categories.length },
        ]}
      />

      {tab === "productos" && (
        <Card>
          <CardHeader
            title="Top productos por venta (unidades)"
            description={`Los ${Math.min(rows.length, TOP_LIMIT)} más vendidos en unidades (30 días).`}
          />
          <DataTable
            columns={productColumns}
            data={topProducts}
            rowKey={(p) => p.sku}
            emptyMessage="Sin venta registrada en el alcance actual."
            mobileCard={(p) => (
              <Link to={productPath(p.sku)} className="block">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                    <p className="font-medium text-slate-800 leading-snug truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.categoryName ?? "—"}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                    {p.sales30Units === null ? "—" : `${formatNumber(p.sales30Units)} u.`}
                  </span>
                </div>
              </Link>
            )}
          />
        </Card>
      )}

      {tab === "categorias" && (
        <Card>
          <CardBody className="space-y-2">
            {categories.length === 0 ? (
              <p className="py-3 text-center text-sm text-slate-400">
                Sin categorías con venta en el alcance actual.
              </p>
            ) : (
              categories.map((c) => (
                <Link
                  key={c.name}
                  to={categoryPath(c.categoryId ?? c.name)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatNumber(c.skuCount)} SKUs
                      {c.marginCount > 0 && (
                        <> · margen {formatPercent(c.marginSum / c.marginCount)}</>
                      )}
                      {c.noSales > 0 && (
                        <span className="text-amber-600"> · {c.noSales} sin rotación</span>
                      )}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-semibold text-slate-900">
                    {formatNumber(c.units30)} u.
                  </span>
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

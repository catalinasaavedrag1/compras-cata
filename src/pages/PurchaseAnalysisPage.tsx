import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, makeToggleSort, type Column, type SortState } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { HelpNote } from "../components/business/HelpNote";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import { useProductsCatalog, type ProductCatalogRow } from "../hooks/useProductsCatalog";
import { useUrlState } from "../utils/useUrlState";
import { productPath, supplierPath } from "../utils/entityLinks";
import {
  formatCurrency,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconSales, IconProducts, IconAlerts, IconBox } from "../components/ui/icons";

// ============================================================================
//  Ranking & liquidación — conectado al motor de compras (useProductsCatalog).
//  ---------------------------------------------------------------------------
//  REAL: venta 30d en UNIDADES, margen %, cobertura, stock y costo unitario.
//  Rankings de productos, proveedores y marcas se agregan sobre las filas
//  reales; los candidatos a liquidar salen de señales reales (sin rotación,
//  margen bajo, sobrestock por cobertura).
//  DEGRADA: la "venta $" (unidades × precio de venta) NO existe — se reemplaza
//  por venta 30d en UNIDADES; el valor de stock se muestra A COSTO. El alcance
//  "mi cartera / todas" lo resuelve el backend (scope del hook).
// ============================================================================

const TOP_LIMIT = 100;
const OVERSTOCK_COVERAGE_DAYS = 120; // sobrestock: cobertura muy alta con venta activa
const LOW_MARGIN_PCT = 20; // margen bajo

type LiquidationReason = "no_rotation" | "overstock" | "low_margin";

interface LiquidationCandidate {
  row: ProductCatalogRow;
  reason: LiquidationReason;
  severity: number; // mayor = más urgente
  metricLabel: string;
  metricValue: string;
  tone: BadgeTone;
  reasonLabel: string;
  action: { label: string; to: string };
}

interface AggregateRow {
  key: string;
  name: string;
  supplierId: string | null;
  skuCount: number;
  units30: number;
  avgMargin: number | null;
  stockValue: number | null;
}

/** Capital a costo inmovilizado (stock × costo). null si falta stock o costo. */
function stockCostValue(p: ProductCatalogRow): number | null {
  if (p.stockAvailable === null || p.unitCost === null) return null;
  return p.stockAvailable * p.unitCost;
}

/** Construye la lista de candidatos a liquidar/descontinuar con su motivo. */
function buildLiquidationCandidate(p: ProductCatalogRow): LiquidationCandidate | null {
  // 1) Sin rotación: no vendió en 30 días pero tiene stock parado.
  if (p.sales30Units === 0 && (p.stockAvailable ?? 0) > 0) {
    const capital = stockCostValue(p);
    return {
      row: p,
      reason: "no_rotation",
      severity: 3 + Math.min((capital ?? 0) / 1_000_000, 5),
      metricLabel: "Capital detenido (costo)",
      metricValue: capital === null ? "—" : formatCurrency(capital),
      tone: "red",
      reasonLabel: "Sin rotación (0 ventas 30d)",
      action: { label: "Revisar surtido", to: "/surtido-redundante" },
    };
  }

  // 2) Margen bajo o negativo: vende, pero deja poco margen.
  if (p.marginPct !== null && p.marginPct < LOW_MARGIN_PCT) {
    return {
      row: p,
      reason: "low_margin",
      severity: p.marginPct <= 0 ? 4 : 2,
      metricLabel: "Margen",
      metricValue: formatPercent(p.marginPct),
      tone: p.marginPct <= 0 ? "red" : "amber",
      reasonLabel: p.marginPct <= 0 ? "Margen negativo" : "Margen bajo",
      action: { label: "Ver producto", to: productPath(p.sku) },
    };
  }

  // 3) Sobrestock: cobertura muy alta aun teniendo venta → liberar capital.
  if (
    p.coverageDays !== null &&
    p.coverageDays >= OVERSTOCK_COVERAGE_DAYS &&
    (p.sales30Units ?? 0) > 0
  ) {
    return {
      row: p,
      reason: "overstock",
      severity: 1 + Math.min(p.coverageDays / 200, 2),
      metricLabel: "Cobertura",
      metricValue: p.coverageDays >= 999 ? "+999 días" : formatDays(p.coverageDays),
      tone: "amber",
      reasonLabel: "Sobrestock (cobertura muy alta)",
      action: { label: "Crear campaña de liquidación", to: "/campanas" },
    };
  }

  return null;
}

export function PurchaseAnalysisPage() {
  const navigate = useNavigate();
  const { scope, setScope } = useCategoryScope();
  const { rows, meta, loading, error, configured, refetch } = useProductsCatalog();

  const [tab, setTab] = useUrlState("tab", "productos");
  const [query, setQuery] = useUrlState("q");
  const [category, setCategory] = useUrlState("cat");
  const [brand, setBrand] = useUrlState("marca");
  const [supplier, setSupplier] = useUrlState("prov");

  const [productSort, setProductSort] = useState<SortState>({ key: "sales", dir: "desc" });
  const [supplierSort, setSupplierSort] = useState<SortState>({ key: "units30", dir: "desc" });
  const [brandSort, setBrandSort] = useState<SortState>({ key: "units30", dir: "desc" });

  // --- KPIs sobre el alcance ---
  const totalUnits30 = useMemo(
    () => rows.reduce((acc, p) => acc + (p.sales30Units ?? 0), 0),
    [rows]
  );
  const liquidationCandidates = useMemo(
    () =>
      rows
        .map(buildLiquidationCandidate)
        .filter((c): c is LiquidationCandidate => c !== null)
        .sort((a, b) => b.severity - a.severity),
    [rows]
  );
  const noRotationCount = useMemo(
    () => rows.filter((p) => p.sales30Units === 0 && (p.stockAvailable ?? 0) > 0).length,
    [rows]
  );

  // --- Tab Top productos ---
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((p) => {
      if (q && !`${p.sku} ${p.name} ${p.brand ?? ""}`.toLowerCase().includes(q)) return false;
      if (category && p.categoryName !== category) return false;
      if (brand && p.brand !== brand) return false;
      if (supplier && p.supplierName !== supplier) return false;
      return true;
    });
  }, [rows, query, category, brand, supplier]);

  const topProducts = useMemo(
    () =>
      [...filteredProducts]
        .sort((a, b) => (b.sales30Units ?? 0) - (a.sales30Units ?? 0))
        .slice(0, TOP_LIMIT),
    [filteredProducts]
  );

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setBrand("");
    setSupplier("");
  };

  const uniqueOptions = (pick: (p: ProductCatalogRow) => string | null) =>
    Array.from(new Set(rows.map(pick).filter((v): v is string => !!v)))
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((v) => ({ value: v, label: v }));

  // --- Agregaciones por proveedor y marca ---
  const aggregate = useCallback(
    (keyOf: (p: ProductCatalogRow) => string | null): AggregateRow[] => {
      const map = new Map<
        string,
        {
          name: string;
          supplierId: string | null;
          skuCount: number;
          units30: number;
          marginSum: number;
          marginCount: number;
          stockValue: number;
          costCount: number;
        }
      >();
      for (const p of rows) {
        const name = keyOf(p) || "Sin asignar";
        const cur =
          map.get(name) ??
          {
            name,
            supplierId: null,
            skuCount: 0,
            units30: 0,
            marginSum: 0,
            marginCount: 0,
            stockValue: 0,
            costCount: 0,
          };
        cur.skuCount += 1;
        cur.units30 += p.sales30Units ?? 0;
        if (p.marginPct !== null) {
          cur.marginSum += p.marginPct;
          cur.marginCount += 1;
        }
        const v = stockCostValue(p);
        if (v !== null) {
          cur.stockValue += v;
          cur.costCount += 1;
        }
        if (cur.supplierId === null && p.supplierId) cur.supplierId = p.supplierId;
        map.set(name, cur);
      }
      return Array.from(map.values())
        .map((v) => ({
          key: v.name,
          name: v.name,
          supplierId: v.supplierId,
          skuCount: v.skuCount,
          units30: v.units30,
          avgMargin: v.marginCount ? v.marginSum / v.marginCount : null,
          stockValue: v.costCount ? v.stockValue : null,
        }))
        .sort((a, b) => b.units30 - a.units30);
    },
    [rows]
  );

  const supplierRows = useMemo(() => aggregate((p) => p.supplierName), [aggregate]);
  const brandRows = useMemo(() => aggregate((p) => p.brand), [aggregate]);

  const pageTitle = "Ranking & liquidación";
  const pageDescription =
    "Comprar bien: top productos, proveedores y marcas por venta en unidades, y qué liquidar o descontinuar.";

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
              ver el ranking real del motor de compras.
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
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando ranking">
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
            <p className="text-sm font-semibold text-slate-800">No se pudo cargar el ranking</p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // --- Columnas ---
  const productColumns: Column<ProductCatalogRow>[] = [
    {
      key: "product",
      header: "Producto",
      sortable: true,
      sortValue: (p) => p.name,
      render: (p) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-slate-800 leading-snug">{p.name}</p>
          <p className="text-xs font-mono text-slate-400">{p.sku}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoría",
      hideOnMobile: true,
      sortable: true,
      sortValue: (p) => p.categoryName ?? "",
      render: (p) => <span className="text-sm text-slate-600">{p.categoryName ?? "—"}</span>,
    },
    {
      key: "brand",
      header: "Marca",
      hideOnMobile: true,
      sortable: true,
      sortValue: (p) => p.brand ?? "",
      render: (p) => <span className="text-sm text-slate-600">{p.brand ?? "—"}</span>,
    },
    {
      key: "supplier",
      header: "Proveedor",
      hideOnMobile: true,
      sortable: true,
      sortValue: (p) => p.supplierName ?? "",
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
      key: "sales",
      header: "Venta 30d (u.)",
      align: "right",
      sortable: true,
      sortValue: (p) => p.sales30Units ?? 0,
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
      sortable: true,
      sortValue: (p) => p.stockAvailable ?? 0,
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
      sortable: true,
      sortValue: (p) => p.coverageDays ?? 0,
      render: (p) =>
        p.coverageDays === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className="text-slate-700">
            {p.coverageDays >= 999 ? "+999 d" : formatDays(p.coverageDays)}
          </span>
        ),
    },
    {
      key: "margin",
      header: "Margen %",
      align: "right",
      sortable: true,
      sortValue: (p) => p.marginPct ?? 0,
      render: (p) =>
        p.marginPct === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span
            className={p.marginPct < LOW_MARGIN_PCT ? "text-amber-600 font-medium" : "text-slate-700"}
          >
            {formatPercent(p.marginPct)}
          </span>
        ),
    },
  ];

  const aggregateColumns = (entityLabel: string): Column<AggregateRow>[] => [
    {
      key: "name",
      header: entityLabel,
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) =>
        entityLabel === "Proveedor" && r.supplierId ? (
          <Link
            to={supplierPath(r.supplierId)}
            className="font-medium text-slate-800 hover:text-brand-700 hover:underline"
          >
            {r.name}
          </Link>
        ) : (
          <span className="font-medium text-slate-800">{r.name}</span>
        ),
    },
    {
      key: "skuCount",
      header: "Nº SKUs",
      align: "right",
      sortable: true,
      sortValue: (r) => r.skuCount,
      render: (r) => formatNumber(r.skuCount),
    },
    {
      key: "units30",
      header: "Venta 30d (u.)",
      align: "right",
      sortable: true,
      sortValue: (r) => r.units30,
      render: (r) => <span className="font-semibold text-slate-900">{formatNumber(r.units30)}</span>,
    },
    {
      key: "avgMargin",
      header: "Margen prom. %",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.avgMargin ?? -1,
      render: (r) =>
        r.avgMargin === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span
            className={r.avgMargin < LOW_MARGIN_PCT ? "text-amber-600 font-medium" : "text-slate-700"}
          >
            {formatPercent(r.avgMargin)}
          </span>
        ),
    },
    {
      key: "stockValue",
      header: "Valor stock (costo)",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.stockValue ?? -1,
      render: (r) =>
        r.stockValue === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span className="text-slate-700">{formatCurrency(r.stockValue)}</span>
        ),
    },
  ];

  const liquidationColumns: Column<LiquidationCandidate>[] = [
    {
      key: "product",
      header: "Producto",
      render: (c) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-slate-800 leading-snug">{c.row.name}</p>
          <p className="text-xs font-mono text-slate-400">
            {c.row.sku}
            {c.row.categoryName ? ` · ${c.row.categoryName}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Motivo",
      render: (c) => <Badge tone={c.tone}>{c.reasonLabel}</Badge>,
    },
    {
      key: "metric",
      header: "Métrica clave",
      align: "right",
      render: (c) => (
        <div className="text-sm">
          <p className="font-semibold text-slate-900">{c.metricValue}</p>
          <p className="text-xs text-slate-400">{c.metricLabel}</p>
        </div>
      ),
    },
    {
      key: "action",
      header: "Acción",
      align: "right",
      render: (c) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            navigate(c.action.to);
          }}
        >
          {c.action.label}
        </Button>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="SKUs en alcance"
          value={formatNumber(rows.length)}
          tone="info"
          icon={<IconProducts className="w-4 h-4" />}
          description={scope === "mine" ? "Mi cartera" : "Todas"}
        />
        <KpiCard
          title="Venta 30d (u.)"
          value={formatNumber(totalUnits30)}
          tone="good"
          icon={<IconSales className="w-4 h-4" />}
          description="Suma de unidades"
        />
        <KpiCard
          title="Candidatos a liquidar"
          value={formatNumber(liquidationCandidates.length)}
          tone={liquidationCandidates.length ? "warn" : "good"}
          icon={<IconBox className="w-4 h-4" />}
          description="Ver detalle"
          active={tab === "liquidar"}
          onClick={() => setTab("liquidar")}
        />
        <KpiCard
          title="Sin rotación (30d)"
          value={formatNumber(noRotationCount)}
          tone={noRotationCount ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="0 ventas con stock"
          active={tab === "liquidar"}
          onClick={() => setTab("liquidar")}
        />
      </div>

      <div className="mb-4">
        <Tabs
          tabs={[
            {
              value: "productos",
              label: "Top productos",
              count: Math.min(filteredProducts.length, TOP_LIMIT),
            },
            { value: "proveedores", label: "Top proveedores", count: supplierRows.length },
            { value: "marcas", label: "Top marcas", count: brandRows.length },
            {
              value: "liquidar",
              label: "Liquidar / descontinuar",
              count: liquidationCandidates.length,
            },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "productos" && (
        <div className="space-y-4">
          <FilterBar
            searchValue={query}
            onSearchChange={setQuery}
            searchPlaceholder="Buscar SKU, producto o marca"
            resultCount={Math.min(filteredProducts.length, TOP_LIMIT)}
            summary={`Top ${Math.min(filteredProducts.length, TOP_LIMIT)} de ${filteredProducts.length} productos por venta 30d (u.)`}
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
                key: "prov",
                placeholder: "Proveedor",
                value: supplier,
                onChange: setSupplier,
                options: uniqueOptions((p) => p.supplierName),
              },
            ]}
          />

          {filteredProducts.length > TOP_LIMIT && (
            <p className="text-xs text-slate-500 px-0.5">
              Mostrando top {TOP_LIMIT} de {formatNumber(filteredProducts.length)} productos.
            </p>
          )}

          <Card>
            <DataTable
              columns={productColumns}
              data={topProducts}
              rowKey={(p) => p.sku}
              sort={productSort}
              onSortChange={makeToggleSort(setProductSort)}
              onRowClick={(p) => navigate(productPath(p.sku))}
              mobileCard={(p) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 leading-snug truncate">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {[p.categoryName, p.brand].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                      {p.sales30Units === null ? "—" : `${formatNumber(p.sales30Units)} u.`}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Stock</p>
                      <p className="text-slate-700">
                        {p.stockAvailable === null ? "—" : formatNumber(p.stockAvailable)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Cobertura</p>
                      <p className="text-slate-700">
                        {p.coverageDays === null ? "—" : formatDays(p.coverageDays)}
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
      )}

      {tab === "proveedores" && (
        <Card>
          <CardHeader
            title="Top proveedores"
            description="Agregado del alcance, ordenado por venta de 30 días en unidades."
          />
          <DataTable
            columns={aggregateColumns("Proveedor")}
            data={supplierRows}
            rowKey={(r) => r.key}
            sort={supplierSort}
            onSortChange={makeToggleSort(setSupplierSort)}
            onRowClick={(r) => r.supplierId && navigate(supplierPath(r.supplierId))}
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatNumber(r.skuCount)} SKUs
                    {r.avgMargin !== null && <> · margen {formatPercent(r.avgMargin)}</>}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                  {formatNumber(r.units30)} u.
                </span>
              </div>
            )}
          />
        </Card>
      )}

      {tab === "marcas" && (
        <Card>
          <CardHeader
            title="Top marcas"
            description="Agregado del alcance, ordenado por venta de 30 días en unidades."
          />
          <DataTable
            columns={aggregateColumns("Marca")}
            data={brandRows}
            rowKey={(r) => r.key}
            sort={brandSort}
            onSortChange={makeToggleSort(setBrandSort)}
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatNumber(r.skuCount)} SKUs
                    {r.avgMargin !== null && <> · margen {formatPercent(r.avgMargin)}</>}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                  {formatNumber(r.units30)} u.
                </span>
              </div>
            )}
          />
        </Card>
      )}

      {tab === "liquidar" && (
        <div className="space-y-4">
          <HelpNote title="Criterios:">
            Marcamos un producto para <b>liquidar o descontinuar</b> cuando: no rotó (0 ventas en 30
            días con stock disponible), tiene <b>margen bajo o negativo</b> (&lt; {LOW_MARGIN_PCT}
            %), o está en <b>sobrestock</b> (cobertura sobre {OVERSTOCK_COVERAGE_DAYS} días aun con
            venta). El capital detenido se muestra <b>a costo</b> (no hay precio de venta). Ordenados
            por severidad.
          </HelpNote>
          <Card>
            <CardHeader
              title="Candidatos a liquidar / descontinuar"
              description="Motivo, métrica clave y acción sugerida para cada producto."
              action={
                <Badge tone={liquidationCandidates.length ? "amber" : "green"}>
                  {liquidationCandidates.length}
                </Badge>
              }
            />
            <DataTable
              columns={liquidationColumns}
              data={liquidationCandidates}
              rowKey={(c) => c.row.sku}
              onRowClick={(c) => navigate(productPath(c.row.sku))}
              emptyMessage="No hay productos para liquidar o descontinuar en tu alcance."
              mobileCard={(c) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{c.row.name}</p>
                      <p className="text-xs text-slate-500">
                        {c.row.sku}
                        {c.row.categoryName ? ` · ${c.row.categoryName}` : ""}
                      </p>
                    </div>
                    <Badge tone={c.tone}>{c.reasonLabel}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="text-sm text-slate-600">
                      {c.metricLabel}: <b className="text-slate-900">{c.metricValue}</b>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(c.action.to);
                      }}
                    >
                      {c.action.label}
                    </Button>
                  </div>
                </div>
              )}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

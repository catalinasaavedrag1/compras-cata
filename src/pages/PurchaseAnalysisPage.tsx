import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, type Column, type SortState } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { HelpNote } from "../components/business/HelpNote";
import { products as mockProducts } from "../data/mockProducts";
import { useCollection } from "../context/DataContext";
import { useBuyer } from "../context/BuyerContext";
import { useRole } from "../context/RoleContext";
import { useUrlState } from "../utils/useUrlState";
import { uniqueValues } from "../utils/filters";
import { coverageDays } from "../utils/calculations";
import { productPath, supplierPath } from "../utils/entityLinks";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconSales, IconProducts, IconAlerts, IconBox } from "../components/ui/icons";
import type { Product } from "../types/purchasing";

const TOP_LIMIT = 100;
// Umbrales del análisis de liquidación / descontinuación.
const OVERSTOCK_COVERAGE_DAYS = 120; // sobrestock: cobertura muy alta con venta activa
const LOW_MARGIN_PCT = 20; // margen bajo

type LiquidationReason = "no_rotation" | "overstock" | "low_margin";

interface LiquidationCandidate {
  product: Product;
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
  skuCount: number;
  sales30: number;
  avgMargin: number;
  stockValue: number;
}

/** Marca de rotación legible (verde alta, ámbar media, roja baja/nula). */
function rotationTone(rotation: number): BadgeTone {
  if (rotation >= 8) return "green";
  if (rotation >= 4) return "amber";
  return "red";
}

function rotationLabel(rotation: number): string {
  if (rotation >= 8) return "Alta rotación";
  if (rotation >= 4) return "Rotación media";
  return "Baja rotación";
}

/** Construye la lista de candidatos a liquidar/descontinuar con su motivo. */
function buildLiquidationCandidate(p: Product): LiquidationCandidate | null {
  const cover = coverageDays(p.availableStock, p.salesLast30Days);

  // 1) Sin rotación: no vendió en 30 días pero tiene stock parado.
  if (p.salesLast30Days === 0 && p.availableStock > 0) {
    return {
      product: p,
      reason: "no_rotation",
      severity: 3 + Math.min((p.availableStock * p.cost) / 1_000_000, 5),
      metricLabel: "Capital detenido",
      metricValue: formatCurrency(p.availableStock * p.cost),
      tone: "red",
      reasonLabel: "Sin rotación (0 ventas 30d)",
      // Surtido redundante / descontinuar: racionalizar el catálogo.
      action: { label: "Revisar surtido", to: "/surtido-redundante" },
    };
  }

  // 2) Margen negativo o bajo: vende, pero no deja margen.
  if (p.margin < LOW_MARGIN_PCT) {
    return {
      product: p,
      reason: "low_margin",
      severity: p.margin <= 0 ? 4 : 2,
      metricLabel: "Margen",
      metricValue: formatPercent(p.margin),
      tone: p.margin <= 0 ? "red" : "amber",
      reasonLabel: p.margin <= 0 ? "Margen negativo" : "Margen bajo",
      action: { label: "Ver producto", to: productPath(p.sku) },
    };
  }

  // 3) Sobrestock: cobertura muy alta aun teniendo venta → liberar capital.
  if (cover >= OVERSTOCK_COVERAGE_DAYS && p.salesLast30Days > 0) {
    return {
      product: p,
      reason: "overstock",
      severity: 1 + Math.min(cover / 200, 2),
      metricLabel: "Cobertura",
      metricValue: cover >= 999 ? "+999 días" : `${formatNumber(cover)} días`,
      tone: "amber",
      reasonLabel: "Sobrestock (cobertura muy alta)",
      action: { label: "Crear campaña de liquidación", to: "/campanas" },
    };
  }

  return null;
}

export function PurchaseAnalysisPage() {
  const navigate = useNavigate();
  const allProducts = useCollection<Product>("products", mockProducts);
  const { role } = useRole();
  const { myCategories } = useBuyer();

  // Alcance: el comprador ve sus categorías; el líder ve todo el catálogo.
  const scoped = useMemo(
    () =>
      role === "lider" ? allProducts : allProducts.filter((p) => myCategories.includes(p.category)),
    [allProducts, role, myCategories]
  );

  const [tab, setTab] = useUrlState("tab", "productos");
  const [query, setQuery] = useUrlState("q");
  const [category, setCategory] = useUrlState("cat");
  const [brand, setBrand] = useUrlState("marca");
  const [supplier, setSupplier] = useUrlState("prov");

  // Orden por columna en cada tabla (por defecto, venta 30d descendente).
  const [productSort, setProductSort] = useState<SortState>({ key: "sales", dir: "desc" });
  const [supplierSort, setSupplierSort] = useState<SortState>({ key: "sales30", dir: "desc" });
  const [brandSort, setBrandSort] = useState<SortState>({ key: "sales30", dir: "desc" });
  const toggleSort = (setter: React.Dispatch<React.SetStateAction<SortState>>) => (key: string) =>
    setter((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );

  // --- KPIs sobre el alcance ---
  const totalSales30 = useMemo(
    () => scoped.reduce((acc, p) => acc + p.salesLast30Days * p.price, 0),
    [scoped]
  );
  const liquidationCandidates = useMemo(
    () =>
      scoped
        .map(buildLiquidationCandidate)
        .filter((c): c is LiquidationCandidate => c !== null)
        .sort((a, b) => b.severity - a.severity),
    [scoped]
  );
  const noRotationCount = useMemo(
    () => scoped.filter((p) => p.salesLast30Days === 0 && p.availableStock > 0).length,
    [scoped]
  );

  // --- Tab Top productos ---
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((p) => {
      if (q && ![p.sku, p.name, p.brand].some((h) => h.toLowerCase().includes(q))) return false;
      if (category && p.category !== category) return false;
      if (brand && p.brand !== brand) return false;
      if (supplier && p.supplierName !== supplier) return false;
      return true;
    });
  }, [scoped, query, category, brand, supplier]);

  const topProducts = useMemo(
    () =>
      [...filteredProducts]
        .sort((a, b) => b.salesLast30Days - a.salesLast30Days)
        .slice(0, TOP_LIMIT),
    [filteredProducts]
  );

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setBrand("");
    setSupplier("");
  };

  // --- Agregaciones por proveedor y marca ---
  const aggregate = useCallback(
    (keyOf: (p: Product) => string): AggregateRow[] => {
      const map = new Map<
        string,
        { name: string; skuCount: number; sales30: number; marginSum: number; stockValue: number }
      >();
      for (const p of scoped) {
        const name = keyOf(p) || "Sin asignar";
        const cur = map.get(name) ?? { name, skuCount: 0, sales30: 0, marginSum: 0, stockValue: 0 };
        cur.skuCount += 1;
        cur.sales30 += p.salesLast30Days * p.price;
        cur.marginSum += p.margin;
        cur.stockValue += p.cost * p.availableStock;
        map.set(name, cur);
      }
      return Array.from(map.values())
        .map((v) => ({
          key: v.name,
          name: v.name,
          skuCount: v.skuCount,
          sales30: v.sales30,
          avgMargin: v.skuCount ? v.marginSum / v.skuCount : 0,
          stockValue: v.stockValue,
        }))
        .sort((a, b) => b.sales30 - a.sales30);
    },
    [scoped]
  );

  const supplierRows = useMemo(() => aggregate((p) => p.supplierName), [aggregate]);
  const brandRows = useMemo(() => aggregate((p) => p.brand), [aggregate]);

  // --- Columnas ---
  const productColumns: Column<Product>[] = [
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
      sortValue: (p) => p.category,
      render: (p) => <span className="text-sm text-slate-600">{p.category}</span>,
    },
    {
      key: "brand",
      header: "Marca",
      hideOnMobile: true,
      sortable: true,
      sortValue: (p) => p.brand,
      render: (p) => <span className="text-sm text-slate-600">{p.brand}</span>,
    },
    {
      key: "supplier",
      header: "Proveedor",
      hideOnMobile: true,
      sortable: true,
      sortValue: (p) => p.supplierName,
      render: (p) =>
        p.supplierName ? (
          <Link
            to={supplierPath(p.supplierName)}
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
      header: "Venta 30d",
      align: "right",
      sortable: true,
      sortValue: (p) => p.salesLast30Days,
      render: (p) => (
        <span className="font-semibold text-slate-900">{formatNumber(p.salesLast30Days)}</span>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (p) => p.availableStock,
      render: (p) => (
        <span className={p.availableStock <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>
          {formatNumber(p.availableStock)}
        </span>
      ),
    },
    {
      key: "coverage",
      header: "Cobertura",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (p) => coverageDays(p.availableStock, p.salesLast30Days),
      render: (p) => {
        const c = coverageDays(p.availableStock, p.salesLast30Days);
        return (
          <span className="text-slate-700">{c >= 999 ? "+999 d" : `${formatNumber(c)} d`}</span>
        );
      },
    },
    {
      key: "margin",
      header: "Margen %",
      align: "right",
      sortable: true,
      sortValue: (p) => p.margin,
      render: (p) => (
        <span
          className={p.margin < LOW_MARGIN_PCT ? "text-amber-600 font-medium" : "text-slate-700"}
        >
          {formatPercent(p.margin)}
        </span>
      ),
    },
    {
      key: "rotation",
      header: "Rotación",
      sortable: true,
      sortValue: (p) => p.rotation,
      render: (p) => <Badge tone={rotationTone(p.rotation)}>{rotationLabel(p.rotation)}</Badge>,
    },
  ];

  const aggregateColumns = (entityLabel: string): Column<AggregateRow>[] => [
    {
      key: "name",
      header: entityLabel,
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) =>
        entityLabel === "Proveedor" && r.name !== "Sin asignar" ? (
          <Link
            to={supplierPath(r.name)}
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
      key: "sales30",
      header: "Venta 30d",
      align: "right",
      sortable: true,
      sortValue: (r) => r.sales30,
      render: (r) => (
        <span className="font-semibold text-slate-900">{formatCurrency(r.sales30)}</span>
      ),
    },
    {
      key: "avgMargin",
      header: "Margen prom. %",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.avgMargin,
      render: (r) => (
        <span
          className={r.avgMargin < LOW_MARGIN_PCT ? "text-amber-600 font-medium" : "text-slate-700"}
        >
          {formatPercent(r.avgMargin)}
        </span>
      ),
    },
    {
      key: "stockValue",
      header: "Valor stock",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.stockValue,
      render: (r) => <span className="text-slate-700">{formatCurrency(r.stockValue)}</span>,
    },
  ];

  const liquidationColumns: Column<LiquidationCandidate>[] = [
    {
      key: "product",
      header: "Producto",
      render: (c) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-slate-800 leading-snug">{c.product.name}</p>
          <p className="text-xs font-mono text-slate-400">
            {c.product.sku} · {c.product.category}
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

  const scopeLabel = role === "lider" ? "Todo el catálogo" : "Tus categorías";

  return (
    <div>
      <PageHeader
        title="Ranking & liquidación"
        description={`Comprar bien: top productos, proveedores y marcas, y qué liquidar o descontinuar. Alcance: ${scopeLabel.toLowerCase()}.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="SKUs en alcance"
          value={formatNumber(scoped.length)}
          tone="info"
          icon={<IconProducts className="w-4 h-4" />}
          description={scopeLabel}
        />
        <KpiCard
          title="Venta 30d"
          value={formatCurrencyCompact(totalSales30)}
          tone="good"
          icon={<IconSales className="w-4 h-4" />}
          description="Suma del alcance"
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
            summary={`Top ${Math.min(filteredProducts.length, TOP_LIMIT)} de ${filteredProducts.length} productos por venta 30d`}
            onClear={clearFilters}
            selects={[
              {
                key: "cat",
                placeholder: "Categoría",
                value: category,
                onChange: setCategory,
                options: uniqueValues(scoped, (p) => p.category).map((c) => ({
                  value: c,
                  label: c,
                })),
              },
              {
                key: "brand",
                placeholder: "Marca",
                value: brand,
                onChange: setBrand,
                options: uniqueValues(scoped, (p) => p.brand).map((c) => ({ value: c, label: c })),
              },
              {
                key: "prov",
                placeholder: "Proveedor",
                value: supplier,
                onChange: setSupplier,
                options: uniqueValues(
                  scoped.filter((p) => p.supplierName),
                  (p) => p.supplierName
                ).map((c) => ({ value: c, label: c })),
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
              onSortChange={toggleSort(setProductSort)}
              onRowClick={(p) => navigate(productPath(p.sku))}
              mobileCard={(p) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 leading-snug truncate">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {p.category} · {p.brand}
                      </p>
                    </div>
                    <Badge tone={rotationTone(p.rotation)}>{rotationLabel(p.rotation)}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Venta 30d</p>
                      <p className="font-semibold text-slate-900">
                        {formatNumber(p.salesLast30Days)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Stock</p>
                      <p className="text-slate-700">{formatNumber(p.availableStock)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Margen</p>
                      <p
                        className={
                          p.margin < LOW_MARGIN_PCT
                            ? "text-amber-600 font-medium"
                            : "text-slate-700"
                        }
                      >
                        {formatPercent(p.margin)}
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
            description="Agregado del alcance, ordenado por venta de 30 días."
          />
          <DataTable
            columns={aggregateColumns("Proveedor")}
            data={supplierRows}
            rowKey={(r) => r.key}
            sort={supplierSort}
            onSortChange={toggleSort(setSupplierSort)}
            onRowClick={(r) => r.name !== "Sin asignar" && navigate(supplierPath(r.name))}
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatNumber(r.skuCount)} SKUs · margen {formatPercent(r.avgMargin)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                  {formatCurrencyCompact(r.sales30)}
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
            description="Agregado del alcance, ordenado por venta de 30 días."
          />
          <DataTable
            columns={aggregateColumns("Marca")}
            data={brandRows}
            rowKey={(r) => r.key}
            sort={brandSort}
            onSortChange={toggleSort(setBrandSort)}
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{r.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatNumber(r.skuCount)} SKUs · margen {formatPercent(r.avgMargin)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                  {formatCurrencyCompact(r.sales30)}
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
            venta). Están ordenados por severidad: primero lo que más capital detiene o peor margen
            deja.
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
              rowKey={(c) => c.product.sku}
              onRowClick={(c) => navigate(productPath(c.product.sku))}
              emptyMessage="No hay productos para liquidar o descontinuar en tu alcance."
              mobileCard={(c) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{c.product.name}</p>
                      <p className="text-xs text-slate-500">
                        {c.product.sku} · {c.product.category}
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

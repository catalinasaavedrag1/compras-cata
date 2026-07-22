import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { EmptyState } from "../components/ui/EmptyState";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import { useProductsCatalog, type ProductCatalogRow } from "../hooks/useProductsCatalog";
import { categoryPath, productPath } from "../utils/entityLinks";
import {
  CATEGORY_ROLE_META,
  PRIVATE_LABEL_BRANDS,
  type CategoryRole,
} from "../utils/assortment";
import { formatNumber, formatPercent } from "../utils/formatters";
import { IconCategories, IconProducts, IconSuppliers, IconBulb } from "../components/ui/icons";

// ============================================================================
//  Surtido — conectado al motor de compras (useProductsCatalog).
//  ---------------------------------------------------------------------------
//  REAL: rol de categoría (relativo, sobre venta en unidades, margen y nº de
//  SKUs reales), penetración de marca propia (por marca conocida, con venta en
//  UNIDADES y margen reales) y candidatos a salida (sin rotación con stock).
//  DEGRADA (sin fuente real): surtido por tienda/cluster (no hay stock por
//  ubicación), altas/NPI (no hay marca de "producto nuevo") y todo cálculo de
//  venta en $. Antes venía de un mock de productos + utils/assortment.
// ============================================================================

const TABS = [
  { value: "rol", label: "Rol de categoría" },
  { value: "marca-propia", label: "Marca propia" },
  { value: "line-review", label: "Altas y salidas" },
  { value: "tiendas", label: "Surtido por tienda" },
];

interface CatAgg {
  id: string | null;
  name: string;
  units30: number;
  skuCount: number;
  avgMargin: number | null;
}

function isPrivateBrand(row: ProductCatalogRow): boolean {
  return !!row.brand && PRIVATE_LABEL_BRANDS.has(row.brand);
}

/** Margen ponderado por unidades sobre las filas con margen. null si no hay. */
function weightedMargin(items: ProductCatalogRow[]): number | null {
  const withMargin = items.filter((p) => p.marginPct !== null);
  if (withMargin.length === 0) return null;
  const units = withMargin.reduce((a, p) => a + (p.sales30Units ?? 0), 0);
  if (units <= 0)
    return withMargin.reduce((a, p) => a + (p.marginPct ?? 0), 0) / withMargin.length;
  return withMargin.reduce((a, p) => a + (p.marginPct ?? 0) * (p.sales30Units ?? 0), 0) / units;
}

export function AssortmentPage() {
  const [tab, setTab] = useState("rol");
  const { scope, setScope } = useCategoryScope();
  const { rows, meta, loading, error, configured, refetch } = useProductsCatalog();

  const pageTitle = "Surtido";
  const pageDescription =
    "Decide qué surtido llevar, no solo cuánto reponer: rol de cada categoría, marca propia y qué productos salen.";

  if (!configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              analizar el surtido con el catálogo real del motor.
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
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando surtido">
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
            <p className="text-sm font-semibold text-slate-800">No se pudo cargar el surtido</p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={<ScopeToggle scope={scope} onChange={setScope} />}
      />

      <div className="mb-4">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "rol" && <RoleTab rows={rows} />}
      {tab === "marca-propia" && <PrivateLabelTab rows={rows} />}
      {tab === "line-review" && <LineReviewTab rows={rows} />}
      {tab === "tiendas" && <StoresTab />}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Rol de categoría (relativo, sobre datos reales del motor).
// ----------------------------------------------------------------------------

function aggregateCategories(rows: ProductCatalogRow[]): CatAgg[] {
  const map = new Map<string, { id: string | null; units30: number; skuCount: number; mSum: number; mCount: number }>();
  for (const p of rows) {
    const name = p.categoryName ?? "Sin categoría";
    const cur = map.get(name) ?? { id: p.categoryId, units30: 0, skuCount: 0, mSum: 0, mCount: 0 };
    cur.units30 += p.sales30Units ?? 0;
    cur.skuCount += 1;
    if (p.marginPct !== null) {
      cur.mSum += p.marginPct;
      cur.mCount += 1;
    }
    map.set(name, cur);
  }
  return Array.from(map.entries()).map(([name, v]) => ({
    id: v.id,
    name,
    units30: v.units30,
    skuCount: v.skuCount,
    avgMargin: v.mCount ? v.mSum / v.mCount : null,
  }));
}

/** Clasificación relativa: tráfico (mayor venta), margen, nicho, conveniencia. */
function classifyRoles(cats: CatAgg[]): Map<string, CategoryRole> {
  const roles = new Map<string, CategoryRole>();
  if (cats.length === 0) return roles;

  const bySales = [...cats].sort((a, b) => b.units30 - a.units30);
  const trafficCut = Math.max(1, Math.ceil(cats.length * 0.3));
  const trafficNames = new Set(bySales.slice(0, trafficCut).map((c) => c.name));

  const margins = cats.map((c) => c.avgMargin ?? 0).sort((a, b) => b - a);
  const medianMargin = margins[Math.floor(margins.length / 2)];
  const skus = [...cats].map((c) => c.skuCount).sort((a, b) => a - b);
  const medianSkus = skus[Math.floor(skus.length / 2)];

  for (const c of cats) {
    if (trafficNames.has(c.name)) roles.set(c.name, "trafico");
    else if ((c.avgMargin ?? 0) >= medianMargin) roles.set(c.name, "margen");
    else if (c.skuCount >= medianSkus) roles.set(c.name, "nicho");
    else roles.set(c.name, "conveniencia");
  }
  return roles;
}

function RoleTab({ rows }: { rows: ProductCatalogRow[] }) {
  const cats = useMemo(() => aggregateCategories(rows), [rows]);
  const roles = useMemo(() => classifyRoles(cats), [cats]);
  const withRole = cats
    .map((c) => ({ c, role: roles.get(c.name) ?? "conveniencia" }))
    .sort((a, b) => b.c.units30 - a.c.units30);

  const counts = useMemo(() => {
    const acc: Record<CategoryRole, number> = { trafico: 0, margen: 0, nicho: 0, conveniencia: 0 };
    withRole.forEach(({ role }) => (acc[role] += 1));
    return acc;
  }, [withRole]);

  const columns: Column<{ c: CatAgg; role: CategoryRole }>[] = [
    {
      key: "cat",
      header: "Categoría",
      render: ({ c }) => (
        <Link
          to={categoryPath(c.id ?? c.name)}
          className="font-medium text-slate-800 hover:text-brand-700"
        >
          {c.name}
        </Link>
      ),
    },
    {
      key: "role",
      header: "Rol sugerido",
      render: ({ role }) => (
        <Badge tone={CATEGORY_ROLE_META[role].tone}>{CATEGORY_ROLE_META[role].label}</Badge>
      ),
    },
    {
      key: "focus",
      header: "Foco",
      hideOnMobile: true,
      render: ({ role }) => (
        <span className="text-xs text-slate-500">{CATEGORY_ROLE_META[role].description}</span>
      ),
    },
    {
      key: "sales",
      header: "Venta 30d (u.)",
      align: "right",
      render: ({ c }) => formatNumber(c.units30),
    },
    {
      key: "margin",
      header: "Margen",
      align: "right",
      hideOnMobile: true,
      render: ({ c }) => (c.avgMargin === null ? "—" : formatPercent(c.avgMargin)),
    },
    {
      key: "skus",
      header: "SKUs",
      align: "right",
      hideOnMobile: true,
      render: ({ c }) => formatNumber(c.skuCount),
    },
  ];

  return (
    <div>
      <HelpNote className="mb-4">
        El <b>rol</b> orienta la estrategia de surtido de cada categoría: las de <b>tráfico</b> traen
        visitas (no pueden quebrar), las de <b>margen</b> aportan rentabilidad, las de <b>nicho</b>{" "}
        profundizan donde eres especialista y las de <b>conveniencia</b> completan la compra. Se
        sugiere de forma relativa a tu cartera con venta en <b>unidades</b> y margen reales; ajústalo
        con criterio comercial.
      </HelpNote>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {(Object.keys(CATEGORY_ROLE_META) as CategoryRole[]).map((role) => (
          <KpiCard
            key={role}
            title={CATEGORY_ROLE_META[role].label}
            value={formatNumber(counts[role])}
            tone="neutral"
            icon={<IconCategories className="w-4 h-4" />}
            description="categorías"
          />
        ))}
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={withRole}
          rowKey={({ c }) => c.name}
          emptyMessage="No hay categorías en tu alcance."
        />
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Marca propia (por marca conocida; mixes en unidades reales).
// ----------------------------------------------------------------------------

interface PrivateLabelRow {
  category: string;
  categoryId: string | null;
  skus: number;
  privateSkus: number;
  skuMixPct: number;
  units: number;
  privateUnits: number;
  unitsMixPct: number;
  privateMarginPct: number | null;
  nationalMarginPct: number | null;
}

function MixBar({ pct }: { pct: number }) {
  const p = Math.min(100, Math.round(pct));
  return (
    <div className="min-w-[110px]">
      <div className="mb-1 text-xs font-medium text-slate-600">{formatPercent(pct, 0)}</div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-violet-500" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function PrivateLabelTab({ rows }: { rows: ProductCatalogRow[] }) {
  const data = useMemo<PrivateLabelRow[]>(() => {
    const byCat = new Map<string, ProductCatalogRow[]>();
    for (const p of rows) {
      const name = p.categoryName ?? "Sin categoría";
      const arr = byCat.get(name) ?? [];
      arr.push(p);
      byCat.set(name, arr);
    }
    const out: PrivateLabelRow[] = [];
    for (const [category, items] of byCat) {
      const priv = items.filter(isPrivateBrand);
      const nat = items.filter((p) => !isPrivateBrand(p));
      const units = items.reduce((a, p) => a + (p.sales30Units ?? 0), 0);
      const privateUnits = priv.reduce((a, p) => a + (p.sales30Units ?? 0), 0);
      out.push({
        category,
        categoryId: items[0].categoryId,
        skus: items.length,
        privateSkus: priv.length,
        skuMixPct: items.length ? (priv.length / items.length) * 100 : 0,
        units,
        privateUnits,
        unitsMixPct: units > 0 ? (privateUnits / units) * 100 : 0,
        privateMarginPct: weightedMargin(priv),
        nationalMarginPct: weightedMargin(nat),
      });
    }
    return out.sort((a, b) => b.units - a.units);
  }, [rows]);

  const totals = useMemo(() => {
    const skus = data.reduce((a, r) => a + r.skus, 0);
    const privateSkus = data.reduce((a, r) => a + r.privateSkus, 0);
    const units = data.reduce((a, r) => a + r.units, 0);
    const privateUnits = data.reduce((a, r) => a + r.privateUnits, 0);
    return {
      skuMix: skus ? (privateSkus / skus) * 100 : 0,
      unitsMix: units ? (privateUnits / units) * 100 : 0,
      privateSkus,
      privateUnits,
    };
  }, [data]);

  const columns: Column<PrivateLabelRow>[] = [
    {
      key: "cat",
      header: "Categoría",
      render: (r) => (
        <Link
          to={categoryPath(r.categoryId ?? r.category)}
          className="font-medium text-slate-800 hover:text-brand-700"
        >
          {r.category}
        </Link>
      ),
    },
    {
      key: "sku",
      header: "SKU propia / total",
      align: "right",
      render: (r) => (
        <span className="text-slate-700">
          {formatNumber(r.privateSkus)} / {formatNumber(r.skus)}
        </span>
      ),
    },
    {
      key: "skuMix",
      header: "Mix surtido",
      render: (r) => <MixBar pct={r.skuMixPct} />,
    },
    {
      key: "unitsMix",
      header: "Mix venta (u.)",
      align: "right",
      hideOnMobile: true,
      render: (r) => formatPercent(r.unitsMixPct, 0),
    },
    {
      key: "margin",
      header: "Margen propia / nacional",
      align: "right",
      hideOnMobile: true,
      render: (r) => (
        <span className="text-sm">
          <b
            className={
              r.privateMarginPct !== null &&
              r.nationalMarginPct !== null &&
              r.privateMarginPct >= r.nationalMarginPct
                ? "text-emerald-600"
                : "text-slate-700"
            }
          >
            {r.privateMarginPct === null ? "—" : formatPercent(r.privateMarginPct, 0)}
          </b>{" "}
          <span className="text-slate-400">
            / {r.nationalMarginPct === null ? "—" : formatPercent(r.nationalMarginPct, 0)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <div>
      <HelpNote className="mb-4">
        La <b>marca propia</b> suele dar más margen y fidelidad. Aquí ves su penetración por categoría
        (mix de surtido y de venta en <b>unidades</b>) y cómo se compara su margen con la marca
        nacional. La marca propia se identifica por marca conocida; el mix de venta usa unidades (no
        hay venta en $).
      </HelpNote>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Mix surtido propio"
          value={formatPercent(totals.skuMix, 0)}
          tone="info"
          icon={<IconProducts className="w-4 h-4" />}
          description={`${formatNumber(totals.privateSkus)} SKU propios`}
        />
        <KpiCard
          title="Mix venta propia (u.)"
          value={formatPercent(totals.unitsMix, 0)}
          tone="neutral"
          icon={<IconSuppliers className="w-4 h-4" />}
          description="de las unidades vendidas"
        />
        <KpiCard
          title="Venta marca propia (u.)"
          value={formatNumber(totals.privateUnits)}
          tone="good"
          icon={<IconBulb className="w-4 h-4" />}
          description="unidades 30 días"
        />
        <KpiCard
          title="Categorías"
          value={formatNumber(data.length)}
          tone="neutral"
          icon={<IconCategories className="w-4 h-4" />}
          description="en tu alcance"
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={data}
          rowKey={(r) => r.category}
          emptyMessage="No hay productos en tu alcance."
        />
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Altas y salidas (line review).
// ----------------------------------------------------------------------------

function LineReviewTab({ rows }: { rows: ProductCatalogRow[] }) {
  const salidas = useMemo(
    () =>
      rows
        .filter((p) => p.sales30Units === 0 && (p.stockAvailable ?? 0) > 0)
        .sort((a, b) => (b.stockAvailable ?? 0) - (a.stockAvailable ?? 0)),
    [rows]
  );

  const columns: Column<ProductCatalogRow>[] = [
    {
      key: "product",
      header: "Producto",
      render: (p) => (
        <div className="min-w-[180px]">
          <Link to={productPath(p.sku)} className="font-medium text-slate-800 hover:text-brand-700">
            {p.name}
          </Link>
          <p className="text-xs text-slate-400">
            {p.sku}
            {p.categoryName ? ` · ${p.categoryName}` : ""}
            {p.brand ? ` · ${p.brand}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "sales",
      header: "Venta 30d (u.)",
      align: "right",
      render: (p) => (p.sales30Units === null ? "—" : `${formatNumber(p.sales30Units)} u.`),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      hideOnMobile: true,
      render: (p) => (p.stockAvailable === null ? "—" : formatNumber(p.stockAvailable)),
    },
    {
      key: "margin",
      header: "Margen",
      align: "right",
      hideOnMobile: true,
      render: (p) => (p.marginPct === null ? "—" : formatPercent(p.marginPct, 0)),
    },
  ];

  return (
    <div className="space-y-5">
      <HelpNote className="mb-1">
        El <b>line review</b> revisa qué entra y qué sale del surtido. Las <b>altas (NPI)</b>{" "}
        requieren una marca de "producto nuevo" que el motor no entrega; abajo se listan los{" "}
        <b>candidatos a salida</b> reales: SKUs <b>sin rotación</b> (0 ventas en 30 días) con stock
        disponible, para liquidar y liberar espacio.
      </HelpNote>

      <Card>
        <CardBody>
          <EmptyState
            icon={<IconProducts className="w-6 h-6" />}
            title="Altas / NPI no disponibles"
            description="Disponible cuando exista la marca de producto nuevo en la fuente. El motor no distingue hoy los SKUs recién incorporados al surtido."
          />
        </CardBody>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Candidatos a salida</p>
            <p className="text-xs text-slate-500">
              Sin rotación (0 ventas 30d) con stock: liquida y libera espacio.
            </p>
          </div>
          <Badge tone={salidas.length ? "amber" : "green"}>{salidas.length}</Badge>
        </div>
        <DataTable
          columns={columns}
          data={salidas}
          rowKey={(p) => p.sku}
          emptyMessage="Sin candidatos a salida en tu alcance. Surtido sano."
        />
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Surtido por tienda / cluster — sin fuente real (stock por ubicación).
// ----------------------------------------------------------------------------

function StoresTab() {
  return (
    <div>
      <HelpNote className="mb-4">
        El surtido por <b>tienda/cluster</b> y sus <b>brechas</b> exigen el stock por ubicación de
        cada SKU, que el motor de compras no entrega hoy.
      </HelpNote>
      <Card>
        <CardBody>
          <EmptyState
            icon={<IconCategories className="w-6 h-6" />}
            title="Sin stock por ubicación"
            description="Disponible cuando exista la fuente de stock por tienda/bodega. Con ella se podrán detectar SKUs vendedores ausentes en un cluster (brechas de surtido localizado)."
          />
        </CardBody>
      </Card>
    </div>
  );
}

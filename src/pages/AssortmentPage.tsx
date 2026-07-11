import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import { categoryPath, productPath } from "../utils/entityLinks";
import { categories as allCategories } from "../data/mockCategories";
import { products as allProducts } from "../data/mockProducts";
import {
  CATEGORY_ROLE_META,
  classifyCategoryRoles,
  privateLabelByCategory,
  assortmentByCluster,
  newProducts,
  exitCandidates,
  type CategoryRole,
  type PrivateLabelRow,
  type AssortmentChange,
} from "../utils/assortment";
import { formatCurrencyCompact, formatNumber, formatPercent } from "../utils/formatters";
import { IconCategories, IconProducts, IconSuppliers, IconBulb } from "../components/ui/icons";
import type { Category, Product } from "../types/purchasing";

const TABS = [
  { value: "rol", label: "Rol de categoría" },
  { value: "tiendas", label: "Surtido por tienda" },
  { value: "marca-propia", label: "Marca propia" },
  { value: "line-review", label: "Altas y salidas" },
];

export function AssortmentPage() {
  const [tab, setTab] = useState("rol");
  const { scope, setScope, inScope, myCategories } = useCategoryScope();

  const categories = useMemo(() => allCategories.filter((c) => inScope(c.name)), [inScope]);
  const products = useMemo(() => allProducts.filter((p) => inScope(p.category)), [inScope]);

  return (
    <div>
      <PageHeader
        title="Surtido"
        description="Decide qué surtido llevar, no solo cuánto reponer: rol de cada categoría, surtido por tienda, marca propia y qué productos entran o salen."
        action={<ScopeToggle scope={scope} onChange={setScope} myCount={myCategories.length} />}
      />

      <div className="mb-4">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "rol" && <RoleTab categories={categories} />}
      {tab === "tiendas" && <StoresTab products={products} />}
      {tab === "marca-propia" && <PrivateLabelTab products={products} />}
      {tab === "line-review" && <LineReviewTab products={products} />}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Rol de categoría
// ----------------------------------------------------------------------------

function RoleTab({ categories }: { categories: Category[] }) {
  const roles = useMemo(() => classifyCategoryRoles(categories), [categories]);
  const withRole = categories.map((c) => ({ c, role: roles.get(c.id) ?? "nicho" }));

  const counts = useMemo(() => {
    const acc: Record<CategoryRole, number> = { trafico: 0, margen: 0, nicho: 0, conveniencia: 0 };
    withRole.forEach(({ role }) => (acc[role] += 1));
    return acc;
  }, [withRole]);

  const columns: Column<{ c: Category; role: CategoryRole }>[] = [
    {
      key: "cat",
      header: "Categoría",
      render: ({ c }) => (
        <Link to={categoryPath(c.name)} className="font-medium text-slate-800 hover:text-brand-700">
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
      header: "Venta 30d",
      align: "right",
      render: ({ c }) => formatCurrencyCompact(c.salesLast30Days),
    },
    {
      key: "margin",
      header: "Margen",
      align: "right",
      hideOnMobile: true,
      render: ({ c }) => formatPercent(c.averageMargin),
    },
    {
      key: "skus",
      header: "SKUs",
      align: "right",
      hideOnMobile: true,
      render: ({ c }) => formatNumber(c.activeSkus),
    },
  ];

  return (
    <div>
      <HelpNote className="mb-4">
        El <b>rol</b> orienta la estrategia de surtido de cada categoría: las de <b>tráfico</b>{" "}
        traen visitas (no pueden quebrar), las de <b>margen</b> aportan rentabilidad, las de{" "}
        <b>nicho</b> profundizan donde eres especialista y las de <b>conveniencia</b> completan la
        compra sin sobreinvertir. Se sugiere de forma relativa a tu cartera; ajústalo con criterio
        comercial.
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
          rowKey={({ c }) => c.id}
          emptyMessage="No hay categorías en tu alcance."
        />
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Surtido por tienda / cluster
// ----------------------------------------------------------------------------

function StoresTab({ products }: { products: Product[] }) {
  const clusters = useMemo(() => assortmentByCluster(products), [products]);
  const totalGaps = clusters.reduce((a, c) => a + c.brechas, 0);

  return (
    <div>
      <HelpNote className="mb-4">
        No todas las tiendas necesitan el mismo surtido. Aquí ves, por <b>cluster</b>, cuántos SKU
        están presentes y qué productos que <b>sí venden</b> a nivel nacional <b>faltan</b> ahí
        (brecha de surtido o quiebre local). Prioriza cerrar las brechas de mayor venta.
      </HelpNote>

      {totalGaps === 0 ? (
        <Card>
          <CardBody className="text-center text-sm text-slate-500">
            Sin brechas de surtido detectadas en tu alcance: los SKU vendedores tienen presencia en
            todos los clusters.
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {clusters.map((cl) => (
            <Card key={cl.cluster}>
              <CardHeader
                title={cl.cluster}
                description={`${formatNumber(cl.presentes)} SKU presentes · ${formatNumber(cl.brechas)} brechas`}
                action={
                  cl.brechas > 0 ? (
                    <Badge tone="amber">{cl.brechas} brechas</Badge>
                  ) : (
                    <Badge tone="green">Cubierto</Badge>
                  )
                }
              />
              <CardBody>
                {cl.brechaSkus.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin brechas relevantes.</p>
                ) : (
                  <ul className="divide-y divide-slate-50">
                    {cl.brechaSkus.map((s) => (
                      <li key={s.sku} className="flex items-center justify-between gap-2 py-1.5">
                        <Link
                          to={productPath(s.sku)}
                          className="min-w-0 text-sm text-slate-700 hover:text-brand-700 truncate"
                        >
                          {s.name}
                        </Link>
                        <span className="flex-shrink-0 text-xs text-slate-400">
                          {formatNumber(s.sales30)} u./mes
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Marca propia
// ----------------------------------------------------------------------------

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

function PrivateLabelTab({ products }: { products: Product[] }) {
  const rows = useMemo(() => privateLabelByCategory(products), [products]);

  const totals = useMemo(() => {
    const skus = rows.reduce((a, r) => a + r.skus, 0);
    const privateSkus = rows.reduce((a, r) => a + r.privateSkus, 0);
    const sales = rows.reduce((a, r) => a + r.sales, 0);
    const privateSales = rows.reduce((a, r) => a + r.privateSales, 0);
    return {
      skuMix: skus ? (privateSkus / skus) * 100 : 0,
      salesMix: sales ? (privateSales / sales) * 100 : 0,
      privateSkus,
      privateSales,
    };
  }, [rows]);

  const columns: Column<PrivateLabelRow>[] = [
    {
      key: "cat",
      header: "Categoría",
      render: (r) => (
        <Link
          to={categoryPath(r.category)}
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
      key: "salesMix",
      header: "Mix venta",
      align: "right",
      hideOnMobile: true,
      render: (r) => formatPercent(r.salesMixPct, 0),
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
              r.privateMarginPct >= r.nationalMarginPct ? "text-emerald-600" : "text-slate-700"
            }
          >
            {r.privateSkus > 0 ? formatPercent(r.privateMarginPct, 0) : "—"}
          </b>{" "}
          <span className="text-slate-400">/ {formatPercent(r.nationalMarginPct, 0)}</span>
        </span>
      ),
    },
  ];

  return (
    <div>
      <HelpNote className="mb-4">
        La <b>marca propia</b> suele dar más margen y fidelidad. Aquí ves su penetración por
        categoría (mix de surtido y de venta) y cómo se compara su margen con la marca nacional.
        Donde el margen propio es mayor y el mix bajo, hay espacio para crecer.
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
          title="Mix venta propia"
          value={formatPercent(totals.salesMix, 0)}
          tone="neutral"
          icon={<IconSuppliers className="w-4 h-4" />}
          description="de la venta total"
        />
        <KpiCard
          title="Venta marca propia"
          value={formatCurrencyCompact(totals.privateSales)}
          tone="good"
          icon={<IconBulb className="w-4 h-4" />}
          description="últimos 30 días"
        />
        <KpiCard
          title="Categorías"
          value={formatNumber(rows.length)}
          tone="neutral"
          icon={<IconCategories className="w-4 h-4" />}
          description="en tu alcance"
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.category}
          emptyMessage="No hay productos en tu alcance."
        />
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Line review: altas (NPI) y candidatos a salida
// ----------------------------------------------------------------------------

function ChangeTable({ data, emptyMessage }: { data: AssortmentChange[]; emptyMessage: string }) {
  const columns: Column<AssortmentChange>[] = [
    {
      key: "product",
      header: "Producto",
      render: (p) => (
        <div className="min-w-[180px]">
          <Link to={productPath(p.sku)} className="font-medium text-slate-800 hover:text-brand-700">
            {p.name}
          </Link>
          <p className="text-xs text-slate-400">
            {p.sku} · {p.category} · {p.brand}
          </p>
        </div>
      ),
    },
    {
      key: "sales",
      header: "Venta 30d",
      align: "right",
      render: (p) => `${formatNumber(p.sales30)} u.`,
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      hideOnMobile: true,
      render: (p) => formatNumber(p.availableStock),
    },
    {
      key: "margin",
      header: "Margen",
      align: "right",
      hideOnMobile: true,
      render: (p) => formatPercent(p.margin, 0),
    },
    {
      key: "reason",
      header: "Recomendación",
      render: (p) => <span className="text-xs text-slate-500">{p.reason}</span>,
    },
  ];
  return (
    <DataTable columns={columns} data={data} rowKey={(p) => p.sku} emptyMessage={emptyMessage} />
  );
}

function LineReviewTab({ products }: { products: Product[] }) {
  const altas = useMemo(() => newProducts(products), [products]);
  const salidas = useMemo(() => exitCandidates(products), [products]);

  return (
    <div className="space-y-5">
      <HelpNote className="mb-1">
        El <b>line review</b> es la revisión periódica de qué entra y qué sale del surtido. A la
        izquierda, las <b>altas</b> nuevas por validar (rotación y espacio); abajo, los{" "}
        <b>candidatos a salida</b> (sin venta, descontinuados o marcados no comprar) para liquidar y
        liberar espacio.
      </HelpNote>

      <Card>
        <CardHeader
          title="Altas por evaluar (NPI)"
          description="Productos nuevos: confirma rotación antes de comprometer más compra y espacio"
          action={<Badge tone="blue">{altas.length}</Badge>}
        />
        <ChangeTable
          data={altas}
          emptyMessage="No hay productos nuevos por evaluar en tu alcance."
        />
      </Card>

      <Card>
        <CardHeader
          title="Candidatos a salida (line review)"
          description="Sin venta, descontinuados o marcados no comprar: liquida y libera espacio"
          action={
            <Link
              to="/surtido-redundante"
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Ver surtido redundante →
            </Link>
          }
        />
        <ChangeTable
          data={salidas}
          emptyMessage="Sin candidatos a salida en tu alcance. Surtido sano."
        />
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Tabs } from "../components/ui/Tabs";
import { BarList } from "../components/business/BarList";
import { DataTable, type Column } from "../components/ui/Table";
import { StatusBadge } from "../components/business/StatusBadge";
import { Badge } from "../components/ui/Badge";
import {
  inventoryKpis,
  inventoryByCategory,
  inventoryByWarehouse,
  inventoryByRotation,
} from "../data/mockInventory";
import { products } from "../data/mockProducts";
import { frozenCapital } from "../utils/calculations";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../utils/formatters";
import { IconInventory, IconBox, IconAlerts } from "../components/ui/icons";
import type { Product } from "../types/purchasing";

const GROUP_TABS = [
  { value: "category", label: "Por categoría" },
  { value: "warehouse", label: "Por tienda/bodega" },
  { value: "rotation", label: "Por rotación" },
];

export function InventoryAnalysisPage() {
  const navigate = useNavigate();
  const [group, setGroup] = useState("category");

  const groupData =
    group === "warehouse"
      ? inventoryByWarehouse
      : group === "rotation"
        ? inventoryByRotation
        : inventoryByCategory;

  // Productos con más capital inmovilizado (stock disponible * costo)
  const frozen = [...products]
    .map((p) => ({ p, frozen: p.availableStock * p.cost }))
    .sort((a, b) => b.frozen - a.frozen)
    .slice(0, 6);

  const overstock = products.filter((p) => p.purchaseStatus === "overstock");
  const noSales90 = products.filter((p) => p.salesLast90Days <= 6);
  const criticalStock = products.filter((p) => p.availableStock <= 0 && p.salesLast30Days > 0);

  const frozenColumns: Column<Product>[] = [
    {
      key: "product",
      header: "Producto",
      render: (p) => (
        <Link to={`/productos/${p.sku}`} className="block hover:text-brand-700">
          <span className="text-xs font-mono text-slate-400">{p.sku}</span>
          <p className="font-medium text-slate-800">{p.name}</p>
        </Link>
      ),
    },
    {
      key: "stock",
      header: "Stock disp.",
      align: "right",
      render: (p) => formatNumber(p.availableStock),
    },
    {
      key: "sales",
      header: "Venta mes",
      align: "right",
      hideOnMobile: true,
      render: (p) => formatNumber(p.salesLast30Days),
    },
    {
      key: "days",
      header: "Días inv.",
      align: "right",
      render: (p) => formatNumber(p.inventoryDays),
    },
    {
      key: "capital",
      header: "Capital inmovilizado",
      align: "right",
      render: (p) => (
        <span className="font-semibold text-slate-900">
          {formatCurrency(p.availableStock * p.cost)}
        </span>
      ),
    },
    {
      key: "excess",
      header: "Sobre máximo",
      align: "right",
      hideOnMobile: true,
      render: (p) => {
        const fc = frozenCapital(p.availableStock, p.maxStock, p.cost);
        return fc > 0 ? (
          <span className="text-amber-600">{formatCurrency(fc)}</span>
        ) : (
          <span className="text-slate-300">—</span>
        );
      },
    },
    {
      key: "status",
      header: "Estado",
      render: (p) => <StatusBadge kind="purchase" value={p.purchaseStatus} dot={false} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Análisis de inventario"
        description="Capital inmovilizado, sobrestock, stock muerto y quiebres."
      />

      {/* 4 KPIs hero: capital y riesgo (cliqueables a su acción) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <KpiCard
          title="Inventario valorizado"
          value={formatCurrencyCompact(inventoryKpis.totalInventoryValue)}
          tone="info"
          icon={<IconInventory className="w-4 h-4" />}
          description={`${inventoryKpis.averageInventoryDays} días prom.`}
        />
        <KpiCard
          title="Sobrestock"
          value={formatCurrencyCompact(inventoryKpis.overstockValue)}
          tone="warn"
          icon={<IconBox className="w-4 h-4" />}
          description="Liberar capital"
          to="/comprar/decisiones?foco=overstock"
        />
        <KpiCard
          title="Stock muerto"
          value={formatCurrencyCompact(inventoryKpis.deadStockValue)}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Sin venta 90 días"
        />
        <KpiCard
          title="SKUs con quiebre"
          value={formatNumber(criticalStock.length)}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Ver sin stock"
          to="/productos?stock=1"
        />
      </div>

      {/* Detalle de capital en chips compactos */}
      <div className="flex flex-wrap items-center gap-2 -mx-1 px-1 mb-4 text-xs">
        <span className="whitespace-nowrap flex-shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-600">
          Disponible: <b>{formatCurrencyCompact(inventoryKpis.availableStockValue)}</b>
        </span>
        <span className="whitespace-nowrap flex-shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-600">
          Comprometido: <b>{formatCurrencyCompact(inventoryKpis.committedStockValue)}</b>
        </span>
        <span className="whitespace-nowrap flex-shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-600">
          Stock lento: <b>{formatCurrencyCompact(inventoryKpis.slowStockValue)}</b>
        </span>
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Inventario valorizado"
          description="Distribución del inventario según el corte seleccionado"
        />
        <CardBody>
          <div className="mb-4">
            <Tabs tabs={GROUP_TABS} value={group} onChange={setGroup} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-3">Inventario valorizado</p>
              <BarList
                items={groupData.map((g) => ({
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
                items={groupData.map((g) => ({
                  label: g.label,
                  value: g.overstockValue,
                  display: formatCurrencyCompact(g.overstockValue),
                  tone: "violet",
                }))}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="mb-5">
        <CardHeader
          title="Productos con más inventario inmovilizado"
          description="Capital detenido en stock. Prioridad para liberar caja."
        />
        <DataTable
          columns={frozenColumns}
          data={frozen.map((f) => f.p)}
          rowKey={(p) => p.sku}
          onRowClick={(p) => navigate(`/productos/${p.sku}`)}
          mobileCard={(p) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                  <p className="font-medium text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    Disp. {formatNumber(p.availableStock)} · {formatNumber(p.inventoryDays)} días
                    inv.
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                  {formatCurrencyCompact(p.availableStock * p.cost)}
                </span>
              </div>
            </div>
          )}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ListCard
          title="Sobrestock"
          subtitle="Stock sobre el máximo"
          products={overstock}
          tone="violet"
        />
        <ListCard
          title="Sin venta en 90 días"
          subtitle="Candidatos a stock muerto"
          products={noSales90}
          tone="amber"
        />
        <ListCard
          title="Stock crítico"
          subtitle="Quiebre con venta activa"
          products={criticalStock}
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
  products: Product[];
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
          products.map((p) => (
            <Link
              key={p.sku}
              to={`/productos/${p.sku}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-2 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                <p className="text-xs text-slate-500">
                  Disp. {formatNumber(p.availableStock)} · {formatNumber(p.inventoryDays)} días inv.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-700 flex-shrink-0">
                {formatCurrencyCompact(p.availableStock * p.cost)}
              </span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-slate-400 py-3 text-center">
            Sin productos en esta categoría.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

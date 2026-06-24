import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { BarList } from "../components/business/BarList";
import { HelpNote } from "../components/business/HelpNote";
import { DataTable, type Column } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import {
  salesKpis,
  salesByCategory,
  salesBySupplier,
  topProducts,
  growingProducts,
  decliningProducts,
  seasonalProducts,
} from "../data/mockSales";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDelta,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconSales, IconAlerts } from "../components/ui/icons";
import type { TopProduct } from "../types/purchasing";
import type { ProductTrend } from "../data/mockSales";

export function SalesAnalysisPage() {
  const topColumns: Column<TopProduct>[] = [
    {
      key: "product",
      header: "Producto",
      render: (p) => (
        <Link to={`/productos/${p.sku}`} className="block hover:text-brand-700">
          <span className="text-xs font-mono text-slate-400">{p.sku}</span>
          <p className="font-medium text-slate-800">{p.name}</p>
          <p className="text-xs text-slate-500">{p.category}</p>
        </Link>
      ),
    },
    { key: "units", header: "Unidades 30d", align: "right", render: (p) => formatNumber(p.unitsLast30Days) },
    { key: "amount", header: "Venta 30d", align: "right", render: (p) => <span className="font-medium text-slate-800">{formatCurrency(p.amountLast30Days)}</span> },
    {
      key: "growth",
      header: "Variación",
      align: "right",
      render: (p) => (
        <span className={p.growth >= 0 ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
          {formatDelta(p.growth)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Análisis de ventas"
        description="Señales de venta para comprar mejor: qué se vende más, qué crece, qué cae y cuánta venta se pierde por quiebre."
      />

      <HelpNote className="mb-4">
        Úsala para anticipar la compra: los productos en <b>crecimiento</b> pueden necesitar más stock,
        los que <b>caen</b> conviene revisarlos antes de reponer, y la <b>venta perdida por quiebre</b>
        muestra cuánto cuesta no tener stock a tiempo.
      </HelpNote>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard title="Venta 30 días" value={formatCurrencyCompact(salesKpis.salesLast30Days)} tone="good" delta={8.4} icon={<IconSales className="w-4 h-4" />} />
        <KpiCard title="Venta 90 días" value={formatCurrencyCompact(salesKpis.salesLast90Days)} tone="good" icon={<IconSales className="w-4 h-4" />} />
        <KpiCard title="Venta 180 días" value={formatCurrencyCompact(salesKpis.salesLast180Days)} tone="neutral" icon={<IconSales className="w-4 h-4" />} />
        <KpiCard title="Margen promedio" value={formatPercent(salesKpis.averageMargin)} tone="good" icon={<IconSales className="w-4 h-4" />} />
        <KpiCard title="Categoría en alza" value={salesKpis.topGrowthCategory} tone="good" icon={<IconSales className="w-4 h-4" />} description="Mayor crecimiento" />
        <KpiCard title="Producto más vendido" value={salesKpis.topProduct} tone="info" icon={<IconSales className="w-4 h-4" />} />
        <KpiCard title="Mayor caída" value={salesKpis.topDropProduct} tone="warn" icon={<IconAlerts className="w-4 h-4" />} />
        <KpiCard title="Venta perdida por quiebre" value={formatCurrencyCompact(salesKpis.lostSalesByStockout)} tone="bad" icon={<IconAlerts className="w-4 h-4" />} description="Estimada últimos 30 días" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader title="Venta por categoría" description="Últimos 30 días" />
          <CardBody>
            <BarList
              items={[...salesByCategory]
                .sort((a, b) => b.last30Days - a.last30Days)
                .map((c) => ({
                  label: c.category,
                  value: c.last30Days,
                  display: formatCurrencyCompact(c.last30Days),
                  tone: "blue",
                }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Venta por proveedor" description="Participación últimos 90 días" />
          <CardBody>
            <BarList
              items={salesBySupplier.map((s) => ({
                label: `${s.supplier} (${formatPercent(s.share, 1)})`,
                value: s.last90Days,
                display: formatCurrencyCompact(s.last90Days),
                tone: "green",
              }))}
            />
          </CardBody>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader title="Productos más vendidos" description="Top productos por venta en 30 días" />
        <DataTable columns={topColumns} data={topProducts} rowKey={(p) => p.sku} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TrendCard title="Productos con crecimiento" subtitle="Demanda al alza" trends={growingProducts} positive />
        <TrendCard title="Productos con caída" subtitle="Revisar surtido y compra" trends={decliningProducts} positive={false} />
        <TrendCard title="Productos de temporada" subtitle="Ajustar compra según estación" trends={seasonalProducts} positive={null} />
      </div>
    </div>
  );
}

function TrendCard({
  title,
  subtitle,
  trends,
  positive,
}: {
  title: string;
  subtitle: string;
  trends: ProductTrend[];
  positive: boolean | null;
}) {
  return (
    <Card>
      <CardHeader title={title} description={subtitle} />
      <CardBody className="space-y-2.5">
        {trends.map((t) => (
          <Link
            key={t.sku}
            to={`/productos/${t.sku}`}
            className="block rounded-lg border border-slate-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/40"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
              <Badge tone={positive === null ? "violet" : positive ? "green" : "red"}>
                {formatDelta(t.growth)}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">{t.note}</p>
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}

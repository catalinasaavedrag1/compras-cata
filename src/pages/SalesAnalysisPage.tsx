import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { BarList } from "../components/business/BarList";
import { HelpNote } from "../components/business/HelpNote";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { DataTable, type Column } from "../components/ui/Table";
import { IconArrowRight } from "../components/ui/icons";
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

type Period = "30" | "90" | "180";

export function SalesAnalysisPage() {
  const [period, setPeriod] = useState<Period>("30");
  const periodKey = period === "30" ? "last30Days" : period === "90" ? "last90Days" : "last180Days";

  const sortedByGrowth = [...salesByCategory].sort((a, b) => b.growth - a.growth);
  const topGrow = sortedByGrowth[0];
  const topDrop = sortedByGrowth[sortedByGrowth.length - 1];

  // Insights accionables: traducen los datos en decisiones de compra
  const insights = [
    {
      tone: "good" as const,
      title: `${topGrow.category} crece ${formatDelta(topGrow.growth)}`,
      detail: "Demanda al alza: revisa stock objetivo y adelanta compras para no quebrar.",
      to: `/reposicion?cat=${encodeURIComponent(topGrow.category)}`,
      cta: "Ver reposición de la categoría",
    },
    {
      tone: "bad" as const,
      title: `${topDrop.category} cae ${formatDelta(topDrop.growth)}`,
      detail: "Venta a la baja: evita sobrecomprar y revisa el inventario de la categoría.",
      to: `/inventario`,
      cta: "Revisar inventario",
    },
    {
      tone: "warn" as const,
      title: `Venta perdida por quiebre: ${formatCurrencyCompact(salesKpis.lostSalesByStockout)}`,
      detail: "Lo que se dejó de vender por falta de stock. Prioriza los productos críticos.",
      to: "/reposicion?foco=urgent",
      cta: "Comprar productos críticos",
    },
    {
      tone: "good" as const,
      title: `${growingProducts[0].name} +${growingProducts[0].growth}%`,
      detail: growingProducts[0].note,
      to: `/productos/${growingProducts[0].sku}`,
      cta: "Ver producto",
    },
  ];

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

      {/* Insights accionables: qué hacer con estos datos */}
      <Card className="mb-5">
        <CardHeader title="Qué significa para tus compras" description="Lecturas accionables de la venta, con su siguiente paso" />
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((i) => (
            <Link
              key={i.title}
              to={i.to}
              className="group flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span
                className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                  i.tone === "good" ? "bg-emerald-500" : i.tone === "bad" ? "bg-rose-500" : "bg-amber-500"
                }`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{i.title}</span>
                <span className="block text-xs text-slate-500 mt-0.5 leading-snug">{i.detail}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 group-hover:text-brand-700">
                  {i.cta} <IconArrowRight className="w-3.5 h-3.5" />
                </span>
              </span>
            </Link>
          ))}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader
            title="Venta por categoría"
            description="Dónde se concentra la venta en el período"
            action={
              <Tabs
                value={period}
                onChange={(v) => setPeriod(v as Period)}
                tabs={[
                  { value: "30", label: "30 días" },
                  { value: "90", label: "90 días" },
                  { value: "180", label: "180 días" },
                ]}
              />
            }
          />
          <CardBody>
            <BarList
              items={[...salesByCategory]
                .sort((a, b) => b[periodKey] - a[periodKey])
                .map((c) => ({
                  label: c.category,
                  value: c[periodKey],
                  display: formatCurrencyCompact(c[periodKey]),
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

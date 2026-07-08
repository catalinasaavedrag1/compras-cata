import { useState } from "react";
import { Link } from "react-router-dom";
import { supplierPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { BarList } from "../components/business/BarList";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import {
  salesKpis,
  salesByCategory,
  salesBySupplier,
  topProducts,
  growingProducts,
  decliningProducts,
  seasonalProducts,
} from "../data/mockSales";
import { products, getProductBySku } from "../data/mockProducts";
import { categories } from "../data/mockCategories";
import { coverageDays } from "../utils/calculations";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDelta,
  formatNumber,
  formatPercent,
  formatDays,
} from "../utils/formatters";
import { IconSales, IconAlerts, IconArrowRight } from "../components/ui/icons";

type Period = "30" | "90" | "180";

export function SalesAnalysisPage() {
  const [period, setPeriod] = useState<Period>("30");
  const [tab, setTab] = useState("resumen");
  const periodKey = period === "30" ? "last30Days" : period === "90" ? "last90Days" : "last180Days";
  const periodSales =
    period === "30"
      ? salesKpis.salesLast30Days
      : period === "90"
        ? salesKpis.salesLast90Days
        : salesKpis.salesLast180Days;

  const sortedByGrowth = [...salesByCategory].sort((a, b) => b.growth - a.growth);
  const topGrow = sortedByGrowth[0];
  const topDrop = sortedByGrowth[sortedByGrowth.length - 1];

  // Productos con venta perdida por quiebre
  const lostSalesProducts = products
    .filter((p) => p.availableStock <= 0 && p.salesLast30Days > 0)
    .map((p) => ({ p, lost: Math.round(p.salesLast30Days * p.price) }))
    .sort((a, b) => b.lost - a.lost);

  // Productos de alta venta con bajo stock
  const highSaleLowStock = topProducts.filter((tp) => {
    const p = getProductBySku(tp.sku);
    return p && coverageDays(p.availableStock, p.salesLast30Days) <= p.supplierLeadTimeDays * 1.5;
  });

  // Señales accionables
  const signals = [
    {
      tone: "good" as const,
      title: `${topGrow.category} crece ${formatDelta(topGrow.growth)}`,
      detail: "Demanda al alza. Revisa stock objetivo y adelanta compras.",
      to: `/reposicion?cat=${encodeURIComponent(topGrow.category)}`,
      cta: "Ver reposición",
    },
    {
      tone: "bad" as const,
      title: `${topDrop.category} cae ${formatDelta(topDrop.growth)}`,
      detail: "Venta a la baja. Evita sobrecomprar y revisa inventario.",
      to: "/inventario",
      cta: "Revisar inventario",
    },
    {
      tone: "warn" as const,
      title: `Venta perdida por quiebre: ${formatCurrencyCompact(salesKpis.lostSalesByStockout)}`,
      detail: "Se dejó de vender por falta de stock. Prioriza críticos.",
      to: "/reposicion?foco=urgent",
      cta: "Comprar críticos",
    },
    {
      tone: "good" as const,
      title: `${growingProducts[0].name} +${growingProducts[0].growth}%`,
      detail: growingProducts[0].note,
      to: `/productos/${growingProducts[0].sku}`,
      cta: "Ver producto",
    },
  ];

  const TABS = [
    { value: "resumen", label: "Resumen" },
    { value: "categorias", label: "Categorías", count: salesByCategory.length },
    { value: "proveedores", label: "Proveedores", count: salesBySupplier.length },
    { value: "productos", label: "Productos", count: topProducts.length },
    { value: "crecimiento", label: "Crecimiento", count: growingProducts.length },
    { value: "caida", label: "Caída", count: decliningProducts.length },
    { value: "perdida", label: "Venta perdida", count: lostSalesProducts.length },
    { value: "temporada", label: "Temporada", count: seasonalProducts.length },
  ];

  return (
    <div>
      <PageHeader
        title="Análisis de ventas"
        description="Señales de venta para comprar mejor: qué crece, qué cae y dónde se pierde venta."
        action={
          <Tabs
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            tabs={[
              { value: "30", label: "30 d" },
              { value: "90", label: "90 d" },
              { value: "180", label: "180 d" },
            ]}
          />
        }
      />

      {/* Resumen ejecutivo */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-card px-4 py-3 mb-4 text-sm text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          <b className="text-slate-900">{formatCurrency(periodSales)}</b> venta {period} días
        </span>
        {period === "30" && <span className="text-emerald-600">+8,4% vs período anterior</span>}
        <span className="text-rose-600">
          {formatCurrencyCompact(salesKpis.lostSalesByStockout)} venta perdida
        </span>
        <span className="text-slate-500">Margen {formatPercent(salesKpis.averageMargin)}</span>
      </div>

      {/* KPIs compactos y cliqueables */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Venta perdida"
          value={formatCurrencyCompact(salesKpis.lostSalesByStockout)}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Ver venta perdida"
          onClick={() => setTab("perdida")}
          active={tab === "perdida"}
        />
        <KpiCard
          title="Alta venta + bajo stock"
          value={formatNumber(highSaleLowStock.length)}
          tone="warn"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Ver productos"
          onClick={() => setTab("productos")}
          active={tab === "productos"}
        />
        <KpiCard
          title="En crecimiento"
          value={formatNumber(growingProducts.length)}
          tone="good"
          icon={<IconSales className="w-4 h-4" />}
          description="Ver crecimiento"
          onClick={() => setTab("crecimiento")}
          active={tab === "crecimiento"}
        />
        <KpiCard
          title="En caída"
          value={formatNumber(decliningProducts.length)}
          tone="warn"
          icon={<IconSales className="w-4 h-4" />}
          description="Ver caída"
          onClick={() => setTab("caida")}
          active={tab === "caida"}
        />
      </div>

      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={TABS} />

      {/* ---- Contenido por tab ---- */}
      {tab === "resumen" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader
              title="Señales para comprar mejor"
              description="Lo más relevante, con su acción"
            />
            <CardBody className="space-y-2">
              {signals.map((s) => (
                <Link
                  key={s.title}
                  to={s.to}
                  className="group flex items-start gap-3 rounded-lg border border-slate-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span
                    className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${s.tone === "good" ? "bg-emerald-500" : s.tone === "bad" ? "bg-rose-500" : "bg-amber-500"}`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">{s.title}</span>
                    <span className="block text-xs text-slate-500">{s.detail}</span>
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                      {s.cta} <IconArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </span>
                </Link>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Venta por categoría"
              description={`Últimos ${period} días`}
              action={
                <button
                  onClick={() => setTab("categorias")}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Ver todas
                </button>
              }
            />
            <CardBody>
              <BarList
                items={[...salesByCategory]
                  .sort((a, b) => b[periodKey] - a[periodKey])
                  .slice(0, 6)
                  .map((c) => ({
                    label: c.category,
                    value: c[periodKey],
                    display: formatCurrencyCompact(c[periodKey]),
                    tone: "blue",
                  }))}
              />
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "categorias" && (
        <Card>
          <CardBody className="space-y-2">
            {[...salesByCategory]
              .sort((a, b) => b[periodKey] - a[periodKey])
              .map((c) => {
                const cat = categories.find((x) => x.name === c.category);
                return (
                  <Link
                    key={c.category}
                    to={`/reposicion?cat=${encodeURIComponent(c.category)}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{c.category}</p>
                      <p className="text-xs text-slate-500">
                        {formatCurrencyCompact(c[periodKey])}
                        {cat && cat.stockoutSkus > 0 && (
                          <span className="text-rose-600"> · {cat.stockoutSkus} en quiebre</span>
                        )}
                        {cat && cat.riskSkus > 0 && (
                          <span className="text-amber-600"> · {cat.riskSkus} en riesgo</span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-medium flex-shrink-0 ${c.growth >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {formatDelta(c.growth)}
                    </span>
                  </Link>
                );
              })}
          </CardBody>
        </Card>
      )}

      {tab === "proveedores" && (
        <Card>
          <CardBody className="space-y-2">
            {salesBySupplier.map((s) => (
              <Link
                key={s.supplier}
                to={supplierPath(s.supplier)}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{s.supplier}</p>
                  <p className="text-xs text-slate-500">
                    {formatCurrencyCompact(s.last90Days)} en 90 días · {formatPercent(s.share, 1)}{" "}
                    participación
                  </p>
                </div>
                <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${s.share * 3}%` }}
                  />
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      {tab === "productos" && (
        <Card>
          <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {topProducts.map((tp) => {
              const p = getProductBySku(tp.sku);
              const cover = p ? coverageDays(p.availableStock, p.salesLast30Days) : 999;
              const risk = p && cover <= p.supplierLeadTimeDays * 1.5;
              return (
                <Link
                  key={tp.sku}
                  to={`/productos/${tp.sku}`}
                  className="rounded-lg border border-slate-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{tp.name}</p>
                    <span
                      className={`text-xs font-medium ${tp.growth >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {formatDelta(tp.growth)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatCurrency(tp.amountLast30Days)} · {formatNumber(tp.unitsLast30Days)} u.
                    {p && <> · stock {formatNumber(p.availableStock)}</>}
                  </p>
                  {risk && (
                    <Badge tone="red" dot>
                      Alta venta + bajo stock
                    </Badge>
                  )}
                </Link>
              );
            })}
          </CardBody>
        </Card>
      )}

      {tab === "crecimiento" && <TrendList trends={growingProducts} positive />}
      {tab === "caida" && <TrendList trends={decliningProducts} positive={false} />}
      {tab === "temporada" && <TrendList trends={seasonalProducts} positive={null} />}

      {tab === "perdida" && (
        <Card>
          <CardBody className="space-y-2">
            {lostSalesProducts.length === 0 ? (
              <EmptyState
                title="Sin venta perdida"
                description="No hay productos en quiebre con venta activa."
              />
            ) : (
              lostSalesProducts.map(({ p, lost }) => (
                <Link
                  key={p.sku}
                  to={`/productos/${p.sku}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2.5 hover:border-brand-300"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.category} · {p.supplierName || "Sin proveedor"} · vende{" "}
                      {formatNumber(p.salesLast30Days)} u./mes
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-rose-600">
                      {formatCurrencyCompact(lost)}
                    </p>
                    <p className="text-xs text-slate-400">venta perdida/mes</p>
                  </div>
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function TrendList({
  trends,
  positive,
}: {
  trends: typeof growingProducts;
  positive: boolean | null;
}) {
  return (
    <Card>
      <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {trends.map((t) => {
          const p = getProductBySku(t.sku);
          const cover = p ? coverageDays(p.availableStock, p.salesLast30Days) : null;
          return (
            <Link
              key={t.sku}
              to={`/productos/${t.sku}`}
              className="rounded-lg border border-slate-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                <Badge tone={positive === null ? "violet" : positive ? "green" : "red"}>
                  {formatDelta(t.growth)}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.category}
                {p && <> · stock {formatNumber(p.availableStock)}</>}
                {p && cover !== null && cover < 999 && <> · cubre {formatDays(cover)}</>}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{t.note}</p>
            </Link>
          );
        })}
      </CardBody>
    </Card>
  );
}

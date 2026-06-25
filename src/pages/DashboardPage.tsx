import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { AlertCard } from "../components/business/AlertCard";
import { BarList } from "../components/business/BarList";
import { Badge } from "../components/ui/Badge";
import { StatusBadge } from "../components/business/StatusBadge";
import { PriorityBadge } from "../components/business/PriorityBadge";
import { PriorityGuide, type GuideStep } from "../components/business/PriorityGuide";
import { Button } from "../components/ui/Button";
import {
  IconProducts,
  IconAlerts,
  IconInventory,
  IconReplenish,
  IconBox,
  IconSales,
  IconSuppliers,
  IconChevronRight,
  IconCampaign,
  IconArrowRight,
  IconCheck,
} from "../components/ui/icons";
import { products } from "../data/mockProducts";
import { recommendations } from "../data/mockRecommendations";
import { alerts } from "../data/mockAlerts";
import { categories } from "../data/mockCategories";
import { suppliers } from "../data/mockSuppliers";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { salesKpis } from "../data/mockSales";
import { inventoryKpis } from "../data/mockInventory";
import { monthlyPurchaseBudget } from "../data/mockRules";
import { campaignOpportunities } from "../data/mockCampaignOpportunities";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatNumber,
  formatPercent,
} from "../utils/formatters";

export function DashboardPage() {
  const activeSkus = products.filter((p) => p.productStatus !== "discontinued").length;
  const stockoutSkus = products.filter((p) => p.availableStock <= 0).length;
  const criticalRecs = recommendations.filter((r) => r.status === "critical");
  const buyNowRecs = recommendations.filter((r) => r.status === "buy_now");
  const overstockProducts = products.filter((p) => p.purchaseStatus === "overstock");
  const suggestedTotal = recommendations.reduce((acc, r) => acc + r.suggestedPurchaseAmount, 0);
  const openPOs = purchaseOrders.filter((o) => !["received", "cancelled"].includes(o.status)).length;
  const delayedPOs = purchaseOrders.filter((o) => o.status === "delayed");
  const lowComplianceSuppliers = suppliers.filter((s) => s.deliveryCompliance < 70 && s.status !== "inactive");
  const avgMargin = products.reduce((acc, p) => acc + p.margin, 0) / products.length;
  const noSupplier = products.filter((p) => !p.supplierName).length;
  const budgetPct = (suggestedTotal / monthlyPurchaseBudget) * 100;

  // "Qué revisar primero" — pasos con conteo en vivo, ordenados por urgencia
  const guideSteps: GuideStep[] = [
    {
      title: "Productos críticos sin stock",
      detail: "Sin stock disponible y con venta activa. Riesgo de venta perdida ahora.",
      count: criticalRecs.length,
      countLabel: `${criticalRecs.length} productos`,
      to: "/reposicion",
      tone: "red",
    },
    {
      title: "Órdenes de compra atrasadas",
      detail: "OC vencidas según su fecha esperada de entrega.",
      count: delayedPOs.length,
      countLabel: `${delayedPOs.length} órdenes`,
      to: "/ordenes-compra",
      tone: "amber",
    },
    {
      title: "Productos con alta venta y bajo inventario",
      detail: "Stock cubre pocos días considerando el lead time del proveedor.",
      count: buyNowRecs.length,
      countLabel: `${buyNowRecs.length} productos`,
      to: "/reposicion",
      tone: "amber",
    },
    {
      title: "Proveedores con bajo cumplimiento",
      detail: "Entregan menos del 70% a tiempo. Pueden afectar la reposición.",
      count: lowComplianceSuppliers.length,
      countLabel: `${lowComplianceSuppliers.length} proveedores`,
      to: "/proveedores",
      tone: "red",
    },
    {
      title: "Sobrestock con baja rotación",
      detail: "Más inventario del necesario. Capital inmovilizado a liberar.",
      count: overstockProducts.length,
      countLabel: `${overstockProducts.length} productos`,
      to: "/inventario",
      tone: "violet",
    },
  ];

  const criticalAlerts = alerts
    .filter((a) => a.severity === "high" && a.status !== "resolved")
    .slice(0, 3);

  const urgentRecs = [...criticalRecs, ...buyNowRecs]
    .sort((a, b) => b.suggestedPurchaseAmount - a.suggestedPurchaseAmount)
    .slice(0, 5);

  const criticalCategories = [...categories]
    .sort((a, b) => b.stockoutSkus + b.riskSkus - (a.stockoutSkus + a.riskSkus))
    .slice(0, 5);

  const worstSuppliers = [...suppliers]
    .filter((s) => s.status !== "inactive")
    .sort((a, b) => a.deliveryCompliance - b.deliveryCompliance)
    .slice(0, 5);

  const expiringPOs = purchaseOrders
    .filter((o) => ["delayed", "sent", "confirmed"].includes(o.status))
    .sort((a, b) => b.delayedDays - a.delayedDays)
    .slice(0, 5);

  const topOverstock = [...overstockProducts]
    .sort((a, b) => b.availableStock * b.cost - a.availableStock * a.cost)
    .slice(0, 5);

  const salesByCat = [...categories].sort((a, b) => b.salesLast30Days - a.salesLast30Days).slice(0, 6);

  // Campañas y oportunidades
  const upcomingCampaigns = new Set(campaignOpportunities.map((o) => o.campaignName)).size;
  const campaignStockoutRisk = campaignOpportunities.filter((o) => o.status === "stockout_risk").length;
  const campaignLiquidate = campaignOpportunities.filter((o) => o.status === "liquidate").length;
  const campaignGrowth = campaignOpportunities.filter((o) => o.opportunityType === "accelerated_growth").length;
  const nextCampaigns = [...campaignOpportunities]
    .reduce<{ name: string; days: number }[]>((acc, o) => {
      const e = acc.find((x) => x.name === o.campaignName);
      if (e) e.days = Math.min(e.days, o.daysToCampaign);
      else acc.push({ name: o.campaignName, days: o.daysToCampaign });
      return acc;
    }, [])
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  return (
    <div>
      <PageHeader
        title="Dashboard de compras"
        description="Tu portada de decisiones del día: qué está crítico, qué revisar primero, cuánta plata implica la compra sugerida y qué proveedores están fallando. Datos de ejemplo al 24/06/2026."
        action={
          <Link to="/mi-panel">
            <Button variant="secondary" icon={<IconCheck className="w-4 h-4" />}>
              Ir a Mi panel
            </Button>
          </Link>
        }
      />

      {/* 4 KPIs hero de decisión (cliqueables) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard title="SKUs con quiebre" value={formatNumber(stockoutSkus)} tone="bad" icon={<IconAlerts className="w-4 h-4" />} description="Ver sin stock" to="/productos?stock=1" />
        <KpiCard title="En riesgo de quiebre" value={formatNumber(criticalRecs.length + buyNowRecs.length)} tone="warn" icon={<IconReplenish className="w-4 h-4" />} description="Ver reposición" to="/reposicion" />
        <KpiCard title="Compra sugerida del mes" value={formatCurrencyCompact(suggestedTotal)} tone="info" icon={<IconReplenish className="w-4 h-4" />} description={`${formatPercent(budgetPct, 0)} del presupuesto`} to="/reposicion" />
        <KpiCard title="OC abiertas (sin recibir)" value={formatNumber(openPOs)} tone="neutral" icon={<IconInventory className="w-4 h-4" />} description={`${delayedPOs.length} atrasadas`} to="/ordenes-compra" />
      </div>

      {/* Indicadores secundarios en chips compactos (cliqueables) */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin -mx-1 px-1 mb-4 pb-0.5">
        <DashChip to="/inventario" label={`${overstockProducts.length} con sobrestock`} />
        <DashChip to="/proveedores" label={`${lowComplianceSuppliers.length} proveedores a revisar`} />
        <DashChip to="/ventas" label={`${formatCurrencyCompact(salesKpis.salesLast30Days)} venta 30d`} />
        <DashChip to="/inventario" label={`${formatCurrencyCompact(inventoryKpis.totalInventoryValue)} inventario`} />
        <DashChip to="/ventas" label={`${formatCurrencyCompact(salesKpis.lostSalesByStockout)} venta perdida`} />
      </div>

      {/* Qué revisar primero — lo más importante, arriba */}
      <Card className="mb-5">
        <CardHeader
          title="Qué revisar primero"
          description="Acciones ordenadas por urgencia. Empieza por arriba: lo de mayor riesgo está primero."
          action={
            <Link to="/reposicion" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Ir a reposición
            </Link>
          }
        />
        <PriorityGuide steps={guideSteps} />
      </Card>

      {/* Campañas y oportunidades */}
      <Card className="mb-5">
        <CardHeader
          title="Campañas y oportunidades"
          description="Anticipa compras para campañas comerciales, liquidaciones y crecimiento."
          action={
            <Link to="/campanas-oportunidades">
              <Button size="sm" variant="secondary" icon={<IconArrowRight className="w-4 h-4" />}>
                Ver campañas y oportunidades
              </Button>
            </Link>
          }
        />
        <CardBody>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <MiniIndicator icon={<IconCampaign className="w-4 h-4" />} label="Campañas próximas" value={formatNumber(upcomingCampaigns)} tone="info" />
            <MiniIndicator icon={<IconAlerts className="w-4 h-4" />} label="Riesgo de quiebre por campaña" value={formatNumber(campaignStockoutRisk)} tone="bad" />
            <MiniIndicator icon={<IconBox className="w-4 h-4" />} label="Sugeridos para liquidación" value={formatNumber(campaignLiquidate)} tone="warn" />
            <MiniIndicator icon={<IconSales className="w-4 h-4" />} label="Crecimiento acelerado" value={formatNumber(campaignGrowth)} tone="good" />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-medium text-slate-500 mr-1 self-center">Próximas:</span>
            {nextCampaigns.map((c) => (
              <Badge key={c.name} tone={c.days <= 7 ? "red" : "amber"} dot>
                {c.name} · en {c.days} días
              </Badge>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        {/* Acciones urgentes / alertas críticas */}
        <div className="xl:col-span-2 space-y-3">
          <SectionTitle title="Acciones urgentes del día" to="/alertas" linkLabel="Ver todas las alertas" />
          {criticalAlerts.length > 0 ? (
            criticalAlerts.map((a) => <AlertCard key={a.id} alert={a} />)
          ) : (
            <Card>
              <CardBody>
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-emerald-700">No hay alertas de alta severidad.</span>{" "}
                  Todo está en orden por ahora. Continúa con la reposición sugerida.
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Riesgos de quiebre / compra urgente */}
        <div>
          <SectionTitle title="Riesgos de quiebre" to="/reposicion" linkLabel="Ver reposición" />
          <Card>
            <CardBody className="space-y-2.5">
              {urgentRecs.map((r) => (
                <Link
                  key={r.id}
                  to={`/productos/${r.sku}`}
                  className="block rounded-lg border border-slate-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-slate-400">{r.sku}</span>
                    <PriorityBadge priority={r.priority} />
                  </div>
                  <p className="text-sm font-medium text-slate-800 truncate mt-0.5">{r.productName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-slate-500">Comprar {formatNumber(r.suggestedQuantity)} u.</span>
                    <span className="text-xs font-semibold text-slate-700">{formatCurrency(r.suggestedPurchaseAmount)}</span>
                  </div>
                </Link>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Categorías críticas */}
        <Card>
          <CardHeader title="Categorías que necesitan atención" description="Ordenadas por SKUs con quiebre y en riesgo" />
          <CardBody className="space-y-2">
            {criticalCategories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500">Comprador: {c.buyer}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge tone="red">{c.stockoutSkus} quiebre</Badge>
                  <Badge tone="amber">{c.riskSkus} riesgo</Badge>
                  <StatusBadge kind="category" value={c.status} dot={false} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Proveedores con problemas */}
        <Card>
          <CardHeader title="Proveedores con problemas" description="Bajo cumplimiento de entrega. Pueden frenar la reposición." />
          <CardBody className="space-y-2">
            {worstSuppliers.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                  <p className="text-xs text-slate-500">Lead time {s.averageLeadTimeDays} días · {s.openPurchaseOrders} OC abiertas</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm font-semibold ${s.deliveryCompliance < 70 ? "text-rose-600" : "text-slate-700"}`}>
                    {formatPercent(s.deliveryCompliance, 0)}
                  </span>
                  <StatusBadge kind="supplier" value={s.status} dot={false} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Sobrestock relevante */}
        <Card>
          <CardHeader
            title="Sobrestock relevante"
            description="Productos que inmovilizan más capital. No conviene comprar."
            action={<Link to="/inventario" className="text-xs font-medium text-brand-600 hover:text-brand-700">Ver inventario</Link>}
          />
          <CardBody className="space-y-2">
            {topOverstock.map((p) => (
              <Link key={p.sku} to={`/productos/${p.sku}`} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0 hover:text-brand-700">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">Disp. {formatNumber(p.availableStock)} · {formatNumber(p.inventoryDays)} días inv.</p>
                </div>
                <span className="text-sm font-semibold text-violet-600 flex-shrink-0">
                  {formatCurrencyCompact(p.availableStock * p.cost)}
                </span>
              </Link>
            ))}
          </CardBody>
        </Card>

        {/* OC a vigilar */}
        <Card>
          <CardHeader
            title="Órdenes de compra a vigilar"
            description="Atrasadas o próximas a su fecha esperada"
            action={<Link to="/ordenes-compra" className="text-xs font-medium text-brand-600 hover:text-brand-700">Ver todas</Link>}
          />
          <CardBody className="space-y-2">
            {expiringPOs.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{o.number}</p>
                  <p className="text-xs text-slate-500 truncate">{o.supplierName} · espera {formatDate(o.expectedDate)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {o.delayedDays > 0 && <Badge tone="red">{o.delayedDays} d atraso</Badge>}
                  <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Resumen venta por categoría + extras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Venta por categoría (30 días)" description="Dónde se concentra la venta del mes" />
          <CardBody>
            <BarList
              items={salesByCat.map((c) => ({
                label: c.name,
                value: c.salesLast30Days,
                display: formatCurrencyCompact(c.salesLast30Days),
                tone: "blue",
              }))}
            />
          </CardBody>
        </Card>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard title="SKUs activos" value={formatNumber(activeSkus)} tone="info" icon={<IconProducts className="w-4 h-4" />} />
            <KpiCard title="Margen promedio" value={formatPercent(avgMargin)} tone="good" icon={<IconSales className="w-4 h-4" />} />
            <KpiCard title="Sin proveedor" value={formatNumber(noSupplier)} tone={noSupplier > 0 ? "warn" : "good"} icon={<IconSuppliers className="w-4 h-4" />} description="No se pueden reponer" />
            <KpiCard title="Venta perdida por quiebre" value={formatCurrencyCompact(salesKpis.lostSalesByStockout)} tone="bad" icon={<IconAlerts className="w-4 h-4" />} description="Estimada 30 días" />
          </div>
          <Card>
            <CardBody className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Inventario inmovilizado</p>
                <p className="text-xs text-slate-500 mt-0.5">Stock muerto + sobrestock que detiene capital</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold text-rose-600">
                  {formatCurrencyCompact(inventoryKpis.deadStockValue + inventoryKpis.overstockValue)}
                </p>
                <Link to="/inventario" className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-0.5">
                  Analizar <IconChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DashChip({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="whitespace-nowrap flex-shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50/40"
    >
      {label}
    </Link>
  );
}

function MiniIndicator({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "info" | "bad" | "warn" | "good";
}) {
  const toneClass = {
    info: "bg-brand-50 text-brand-600",
    bad: "bg-rose-50 text-rose-600",
    warn: "bg-amber-50 text-amber-600",
    good: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${toneClass[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xl font-semibold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1 leading-snug">{label}</p>
      </div>
    </div>
  );
}

function SectionTitle({ title, to, linkLabel }: { title: string; to: string; linkLabel: string }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <Link to={to} className="text-xs font-medium text-brand-600 hover:text-brand-700">
        {linkLabel}
      </Link>
    </div>
  );
}

import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, type Column } from "../components/ui/Table";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusBadge } from "../components/business/StatusBadge";
import { PriorityGuide, type GuideStep } from "../components/business/PriorityGuide";
import { CollapsibleSection } from "../components/ui/CollapsibleSection";
import {
  IconAlerts,
  IconBox,
  IconOrders,
  IconSuppliers,
  IconReplenish,
  IconCheck,
  IconPlus,
  IconChevronRight,
  IconSales,
} from "../components/ui/icons";
import { products } from "../data/mockProducts";
import { recommendations } from "../data/mockRecommendations";
import { suppliers } from "../data/mockSuppliers";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { categories } from "../data/mockCategories";
import { useBuyer } from "../context/BuyerContext";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { useSignals } from "../context/SignalsContext";
import { SIGNAL_TYPE, SIGNAL_STATUS, SIGNAL_PRIORITY } from "../components/business/signalLabels";
import { IconSignal } from "../components/ui/icons";
import {
  coverageDays,
  coverageSentence,
  estimatedStockoutDate,
  calculateSuggestedPurchase,
  addDaysISO,
} from "../utils/calculations";
import { TODAY_ISO } from "../utils/constants";
import { seasonalFactor } from "../utils/seasonality";
import { lostOpportunities } from "../utils/lostOpportunities";
import { usePurchaseFlow } from "../context/PurchaseFlowContext";
import {
  formatCurrencyCompact,
  formatDate,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import type { Product } from "../types/purchasing";

interface RiskRow {
  product: Product;
  coverage: number;
  stockoutDate: string | null;
  suggestedQty: number;
  coverageAfter: number;
}

interface SalesPaceRow {
  product: Product;
  expected30: number;
  diffUnits: number;
  diffPct: number;
  coverage: number;
}

export function MyPanelPage() {
  const navigate = useNavigate();
  const { buyer, myCategories } = useBuyer();
  const { approvals } = usePurchaseFlow();
  const { signals } = useSignals();

  // Señales de ventas que me tocan: asignadas a mí, o de mis categorías sin asignar.
  const mySignals = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return signals
      .filter(
        (s) =>
          (s.status === "new" || s.status === "in_review") &&
          (s.assignedBuyer === buyer || (!s.assignedBuyer && myCategories.includes(s.category)))
      )
      .sort((a, b) => {
        const p = order[a.priority] - order[b.priority];
        return p !== 0 ? p : a.date < b.date ? 1 : -1;
      })
      .slice(0, 5);
  }, [signals, buyer, myCategories]);
  const { addItem, hasItem } = useOcDraft();
  const toast = useToast();

  const myProducts = useMemo(
    () => products.filter((p) => myCategories.includes(p.category)),
    [myCategories]
  );

  const myCats = categories.filter((c) => c.buyer === buyer);

  const portfolio = useMemo(() => {
    const salesValue = myProducts.reduce((sum, p) => sum + p.salesLast30Days * p.price, 0);
    const grossProfit = myProducts.reduce(
      (sum, p) => sum + p.salesLast30Days * (p.price - p.cost),
      0
    );
    const inventoryValue = myProducts.reduce((sum, p) => sum + p.availableStock * p.cost, 0);
    const overstockValue = myProducts
      .filter((p) => p.purchaseStatus === "overstock" || p.inventoryDays > 180)
      .reduce((sum, p) => sum + p.availableStock * p.cost, 0);
    const noSalesStockValue = myProducts
      .filter((p) => p.salesLast90Days === 0 && p.availableStock > 0)
      .reduce((sum, p) => sum + p.availableStock * p.cost, 0);
    const coverageWeighted =
      salesValue > 0
        ? myProducts.reduce((sum, p) => sum + p.inventoryDays * p.salesLast30Days * p.price, 0) /
          salesValue
        : 0;
    const rotation =
      inventoryValue > 0
        ? (myProducts.reduce((sum, p) => sum + p.salesLast30Days * p.cost, 0) * 12) / inventoryValue
        : 0;
    const gmroi = inventoryValue > 0 ? (grossProfit * 12) / inventoryValue : 0;
    const brands = Array.from(new Set(myProducts.map((p) => p.brand).filter(Boolean))).sort();
    const supplierNames = Array.from(
      new Set(myProducts.map((p) => p.supplierName).filter(Boolean))
    ).sort();
    const subcategories = Array.from(new Set(myProducts.map((p) => p.subcategory))).sort();

    return {
      salesValue,
      marginPct: salesValue > 0 ? (grossProfit / salesValue) * 100 : 0,
      inventoryValue,
      overstockValue,
      noSalesStockValue,
      coverageWeighted,
      rotation,
      gmroi,
      brands,
      supplierNames,
      subcategories,
    };
  }, [myProducts]);

  const salesPace = useMemo(() => {
    const rows = myProducts
      .map<SalesPaceRow | null>((p) => {
        const expected30 = p.salesLast90Days / 3;
        if (expected30 < 8) return null;
        const diffUnits = p.salesLast30Days - expected30;
        const diffPct = expected30 > 0 ? diffUnits / expected30 : 0;
        return {
          product: p,
          expected30,
          diffUnits,
          diffPct,
          coverage: coverageDays(p.availableStock, p.salesLast30Days),
        };
      })
      .filter((r): r is SalesPaceRow => !!r);

    const faster = rows
      .filter((r) => r.diffPct >= 0.15)
      .sort((a, b) => b.diffPct - a.diffPct || a.coverage - b.coverage);
    const slower = rows
      .filter((r) => r.diffPct <= -0.15 && r.product.availableStock > 0)
      .sort((a, b) => a.diffPct - b.diffPct || b.product.availableStock - a.product.availableStock);

    return { faster, slower };
  }, [myProducts]);

  // Oportunidades no capturadas y aprobaciones del comprador
  const myLostOpps = useMemo(
    () => lostOpportunities().filter((o) => myCategories.includes(o.category)),
    [myCategories]
  );
  const myLostRevenue = myLostOpps.reduce((a, o) => a + o.ventaPerdida, 0);
  const myApprovals = approvals.filter((a) => a.buyerName === buyer);

  // Riesgo de quiebre: sin stock con venta, o cobertura corta vs lead time
  const riskRows = useMemo<RiskRow[]>(() => {
    return myProducts
      .filter((p) => {
        if (p.salesLast30Days <= 0) return false;
        const cover = coverageDays(p.availableStock, p.salesLast30Days);
        return p.availableStock <= 0 || cover <= p.supplierLeadTimeDays * 2;
      })
      .map((p) => {
        const cover = coverageDays(p.availableStock, p.salesLast30Days);
        const rec = recommendations.find((r) => r.sku === p.sku);
        const calc = calculateSuggestedPurchase({
          availableStock: p.availableStock,
          committedStock: p.committedStock,
          monthlySales: p.salesLast30Days,
          leadTimeDays: p.supplierLeadTimeDays,
          targetInventoryDays: 45,
          minStock: p.minStock,
          maxStock: p.maxStock,
          seasonalFactor: seasonalFactor(p.category),
        });
        const suggestedQty = rec?.suggestedQuantity ?? calc.suggestedQuantity;
        const coverageAfter =
          p.salesLast30Days > 0
            ? Math.round(((p.availableStock + suggestedQty) / (p.salesLast30Days / 30)) * 10) / 10
            : 0;
        return {
          product: p,
          coverage: cover,
          stockoutDate: estimatedStockoutDate(p.availableStock, p.salesLast30Days, TODAY_ISO),
          suggestedQty,
          coverageAfter,
        };
      })
      .sort((a, b) => a.coverage - b.coverage);
  }, [myProducts]);

  const overstockProducts = myProducts.filter((p) => p.purchaseStatus === "overstock");

  const myOpenOrders = purchaseOrders.filter(
    (o) => o.buyerName === buyer && !["received", "cancelled"].includes(o.status)
  );
  const myDelayedPOs = myOpenOrders.filter((o) => o.status === "delayed");

  const mySuppliersToReview = suppliers.filter(
    (s) =>
      s.categories.some((c) => myCategories.includes(c)) &&
      ["review", "delayed", "inactive"].includes(s.status)
  );

  const noSupplierProducts = myProducts.filter((p) => !p.supplierName);

  // ---- Salud del catálogo (#4): costo, margen y novedades por revisar ----
  const costStaleBefore = addDaysISO(TODAY_ISO, -90);
  const outdatedCostProducts = myProducts.filter((p) => p.costUpdatedAt < costStaleBefore);
  const lowMarginProducts = myProducts.filter((p) => p.margin < 20);
  const newProductsToReview = myProducts.filter((p) => p.productStatus === "new");

  // ---- Agenda por horizonte de tiempo ----
  const [horizon, setHorizon] = useState<"hoy" | "semana" | "mes" | "trimestre">("hoy");
  const daysTo = (iso: string) =>
    Math.round(
      (new Date(`${iso}T00:00:00`).getTime() - new Date(`${TODAY_ISO}T00:00:00`).getTime()) /
        86400000
    );

  interface AgendaItem {
    id: string;
    dueDate: string;
    days: number;
    kind: string;
    title: string;
    detail: string;
    to: string;
    tone: "red" | "amber" | "violet" | "blue";
  }

  const agenda: AgendaItem[] = [];
  riskRows.forEach((r) => {
    const due = r.product.availableStock <= 0 ? TODAY_ISO : (r.stockoutDate ?? TODAY_ISO);
    agenda.push({
      id: `q-${r.product.sku}`,
      dueDate: due,
      days: Math.max(daysTo(due), r.product.availableStock <= 0 ? -1 : daysTo(due)),
      kind: "Quiebre",
      title: r.product.name,
      detail: `Riesgo de quiebre · comprar ${formatNumber(r.suggestedQty)} u.`,
      to: `/productos/${r.product.sku}`,
      tone: "red",
    });
  });
  salesPace.faster.slice(0, 3).forEach((r) => {
    agenda.push({
      id: `fast-${r.product.sku}`,
      dueDate: TODAY_ISO,
      days: 0,
      kind: "Venta rápida",
      title: r.product.name,
      detail: `Venta ${formatNumber(Math.round(r.diffPct * 100))}% sobre lo esperado · revisar stock`,
      to: `/productos/${r.product.sku}`,
      tone: r.coverage <= r.product.supplierLeadTimeDays * 2 ? "red" : "blue",
    });
  });
  salesPace.slower.slice(0, 3).forEach((r) => {
    agenda.push({
      id: `slow-${r.product.sku}`,
      dueDate: addDaysISO(TODAY_ISO, 7),
      days: 7,
      kind: "Venta lenta",
      title: r.product.name,
      detail: `Venta ${formatNumber(Math.abs(Math.round(r.diffPct * 100)))}% bajo lo esperado · revisar compra`,
      to: `/productos/${r.product.sku}`,
      tone: "amber",
    });
  });
  myOpenOrders.forEach((o) => {
    agenda.push({
      id: `oc-${o.id}`,
      dueDate: o.expectedDate,
      days: daysTo(o.expectedDate),
      kind: "OC",
      title: o.number,
      detail: `${o.supplierName} · ${o.delayedDays > 0 ? `atrasada ${o.delayedDays} d` : "por recibir"}`,
      to: "/ordenes-compra",
      tone: o.delayedDays > 0 ? "red" : "amber",
    });
  });
  mySuppliersToReview.forEach((s) => {
    const add = s.status === "delayed" ? 0 : s.status === "review" ? 14 : 30;
    const due = addDaysISO(TODAY_ISO, add);
    agenda.push({
      id: `prov-${s.id}`,
      dueDate: due,
      days: daysTo(due),
      kind: "Proveedor",
      title: s.name,
      detail: `Revisar proveedor · cumple ${s.deliveryCompliance}%`,
      to: "/proveedores",
      tone: "amber",
    });
  });
  overstockProducts.forEach((p) => {
    const due = addDaysISO(TODAY_ISO, 30);
    agenda.push({
      id: `over-${p.sku}`,
      dueDate: due,
      days: daysTo(due),
      kind: "Sobrestock",
      title: p.name,
      detail: `Sobrestock · ${formatCurrencyCompact(p.availableStock * p.cost)} inmovilizado`,
      to: `/productos/${p.sku}`,
      tone: "violet",
    });
  });

  const horizonMax = { hoy: 0, semana: 7, mes: 30, trimestre: 90 };
  const agendaCounts = {
    hoy: agenda.filter((a) => a.days <= 0).length,
    semana: agenda.filter((a) => a.days <= 7).length,
    mes: agenda.filter((a) => a.days <= 30).length,
    trimestre: agenda.filter((a) => a.days <= 90).length,
  };
  const agendaItems = agenda
    .filter((a) => a.days <= horizonMax[horizon])
    .sort((a, b) => a.days - b.days);

  const handleAdd = (p: Product, qty: number) => {
    addItem({
      sku: p.sku,
      productName: p.name,
      supplierName: p.supplierName,
      quantity: qty,
      unitCost: p.cost,
    });
    toast.success(`${p.name} agregado al borrador de OC`, {
      label: "Ver borrador OC",
      onClick: () => navigate("/ordenes-compra"),
    });
  };

  // Acción recomendada del día (lo más urgente) + resumen compacto
  const topRisk = riskRows[0];
  const quiebresHoy = riskRows.filter((r) => r.product.availableStock <= 0).length;
  const fastWithLowCoverage = salesPace.faster.filter(
    (r) => r.coverage <= r.product.supplierLeadTimeDays * 2
  ).length;
  const slowCapital = salesPace.slower.reduce(
    (sum, r) => sum + r.product.availableStock * r.product.cost,
    0
  );
  const criticalActions =
    quiebresHoy +
    fastWithLowCoverage +
    myDelayedPOs.length +
    mySuppliersToReview.filter((s) => s.status === "delayed").length;

  // Tareas consolidadas del comprador
  const tasks: GuideStep[] = [
    {
      title: "Comprar productos en riesgo de quiebre",
      detail: "SKUs sin stock o con cobertura menor al doble del lead time.",
      count: riskRows.length,
      countLabel: `${riskRows.length} productos`,
      to: "#riesgo",
      tone: "red",
    },
    {
      title: "Seguir órdenes de compra sin recibir",
      detail: "Mercadería que aún no llega. Revisa las atrasadas primero.",
      count: myOpenOrders.length,
      countLabel: `${myOpenOrders.length} órdenes`,
      to: "#ordenes",
      tone: myDelayedPOs.length > 0 ? "red" : "amber",
    },
    {
      title: "Revisar proveedores con problemas",
      detail: "Proveedores de mis categorías a revisar este mes.",
      count: mySuppliersToReview.length,
      countLabel: `${mySuppliersToReview.length} proveedores`,
      to: "#proveedores",
      tone: "amber",
    },
    {
      title: "Gestionar sobrestock",
      detail: "Inventario inmovilizado: liquidar o dejar de comprar.",
      count: overstockProducts.length,
      countLabel: `${overstockProducts.length} productos`,
      to: "#sobrestock",
      tone: "violet",
    },
    {
      title: "Asignar proveedor a productos sin proveedor",
      detail: "No se pueden reponer hasta tener proveedor.",
      count: noSupplierProducts.length,
      countLabel: `${noSupplierProducts.length} productos`,
      to: "/productos?prov=&compra=",
      tone: "neutral",
    },
  ];

  const riskColumns: Column<RiskRow>[] = [
    {
      key: "product",
      header: "Producto",
      render: ({ product: p }) => (
        <div className="min-w-[200px]">
          <span className="text-xs font-mono text-slate-400">{p.sku}</span>
          <p className="font-medium text-slate-800 leading-snug">{p.name}</p>
          <p className="text-xs text-slate-500">
            {p.category} · {p.supplierName || "Sin proveedor"}
          </p>
          <p className="text-xs mt-0.5 leading-snug text-rose-600">
            {coverageSentence(p.availableStock, p.salesLast30Days)}
          </p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock disp.",
      align: "right",
      render: ({ product: p }) => (
        <span className={p.availableStock <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>
          {formatNumber(p.availableStock)}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Venta 30d",
      align: "right",
      hideOnMobile: true,
      render: ({ product: p }) => formatNumber(p.salesLast30Days),
    },
    {
      key: "stockout",
      header: "Quiebre estimado",
      align: "right",
      render: (r) => (
        <div className="text-sm">
          <p
            className={
              r.coverage <= r.product.supplierLeadTimeDays
                ? "text-rose-600 font-semibold"
                : "text-amber-600 font-medium"
            }
          >
            {r.product.availableStock <= 0 ? "En quiebre" : formatDate(r.stockoutDate ?? "")}
          </p>
          <p className="text-xs text-slate-400">
            cubre {formatDays(r.coverage)} · lead {formatDays(r.product.supplierLeadTimeDays)}
          </p>
        </div>
      ),
    },
    {
      key: "suggested",
      header: "Compra sugerida",
      align: "right",
      render: (r) => (
        <div className="text-sm">
          <p className="font-semibold text-slate-900">{formatNumber(r.suggestedQty)} u.</p>
          <p className="text-xs text-slate-400">para ~{formatDays(r.coverageAfter)}</p>
        </div>
      ),
    },
    {
      key: "action",
      header: "",
      render: (r) => (
        <div className="flex flex-col gap-1 min-w-[130px]">
          <Button
            size="sm"
            variant={hasItem(r.product.sku) ? "secondary" : "primary"}
            disabled={hasItem(r.product.sku) || r.suggestedQty <= 0}
            onClick={(e) => {
              e.stopPropagation();
              handleAdd(r.product, r.suggestedQty);
            }}
            icon={
              hasItem(r.product.sku) ? (
                <IconCheck className="w-3.5 h-3.5" />
              ) : (
                <IconPlus className="w-3.5 h-3.5" />
              )
            }
          >
            {hasItem(r.product.sku) ? "En OC" : "Agregar a OC"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Hola, ${buyer}`}
        description={`${formatDate(TODAY_ISO)} · ${criticalActions > 0 ? `${criticalActions} foco${criticalActions === 1 ? "" : "s"} crítico${criticalActions === 1 ? "" : "s"} para revisar ahora.` : "Sin focos críticos para hoy."}`}
        action={
          <Button
            variant="secondary"
            onClick={() => navigate("/reposicion")}
            icon={<IconReplenish className="w-4 h-4" />}
          >
            Ir a reposición
          </Button>
        }
      />

      <section className="mb-4 lg:hidden rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Prioridades hoy
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">
          Qué mirar primero en tu cartera
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <AttentionMetric
            tone="red"
            label="Quiebres"
            value={formatNumber(quiebresHoy)}
            detail={`${riskRows.length} en riesgo`}
            to="#riesgo"
          />
          <AttentionMetric
            tone="blue"
            label="Venta rápida"
            value={formatNumber(salesPace.faster.length)}
            detail={`${fastWithLowCoverage} cortos`}
            to="#ventas-rapidas"
          />
          <AttentionMetric
            tone="amber"
            label="Venta lenta"
            value={formatNumber(salesPace.slower.length)}
            detail={formatCurrencyCompact(slowCapital)}
            to="#ventas-lentas"
          />
          <AttentionMetric
            tone="violet"
            label="No capturada"
            value={formatCurrencyCompact(myLostRevenue)}
            detail={`${myLostOpps.length} casos`}
            to="/venta-no-capturada"
          />
        </div>
        <Button
          className="mt-3 w-full"
          size="sm"
          variant="primary"
          onClick={() => navigate(topRisk ? `/productos/${topRisk.product.sku}` : "/reposicion")}
          icon={<IconAlerts className="w-3.5 h-3.5" />}
        >
          Revisar prioridad principal
        </Button>
      </section>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="border-b border-slate-100 p-4 xl:border-b-0 xl:border-r">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mi cartera asignada
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {myCats.length} categorías · {portfolio.subcategories.length} subcategorías ·{" "}
              {myProducts.length} SKU
            </h2>
            <div className="mt-3 space-y-3">
              <PortfolioGroup
                label="Categorías"
                items={myCats.map((c) => c.name)}
                tone="blue"
                moreTo="/categorias"
              />
              <PortfolioGroup
                label="Marcas"
                items={portfolio.brands}
                tone="violet"
                moreTo="/productos"
              />
              <PortfolioGroup
                label="Proveedores"
                items={portfolio.supplierNames}
                tone="amber"
                moreTo="/proveedores"
              />
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <PortfolioMetric
                label="Venta 30d"
                value={formatCurrencyCompact(portfolio.salesValue)}
              />
              <PortfolioMetric label="Margen" value={formatPercent(portfolio.marginPct)} />
              <PortfolioMetric
                label="Inventario"
                value={formatCurrencyCompact(portfolio.inventoryValue)}
              />
              <PortfolioMetric label="Rotación" value={`${formatNumber(portfolio.rotation)}x`} />
              <PortfolioMetric
                label="Cobertura"
                value={formatDays(Math.round(portfolio.coverageWeighted))}
              />
              <PortfolioMetric
                label="Quiebres críticos"
                value={`${formatNumber(quiebresHoy)} SKU`}
              />
              <PortfolioMetric
                label="Sobrestock"
                value={formatCurrencyCompact(portfolio.overstockValue)}
              />
              <PortfolioMetric label="GMROI" value={portfolio.gmroi.toFixed(1).replace(".", ",")} />
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4">
        <div className="hidden grid-cols-1 gap-4 lg:grid xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Radar de atención
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  Primero mira quiebres y cambios de velocidad de venta
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Detecté productos sin stock, SKUs que se aceleraron contra su ritmo histórico y
                  productos que se frenaron antes de que se transformen en sobrestock.
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  navigate(topRisk ? `/productos/${topRisk.product.sku}` : "/reposicion")
                }
                icon={<IconAlerts className="w-3.5 h-3.5" />}
              >
                Revisar prioridad
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <AttentionMetric
                tone="red"
                label="Quiebres ahora"
                value={formatNumber(quiebresHoy)}
                detail={`${riskRows.length} SKUs en riesgo`}
                to="#riesgo"
              />
              <AttentionMetric
                tone="blue"
                label="Venta más rápida"
                value={formatNumber(salesPace.faster.length)}
                detail={`${fastWithLowCoverage} con cobertura corta`}
                to="#ventas-rapidas"
              />
              <AttentionMetric
                tone="amber"
                label="Venta más lenta"
                value={formatNumber(salesPace.slower.length)}
                detail={`${formatCurrencyCompact(slowCapital)} expuesto`}
                to="#ventas-lentas"
              />
              <AttentionMetric
                tone="violet"
                label="Venta no capturada"
                value={formatCurrencyCompact(myLostRevenue)}
                detail={`${myLostOpps.length} oportunidades`}
                to="/venta-no-capturada"
              />
            </div>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
              Acción recomendada hoy
            </p>
            {topRisk ? (
              <>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  Comprar {formatNumber(topRisk.suggestedQty)} u. de {topRisk.product.name}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {topRisk.product.availableStock <= 0
                    ? "Quiebre hoy"
                    : `Quiebre estimado ${formatDate(topRisk.stockoutDate ?? "")}`}{" "}
                  · stock {formatNumber(topRisk.product.availableStock)} u. · lead{" "}
                  {formatDays(topRisk.product.supplierLeadTimeDays)} · cubre ~
                  {formatDays(topRisk.coverageAfter)}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    size="sm"
                    disabled={hasItem(topRisk.product.sku)}
                    variant={hasItem(topRisk.product.sku) ? "secondary" : "primary"}
                    onClick={() => handleAdd(topRisk.product, topRisk.suggestedQty)}
                    icon={
                      hasItem(topRisk.product.sku) ? (
                        <IconCheck className="w-3.5 h-3.5" />
                      ) : (
                        <IconPlus className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {hasItem(topRisk.product.sku) ? "En OC" : "Crear OC"}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/productos/${topRisk.product.sku}`)}
                  >
                    Revisar SKU
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate("/reposicion?foco=urgent")}
                  >
                    Ver reposición
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                No hay quiebres urgentes. Revisa los cambios de velocidad de venta para anticiparte.
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SalesPaceCard
            id="ventas-rapidas"
            tone="blue"
            title="Ventas más rápidas de lo esperado"
            description="Subieron contra su promedio reciente. Si la cobertura es corta, conviene comprar antes."
            icon={<IconSales className="w-4 h-4" />}
            rows={salesPace.faster.slice(0, 4)}
            emptyTitle="Sin aceleraciones relevantes"
            emptyDescription="Tus productos están vendiendo cerca de su ritmo esperado."
          />
          <SalesPaceCard
            id="ventas-lentas"
            tone="amber"
            title="Ventas más lentas de lo esperado"
            description="Cayeron contra su promedio reciente. Evita recomprar igual que antes y revisa precio, campaña o surtido."
            icon={<IconBox className="w-4 h-4" />}
            rows={salesPace.slower.slice(0, 4)}
            emptyTitle="Sin frenos relevantes"
            emptyDescription="No hay señales fuertes de desaceleración en tus categorías."
          />
        </div>
      </section>

      {/* Agenda por horizonte: qué revisar hoy / semana / mes / 3 meses */}
      <Card className="mb-4">
        <CardHeader
          title="Qué tengo que ver"
          description="Tus pendientes ordenados por cuándo vencen. Empieza por hoy."
        />
        <div className="px-4 pt-1">
          <Tabs
            value={horizon}
            onChange={(v) => setHorizon(v as typeof horizon)}
            tabs={[
              { value: "hoy", label: "Hoy / vencido", count: agendaCounts.hoy },
              { value: "semana", label: "Esta semana", count: agendaCounts.semana },
              { value: "mes", label: "Este mes", count: agendaCounts.mes },
              { value: "trimestre", label: "Próx. 3 meses", count: agendaCounts.trimestre },
            ]}
          />
        </div>
        <CardBody>
          {agendaItems.length === 0 ? (
            <EmptyState
              icon={<IconCheck className="w-6 h-6" />}
              title="Nada pendiente en este plazo"
              description="No tienes tareas para este horizonte. Revisa un plazo más amplio."
            />
          ) : (
            <div className="space-y-1.5">
              {agendaItems.map((a) => {
                const toneClass =
                  a.tone === "red"
                    ? "bg-rose-500"
                    : a.tone === "amber"
                      ? "bg-amber-500"
                      : a.tone === "violet"
                        ? "bg-violet-500"
                        : "bg-brand-500";
                const when =
                  a.days < 0
                    ? `vencido ${Math.abs(a.days)}d`
                    : a.days === 0
                      ? "hoy"
                      : `en ${a.days}d`;
                return (
                  <Link
                    key={a.id}
                    to={a.to}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <span className={`w-1.5 h-8 rounded-full flex-shrink-0 ${toneClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{a.kind}</Badge>
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {a.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{a.detail}</p>
                    </div>
                    <span
                      className={`text-xs font-medium flex-shrink-0 ${a.days <= 0 ? "text-rose-600" : "text-slate-500"}`}
                    >
                      {when}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Oportunidades no capturadas y aprobaciones mías */}
      {(myLostOpps.length > 0 || myApprovals.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {myLostOpps.length > 0 && (
            <Card>
              <CardHeader
                title="Venta no capturada"
                description={`${formatCurrencyCompact(myLostRevenue)}/mes que dejas de vender por no reponer`}
                action={
                  <Link to="/venta-no-capturada">
                    <span className="text-xs font-medium text-brand-600 hover:text-brand-700">
                      Ver todas
                    </span>
                  </Link>
                }
              />
              <CardBody className="space-y-1.5">
                {myLostOpps.slice(0, 4).map((o) => (
                  <Link
                    key={o.sku}
                    to={`/productos/${o.sku}`}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {o.name}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {o.motivo} · vendía ~{formatNumber(o.histMonthly)}/mes
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-rose-600 flex-shrink-0">
                      {formatCurrencyCompact(o.ventaPerdida)}/mes
                    </span>
                  </Link>
                ))}
              </CardBody>
            </Card>
          )}
          {myApprovals.length > 0 && (
            <Card>
              <CardHeader
                title="Mis aprobaciones"
                description="Compras fuera de criterio a la espera de aprobación"
                action={
                  <Link to="/aprobaciones">
                    <span className="text-xs font-medium text-brand-600 hover:text-brand-700">
                      Ver todas
                    </span>
                  </Link>
                }
              />
              <CardBody className="space-y-1.5">
                {myApprovals.slice(0, 4).map((a) => (
                  <Link
                    key={a.id}
                    to="/aprobaciones"
                    className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {a.productName}
                      </span>
                      <span className="block text-xs text-slate-400">
                        sugerido {formatNumber(a.suggestedQty)} → {formatNumber(a.requestedQty)} u.
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-slate-700 flex-shrink-0">
                      {formatCurrencyCompact(a.amount)}
                    </span>
                  </Link>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Mis categorías asignadas */}
      <CollapsibleSection
        id="panel-categorias"
        className="mb-4"
        title="Mis categorías asignadas"
        description={`${myCats.length} categoría${myCats.length === 1 ? "" : "s"} bajo tu gestión`}
        hint={`${myCats.reduce((a, c) => a + c.stockoutSkus, 0)} quiebres en tus categorías`}
      >
        {myCats.length === 0 ? (
          <EmptyState
            title="Sin categorías asignadas"
            description="Cambia de comprador en la barra superior para ver sus categorías."
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {myCats.map((c) => (
              <Link
                key={c.id}
                to={`/categorias/${c.id}`}
                className="group flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="text-sm font-medium text-slate-800">{c.name}</span>
                {c.stockoutSkus > 0 && <Badge tone="red">{c.stockoutSkus} quiebre</Badge>}
                {c.riskSkus > 0 && <Badge tone="amber">{c.riskSkus} riesgo</Badge>}
                <StatusBadge kind="category" value={c.status} dot={false} />
                <IconChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500" />
              </Link>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* Señales de ventas para mí */}
      <CollapsibleSection
        id="panel-senales"
        className="mb-4"
        title="Señales de ventas para mí"
        description="Lo que ventas reportó en tus categorías y aún espera tu decisión"
        hint={`${mySignals.length} pendiente${mySignals.length === 1 ? "" : "s"}`}
        action={
          <Link
            to="/senales-ventas"
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Ver todas
          </Link>
        }
      >
        {mySignals.length === 0 ? (
          <EmptyState
            title="Todo al día"
            description="No tienes señales de ventas pendientes en tus categorías."
            icon={<IconCheck className="w-6 h-6" />}
          />
        ) : (
          <div className="space-y-2">
            {mySignals.map((s) => (
              <Link
                key={s.id}
                to="/senales-ventas"
                className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <IconSignal className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge tone={SIGNAL_PRIORITY[s.priority].tone}>
                      {SIGNAL_PRIORITY[s.priority].label}
                    </Badge>
                    <Badge tone={SIGNAL_TYPE[s.type].tone}>{SIGNAL_TYPE[s.type].short}</Badge>
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {s.productName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{s.comment}</p>
                </div>
                <Badge tone={SIGNAL_STATUS[s.status].tone} dot>
                  {SIGNAL_STATUS[s.status].label}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* KPIs de tareas (cliqueables) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="En riesgo de quiebre"
          value={formatNumber(riskRows.length)}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Ver abajo"
          to="#riesgo"
        />
        <KpiCard
          title="OC sin recibir"
          value={formatNumber(myOpenOrders.length)}
          tone={myDelayedPOs.length ? "bad" : "warn"}
          icon={<IconOrders className="w-4 h-4" />}
          description={`${myDelayedPOs.length} atrasadas`}
          to="#ordenes"
        />
        <KpiCard
          title="Proveedores por revisar"
          value={formatNumber(mySuppliersToReview.length)}
          tone="warn"
          icon={<IconSuppliers className="w-4 h-4" />}
          description="Este mes"
          to="#proveedores"
        />
        <KpiCard
          title="Con sobrestock"
          value={formatNumber(overstockProducts.length)}
          tone="warn"
          icon={<IconBox className="w-4 h-4" />}
          description="Capital inmovilizado"
          to="#sobrestock"
        />
      </div>

      {/* Salud del catálogo (#4): costo, margen y novedades por revisar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <KpiCard
          title="Sin costo actualizado"
          value={formatNumber(outdatedCostProducts.length)}
          tone={outdatedCostProducts.length ? "warn" : "good"}
          icon={<IconBox className="w-4 h-4" />}
          description="Costo de más de 90 días"
          to="/productos"
        />
        <KpiCard
          title="Margen bajo"
          value={formatNumber(lowMarginProducts.length)}
          tone={lowMarginProducts.length ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="Bajo 20% — revisar precio/costo"
          to="/analisis-compra"
        />
        <KpiCard
          title="Productos nuevos"
          value={formatNumber(newProductsToReview.length)}
          tone={newProductsToReview.length ? "info" : "neutral"}
          icon={<IconPlus className="w-4 h-4" />}
          description="Por revisar surtido"
          to="/productos"
        />
      </div>

      {/* Todas mis tareas */}
      <Card className="mb-5">
        <CardHeader
          title="Todas mis tareas"
          description="Ordenadas por urgencia. Empieza por arriba."
        />
        <PriorityGuide steps={tasks} />
      </Card>

      {/* Bloque inferior en 2 columnas (escritorio aprovecha el ancho) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Riesgo de quiebre */}
          <div id="riesgo">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-semibold text-slate-800">
                Mis productos en riesgo de quiebre
              </h3>
              <Link
                to="/reposicion"
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Ver reposición
              </Link>
            </div>
            <Card>
              <DataTable
                columns={riskColumns}
                data={riskRows}
                rowKey={(r) => r.product.sku}
                onRowClick={(r) => navigate(`/productos/${r.product.sku}`)}
                rowClassName={(r) => (r.product.availableStock <= 0 ? "bg-rose-50/40" : undefined)}
                emptyMessage="No tienes productos en riesgo de quiebre. ¡Bien!"
                mobileCard={(r) => (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-mono text-slate-400">{r.product.sku}</span>
                        <p className="font-medium text-slate-800 leading-snug">{r.product.name}</p>
                        <p className="text-xs text-slate-500">
                          {r.product.category} · {r.product.supplierName || "Sin proveedor"}
                        </p>
                        <p className="text-xs mt-0.5 leading-snug text-rose-600 font-medium">
                          {coverageSentence(r.product.availableStock, r.product.salesLast30Days)}
                        </p>
                      </div>
                      <Badge tone="red" dot>
                        {r.product.availableStock <= 0 ? "Quiebre" : "Riesgo"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Stock</p>
                        <p
                          className={
                            r.product.availableStock <= 0
                              ? "text-rose-600 font-semibold"
                              : "text-slate-700"
                          }
                        >
                          {formatNumber(r.product.availableStock)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Quiebre</p>
                        <p className="text-slate-700">
                          {r.product.availableStock <= 0 ? "hoy" : formatDate(r.stockoutDate ?? "")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Comprar</p>
                        <p className="font-semibold text-slate-900">
                          {formatNumber(r.suggestedQty)} u.
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Cubre ~{formatDays(r.coverageAfter)} · lead{" "}
                      {formatDays(r.product.supplierLeadTimeDays)}
                    </p>
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      variant={hasItem(r.product.sku) ? "secondary" : "primary"}
                      disabled={hasItem(r.product.sku) || r.suggestedQty <= 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdd(r.product, r.suggestedQty);
                      }}
                      icon={
                        hasItem(r.product.sku) ? (
                          <IconCheck className="w-3.5 h-3.5" />
                        ) : (
                          <IconPlus className="w-3.5 h-3.5" />
                        )
                      }
                    >
                      {hasItem(r.product.sku) ? "En OC" : "Agregar a OC"}
                    </Button>
                  </div>
                )}
              />
            </Card>
          </div>

          {/* OC sin recibir */}
          <div id="ordenes">
            <h3 className="text-sm font-semibold text-slate-800 mb-2.5">
              Órdenes de compra sin recibir
            </h3>
            <Card>
              <CardBody className="space-y-2">
                {myOpenOrders.length === 0 ? (
                  <EmptyState
                    icon={<IconCheck className="w-6 h-6" />}
                    title="Sin órdenes pendientes"
                    description="No tienes mercadería por recibir."
                  />
                ) : (
                  myOpenOrders
                    .sort((a, b) => b.delayedDays - a.delayedDays)
                    .map((o) => (
                      <Link
                        key={o.id}
                        to={`/ordenes-compra?oc=${encodeURIComponent(o.number)}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">{o.number}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {o.supplierName} · espera {formatDate(o.expectedDate)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {o.delayedDays > 0 && <Badge tone="red">{o.delayedDays} d atraso</Badge>}
                          <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
                        </div>
                      </Link>
                    ))
                )}
              </CardBody>
            </Card>
          </div>
        </div>
        {/* fin columna izquierda */}

        <div className="space-y-5">
          {/* Proveedores por revisar */}
          <div id="proveedores">
            <h3 className="text-sm font-semibold text-slate-800 mb-2.5">Proveedores por revisar</h3>
            <Card>
              <CardBody className="space-y-2">
                {mySuppliersToReview.length === 0 ? (
                  <EmptyState
                    icon={<IconCheck className="w-6 h-6" />}
                    title="Proveedores al día"
                    description="Ninguno de tus proveedores requiere revisión ahora."
                  />
                ) : (
                  mySuppliersToReview
                    .sort((a, b) => a.deliveryCompliance - b.deliveryCompliance)
                    .map((s) => (
                      <Link
                        key={s.id}
                        to="/proveedores"
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                          <p className="text-xs text-slate-500">
                            Cumple {s.deliveryCompliance}% · última compra{" "}
                            {formatDate(s.lastPurchaseDate)}
                          </p>
                        </div>
                        <StatusBadge kind="supplier" value={s.status} dot={false} />
                      </Link>
                    ))
                )}
              </CardBody>
            </Card>
          </div>

          {/* Sobrestock */}
          <div id="sobrestock">
            <h3 className="text-sm font-semibold text-slate-800 mb-2.5">
              Mi inventario con sobrestock
            </h3>
            <Card>
              <CardBody className="space-y-2">
                {overstockProducts.length === 0 ? (
                  <EmptyState
                    icon={<IconCheck className="w-6 h-6" />}
                    title="Sin sobrestock"
                    description="No tienes capital inmovilizado relevante."
                  />
                ) : (
                  overstockProducts
                    .sort((a, b) => b.availableStock * b.cost - a.availableStock * a.cost)
                    .map((p) => (
                      <Link
                        key={p.sku}
                        to={`/productos/${p.sku}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                          <p className="text-xs text-slate-500">
                            Disp. {formatNumber(p.availableStock)} · {formatNumber(p.inventoryDays)}{" "}
                            días inv.
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-violet-600 flex-shrink-0">
                          {formatCurrencyCompact(p.availableStock * p.cost)}
                        </span>
                      </Link>
                    ))
                )}
              </CardBody>
            </Card>
          </div>
        </div>
        {/* fin columna derecha */}
      </div>
      {/* fin grid 2 columnas */}
    </div>
  );
}

function AttentionMetric({
  label,
  value,
  detail,
  tone,
  to,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "red" | "amber" | "blue" | "violet";
  to: string;
}) {
  const toneClass = {
    red: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-brand-200 bg-brand-50 text-brand-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  }[tone];

  return (
    <a href={to} className={`rounded-lg border p-3 transition-colors hover:bg-white ${toneClass}`}>
      <span className="block text-xs font-medium">{label}</span>
      <span className="mt-1 block text-2xl font-semibold leading-none text-slate-900">{value}</span>
      <span className="mt-1 block text-xs text-slate-500">{detail}</span>
    </a>
  );
}

function PortfolioMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PortfolioGroup({
  label,
  items,
  tone,
  moreTo,
}: {
  label: string;
  items: string[];
  tone: "blue" | "amber" | "violet";
  moreTo: string;
}) {
  const shown = items.slice(0, 5);
  const remaining = Math.max(0, items.length - shown.length);
  const toneClass = {
    blue: "bg-brand-50 text-brand-700 border-brand-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  }[tone];

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <Link to={moreTo} className="text-xs font-medium text-brand-600 hover:text-brand-700">
          Ver
        </Link>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {shown.map((item) => (
          <span key={item} className={`rounded-full border px-2 py-1 text-xs ${toneClass}`}>
            {item}
          </span>
        ))}
        {remaining > 0 && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
            +{remaining}
          </span>
        )}
      </div>
    </div>
  );
}

function SalesPaceCard({
  id,
  tone,
  title,
  description,
  icon,
  rows,
  emptyTitle,
  emptyDescription,
}: {
  id: string;
  tone: "blue" | "amber";
  title: string;
  description: string;
  icon: ReactNode;
  rows: SalesPaceRow[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const toneClass =
    tone === "blue"
      ? "bg-brand-50 text-brand-700 border-brand-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <div id={id}>
      <Card>
        <CardHeader
          title={title}
          description={description}
          action={<span className={`rounded-lg border p-2 ${toneClass}`}>{icon}</span>}
        />
        <CardBody className="space-y-2">
          {rows.length === 0 ? (
            <EmptyState title={emptyTitle} description={emptyDescription} />
          ) : (
            rows.map((r) => {
              const diff = Math.round(r.diffPct * 100);
              const absDiff = Math.abs(diff);
              const risk =
                tone === "blue" && r.coverage <= r.product.supplierLeadTimeDays * 2
                  ? "Cobertura corta"
                  : tone === "amber"
                    ? `${formatNumber(r.product.inventoryDays)} días inv.`
                    : `${formatDays(r.coverage)} cobertura`;

              return (
                <Link
                  key={r.product.sku}
                  to={`/productos/${r.product.sku}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">
                      {r.product.name}
                    </span>
                    <span className="block text-xs text-slate-500 truncate">
                      Esperado {formatNumber(Math.round(r.expected30))} u. · real{" "}
                      {formatNumber(r.product.salesLast30Days)} u.
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge tone={tone === "blue" ? "blue" : "amber"}>
                      {tone === "blue" ? "+" : "-"}
                      {formatNumber(absDiff)}%
                    </Badge>
                    <span className="text-xs text-slate-500">{risk}</span>
                  </span>
                </Link>
              );
            })
          )}
        </CardBody>
      </Card>
    </div>
  );
}

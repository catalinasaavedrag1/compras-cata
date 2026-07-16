import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import {
  IconAlerts,
  IconReplenish,
  IconTruck,
  IconClock,
  IconCampaign,
} from "../components/ui/icons";
import { products } from "../data/mockProducts";
import { recommendations } from "../data/mockRecommendations";
import { suppliers } from "../data/mockSuppliers";
import { campaignOpportunities } from "../data/mockCampaignOpportunities";
import { orderBySignal } from "../utils/orderConsolidation";
import {
  InicioPortada,
  type AgendaEntry,
  type PendingWork,
} from "./myPanel/InicioPortada";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { categories } from "../data/mockCategories";
import { useBuyer } from "../context/BuyerContext";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { useSignals } from "../context/SignalsContext";
import {
  coverageDays,
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
import type {
  AgendaItem,
  BrandPortfolioRow,
  KeyProductRow,
  PortfolioFocus,
  PortfolioOpportunity,
  PortfolioProductRole,
  RiskRow,
  SalesPaceRow,
  SupplierPortfolioRow,
} from "./myPanel/types";
import {
  BrandsSuppliersTables,
  CategoriesCard,
  ExecutiveSummary,
  LostSalesCard,
  MonthGoalsCard,
  OpenOrdersList,
  OpportunitiesSummary,
  OverstockList,
  PortfolioFocusWorkspace,
  PortfolioHeaderCard,
  PortfolioHealthFocus,
  PortfolioQualityCard,
  SalesSignalsCard,
  SectionLabel,
  StockoutRiskCard,
  StrategicProductsCard,
  SuppliersToReviewList,
  TrendsCard,
} from "./myPanel/components";

export function MyPanelPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPortfolioView = location.pathname.startsWith("/mi-cartera");
  const portfolioFocus: PortfolioFocus = location.pathname.includes("/productos-clave")
    ? "productos-clave"
    : location.pathname.includes("/marcas")
      ? "marcas"
      : location.pathname.includes("/proveedores")
        ? "proveedores"
        : location.pathname.includes("/oportunidades")
          ? "oportunidades"
          : "resumen";
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
  const { addItem, hasItem, count: draftCount, totalAmount: draftTotal } = useOcDraft();
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

  const portfolioInsights = useMemo(() => {
    const productRows = myProducts
      .map<KeyProductRow>((p) => {
        const salesValue = p.salesLast30Days * p.price;
        const grossProfit = p.salesLast30Days * (p.price - p.cost);
        const inventoryValue = Math.max(1, p.availableStock * p.cost);
        const gmroi = (grossProfit * 12) / inventoryValue;
        const expected30 = p.salesLast90Days / 3;
        const growthPct = expected30 > 0 ? (p.salesLast30Days - expected30) / expected30 : 0;
        const coverage = coverageDays(p.availableStock, p.salesLast30Days);

        let role: PortfolioProductRole = "Riesgo";
        let reason = "Requiere revisión por disponibilidad, margen o rotación.";
        if (p.salesLast30Days === 0 && p.availableStock > 0) {
          role = "Detenido";
          reason = "Tiene stock, capital inmovilizado y venta detenida.";
        } else if (growthPct <= -0.25 && p.availableStock > 0) {
          role = "Deterioro";
          reason = "Se está frenando contra su ritmo reciente.";
        } else if (growthPct >= 0.25) {
          role = "Emergente";
          reason = "Acelera venta y puede necesitar mayor profundidad.";
        } else if (salesValue > 0 && p.margin >= 34 && gmroi >= 4) {
          role = "Estrella";
          reason = "Combina venta, margen y productividad del capital.";
        } else if (salesValue > 0 && p.margin >= 36) {
          role = "Margen";
          reason = "Genera rentabilidad por unidad y conviene proteger precio/costo.";
        } else if (salesValue > 0 && p.salesLast30Days >= 40) {
          role = "Tractor";
          reason = "Mueve tráfico y frecuencia aunque el margen no sea el mejor.";
        }

        return { product: p, role, salesValue, grossProfit, gmroi, growthPct, coverage, reason };
      })
      .sort((a, b) => {
        const order: Record<PortfolioProductRole, number> = {
          Estrella: 0,
          Tractor: 1,
          Margen: 2,
          Emergente: 3,
          Riesgo: 4,
          Deterioro: 5,
          Detenido: 6,
        };
        return order[a.role] - order[b.role] || b.salesValue - a.salesValue;
      });

    const brandRows = Array.from(new Set(myProducts.map((p) => p.brand).filter(Boolean)))
      .map<BrandPortfolioRow>((brand) => {
        const rows = myProducts.filter((p) => p.brand === brand);
        const sales = rows.reduce((sum, p) => sum + p.salesLast30Days * p.price, 0);
        const profit = rows.reduce((sum, p) => sum + p.salesLast30Days * (p.price - p.cost), 0);
        const inventory = rows.reduce((sum, p) => sum + p.availableStock * p.cost, 0);
        const expected = rows.reduce((sum, p) => sum + (p.salesLast90Days / 3) * p.price, 0);
        const growth = expected > 0 ? (sales - expected) / expected : 0;
        const stockouts = rows.filter((p) => p.availableStock <= 0 && p.salesLast30Days > 0).length;
        return {
          brand,
          sales,
          margin: sales > 0 ? (profit / sales) * 100 : 0,
          inventory,
          growth,
          stockouts,
          skus: rows.length,
        };
      })
      .sort((a, b) => b.sales - a.sales);

    const supplierRows = suppliers
      .filter((s) => s.categories.some((c) => myCategories.includes(c)))
      .map<SupplierPortfolioRow>((supplier) => {
        const rows = myProducts.filter((p) => p.supplierName === supplier.name);
        const sales = rows.reduce((sum, p) => sum + p.salesLast30Days * p.price, 0);
        const stalled = rows.filter((p) => p.salesLast30Days === 0 && p.availableStock > 0).length;
        const alternatives = rows.filter((p) => (p.equivalencias?.length ?? 0) > 0).length;
        return {
          supplier,
          sales,
          stalled,
          skus: rows.length,
          alternatives,
          dependency: myProducts.length > 0 ? rows.length / myProducts.length : 0,
        };
      })
      .sort((a, b) => b.sales - a.sales);

    const opportunities: PortfolioOpportunity[] = [
      ...productRows
        .filter((r) => r.role === "Emergente" && r.coverage <= r.product.supplierLeadTimeDays * 2)
        .slice(0, 3)
        .map((r) => ({
          title: r.product.name,
          label: "Crecimiento con poca cobertura",
          detail: `Venta ${formatPercent(r.growthPct * 100, 0)} vs ritmo esperado · cubre ${formatDays(r.coverage)}`,
          to: `/productos/${r.product.sku}`,
          tone: "blue" as const,
        })),
      ...productRows
        .filter((r) => r.role === "Margen" && r.product.availableStock > 0)
        .slice(0, 3)
        .map((r) => ({
          title: r.product.name,
          label: "Buen margen por potenciar",
          detail: `Margen ${formatPercent(r.product.margin)} · GMROI ${r.gmroi.toFixed(1)}`,
          to: `/productos/${r.product.sku}`,
          tone: "green" as const,
        })),
      ...supplierRows
        .filter((s) => s.alternatives > 0)
        .slice(0, 2)
        .map((s) => ({
          title: s.supplier.name,
          label: "Alternativas para negociar",
          detail: `${s.alternatives} SKU con proveedor alternativo · dependencia ${formatPercent(s.dependency * 100, 0)}`,
          to: `/proveedores/${s.supplier.id}?tab=negociacion`,
          tone: "amber" as const,
        })),
    ];

    const health = {
      venta: Math.min(
        100,
        Math.round(65 + salesPace.faster.length * 5 - salesPace.slower.length * 3)
      ),
      margen: Math.max(0, Math.min(100, Math.round(portfolio.marginPct * 2.4))),
      inventario: Math.max(
        0,
        Math.min(
          100,
          100 - Math.round((portfolio.overstockValue / Math.max(1, portfolio.inventoryValue)) * 120)
        )
      ),
      disponibilidad: Math.max(
        0,
        Math.min(
          100,
          100 -
            productRows.filter(
              (r) =>
                r.product.salesLast30Days > 0 &&
                (r.product.availableStock <= 0 || r.coverage <= r.product.supplierLeadTimeDays * 2)
            ).length *
              8
        )
      ),
      surtido: Math.max(
        0,
        Math.min(100, 85 - productRows.filter((r) => r.role === "Detenido").length * 4)
      ),
      proveedores: Math.max(
        0,
        Math.min(100, 90 - supplierRows.filter((s) => s.supplier.status !== "active").length * 10)
      ),
    };

    return { productRows, brandRows, supplierRows, opportunities, health };
  }, [myProducts, myCategories, portfolio, salesPace.faster.length, salesPace.slower.length]);

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

  const mySuppliersToReview = suppliers.filter(
    (s) =>
      s.categories.some((c) => myCategories.includes(c)) &&
      ["review", "delayed", "inactive"].includes(s.status)
  );

  // ---- Salud del catálogo (#4): costo, margen y novedades por revisar ----
  const costStaleBefore = addDaysISO(TODAY_ISO, -90);
  const outdatedCostProducts = myProducts.filter((p) => p.costUpdatedAt < costStaleBefore);
  const lowMarginProducts = myProducts.filter((p) => p.margin < 20);
  const newProductsToReview = myProducts.filter((p) => p.productStatus === "new");

  // ---- Historia de "Mi cartera": tendencias, objetivos, salud y focos ----
  const story = useMemo(() => {
    // Base "mes anterior" = promedio de los 2 meses previos (datos reales del maestro).
    const prevBasis = (p: (typeof myProducts)[number]) =>
      Math.max(0, (p.salesLast90Days - p.salesLast30Days) / 2);
    const prevSales = myProducts.reduce((s, p) => s + prevBasis(p) * p.price, 0);
    const prevGross = myProducts.reduce((s, p) => s + prevBasis(p) * (p.price - p.cost), 0);
    const salesTrendPct = prevSales > 0 ? (portfolio.salesValue / prevSales - 1) * 100 : 0;
    const prevMargin = prevSales > 0 ? (prevGross / prevSales) * 100 : portfolio.marginPct;
    const marginDelta = portfolio.marginPct - prevMargin;
    const rotationDelta = portfolio.rotation * (salesTrendPct / 100);
    const gmroiDelta = portfolio.gmroi * (salesTrendPct / 100);
    const coverageDelta = -(portfolio.coverageWeighted * (salesTrendPct / 100));

    // Salud: score global + fortaleza y mayor problema.
    const dimEntries = Object.entries(portfolioInsights.health) as [string, number][];
    const score = Math.round(dimEntries.reduce((a, [, v]) => a + v, 0) / dimEntries.length);
    const best = dimEntries.reduce((b, e) => (e[1] > b[1] ? e : b));
    const worst = dimEntries.reduce((w, e) => (e[1] < w[1] ? e : w));

    // Productos estratégicos: top 3 por utilidad y su participación.
    const totalGross =
      myProducts.reduce((s, p) => s + p.salesLast30Days * (p.price - p.cost), 0) || 1;
    const strategic = [...portfolioInsights.productRows]
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, 3)
      .map((row) => ({ row, utilShare: (row.grossProfit / totalGross) * 100 }));

    // Objetivos del mes.
    const metaVenta = Math.round((portfolio.salesValue * 1.18) / 500000) * 500000;
    const relevant = myProducts.filter((p) => p.salesLast30Days > 0);
    const withStock = relevant.filter((p) => p.availableStock > 0).length;
    const disponibilidad = relevant.length > 0 ? (withStock / relevant.length) * 100 : 100;
    const goals = {
      venta: { actual: portfolio.salesValue, meta: metaVenta },
      margen: { actual: portfolio.marginPct, meta: 33 },
      sobrestock: { actual: portfolio.overstockValue, meta: 3000000 },
      disponibilidad: { actual: disponibilidad, meta: 96 },
    };

    // Oportunidades resumidas por tipo.
    const oppSummary = [
      {
        label: "Buen margen por potenciar",
        count: portfolioInsights.productRows.filter(
          (r) => r.role === "Margen" && r.product.availableStock > 0
        ).length,
        tone: "green" as const,
      },
      { label: "Ventas acelerando", count: salesPace.faster.length, tone: "blue" as const },
      {
        label: "Proveedor alternativo",
        count: portfolioInsights.supplierRows.reduce((a, s) => a + s.alternatives, 0),
        tone: "amber" as const,
      },
      { label: "Productos nuevos", count: newProductsToReview.length, tone: "violet" as const },
    ];

    const atributosIncompletos = myProducts.filter(
      (p) => !p.codigoBarras || !p.unidadCompra
    ).length;

    return {
      salesTrendPct,
      marginDelta,
      rotationDelta,
      gmroiDelta,
      coverageDelta,
      score,
      best,
      worst,
      strategic,
      goals,
      oppSummary,
      atributosIncompletos,
    };
  }, [
    myProducts,
    portfolio,
    portfolioInsights,
    salesPace.faster.length,
    newProductsToReview.length,
  ]);

  // ---- Agenda de decisiones: prioridad + impacto + urgencia ----
  const daysTo = (iso: string) =>
    Math.round(
      (new Date(`${iso}T00:00:00`).getTime() - new Date(`${TODAY_ISO}T00:00:00`).getTime()) /
        86400000
    );

  const agenda: AgendaItem[] = [];
  riskRows.forEach((r) => {
    const due = r.product.availableStock <= 0 ? TODAY_ISO : (r.stockoutDate ?? TODAY_ISO);
    const riskRevenue = Math.round(Math.max(1, r.product.salesLast30Days) * r.product.price);
    agenda.push({
      id: `q-${r.product.sku}`,
      dueDate: due,
      days: Math.max(daysTo(due), r.product.availableStock <= 0 ? -1 : daysTo(due)),
      kind: "Compra",
      urgency: r.product.availableStock <= 0 ? "CRÍTICO · HOY" : "ALTA PRIORIDAD",
      title: r.product.name,
      meta: `${r.product.availableStock <= 0 ? "Quiebre activo" : "Riesgo de quiebre"} · stock ${formatNumber(r.product.availableStock)} u. · cobertura ${formatDays(r.coverage)}`,
      impact: `Venta en riesgo: ${formatCurrencyCompact(riskRevenue)}`,
      recommendation: `Recomendación: comprar ${formatNumber(r.suggestedQty)} u.`,
      actionLabel: "Revisar compra",
      to: `/productos/${r.product.sku}`,
      tone: "red",
      priority: r.product.availableStock <= 0 ? 1000 : 900 - Math.min(200, Math.round(r.coverage)),
      impactValue: riskRevenue,
    });
  });
  salesPace.faster.slice(0, 3).forEach((r) => {
    const salesValue = Math.round(r.product.salesLast30Days * r.product.price);
    agenda.push({
      id: `fast-${r.product.sku}`,
      dueDate: TODAY_ISO,
      days: 0,
      kind: "Inventario",
      urgency: r.coverage <= r.product.supplierLeadTimeDays * 2 ? "ALTA PRIORIDAD" : "HOY",
      title: r.product.name,
      meta: `Venta ${formatNumber(Math.round(r.diffPct * 100))}% sobre lo esperado · cobertura ${formatDays(r.coverage)}`,
      impact: `Venta mensual: ${formatCurrencyCompact(salesValue)}`,
      recommendation:
        r.coverage <= r.product.supplierLeadTimeDays * 2
          ? "Recomendación: anticipar compra"
          : "Recomendación: revisar profundidad",
      actionLabel: "Revisar stock",
      to: `/productos/${r.product.sku}`,
      tone: r.coverage <= r.product.supplierLeadTimeDays * 2 ? "red" : "blue",
      priority: r.coverage <= r.product.supplierLeadTimeDays * 2 ? 830 : 620,
      impactValue: salesValue,
    });
  });
  salesPace.slower.slice(0, 3).forEach((r) => {
    const exposedCapital = Math.round(r.product.availableStock * r.product.cost);
    agenda.push({
      id: `slow-${r.product.sku}`,
      dueDate: addDaysISO(TODAY_ISO, 7),
      days: 7,
      kind: "Margen",
      urgency: "ESTA SEMANA",
      title: r.product.name,
      meta: `Venta ${formatNumber(Math.abs(Math.round(r.diffPct * 100)))}% bajo lo esperado · stock ${formatNumber(r.product.availableStock)} u.`,
      impact: `Capital expuesto: ${formatCurrencyCompact(exposedCapital)}`,
      recommendation: "Recomendación: frenar recompra o activar salida",
      actionLabel: "Revisar venta",
      to: `/productos/${r.product.sku}`,
      tone: "amber",
      priority: 520,
      impactValue: exposedCapital,
    });
  });
  myOpenOrders.forEach((o) => {
    agenda.push({
      id: `oc-${o.id}`,
      dueDate: o.expectedDate,
      days: daysTo(o.expectedDate),
      kind: "OC",
      urgency: o.delayedDays > 0 ? `ATRASADO · ${o.delayedDays} DÍAS` : "POR RECIBIR",
      title: o.number,
      meta: `${o.supplierName} · ${formatCurrencyCompact(o.totalAmount)} pendientes · ${o.skuCount} SKU afectados`,
      impact:
        o.delayedDays > 0
          ? `${o.delayedDays} días de atraso`
          : `Entrega esperada ${formatDate(o.expectedDate)}`,
      recommendation: "Recomendación: confirmar entrega o ajustar reposición",
      actionLabel: "Revisar OC",
      to: "/comprar/seguimiento",
      tone: o.delayedDays > 0 ? "red" : "amber",
      priority: o.delayedDays > 0 ? 880 + Math.min(80, o.delayedDays) : 560,
      impactValue: o.totalAmount,
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
      urgency: s.status === "delayed" ? "ALTA PRIORIDAD" : "SEGUIMIENTO",
      title: s.name,
      meta: `Cumplimiento ${s.deliveryCompliance}% · última compra ${formatDate(s.lastPurchaseDate)}`,
      impact: `${s.categories.filter((c) => myCategories.includes(c)).length} categorías afectadas`,
      recommendation: "Recomendación: revisar cumplimiento y alternativas",
      actionLabel: "Revisar proveedor",
      to: "/proveedores",
      tone: "amber",
      priority: s.status === "delayed" ? 760 : 470,
      impactValue: 0,
    });
  });
  overstockProducts.forEach((p) => {
    const exposedCapital = Math.round(p.availableStock * p.cost);
    const due = addDaysISO(TODAY_ISO, 30);
    agenda.push({
      id: `over-${p.sku}`,
      dueDate: due,
      days: daysTo(due),
      kind: "Inventario",
      urgency: "DESPUÉS",
      title: p.name,
      meta: `Sobrestock · ${formatNumber(p.availableStock)} u. · ${formatNumber(p.inventoryDays)} días inv.`,
      impact: `${formatCurrencyCompact(exposedCapital)} inmovilizado`,
      recommendation: "Recomendación: liquidar, transferir o pausar compra",
      actionLabel: "Revisar sobrestock",
      to: `/productos/${p.sku}`,
      tone: "violet",
      priority: 390,
      impactValue: exposedCapital,
    });
  });
  myApprovals.forEach((a) => {
    agenda.push({
      id: `apr-${a.id}`,
      dueDate: a.date,
      days: daysTo(a.date),
      kind: "Aprobación",
      urgency: "REQUIERE DECISIÓN",
      title: a.productName,
      meta: `${a.supplierName} · solicitado ${formatNumber(a.requestedQty)} u. vs sugerido ${formatNumber(a.suggestedQty)} u.`,
      impact: `Monto: ${formatCurrencyCompact(a.amount)}`,
      recommendation: `Motivo: ${a.justification}`,
      actionLabel: "Revisar aprobación",
      to: "/comprar/aprobaciones",
      tone: "amber",
      priority: 780,
      impactValue: a.amount,
    });
  });

  const priorityAgenda = [...agenda].sort(
    (a, b) => b.priority - a.priority || b.impactValue - a.impactValue || a.days - b.days
  );
  const agendaCounts = {
    prioridad: agenda.length,
    hoy: agenda.filter((a) => a.days <= 0).length,
    semana: agenda.filter((a) => a.days > 0 && a.days <= 7).length,
    despues: agenda.filter((a) => a.days > 7).length,
  };
  // ==========================================================================
  //  Portada de Inicio (bandeja diaria del comprador).
  //  Prioridades + agenda + resumen + trabajo pendiente, en vez de un dashboard.
  // ==========================================================================
  const portadaPriorities = priorityAgenda.slice(0, 6);

  const portadaSummary = {
    categorias: myCategories.length,
    quiebres: riskRows.filter((r) => r.product.availableStock <= 0).length,
    riesgos: riskRows.length,
    sobrestock: formatCurrencyCompact(portfolio.overstockValue),
    ocAtrasadas: myOpenOrders.filter((o) => o.delayedDays > 0).length,
  };

  const whenLabel = (days: number): string =>
    days <= 0 ? "hoy" : days === 1 ? "mañana" : days <= 30 ? `${days}d` : formatDate(addDaysISO(TODAY_ISO, days)).slice(0, 5);

  const portadaAgenda = useMemo<AgendaEntry[]>(() => {
    const entries: AgendaEntry[] = [];

    // Fechas límite para emitir órdenes (quiebre − lead time).
    riskRows
      .map((r) => ({
        r,
        sig: orderBySignal(
          r.product.availableStock,
          r.product.salesLast30Days,
          r.product.supplierLeadTimeDays,
          TODAY_ISO
        ),
      }))
      .filter(({ sig }) => sig.orderByDate && sig.status !== "ok" && sig.status !== "none")
      .sort((a, b) => (a.sig.daysToOrderBy ?? 0) - (b.sig.daysToOrderBy ?? 0))
      .slice(0, 2)
      .forEach(({ r, sig }) => {
        entries.push({
          id: `ob-${r.product.sku}`,
          icon: IconReplenish,
          title: `Emitir OC · ${r.product.name}`,
          detail:
            sig.status === "overdue"
              ? "Ya deberías haberla emitido — llegaría con quiebre"
              : `Emitir antes del ${formatDate(sig.orderByDate!)}`,
          when: whenLabel(sig.daysToOrderBy ?? 0),
          tone: sig.status === "overdue" ? "red" : "amber",
          to: `/productos/${r.product.sku}`,
        });
      });

    // Órdenes atrasadas que requieren seguimiento.
    myOpenOrders
      .filter((o) => o.delayedDays > 0)
      .slice(0, 1)
      .forEach((o) => {
        entries.push({
          id: `fu-${o.id}`,
          icon: IconClock,
          title: `Seguir OC atrasada · ${o.supplierName}`,
          detail: `${o.number} · ${o.delayedDays} días de atraso`,
          when: `${o.delayedDays}d`,
          tone: "red",
          to: "/comprar/seguimiento",
        });
      });

    // Llegadas próximas (OC por recibir a tiempo).
    myOpenOrders
      .filter((o) => o.delayedDays <= 0)
      .sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1))
      .slice(0, 2)
      .forEach((o) => {
        entries.push({
          id: `arr-${o.id}`,
          icon: IconTruck,
          title: `Llega ${o.number}`,
          detail: `${o.supplierName} · ${formatCurrencyCompact(o.totalAmount)}`,
          when: whenLabel(daysTo(o.expectedDate)),
          tone: "blue",
          to: "/comprar/seguimiento",
        });
      });

    // Promociones/campañas próximas en mis categorías (una entrada por campaña).
    const seenCampaigns = new Set<string>();
    campaignOpportunities
      .filter((c) => myCategories.includes(c.category) && c.daysToCampaign >= 0 && c.daysToCampaign <= 21)
      .sort((a, b) => a.daysToCampaign - b.daysToCampaign)
      .forEach((c) => {
        if (seenCampaigns.has(c.campaignName) || seenCampaigns.size >= 2) return;
        seenCampaigns.add(c.campaignName);
        entries.push({
          id: `promo-${c.id}`,
          icon: IconCampaign,
          title: `Campaña · ${c.campaignName}`,
          detail: `Prepara stock en ${c.category} (+${Math.round(c.growthRate)}%)`,
          when: whenLabel(c.daysToCampaign),
          tone: "violet",
          to: "/anticipacion",
        });
      });

    return entries.slice(0, 7);
  }, [riskRows, myOpenOrders, myCategories]);

  const portadaPending = useMemo<PendingWork[]>(() => {
    const proposals = recommendations.filter(
      (r) => (r.status === "critical" || r.status === "buy_now") && r.suggestedQuantity > 0
    ).length;
    return [
      {
        id: "propuestas",
        label: "Propuestas de compra por revisar",
        detail: "Quiebres y recomendaciones que inician la compra",
        count: proposals,
        tone: "red",
        to: "/comprar/decisiones",
      },
      {
        id: "borrador",
        label: "Órdenes en preparación",
        detail: draftCount > 0 ? `${formatCurrencyCompact(draftTotal)} en borrador` : "Sin borrador activo",
        count: draftCount,
        tone: "blue",
        to: "/comprar/borradores",
      },
      {
        id: "aprobaciones",
        label: "Esperando aprobación",
        detail: "Compras fuera de criterio",
        count: myApprovals.length,
        tone: "amber",
        to: "/comprar/aprobaciones",
      },
      {
        id: "proveedores",
        label: "Proveedores por contactar",
        detail: "Bajo cumplimiento o sin respuesta",
        count: mySuppliersToReview.length,
        tone: "amber",
        to: "/proveedores",
      },
      {
        id: "senales",
        label: "Señales de ventas por resolver",
        detail: "Reportes del equipo de ventas en tus categorías",
        count: mySignals.length,
        tone: "violet",
        to: "/senales-ventas",
      },
    ];
  }, [draftCount, draftTotal, myApprovals.length, mySuppliersToReview.length, mySignals.length]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

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
      onClick: () => navigate("/comprar/borradores"),
    });
  };


  const portfolioHeader = {
    resumen: {
      title: `Mi cartera · ${buyer}`,
      description:
        "Cómo está funcionando tu negocio: venta, margen, inventario, cobertura, surtido y proveedores.",
    },
    "productos-clave": {
      title: `Productos clave · ${buyer}`,
      description:
        "Clasifica qué SKU mueven venta, margen, tráfico, crecimiento o riesgo antes de decidir compras.",
    },
    marcas: {
      title: `Marcas · ${buyer}`,
      description:
        "Lee qué marcas ganan participación, cuáles deterioran margen y dónde se está consumiendo capital.",
    },
    proveedores: {
      title: `Proveedores · ${buyer}`,
      description:
        "Prioriza relaciones, dependencia y puntos de negociación de los proveedores de tu cartera.",
    },
    oportunidades: {
      title: `Oportunidades · ${buyer}`,
      description:
        "Encuentra crecimiento, margen protegible y alternativas comerciales antes de que sean urgencias.",
    },
  } satisfies Record<PortfolioFocus, { title: string; description: string }>;

  return (
    <div>
      <PageHeader
        title={
          isPortfolioView
            ? portfolioHeader[portfolioFocus].title
            : `${greeting}, ${buyer.split(" ")[0]}`
        }
        description={
          isPortfolioView
            ? portfolioHeader[portfolioFocus].description
            : agenda.length > 0
              ? `Esto requiere tu atención hoy · ${formatNumber(agendaCounts.hoy)} para hoy · ${formatNumber(agendaCounts.semana)} esta semana`
              : "Esto requiere tu atención hoy"
        }
        action={
          <Button
            variant="secondary"
            onClick={() => navigate(isPortfolioView ? "/" : "/comprar/decisiones")}
            icon={
              isPortfolioView ? (
                <IconAlerts className="w-4 h-4" />
              ) : (
                <IconReplenish className="w-4 h-4" />
              )
            }
          >
            {isPortfolioView ? "Ver decisiones" : "Ir a reposición"}
          </Button>
        }
      />

      {!isPortfolioView && (
        <InicioPortada
          priorities={portadaPriorities}
          agenda={portadaAgenda}
          summary={portadaSummary}
          pending={portadaPending}
        />
      )}

      {/* 1 · Mi cartera — ¿qué administro? */}
      {isPortfolioView && (
        <PortfolioHeaderCard
          catNames={myCats.map((c) => c.name)}
          skuCount={myProducts.length}
          subcatCount={portfolio.subcategories.length}
          supplierCount={portfolio.supplierNames.length}
          brandCount={portfolio.brands.length}
        />
      )}

      {/* 2 · Objetivos del mes — ¿voy en camino a mis metas? */}
      {isPortfolioView && portfolioFocus === "resumen" && <MonthGoalsCard goals={story.goals} />}

      {/* 3 · Resumen ejecutivo — ¿cómo está funcionando? (con tendencia) */}
      {isPortfolioView && portfolioFocus === "resumen" && (
        <ExecutiveSummary portfolio={portfolio} story={story} riskCount={riskRows.length} />
      )}

      {isPortfolioView && portfolioFocus !== "resumen" && (
        <PortfolioFocusWorkspace
          focus={portfolioFocus}
          productRows={portfolioInsights.productRows}
          brandRows={portfolioInsights.brandRows}
          supplierRows={portfolioInsights.supplierRows}
          opportunities={portfolioInsights.opportunities}
        />
      )}

      {/* 4 · Salud de cartera (compacta) + 5 · Principales focos */}
      {isPortfolioView && portfolioFocus === "resumen" && (
        <PortfolioHealthFocus
          score={story.score}
          best={story.best}
          worst={story.worst}
          health={portfolioInsights.health}
          riskCount={riskRows.length}
          overstockValue={portfolio.overstockValue}
          opportunityCount={portfolioInsights.opportunities.length}
          suppliersToReviewCount={mySuppliersToReview.length}
          newProductsCount={newProductsToReview.length}
        />
      )}

      {/* 6 · Productos estratégicos (top 3 por utilidad) */}
      {isPortfolioView && portfolioFocus === "resumen" && (
        <StrategicProductsCard strategic={story.strategic} />
      )}

      {/* 7 · Marcas + 8 · Proveedores (tablas compactas) */}
      {isPortfolioView && portfolioFocus === "resumen" && (
        <BrandsSuppliersTables
          brandRows={portfolioInsights.brandRows}
          supplierRows={portfolioInsights.supplierRows}
        />
      )}

      {/* 9 · Oportunidades (resumen) */}
      {isPortfolioView && portfolioFocus === "resumen" && (
        <OpportunitiesSummary oppSummary={story.oppSummary} />
      )}

      {/* 10 · Tendencias — acelerando vs desacelerando (unificado) */}
      {isPortfolioView && <TrendsCard faster={salesPace.faster} slower={salesPace.slower} />}

      {/* 11 · Categorías — comparar venta, margen e indicadores */}
      {isPortfolioView && <CategoriesCard cats={myCats} />}

      {/* 12 · Calidad de cartera — qué mejorar estructuralmente (datos y mantenimiento) */}
      {isPortfolioView && (
        <PortfolioQualityCard
          outdatedCostCount={outdatedCostProducts.length}
          lowMarginCount={lowMarginProducts.length}
          newProductsCount={newProductsToReview.length}
          incompleteAttributes={story.atributosIncompletos}
        />
      )}

      {/* Trabajo del día: riesgo de quiebre y pendientes operativos */}
      {!isPortfolioView && <SectionLabel>Trabajo del día</SectionLabel>}
      {!isPortfolioView && (
        <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Riesgo de quiebre */}
            <StockoutRiskCard
              rows={riskRows}
              hasItem={hasItem}
              onAdd={handleAdd}
              onOpenProduct={(sku) => navigate(`/productos/${sku}`)}
            />

            {/* OC sin recibir */}
            <OpenOrdersList orders={myOpenOrders} />
          </div>
          {/* fin columna izquierda */}

          <div className="space-y-5">
            {/* Proveedores por revisar */}
            <SuppliersToReviewList suppliers={mySuppliersToReview} />

            {/* Sobrestock */}
            <OverstockList products={overstockProducts} />
          </div>
          {/* fin columna derecha */}
        </div>
      )}
      {/* fin grid 2 columnas */}

      {/* Qué estás perdiendo hoy */}
      {!isPortfolioView && myLostOpps.length > 0 && (
        <LostSalesCard lostOpps={myLostOpps} lostRevenue={myLostRevenue} />
      )}

      {/* Qué te reporta ventas desde el terreno */}
      {!isPortfolioView && <SalesSignalsCard signals={mySignals} />}
    </div>
  );
}

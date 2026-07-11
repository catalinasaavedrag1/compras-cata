import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, type Column } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { StatusBadge } from "../components/business/StatusBadge";
import { CollapsibleSection } from "../components/ui/CollapsibleSection";
import {
  IconAlerts,
  IconBox,
  IconOrders,
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
import { cn } from "../utils/cn";
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

type PortfolioProductRole =
  | "Estrella"
  | "Tractor"
  | "Margen"
  | "Emergente"
  | "Deterioro"
  | "Detenido"
  | "Riesgo";

interface KeyProductRow {
  product: Product;
  role: PortfolioProductRole;
  salesValue: number;
  grossProfit: number;
  gmroi: number;
  growthPct: number;
  coverage: number;
  reason: string;
}

type PortfolioFocus = "resumen" | "productos-clave" | "marcas" | "proveedores" | "oportunidades";

interface BrandPortfolioRow {
  brand: string;
  sales: number;
  margin: number;
  inventory: number;
  growth: number;
  stockouts: number;
  skus: number;
}

interface SupplierPortfolioRow {
  supplier: (typeof suppliers)[number];
  sales: number;
  stalled: number;
  skus: number;
  alternatives: number;
  dependency: number;
}

interface PortfolioOpportunity {
  title: string;
  label: string;
  detail: string;
  to: string;
  tone: "blue" | "green" | "amber";
}

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
  const {
    addItem,
    hasItem,
    items: draftItems,
    count: draftCount,
    totalAmount: draftTotal,
  } = useOcDraft();
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

  // ---- Agenda de decisiones: prioridad + impacto + urgencia ----
  const [agendaView, setAgendaView] = useState<"prioridad" | "hoy" | "semana" | "despues">(
    "prioridad"
  );
  const daysTo = (iso: string) =>
    Math.round(
      (new Date(`${iso}T00:00:00`).getTime() - new Date(`${TODAY_ISO}T00:00:00`).getTime()) /
        86400000
    );

  interface AgendaItem {
    id: string;
    dueDate: string;
    days: number;
    kind: "Compra" | "OC" | "Proveedor" | "Aprobación" | "Inventario" | "Margen" | "Catálogo";
    urgency: string;
    title: string;
    meta: string;
    impact: string;
    recommendation: string;
    actionLabel: string;
    to: string;
    tone: "red" | "amber" | "violet" | "blue";
    priority: number;
    impactValue: number;
  }

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
  const agendaItems = priorityAgenda.filter((a) => {
    if (agendaView === "hoy") return a.days <= 0;
    if (agendaView === "semana") return a.days > 0 && a.days <= 7;
    if (agendaView === "despues") return a.days > 7;
    return true;
  });
  const featuredAgenda = agendaItems[0];
  const secondaryAgenda = agendaItems.slice(1, 5);
  const agendaImpact = priorityAgenda.slice(0, 7).reduce((sum, item) => sum + item.impactValue, 0);
  const agendaTabItems = [
    { value: "prioridad", label: "Prioridad", count: agendaCounts.prioridad },
    { value: "hoy", label: "Hoy", count: agendaCounts.hoy },
    { value: "semana", label: "Semana", count: agendaCounts.semana },
    { value: "despues", label: "Después", count: agendaCounts.despues },
  ] satisfies Array<{ value: typeof agendaView; label: string; count: number }>;
  const agendaCardTone = {
    red: "border-rose-200 bg-rose-50/80",
    amber: "border-amber-200 bg-amber-50/80",
    blue: "border-brand-200 bg-brand-50/80",
    violet: "border-violet-200 bg-violet-50/80",
  } satisfies Record<AgendaItem["tone"], string>;

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

  // Resumen compacto para el encabezado del día.
  const quiebresHoy = riskRows.filter((r) => r.product.availableStock <= 0).length;

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
        title={isPortfolioView ? portfolioHeader[portfolioFocus].title : `Hola, ${buyer.split(" ")[0]}`}
        description={
          isPortfolioView
            ? portfolioHeader[portfolioFocus].description
            : `${formatDate(TODAY_ISO)} · ${formatNumber(agenda.length)} decisiones pendientes · ${formatNumber(agendaCounts.hoy)} requieren atención hoy.`
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
        <section className="mb-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tu agenda de decisiones
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  {agendaCounts.hoy} requieren atención hoy · {agendaCounts.semana} esta semana
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Resuelve primero las decisiones con mayor impacto y después tus vencimientos.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:min-w-[280px]">
                <AgendaStat label="Decisiones" value={formatNumber(agenda.length)} />
                <AgendaStat label="Impacto" value={formatCurrencyCompact(agendaImpact)} />
                <AgendaStat label="Críticas" value={formatNumber(agendaCounts.hoy)} />
              </div>
            </div>

            <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {agendaTabItems.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setAgendaView(tab.value)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold whitespace-nowrap",
                    agendaView === tab.value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                      agendaView === tab.value
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-500"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {featuredAgenda ? (
              <div className="mt-4 space-y-2">
                <div className={cn("rounded-xl border p-4", agendaCardTone[featuredAgenda.tone])}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={featuredAgenda.tone} dot>
                          {featuredAgenda.kind}
                        </Badge>
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {featuredAgenda.urgency}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold leading-snug text-slate-950">
                        {featuredAgenda.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-700">{featuredAgenda.meta}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {featuredAgenda.impact}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{featuredAgenda.recommendation}</p>
                    </div>
                    <Button
                      className="w-full md:w-auto"
                      size="sm"
                      variant="primary"
                      onClick={() => navigate(featuredAgenda.to)}
                      icon={<IconChevronRight className="w-3.5 h-3.5" />}
                    >
                      {featuredAgenda.actionLabel}
                    </Button>
                  </div>
                </div>

                {secondaryAgenda.map((item) => (
                  <Link
                    key={item.id}
                    to={item.to}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 hover:border-brand-300 hover:bg-brand-50/40 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.tone}>{item.kind}</Badge>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {item.urgency}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-slate-500">{item.meta}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:flex-shrink-0">
                      <span className="text-xs font-semibold text-slate-700">{item.impact}</span>
                      <span className="text-xs font-semibold text-brand-600">
                        {item.actionLabel}
                      </span>
                    </div>
                  </Link>
                ))}

                <Link
                  to="/comprar/decisiones"
                  className="inline-flex items-center gap-1.5 px-1 pt-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  Ver agenda completa
                  <IconChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <EmptyState
                icon={<IconCheck className="w-6 h-6" />}
                title="Sin decisiones pendientes"
                description="Tu agenda está limpia. Revisa señales de cartera para anticiparte."
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Prioridad recomendada
              </p>
              {featuredAgenda ? (
                <>
                  <h3 className="mt-1 text-base font-semibold leading-snug text-slate-900">
                    {featuredAgenda.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">{featuredAgenda.impact}</p>
                  <p className="mt-1 text-sm text-slate-500">{featuredAgenda.recommendation}</p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="primary"
                    onClick={() => navigate(featuredAgenda.to)}
                    icon={<IconChevronRight className="w-3.5 h-3.5" />}
                  >
                    Revisar
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">
                    Sin prioridad crítica
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Revisa señales de cartera para anticipar próximos riesgos.
                  </p>
                </>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Continuar trabajo
              </p>
              {draftCount > 0 ? (
                <>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">
                    Borrador OC activo
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatNumber(draftCount)} SKU · {formatCurrencyCompact(draftTotal)} preparados
                    para compra.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => navigate("/comprar/borradores")}
                      icon={<IconOrders className="w-3.5 h-3.5" />}
                    >
                      Continuar
                    </Button>
                    <span className="text-xs text-slate-400">
                      Último SKU: {draftItems[draftItems.length - 1]?.productName}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">
                    Sin borrador activo
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Parte desde la prioridad recomendada o revisa reposición.
                  </p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate("/comprar/decisiones")}
                  >
                    Ir a decisiones
                  </Button>
                </>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Señales de cartera
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <SignalSummary label="Riesgos" value={formatNumber(riskRows.length)} tone="red" />
                <SignalSummary
                  label="OC pendientes"
                  value={formatNumber(myOpenOrders.length)}
                  tone="amber"
                />
                <SignalSummary
                  label="Proveedor"
                  value={formatNumber(mySuppliersToReview.length)}
                  tone="blue"
                />
                <SignalSummary
                  label="Sobrestock"
                  value={formatCurrencyCompact(portfolio.overstockValue)}
                  tone="violet"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {isPortfolioView && (
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
                <PortfolioMetric
                  label="GMROI"
                  value={portfolio.gmroi.toFixed(1).replace(".", ",")}
                />
              </div>
            </div>
          </div>
        </section>
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

      {isPortfolioView && portfolioFocus === "resumen" && (
        <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader
              title="Salud de tu cartera"
              description="Dimensiones que explican si tu negocio está sano o solo apagando incendios."
            />
            <CardBody className="space-y-2">
              {Object.entries(portfolioInsights.health).map(([label, value]) => (
                <HealthScore key={label} label={label} value={value} />
              ))}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Principales focos</p>
                <ul className="mt-1 space-y-1">
                  <li>{formatNumber(riskRows.length)} SKU con riesgo de quiebre.</li>
                  <li>{formatCurrencyCompact(portfolio.overstockValue)} en sobrestock.</li>
                  <li>
                    {portfolioInsights.productRows.filter((r) => r.role === "Detenido").length}{" "}
                    productos detenidos con stock.
                  </li>
                </ul>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Productos clave"
              description="Importante no significa solo top venta: cada SKU cumple un rol distinto."
              action={
                <Link
                  to="/mi-cartera/productos-clave"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Ver foco
                </Link>
              }
            />
            <CardBody className="space-y-2">
              {portfolioInsights.productRows.slice(0, 8).map((row) => (
                <KeyProductItem key={row.product.sku} row={row} />
              ))}
            </CardBody>
          </Card>
        </section>
      )}

      {isPortfolioView && portfolioFocus === "resumen" && (
        <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader
              title="Marcas"
              description="Participación, margen, crecimiento e inventario por marca."
            />
            <CardBody className="space-y-2">
              {portfolioInsights.brandRows.slice(0, 6).map((row) => (
                <BrandHealthItem key={row.brand} row={row} />
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Proveedores de cartera"
              description="Dependencia y señales para preparar negociación."
            />
            <CardBody className="space-y-2">
              {portfolioInsights.supplierRows.slice(0, 6).map((row) => (
                <SupplierPortfolioItem key={row.supplier.id} row={row} />
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Oportunidades comerciales"
              description="No todo es alerta: también hay crecimiento, margen y alternativas."
            />
            <CardBody className="space-y-2">
              {portfolioInsights.opportunities.length === 0 ? (
                <EmptyState
                  title="Sin oportunidades fuertes"
                  description="No hay señales comerciales destacadas en este momento."
                />
              ) : (
                portfolioInsights.opportunities
                  .slice(0, 7)
                  .map((item) => (
                    <OpportunityItem key={`${item.label}-${item.title}`} item={item} />
                  ))
              )}
            </CardBody>
          </Card>
        </section>
      )}

      {isPortfolioView && (
        <section className="mb-4">
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
      )}

      {/* Oportunidades no capturadas */}
      {!isPortfolioView && myLostOpps.length > 0 && (
        <Card className="mb-4">
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
          <CardBody className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {myLostOpps.slice(0, 4).map((o) => (
              <Link
                key={o.sku}
                to={`/productos/${o.sku}`}
                className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {o.name}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {o.motivo} · vendía ~{formatNumber(o.histMonthly)}/mes
                  </span>
                </span>
                <span className="flex-shrink-0 text-sm font-semibold text-rose-600">
                  {formatCurrencyCompact(o.ventaPerdida)}/mes
                </span>
              </Link>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Mis categorías asignadas */}
      {isPortfolioView && (
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
      )}

      {/* Señales de ventas para mí */}
      {!isPortfolioView && (
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
      )}

      {/* Salud del catálogo (#4): costo, margen y novedades por revisar */}
      {isPortfolioView && (
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
      )}

      {/* Bloque inferior en 2 columnas (escritorio aprovecha el ancho) */}
      {!isPortfolioView && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Riesgo de quiebre */}
            <div id="riesgo">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-semibold text-slate-800">
                  Mis productos en riesgo de quiebre
                </h3>
                <Link
                  to="/comprar/decisiones"
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
                  rowClassName={(r) =>
                    r.product.availableStock <= 0 ? "bg-rose-50/40" : undefined
                  }
                  emptyMessage="No tienes productos en riesgo de quiebre. ¡Bien!"
                  mobileCard={(r) => (
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-xs font-mono text-slate-400">{r.product.sku}</span>
                          <p className="font-medium text-slate-800 leading-snug">
                            {r.product.name}
                          </p>
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
                            {r.product.availableStock <= 0
                              ? "hoy"
                              : formatDate(r.stockoutDate ?? "")}
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
                          to={`/comprar/seguimiento?oc=${encodeURIComponent(o.number)}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800">{o.number}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {o.supplierName} · espera {formatDate(o.expectedDate)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {o.delayedDays > 0 && (
                              <Badge tone="red">{o.delayedDays} d atraso</Badge>
                            )}
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
              <h3 className="text-sm font-semibold text-slate-800 mb-2.5">
                Proveedores por revisar
              </h3>
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
                              Disp. {formatNumber(p.availableStock)} ·{" "}
                              {formatNumber(p.inventoryDays)} días inv.
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
      )}
      {/* fin grid 2 columnas */}
    </div>
  );
}

function PortfolioFocusWorkspace({
  focus,
  productRows,
  brandRows,
  supplierRows,
  opportunities,
}: {
  focus: Exclude<PortfolioFocus, "resumen">;
  productRows: KeyProductRow[];
  brandRows: BrandPortfolioRow[];
  supplierRows: SupplierPortfolioRow[];
  opportunities: PortfolioOpportunity[];
}) {
  if (focus === "productos-clave") {
    const roles: PortfolioProductRole[] = [
      "Estrella",
      "Tractor",
      "Margen",
      "Emergente",
      "Deterioro",
      "Detenido",
      "Riesgo",
    ];
    const topSales = [...productRows].sort((a, b) => b.salesValue - a.salesValue).slice(0, 5);
    const topProfit = [...productRows].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 5);
    const topGmroi = [...productRows].sort((a, b) => b.gmroi - a.gmroi).slice(0, 5);

    return (
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader
            title="Mapa de roles comerciales"
            description="El mismo SKU puede ser importante por venta, margen, tráfico, crecimiento o riesgo."
          />
          <CardBody>
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {roles.map((role) => (
                <div
                  key={role}
                  className="min-w-[128px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <Badge tone={roleTone(role)}>{role}</Badge>
                  <p className="mt-1 text-xl font-semibold text-slate-900">
                    {productRows.filter((row) => row.role === role).length}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {productRows.slice(0, 10).map((row) => (
                <KeyProductItem key={row.product.sku} row={row} />
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Rankings para decidir"
            description="Cada lista responde una pregunta distinta antes de comprar o negociar."
          />
          <CardBody className="space-y-4">
            <ProductRank title="Más vendidos" rows={topSales} metric="sales" />
            <ProductRank title="Mayor utilidad" rows={topProfit} metric="profit" />
            <ProductRank title="Mayor GMROI" rows={topGmroi} metric="gmroi" />
          </CardBody>
        </Card>
      </section>
    );
  }

  if (focus === "marcas") {
    const growing = brandRows.filter((row) => row.growth > 0.08).length;
    const pressured = brandRows.filter((row) => row.growth < -0.08 || row.stockouts > 0).length;

    return (
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader
            title="Lectura de marcas"
            description="Participación, crecimiento, margen e inventario para decidir qué proteger."
          />
          <CardBody className="grid grid-cols-2 gap-3">
            <PortfolioMetric label="Marcas activas" value={formatNumber(brandRows.length)} />
            <PortfolioMetric label="Creciendo" value={formatNumber(growing)} />
            <PortfolioMetric label="Con presión" value={formatNumber(pressured)} />
            <PortfolioMetric
              label="Venta líder"
              value={formatCurrencyCompact(brandRows[0]?.sales ?? 0)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Desempeño por marca"
            description="Detecta marcas que crecen consumiendo capital o que sostienen margen."
          />
          <CardBody className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {brandRows.map((row) => (
              <BrandHealthItem key={row.brand} row={row} />
            ))}
          </CardBody>
        </Card>
      </section>
    );
  }

  if (focus === "proveedores") {
    const highDependency = supplierRows.filter((row) => row.dependency > 0.35).length;
    const withAlternatives = supplierRows.filter((row) => row.alternatives > 0).length;
    const stalled = supplierRows.reduce((sum, row) => sum + row.stalled, 0);

    return (
      <section className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader
            title="Prioridad de negociación"
            description="Dónde hay dependencia, alternativas y productos que llevar a reunión."
          />
          <CardBody className="space-y-3">
            <PortfolioMetric label="Dependencia alta" value={formatNumber(highDependency)} />
            <PortfolioMetric label="Con alternativas" value={formatNumber(withAlternatives)} />
            <PortfolioMetric label="SKU detenidos" value={formatNumber(stalled)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Proveedores de cartera"
            description="Entra al proveedor para preparar costo, detenidos, cumplimiento y oportunidad."
          />
          <CardBody className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {supplierRows.map((row) => (
              <SupplierPortfolioItem key={row.supplier.id} row={row} />
            ))}
          </CardBody>
        </Card>
      </section>
    );
  }

  return (
    <section className="mb-4">
      <Card>
        <CardHeader
          title="Radar de oportunidades"
          description="Crecimiento con poca cobertura, margen por potenciar y alternativas para negociar."
        />
        <CardBody>
          {opportunities.length === 0 ? (
            <EmptyState
              title="Sin oportunidades fuertes"
              description="No hay señales comerciales destacadas en este momento."
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
              {opportunities.map((item) => (
                <OpportunityItem key={`${item.label}-${item.title}`} item={item} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </section>
  );
}

function ProductRank({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: KeyProductRow[];
  metric: "sales" | "profit" | "gmroi";
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="space-y-1.5">
        {rows.map((row) => {
          const value =
            metric === "gmroi"
              ? row.gmroi.toFixed(1).replace(".", ",")
              : formatCurrencyCompact(metric === "sales" ? row.salesValue : row.grossProfit);
          return (
            <Link
              key={`${title}-${row.product.sku}`}
              to={`/productos/${row.product.sku}`}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800">
                  {row.product.name}
                </span>
                <span className="text-xs text-slate-500">{row.role}</span>
              </span>
              <span className="flex-shrink-0 text-sm font-semibold text-slate-900">{value}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function HealthScore({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 75
      ? "bg-emerald-500"
      : value >= 60
        ? "bg-brand-500"
        : value >= 45
          ? "bg-amber-500"
          : "bg-rose-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium capitalize text-slate-700">{label}</span>
        <span className="text-sm font-semibold text-slate-900">{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function roleTone(role: PortfolioProductRole): "green" | "blue" | "amber" | "red" | "violet" {
  if (role === "Estrella") return "green";
  if (role === "Tractor") return "blue";
  if (role === "Margen") return "violet";
  if (role === "Emergente") return "blue";
  if (role === "Detenido" || role === "Deterioro") return "red";
  return "amber";
}

function KeyProductItem({ row }: { row: KeyProductRow }) {
  return (
    <Link
      to={`/productos/${row.product.sku}`}
      className="block rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone={roleTone(row.role)}>{row.role}</Badge>
            <span className="text-xs font-mono text-slate-400">{row.product.sku}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-800">{row.product.name}</p>
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{row.reason}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-semibold text-slate-900">
            {formatCurrencyCompact(row.salesValue)}
          </p>
          <p className="text-xs text-slate-500">
            margen {formatPercent(row.product.margin, 0)} · GMROI {row.gmroi.toFixed(1)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function BrandHealthItem({ row }: { row: BrandPortfolioRow }) {
  const conclusion =
    row.growth > 0.15 && row.inventory > row.sales
      ? "crece, pero consume capital"
      : row.growth < -0.12
        ? "se está frenando"
        : row.margin >= 34
          ? "protege rentabilidad"
          : "monitorear mix";
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{row.brand}</p>
          <p className="text-xs text-slate-500">
            {row.skus} SKU · {conclusion}
          </p>
        </div>
        {row.stockouts > 0 && <Badge tone="red">{row.stockouts} quiebre</Badge>}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <span>
          <b className="block text-slate-800">{formatCurrencyCompact(row.sales)}</b>
          venta
        </span>
        <span>
          <b className="block text-slate-800">{formatPercent(row.margin, 0)}</b>
          margen
        </span>
        <span>
          <b className={row.growth >= 0 ? "block text-emerald-700" : "block text-rose-600"}>
            {formatPercent(row.growth * 100, 0)}
          </b>
          crecimiento
        </span>
      </div>
    </div>
  );
}

function SupplierPortfolioItem({ row }: { row: SupplierPortfolioRow }) {
  const position =
    row.dependency > 0.35 && row.alternatives / Math.max(1, row.skus) > 0.4
      ? "posición negociadora media-alta"
      : row.dependency > 0.35
        ? "dependencia alta"
        : "relación diversificada";
  return (
    <Link
      to={`/proveedores/${row.supplier.id}?tab=negociacion`}
      className="block rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{row.supplier.name}</p>
          <p className="text-xs text-slate-500">{position}</p>
        </div>
        <StatusBadge kind="supplier" value={row.supplier.status} dot={false} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <span>
          <b className="block text-slate-800">{formatCurrencyCompact(row.sales)}</b>
          venta
        </span>
        <span>
          <b className="block text-slate-800">{formatPercent(row.dependency * 100, 0)}</b>
          dependencia
        </span>
        <span>
          <b className={row.stalled > 0 ? "block text-rose-600" : "block text-emerald-700"}>
            {row.stalled}
          </b>
          detenidos
        </span>
      </div>
    </Link>
  );
}

function OpportunityItem({ item }: { item: PortfolioOpportunity }) {
  return (
    <Link
      to={item.to}
      className="block rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
    >
      <div className="flex items-center gap-2">
        <Badge tone={item.tone}>{item.label}</Badge>
      </div>
      <p className="mt-1 text-sm font-semibold text-slate-800">{item.title}</p>
      <p className="text-xs text-slate-500">{item.detail}</p>
    </Link>
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

function AgendaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SignalSummary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "amber" | "blue" | "violet";
}) {
  const toneClass = {
    red: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-brand-200 bg-brand-50 text-brand-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-none">{value}</p>
    </div>
  );
}

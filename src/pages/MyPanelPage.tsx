import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { IconAlerts, IconReplenish } from "../components/ui/icons";
import { products } from "../data/mockProducts";
import { recommendations } from "../data/mockRecommendations";
import { suppliers } from "../data/mockSuppliers";
import { InicioPortadaConnected } from "./myPanel/InicioPortadaConnected";
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
import { formatDays, formatPercent } from "../utils/formatters";
import type { Product } from "../types/purchasing";
import type {
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

  // Oportunidades no capturadas del comprador
  const myLostOpps = useMemo(
    () => lostOpportunities().filter((o) => myCategories.includes(o.category)),
    [myCategories]
  );
  const myLostRevenue = myLostOpps.reduce((a, o) => a + o.ventaPerdida, 0);

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

      {/* Bandeja diaria conectada al dashboard real (flujo 6). Los conteos de
          proveedores/señales siguen siendo mock (flujos posteriores). */}
      {!isPortfolioView && (
        <InicioPortadaConnected
          suppliersToReviewCount={mySuppliersToReview.length}
          salesSignalsCount={mySignals.length}
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

import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { IconAlerts, IconReplenish } from "../components/ui/icons";
import { InicioPortadaConnected } from "./myPanel/InicioPortadaConnected";
import { useBuyer } from "../context/BuyerContext";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { useSignals } from "../context/SignalsContext";
import { usePurchaseContext } from "../hooks/usePurchaseContext";
import {
  isHiddenByDefault,
  useReplenishment,
  type ReplenishmentRecommendation,
} from "../hooks/useReplenishment";
import {
  ACTIVE_PO_STATUSES,
  toPurchaseOrderRow,
  usePurchaseOrders,
} from "../hooks/usePurchaseOrders";
import { useSuppliersPanel } from "../hooks/useSuppliersPanel";
import { useCategoriesPanel } from "../hooks/useCategoriesPanel";
import { useMyPanel } from "../hooks/useMyPanel";
import { describePurchaseBffError, type PurchaseBffError } from "../services/purchaseBff";
import { estimatedStockoutDate } from "../utils/calculations";
import { formatCurrencyCompact, formatNumber } from "../utils/formatters";
import type {
  OpportunitySummaryItem,
  PortfolioFoco,
  PortfolioFocus,
  PortfolioOpportunity,
  RiskRow,
  SalesPaceRow,
} from "./myPanel/types";
import {
  BrandsSuppliersTables,
  CategoriesCard,
  ExecutiveSummary,
  MonthGoalsCard,
  OpenOrdersList,
  OpportunitiesSummary,
  PortfolioFocusWorkspace,
  PortfolioHeaderCard,
  PortfolioHealthFocus,
  SalesSignalsCard,
  SectionLabel,
  StockoutRiskCard,
  SuppliersToReviewList,
  TrendsCard,
} from "./myPanel/components";

// ============================================================================
//  "Mi panel" del comprador, conectado por completo al purchase-bff:
//  - Inicio: bandeja del dashboard (flujo 6) + motor de reposición (riesgo de
//    quiebre), OC reales, panel de proveedores (F12) y señales (F13).
//  - Mi cartera: panel de categorías (F12), desempeño y metas (F19),
//    proveedores (F12) y oportunidades/tendencias derivadas del motor.
//  Las métricas del prototipo sin fuente en el contrato (venta/margen de
//  cartera, marcas, roles por SKU, sobrestock, venta no capturada) degradan a
//  "—"/estado vacío o se eliminaron: cero números inventados.
// ============================================================================

/** Esqueleto de tarjeta mientras carga una sección conectada. */
function PanelCardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Card className={className}>
      <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando sección">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Error de una sección conectada, con reintento (patrón ClaimsPage). */
function PanelCardError({
  title,
  error,
  onRetry,
  className,
}: {
  title: string;
  error: PurchaseBffError;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <Card className={className}>
      <div className="p-6 text-center">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{describePurchaseBffError(error)}</p>
        <Button className="mt-4" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    </Card>
  );
}

function NotConfiguredCard() {
  return (
    <Card>
      <div className="p-6 text-center">
        <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
        <p className="mt-1 text-sm text-slate-500">
          Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
          conectar tu panel con datos reales del servicio de compras.
        </p>
      </div>
    </Card>
  );
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

  const { buyer } = useBuyer();
  const { context } = usePurchaseContext();
  const displayName = context?.name ?? buyer;

  // Fuentes reales: motor de reposición, OC, paneles F12, desempeño F19 y señales F13.
  const repl = useReplenishment();
  const po = usePurchaseOrders();
  const sup = useSuppliersPanel("", "");
  const cats = useCategoriesPanel();
  const perf = useMyPanel();
  const { signals, loading: signalsLoading, error: signalsError } = useSignals();
  const configured = repl.configured;

  const { addItem, hasItem } = useOcDraft();
  const toast = useToast();

  // Señales de ventas vivas del backend (nuevas o en revisión), las más urgentes primero.
  const pendingSignals = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 } as const;
    return signals
      .filter((s) => s.status === "new" || s.status === "in_review")
      .sort((a, b) => {
        const p = order[a.priority] - order[b.priority];
        return p !== 0 ? p : a.dateCreated < b.dateCreated ? 1 : -1;
      });
  }, [signals]);
  const topSignals = useMemo(() => pendingSignals.slice(0, 5), [pendingSignals]);

  const todayISO = new Date().toISOString().slice(0, 10);

  // Riesgo de quiebre: prioridades reales del motor (quiebre inminente / stock
  // bajo) aún pendientes, con la cantidad sugerida del propio motor.
  const riskRows = useMemo<RiskRow[]>(() => {
    return repl.rows
      .filter(
        (r) => r.sourceStatus === "pending" && (r.priority === "high" || r.priority === "medium")
      )
      .map((r) => {
        const suggestedQty = r.suggestedQuantity;
        const coverageAfter =
          r.salesLast30Days > 0
            ? Math.round(((r.availableStock + suggestedQty) / (r.salesLast30Days / 30)) * 10) / 10
            : 0;
        return {
          rec: r,
          coverage: r.inventoryDays,
          stockoutDate: estimatedStockoutDate(r.availableStock, r.salesLast30Days, todayISO),
          suggestedQty,
          coverageAfter,
        };
      })
      .sort((a, b) => a.coverage - b.coverage);
  }, [repl.rows, todayISO]);

  // Oportunidades de compra reales (prioridad "opportunity" del motor).
  const opportunities = useMemo<PortfolioOpportunity[]>(() => {
    return repl.rows
      .filter((r) => r.sourceStatus === "pending" && r.priority === "low")
      .map((r) => ({
        title: r.productName,
        label: "Oportunidad de compra",
        detail:
          r.reason ||
          (r.suggestedQuantity > 0
            ? `Sugerido ${formatNumber(r.suggestedQuantity)} u. · ${formatCurrencyCompact(r.suggestedPurchaseAmount)}`
            : `SKU ${r.sku}`),
        to: `/comprar/decisiones?q=${encodeURIComponent(r.sku)}`,
        tone: "blue" as const,
      }));
  }, [repl.rows]);

  // Tendencias: venta 30d vs promedio mensual de 90d, sobre las filas reales
  // del motor (solo SKU con recomendación visible; el umbral evita ruido).
  const salesPace = useMemo(() => {
    const rows = repl.rows
      .filter((r) => !isHiddenByDefault(r) && r.salesLast90Days > 0)
      .map<SalesPaceRow | null>((r) => {
        const expected30 = r.salesLast90Days / 3;
        if (expected30 < 8) return null;
        const diffUnits = r.salesLast30Days - expected30;
        const diffPct = diffUnits / expected30;
        return { rec: r, expected30, diffUnits, diffPct, coverage: r.inventoryDays };
      })
      .filter((r): r is SalesPaceRow => !!r);

    const faster = rows
      .filter((r) => r.diffPct >= 0.15)
      .sort((a, b) => b.diffPct - a.diffPct || a.coverage - b.coverage);
    const slower = rows
      .filter((r) => r.diffPct <= -0.15 && r.rec.availableStock > 0)
      .sort(
        (a, b) => a.diffPct - b.diffPct || b.rec.availableStock - a.rec.availableStock
      );

    return { faster, slower };
  }, [repl.rows]);

  const pendingDecisionsCount = useMemo(
    () => repl.rows.filter((r) => r.sourceStatus === "pending").length,
    [repl.rows]
  );

  // OC reales aún abiertas (aprobada / enviada / confirmada / parcial).
  const openOrders = useMemo(
    () =>
      po.orders
        .filter((o) => ACTIVE_PO_STATUSES.includes(o.status))
        .map(toPurchaseOrderRow),
    [po.orders]
  );

  // Proveedores del panel real que requieren revisión (en observación o bloqueados).
  const suppliersToReview = useMemo(
    () =>
      sup.rows
        .filter((s) => s.status === "on_watch" || s.status === "blocked")
        .sort((a, b) => (a.compliancePct ?? 101) - (b.compliancePct ?? 101)),
    [sup.rows]
  );

  const suppliersByPurchases = useMemo(
    () => [...sup.rows].sort((a, b) => (b.purchased90Clp ?? -1) - (a.purchased90Clp ?? -1)),
    [sup.rows]
  );

  const replReady = !repl.loading && !repl.error;
  const supReady = !sup.loading && !sup.error;
  const signalsReady = !signalsLoading && !signalsError;

  // Principales focos: solo los conteos calculables con fuentes reales.
  const focos = useMemo<PortfolioFoco[]>(() => {
    const list: PortfolioFoco[] = [];
    if (replReady) {
      list.push({
        dot: "bg-rose-500",
        text: `${formatNumber(riskRows.length)} SKU con riesgo de quiebre`,
        to: "/comprar/decisiones",
      });
      list.push({
        dot: "bg-emerald-500",
        text: `${formatNumber(opportunities.length)} oportunidades de compra del motor`,
        to: "/mi-cartera/oportunidades",
      });
    }
    if (supReady) {
      list.push({
        dot: "bg-orange-500",
        text: `${formatNumber(suppliersToReview.length)} proveedores por revisar`,
        to: "/proveedores",
      });
    }
    if (signalsReady) {
      list.push({
        dot: "bg-violet-500",
        text: `${formatNumber(pendingSignals.length)} señales de ventas por resolver`,
        to: "/senales-ventas",
      });
    }
    return list;
  }, [
    replReady,
    supReady,
    signalsReady,
    riskRows.length,
    opportunities.length,
    suppliersToReview.length,
    pendingSignals.length,
  ]);

  const oppSummaryItems = useMemo<OpportunitySummaryItem[]>(
    () => [
      {
        label: "Decisiones de compra pendientes",
        count: replReady ? pendingDecisionsCount : null,
        tone: "blue",
        to: "/comprar/decisiones",
      },
      {
        label: "Oportunidades del motor",
        count: replReady ? opportunities.length : null,
        tone: "green",
        to: "/mi-cartera/oportunidades",
      },
      {
        label: "Señales de ventas pendientes",
        count: signalsReady ? pendingSignals.length : null,
        tone: "violet",
        to: "/senales-ventas",
      },
      {
        label: "Proveedores por revisar",
        count: supReady ? suppliersToReview.length : null,
        tone: "amber",
        to: "/proveedores",
      },
    ],
    [
      replReady,
      supReady,
      signalsReady,
      pendingDecisionsCount,
      opportunities.length,
      pendingSignals.length,
      suppliersToReview.length,
    ]
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  const handleAdd = (rec: ReplenishmentRecommendation, qty: number) => {
    const added = addItem({
      sku: rec.sku,
      productName: rec.productName,
      supplierName: rec.supplierName,
      quantity: qty,
      unitCost: rec.unitCost,
      recommendationId: rec.id,
    });
    if (!added) return;
    toast.success(`${rec.productName} agregado al borrador de OC`, {
      label: "Ver borrador OC",
      onClick: () => navigate("/comprar/borradores"),
    });
  };

  const portfolioHeader = {
    resumen: {
      title: `Mi cartera · ${displayName}`,
      description:
        "Cómo está funcionando tu negocio: decisiones del motor, categorías, proveedores y desempeño.",
    },
    "productos-clave": {
      title: `Productos clave · ${displayName}`,
      description:
        "Clasifica qué SKU mueven venta, margen, tráfico, crecimiento o riesgo antes de decidir compras.",
    },
    marcas: {
      title: `Marcas · ${displayName}`,
      description:
        "Lee qué marcas ganan participación, cuáles deterioran margen y dónde se está consumiendo capital.",
    },
    proveedores: {
      title: `Proveedores · ${displayName}`,
      description:
        "Prioriza relaciones, cumplimiento y puntos de negociación de los proveedores de tu cartera.",
    },
    oportunidades: {
      title: `Oportunidades · ${displayName}`,
      description:
        "Encuentra las oportunidades de compra que el motor detectó antes de que sean urgencias.",
    },
  } satisfies Record<PortfolioFocus, { title: string; description: string }>;

  return (
    <div>
      <PageHeader
        title={
          isPortfolioView
            ? portfolioHeader[portfolioFocus].title
            : `${greeting}, ${displayName.split(" ")[0]}`
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

      {/* Bandeja diaria conectada al dashboard real (flujo 6); los conteos de
          proveedores y señales también vienen de las fuentes reales. */}
      {!isPortfolioView && (
        <InicioPortadaConnected
          suppliersToReviewCount={supReady ? suppliersToReview.length : null}
          salesSignalsCount={signalsReady ? pendingSignals.length : null}
        />
      )}

      {/* Trabajo del día: riesgo de quiebre (motor), OC abiertas y proveedores. */}
      {!isPortfolioView && configured && (
        <>
          <SectionLabel>Trabajo del día</SectionLabel>
          <div className="mb-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              {repl.loading ? (
                <PanelCardSkeleton lines={4} />
              ) : repl.error ? (
                <PanelCardError
                  title="No se pudo cargar el riesgo de quiebre"
                  error={repl.error}
                  onRetry={repl.refetch}
                />
              ) : (
                <StockoutRiskCard
                  rows={riskRows}
                  hasItem={hasItem}
                  onAdd={handleAdd}
                  onOpenProduct={(sku) => navigate(`/productos/${sku}`)}
                />
              )}

              {po.loading ? (
                <PanelCardSkeleton />
              ) : po.error ? (
                <PanelCardError
                  title="No se pudieron cargar tus órdenes de compra"
                  error={po.error}
                  onRetry={po.refetch}
                />
              ) : (
                <OpenOrdersList orders={openOrders} />
              )}
            </div>

            <div className="space-y-5">
              {sup.loading ? (
                <PanelCardSkeleton />
              ) : sup.error ? (
                <PanelCardError
                  title="No se pudo cargar el panel de proveedores"
                  error={sup.error}
                  onRetry={sup.refetch}
                />
              ) : (
                <SuppliersToReviewList suppliers={suppliersToReview} />
              )}
            </div>
          </div>

          {/* Qué te reporta ventas desde el terreno (F13). */}
          <SalesSignalsCard signals={topSignals} />
        </>
      )}

      {/* Mi cartera sin conexión configurada: un solo aviso honesto. */}
      {isPortfolioView && !configured && <NotConfiguredCard />}

      {isPortfolioView && configured && (
        <>
          {/* 1 · Mi cartera — ¿qué administro? (panel de categorías F12) */}
          {cats.loading ? (
            <PanelCardSkeleton lines={2} className="mb-4" />
          ) : cats.error ? (
            <PanelCardError
              className="mb-4"
              title="No se pudo cargar tu cartera"
              error={cats.error}
              onRetry={cats.refetch}
            />
          ) : (
            <PortfolioHeaderCard
              catNames={cats.rows.map((c) => c.name)}
              skuCount={cats.rows.reduce((sum, c) => sum + c.skuCount, 0)}
              supplierCount={supReady ? (sup.meta?.total ?? sup.rows.length) : null}
            />
          )}

          {/* 2 · Objetivos del mes — metas reales del comprador (F19) */}
          {portfolioFocus === "resumen" &&
            (perf.loading ? (
              <PanelCardSkeleton lines={2} className="mb-4" />
            ) : perf.error ? (
              <PanelCardError
                className="mb-4"
                title="No se pudieron cargar tus metas"
                error={perf.error}
                onRetry={perf.refetch}
              />
            ) : (
              <MonthGoalsCard goals={perf.performance?.goals ?? []} />
            ))}

          {/* 3 · Resumen ejecutivo — solo los quiebres tienen fuente real */}
          {portfolioFocus === "resumen" && (
            <ExecutiveSummary riskCount={replReady ? riskRows.length : null} />
          )}

          {portfolioFocus !== "resumen" &&
            ((portfolioFocus === "proveedores" && sup.loading) ||
            (portfolioFocus === "oportunidades" && repl.loading) ? (
              <PanelCardSkeleton lines={4} className="mb-4" />
            ) : portfolioFocus === "proveedores" && sup.error ? (
              <PanelCardError
                className="mb-4"
                title="No se pudo cargar el panel de proveedores"
                error={sup.error}
                onRetry={sup.refetch}
              />
            ) : portfolioFocus === "oportunidades" && repl.error ? (
              <PanelCardError
                className="mb-4"
                title="No se pudieron cargar las oportunidades del motor"
                error={repl.error}
                onRetry={repl.refetch}
              />
            ) : (
              <PortfolioFocusWorkspace
                focus={portfolioFocus}
                supplierRows={suppliersByPurchases}
                opportunities={opportunities}
              />
            ))}

          {/* 4 · Mi puntaje del mes (F19) + 5 · Principales focos */}
          {portfolioFocus === "resumen" && (
            <PortfolioHealthFocus
              performance={perf.loading || perf.error ? null : perf.performance}
              focos={focos}
            />
          )}

          {/* 6 · Marcas (sin fuente) + Proveedores reales (F12) */}
          {portfolioFocus === "resumen" &&
            (sup.loading ? (
              <PanelCardSkeleton className="mb-4" />
            ) : sup.error ? (
              <PanelCardError
                className="mb-4"
                title="No se pudo cargar el panel de proveedores"
                error={sup.error}
                onRetry={sup.refetch}
              />
            ) : (
              <BrandsSuppliersTables supplierRows={suppliersByPurchases} />
            ))}

          {/* 7 · Oportunidades (resumen con conteos reales) */}
          {portfolioFocus === "resumen" && <OpportunitiesSummary items={oppSummaryItems} />}

          {/* 8 · Tendencias — derivadas de la venta real de las filas del motor */}
          {repl.loading ? (
            <PanelCardSkeleton className="mb-4" />
          ) : repl.error ? (
            <PanelCardError
              className="mb-4"
              title="No se pudieron cargar las tendencias"
              error={repl.error}
              onRetry={repl.refetch}
            />
          ) : (
            <TrendsCard faster={salesPace.faster} slower={salesPace.slower} />
          )}

          {/* 9 · Categorías — panel real (F12) */}
          {cats.loading ? (
            <PanelCardSkeleton className="mb-4" />
          ) : cats.error ? (
            <PanelCardError
              className="mb-4"
              title="No se pudieron cargar tus categorías"
              error={cats.error}
              onRetry={cats.refetch}
            />
          ) : (
            <CategoriesCard cats={cats.rows} />
          )}
        </>
      )}
    </div>
  );
}

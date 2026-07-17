import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { DateRangePicker } from "../components/ui/DateRangePicker";
import { InfoHint } from "../components/business/InfoHint";
import { PurchaseProcessBar } from "../components/business/PurchaseProcessBar";
import { IconPlus } from "../components/ui/icons";
import { usePickupPlan } from "../components/business/LogisticsPlan";
import { draftBudgetImpact } from "../utils/openToBuy";
import { recommendations } from "../data/mockRecommendations";
import { rfqs } from "../data/mockRfq";
import { getProductBySku, products as allProducts } from "../data/mockProducts";
import { suppliers as mockSuppliers } from "../data/mockSuppliers";
import { orderSalesAtRisk, type ConsolidationCandidate } from "../utils/orderConsolidation";
import {
  OrderDetailModal,
  DraftSummaryCard,
  OrdersKpiRow,
  OrdersTable,
  OrderDraftDrawer,
  ProposalDraftsTable,
} from "./PurchaseOrdersSections";
import { buildOrderProcessStages } from "./purchaseOrders/processStages";
import { type OcDraftItem } from "../context/OcDraftContext";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import {
  useProposals,
  type ProposalActionResult,
  type ProposalConvertResult,
} from "../hooks/useProposals";
import {
  toPurchaseOrderRow,
  usePurchaseOrders,
  type PurchaseOrderRow,
} from "../hooks/usePurchaseOrders";
import { usePendingApprovalsCount } from "../hooks/useApprovals";
import {
  criterionLabelEs,
  describePurchaseBffError,
  type ProposalView,
} from "../services/purchaseBff";
import { coverageDays } from "../utils/calculations";
import { inRange, type IsoRange } from "../utils/dateRange";
import { TODAY_ISO } from "../utils/constants";
import type { PurchaseOrderStatus } from "../types/purchasing";
import { CLOSED_ORDER_STATUSES } from "../types/purchasing";

/** Días desde hoy hasta una fecha ISO (negativo si ya pasó). */
const daysToDate = (iso: string) =>
  Math.round(
    (new Date(`${iso}T00:00:00`).getTime() - new Date(`${TODAY_ISO}T00:00:00`).getTime()) / 86400000
  );

const TABS = [
  { value: "all", label: "Todas" },
  { value: "draft", label: "Borradores" },
  { value: "open", label: "En curso" },
  { value: "delayed", label: "Atrasadas" },
  { value: "received", label: "Recibidas" },
];

// OCs emitidas y aún en curso (emitidas, no cerradas ni recibidas del todo).
const EMITTED_STATUSES: PurchaseOrderStatus[] = [
  "sent",
  "confirmed",
  "partially_received",
  "with_difference",
];

// Pestaña Seguimiento: OC recién convertidas (approved, viajando a SAP) + emitidas.
const OPEN_STATUSES: PurchaseOrderStatus[] = ["approved", ...EMITTED_STATUSES];

/** Códigos de conflicto de estado/versión que ameritan recargar la lista. */
const CONFLICT_CODES = [
  "VERSION_CONFLICT",
  "CONFLICT",
  "PURCHASE_PROPOSAL_INVALID_STATE",
  "PURCHASE_ORDER_INVALID_STATE",
];

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    items,
    count,
    subtotal,
    discountAmount,
    totalAmount,
    meta,
    setMeta,
    updateQuantity,
    updateItem,
    removeItem,
    addItem,
    hasItem,
    configured: draftConfigured,
    proposal: activeDraft,
    refetch: refetchDraft,
  } = useOcDraft();
  const toast = useToast();
  const {
    proposals: workingProposals,
    loading: proposalsLoading,
    error: proposalsError,
    refetch: refetchProposals,
    submit: submitProposalCmd,
    cancel: cancelProposalCmd,
    convert: convertProposalCmd,
  } = useProposals();
  // OC reales del comprador (flujo 3), con polling de sincronización SAP.
  const {
    orders: orderViews,
    loading: ordersLoading,
    error: ordersError,
    configured: ordersConfigured,
    refetch: refetchOrders,
    send: sendOrderCmd,
    cancel: cancelOrderCmd,
  } = usePurchaseOrders({ poll: true });
  const pendingApprovalsCount = usePendingApprovalsCount();

  const initialTab = pathname.includes("/comprar/borradores")
    ? "draft"
    : pathname.includes("/comprar/seguimiento")
      ? "open"
      : "all";
  const [tab, setTab] = useState(initialTab);
  const [dates, setDates] = useState<IsoRange>({ from: "", to: "" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [draftContextSku, setDraftContextSku] = useState<string | null>(null);
  const [draftContextTab, setDraftContextTab] = useState("resumen");
  // Propuesta con comando en vuelo (submit/cancel/convert) y objetivo del modal de cancelación.
  const [proposalBusyId, setProposalBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ProposalView | null>(null);
  // OC con comando en vuelo (send/cancel) y objetivo del modal de cancelación de OC.
  const [orderBusyId, setOrderBusyId] = useState<string | null>(null);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<{
    order: PurchaseOrderRow;
    version: number;
  } | null>(null);

  // Vista BFF → shape de la tabla existente. El alcance por comprador lo
  // resuelve el servicio con las credenciales de la sesión (sin filtro local).
  const orders = useMemo<PurchaseOrderRow[]>(() => orderViews.map(toPurchaseOrderRow), [orderViews]);

  // El detalle abierto se re-deriva de la lista para que el polling de sapSync
  // también refresque el modal.
  const detail = useMemo(
    () => (detailId ? (orders.find((o) => o.id === detailId) ?? null) : null),
    [detailId, orders]
  );

  // Deep-link: /ordenes-compra?oc=OC-XXXX abre el detalle de esa orden (por número real).
  const [searchParams, setSearchParams] = useSearchParams();
  const ocParam = searchParams.get("oc");
  useEffect(() => {
    if (!ocParam) return;
    const po = orders.find((o) => o.number === ocParam);
    if (po) setDetailId(po.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocParam, orders.length]);
  const closeDetail = () => {
    setDetailId(null);
    if (ocParam) {
      searchParams.delete("oc");
      setSearchParams(searchParams, { replace: true });
    }
  };

  useEffect(() => {
    if (pathname.includes("/comprar/borradores")) setTab("draft");
    if (pathname.includes("/comprar/ordenes")) setTab("all");
    if (pathname.includes("/comprar/seguimiento")) setTab("open");
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen || items.length === 0) return;
    if (!draftContextSku || !items.some((i) => i.sku === draftContextSku)) {
      setDraftContextSku(items[0].sku);
    }
  }, [drawerOpen, draftContextSku, items]);

  // Conjunto acotado por el rango de fechas (por fecha de creación de la OC).
  const visible = useMemo(() => orders.filter((o) => inRange(o.createdAt, dates)), [orders, dates]);

  const counts = useMemo(() => {
    return {
      all: visible.length,
      // Borradores = propuestas reales en trabajo (draft/in_review/changes_requested/approved).
      draft: workingProposals.length,
      open: visible.filter((o) => OPEN_STATUSES.includes(o.status)).length,
      delayed: visible.filter((o) => o.delayedDays > 0).length,
      received: visible.filter((o) => o.status === "received" || o.status === "closed").length,
    };
  }, [visible, workingProposals]);

  // Venta en riesgo por OC: prioriza el seguimiento por impacto comercial, no
  // solo por días de atraso (una OC con 1 día de atraso que evita un quiebre
  // masivo pesa más que una muy atrasada de un producto sin venta).
  const riskByOrder = useMemo(() => {
    const map = new Map<string, ReturnType<typeof orderSalesAtRisk>>();
    visible.forEach((o) => {
      const arrivalDays =
        o.delayedDays > 0
          ? o.delayedDays
          : o.expectedDate
            ? Math.max(0, daysToDate(o.expectedDate))
            : 0;
      map.set(
        o.id,
        orderSalesAtRisk(o.lines, arrivalDays, (sku) => {
          const p = getProductBySku(sku);
          return p
            ? { availableStock: p.availableStock, salesLast30Days: p.salesLast30Days, price: p.price }
            : undefined;
        })
      );
    });
    return map;
  }, [visible]);

  const filtered = useMemo(() => {
    // En seguimiento (en curso / atrasadas) ordena por venta en riesgo y luego
    // por días de atraso: primero lo que más venta protege.
    const rv = (o: PurchaseOrderRow) => riskByOrder.get(o.id)?.value ?? 0;
    const byRisk = (a: PurchaseOrderRow, b: PurchaseOrderRow) =>
      rv(b) - rv(a) || b.delayedDays - a.delayedDays;
    switch (tab) {
      case "open":
        return [...visible.filter((o) => OPEN_STATUSES.includes(o.status))].sort(byRisk);
      case "delayed":
        return [...visible.filter((o) => o.delayedDays > 0)].sort(byRisk);
      case "received":
        return visible.filter((o) => o.status === "received" || o.status === "closed");
      default:
        return visible;
    }
  }, [visible, tab, riskByOrder]);

  const totalOpenAmount = visible
    .filter((o) => !["received", "cancelled"].includes(o.status))
    .reduce((a, o) => a + o.totalAmount, 0);
  const delayedCount = visible.filter((o) => o.status === "delayed").length;
  const draftCount = workingProposals.length;
  const openRfqs = rfqs.filter((r) => !["convertida", "rechazada", "vencida"].includes(r.estado));
  const emittedOrders = visible.filter((o) => EMITTED_STATUSES.includes(o.status));
  const receivingOrders = visible.filter((o) =>
    ["sent", "confirmed", "partially_received", "delayed"].includes(o.status)
  );

  // Líneas del borrador agrupadas por proveedor (una OC no mezcla proveedores).
  const supplierGroups = useMemo(() => {
    const m = new Map<string, OcDraftItem[]>();
    items.forEach((it) => {
      const arr = m.get(it.supplierName) ?? [];
      arr.push(it);
      m.set(it.supplierName, arr);
    });
    return [...m.entries()];
  }, [items]);

  const draftSummary = useMemo(() => {
    const suppliers = new Set(items.map((i) => i.supplierName));
    const mainSupplier =
      supplierGroups.length === 1
        ? supplierGroups[0][0]
        : supplierGroups.length > 1
          ? `${supplierGroups.length} proveedores`
          : "Sin proveedor";
    const critical = items.filter((i) => {
      const p = getProductBySku(i.sku);
      return !!p && p.availableStock <= 0;
    }).length;
    const overSuggested = items.filter((i) => {
      const rec = recommendations.find((r) => r.sku === i.sku);
      return rec ? i.quantity > rec.suggestedQuantity * 1.2 : false;
    }).length;
    const openOverlap = items.filter((i) =>
      orders.some(
        (o) =>
          suppliers.has(o.supplierName) &&
          !CLOSED_ORDER_STATUSES.includes(o.status) &&
          o.lines?.some((line) => line.sku === i.sku)
      )
    ).length;
    const highCoverage = items.filter((i) => {
      const p = getProductBySku(i.sku);
      return (
        !!p &&
        p.salesLast30Days > 0 &&
        coverageDays(p.availableStock + i.quantity, p.salesLast30Days) > 90
      );
    }).length;
    const futureCoverageValues = items
      .map((i) => {
        const p = getProductBySku(i.sku);
        if (!p || p.salesLast30Days <= 0) return null;
        return coverageDays(p.availableStock + i.quantity, p.salesLast30Days);
      })
      .filter((v): v is number => v !== null);
    const avgCoverage =
      futureCoverageValues.length > 0
        ? Math.round(futureCoverageValues.reduce((a, v) => a + v, 0) / futureCoverageValues.length)
        : 0;

    return {
      mainSupplier,
      critical,
      overSuggested,
      openOverlap,
      highCoverage,
      avgCoverage,
    };
  }, [items, orders, supplierGroups]);

  // Plan de retiro en vivo: se recalcula al agregar/cambiar líneas del borrador.
  const pickupLines = useMemo(
    () => items.map((i) => ({ sku: i.sku, productName: i.productName, quantity: i.quantity })),
    [items]
  );
  const pickupPlan = usePickupPlan(pickupLines);

  // Open-to-Buy en vivo: cuánto presupuesto consume el borrador y si sobregira.
  const budget = useMemo(
    () => draftBudgetImpact(TODAY_ISO.slice(0, 7), items, orders),
    [items, orders]
  );

  const selectedDraftItem = items.find((i) => i.sku === draftContextSku) ?? items[0] ?? null;

  // Sugerencias que aún no están en el borrador
  const pendingSuggestions = recommendations.filter(
    (r) => r.suggestedQuantity > 0 && !hasItem(r.sku)
  );

  // Búsqueda de cualquier producto para agregar al borrador.
  const searchResults = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return allProducts
      .filter((p) => `${p.sku} ${p.name} ${p.brand}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [prodSearch]);

  const addProduct = (sku: string) => {
    const p = getProductBySku(sku);
    if (!p) return;
    const rec = recommendations.find((r) => r.sku === sku);
    // Catálogo mock sin referencia real (recommendationId/supplierId): el
    // contexto avisa "flujo posterior" y no simula estado local.
    const added = addItem({
      sku: p.sku,
      productName: p.name,
      supplierName: p.supplierName || "Sin proveedor",
      quantity:
        rec?.suggestedQuantity && rec.suggestedQuantity > 0
          ? rec.suggestedQuantity
          : Math.max(1, p.minStock ?? 1),
      unitCost: p.cost,
      discountPct: p.descuentoVigentePct,
    });
    if (!added) return;
    toast.success(`${p.name} agregado al borrador`);
    setProdSearch("");
  };

  // Proveedor por nombre (para leer su mínimo de compra en el coach).
  const supplierByName = useMemo(() => {
    const m = new Map<string, (typeof mockSuppliers)[number]>();
    mockSuppliers.forEach((s) => m.set(s.name, s));
    return m;
  }, []);

  // Agrega al borrador un candidato de consolidación con su cantidad sugerida.
  const addCandidate = (supplierName: string, c: ConsolidationCandidate) => {
    const added = addItem({
      sku: c.sku,
      productName: c.productName,
      supplierName,
      quantity: c.suggestedQty,
      unitCost: c.unitCost,
      discountPct: c.discountPct,
    });
    if (!added) return;
    toast.success(`${c.productName} agregado — consolidado con ${supplierName}`);
  };

  // --------------------------------------------------------------------------
  //  Comandos reales sobre propuestas (enviar a revisión, cancelar, convertir
  //  en OC) y sobre órdenes de compra (enviar/reintentar SAP, cancelar).
  // --------------------------------------------------------------------------
  const notifySubmitResult = (result: ProposalActionResult) => {
    if (result.ok) {
      const view = result.proposal;
      if (view.status === "approved") {
        toast.success("Propuesta aprobada automáticamente (sin criterios)");
      } else {
        const labels = [
          ...new Set((view.approval?.criteria ?? []).map((c) => criterionLabelEs(c.code).toLowerCase())),
        ];
        toast.success(
          labels.length > 0
            ? `Enviada a revisión — criterios: ${labels.join(", ")}`
            : "Enviada a revisión",
          { label: "Ver aprobaciones", onClick: () => navigate("/comprar/aprobaciones") }
        );
      }
      return;
    }
    const info = result.error;
    if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") {
      toast.warning("La propuesta cambió en otra sesión; se recargó la lista");
    } else {
      toast.error(describePurchaseBffError(info));
    }
  };

  const submitProposalRow = async (p: ProposalView) => {
    setProposalBusyId(p.id);
    const result = await submitProposalCmd(p.id, p.version);
    setProposalBusyId(null);
    notifySubmitResult(result);
    if (result.ok) refetchDraft();
  };

  /** Envía a revisión el borrador activo desde el drawer. */
  const submitActiveDraft = async () => {
    if (!activeDraft || count === 0) return;
    setProposalBusyId(activeDraft.id);
    const result = await submitProposalCmd(activeDraft.id, activeDraft.version);
    setProposalBusyId(null);
    notifySubmitResult(result);
    if (result.ok) {
      refetchDraft();
      setDrawerOpen(false);
      setTab("draft");
    }
  };

  const confirmCancelProposal = async (reason: string) => {
    if (!cancelTarget) return;
    setProposalBusyId(cancelTarget.id);
    const result = await cancelProposalCmd(cancelTarget.id, cancelTarget.version, reason);
    setProposalBusyId(null);
    if (result.ok) {
      toast.info("Propuesta cancelada");
      setCancelTarget(null);
      refetchDraft();
      return;
    }
    const info = result.error;
    if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") {
      toast.warning("La propuesta cambió en otra sesión; se recargó la lista");
      setCancelTarget(null);
    } else {
      toast.error(describePurchaseBffError(info));
    }
  };

  /** Convierte una propuesta aprobada en OC reales y salta a Seguimiento. */
  const notifyConvertResult = (result: ProposalConvertResult) => {
    if (result.ok) {
      const generated = result.result.purchaseOrders.map((po) => {
        const name = result.supplierNames.get(po.supplierId ?? "") ?? po.supplierId ?? "proveedor";
        return `${po.number} (${name})`;
      });
      toast.success(
        generated.length > 0
          ? `OC generadas: ${generated.join(", ")} — enviando a SAP`
          : "Propuesta convertida en órdenes de compra"
      );
      refetchOrders();
      setTab("open");
      return;
    }
    const info = result.error;
    if (CONFLICT_CODES.includes(info.code)) {
      toast.warning("La propuesta cambió de estado o versión en otra sesión; se recargó la lista");
    } else {
      toast.error(describePurchaseBffError(info));
    }
  };

  const convertProposalRow = async (p: ProposalView) => {
    setProposalBusyId(p.id);
    const result = await convertProposalCmd(p.id);
    setProposalBusyId(null);
    notifyConvertResult(result);
  };

  /** Envía la OC al proveedor (y re-encola el job SAP si estaba en failed). */
  const sendOrder = async (row: PurchaseOrderRow, version: number = row.version) => {
    setOrderBusyId(row.id);
    const result = await sendOrderCmd(row.id, version);
    setOrderBusyId(null);
    if (result.ok) {
      toast.success(
        row.sapSync?.status === "failed"
          ? `Reintento de envío a SAP encolado para ${row.number}`
          : `${row.number} enviada al proveedor — sincronizando con SAP`
      );
      setDetailId(null);
      return;
    }
    const info = result.error;
    if (CONFLICT_CODES.includes(info.code)) {
      toast.warning("La orden cambió en otra sesión; se recargó la lista");
      setDetailId(null);
    } else {
      toast.error(describePurchaseBffError(info));
    }
  };

  const confirmCancelOrder = async (reason: string) => {
    if (!cancelOrderTarget) return;
    const { order, version } = cancelOrderTarget;
    setOrderBusyId(order.id);
    const result = await cancelOrderCmd(order.id, version, reason);
    setOrderBusyId(null);
    if (result.ok) {
      toast.info(`${order.number} cancelada`);
      setCancelOrderTarget(null);
      setDetailId(null);
      return;
    }
    const info = result.error;
    if (CONFLICT_CODES.includes(info.code)) {
      toast.warning("La orden cambió en otra sesión; se recargó la lista");
      setCancelOrderTarget(null);
    } else {
      toast.error(describePurchaseBffError(info));
    }
  };


  return (
    <div>
      <PageHeader
        title={
          pathname.includes("/comprar/borradores")
            ? "Comprar · Borradores OC"
            : pathname.includes("/comprar/ordenes")
              ? "Comprar · Órdenes"
              : pathname.includes("/comprar/seguimiento")
                ? "Comprar · Seguimiento"
                : "Órdenes de compra"
        }
        description={
          pathname.includes("/comprar/borradores")
            ? "Construye la compra por proveedor, revisa restricciones y formaliza la OC."
            : pathname.includes("/comprar/ordenes")
              ? "Revisa órdenes emitidas, borradores y estados sin salir del proceso de compra."
              : pathname.includes("/comprar/seguimiento")
                ? "Sigue OC emitidas, atrasos, entregas parciales y recepción."
                : "Seguimiento de OC y creación desde sugerencias."
        }
        action={
          <Button onClick={() => setDrawerOpen(true)} icon={<IconPlus className="w-4 h-4" />}>
            Nuevo borrador de OC
            {count > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{count}</span>
            )}
          </Button>
        }
        help={
          <InfoHint label="Ciclo de una orden de compra">
            <p>
              Una OC pasa por: <b>borrador → enviada → confirmada → recibida</b>.
            </p>
            <p>
              Las <b>atrasadas</b> (rojo) superaron su fecha esperada y pueden provocar quiebre:
              priorízalas.
            </p>
            <p>Crea nuevas OC desde las sugerencias de reposición con el botón de arriba.</p>
          </InfoHint>
        }
      />

      <PurchaseProcessBar
        stages={buildOrderProcessStages({
          necesidadCount: recommendations.filter(
            (r) => r.status === "critical" || r.status === "buy_now"
          ).length,
          rfqCount: openRfqs.length,
          draftCount: count,
          pathname,
          pickupPlan,
          pendingCount: pendingApprovalsCount,
          ordersCount: visible.length,
          emittedCount: emittedOrders.length,
          receivingOrders,
        })}
      />

      {count > 0 && (
        <DraftSummaryCard
          draftSummary={draftSummary}
          count={count}
          totalAmount={totalAmount}
          pickupPlan={pickupPlan}
          budget={budget}
          onOpenPlan={() => navigate("/comprar/plan-retiro")}
          onContinue={() => setDrawerOpen(true)}
        />
      )}

      <OrdersKpiRow
        totalOpenAmount={totalOpenAmount}
        delayedCount={delayedCount}
        draftCount={draftCount}
        totalCount={visible.length}
        tab={tab}
        onTabChange={setTab}
      />

      <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1 min-w-0">
          <Tabs
            tabs={TABS.map((t) => ({ ...t, count: counts[t.value as keyof typeof counts] }))}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div className="sm:w-60 flex-shrink-0">
          <DateRangePicker value={dates} onChange={setDates} placeholder="Fecha de creación" />
        </div>
      </div>

      {tab === "draft" ? (
        // Pestaña Borradores: propuestas reales (draft / en revisión / observadas / aprobadas).
        <ProposalDraftsTable
          proposals={workingProposals}
          loading={proposalsLoading}
          error={proposalsError}
          configured={draftConfigured}
          busyId={proposalBusyId}
          onRetry={refetchProposals}
          onSubmit={(p) => void submitProposalRow(p)}
          onCancel={setCancelTarget}
          onConvert={(p) => void convertProposalRow(p)}
        />
      ) : (
        <OrdersTable
          orders={filtered}
          riskOf={(id) => riskByOrder.get(id)}
          tab={tab}
          loading={ordersLoading}
          error={ordersError}
          configured={ordersConfigured}
          busyId={orderBusyId}
          onRetry={refetchOrders}
          onOpenDetail={(o) => setDetailId(o.id)}
          onRetrySend={(o) => void sendOrder(o)}
        />
      )}

      {/* Editor del borrador de propuesta de compra */}
      <OrderDraftDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navigate={navigate}
        onSubmitDraft={() => void submitActiveDraft()}
        submitting={activeDraft !== null && proposalBusyId === activeDraft.id}
        configured={draftConfigured}
        count={count}
        supplierGroups={supplierGroups}
        subtotal={subtotal}
        discountAmount={discountAmount}
        totalAmount={totalAmount}
        prodSearch={prodSearch}
        setProdSearch={setProdSearch}
        searchResults={searchResults}
        hasItem={hasItem}
        addProduct={addProduct}
        meta={meta}
        setMeta={setMeta}
        selectedDraftItem={selectedDraftItem}
        orders={orders}
        draftContextTab={draftContextTab}
        setDraftContextTab={setDraftContextTab}
        updateQuantity={updateQuantity}
        updateItem={updateItem}
        removeItem={removeItem}
        setDraftContextSku={setDraftContextSku}
        items={items}
        supplierByName={supplierByName}
        addCandidate={addCandidate}
        pickupPlan={pickupPlan}
        pendingSuggestions={pendingSuggestions}
      />

      <OrderDetailModal
        order={detail}
        busy={detail !== null && orderBusyId === detail.id}
        onClose={closeDetail}
        onSend={(order, version) => void sendOrder(order, version)}
        onCancelRequest={(order, version) => setCancelOrderTarget({ order, version })}
      />

      {cancelTarget && (
        <CancelProposalModal
          proposal={cancelTarget}
          busy={proposalBusyId === cancelTarget.id}
          onClose={() => setCancelTarget(null)}
          onConfirm={(reason) => void confirmCancelProposal(reason)}
        />
      )}

      {cancelOrderTarget && (
        <CancelOrderModal
          order={cancelOrderTarget.order}
          busy={orderBusyId === cancelOrderTarget.order.id}
          onClose={() => setCancelOrderTarget(null)}
          onConfirm={(reason) => void confirmCancelOrder(reason)}
        />
      )}
    </div>
  );
}

/** Modal de cancelación de OC real: el motivo es obligatorio (auditable). */
function CancelOrderModal({
  order,
  busy,
  onClose,
  onConfirm,
}: {
  order: PurchaseOrderRow;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Cancelar orden de compra"
      description={`${order.number} · ${order.supplierName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Volver
          </Button>
          <Button disabled={!trimmed || busy} onClick={() => onConfirm(trimmed)}>
            {busy ? "Cancelando…" : "Cancelar OC"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          La OC queda cancelada en la plataforma y, si ya fue contabilizada, se solicita su
          cancelación en SAP. Esta acción queda trazada con su motivo.
        </p>
        <Input
          label="Motivo (obligatorio)"
          placeholder="Ej: quiebre del proveedor, compra duplicada…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}

/** Modal de cancelación de propuesta: el motivo es obligatorio (auditable). */
function CancelProposalModal({
  proposal,
  busy,
  onClose,
  onConfirm,
}: {
  proposal: ProposalView;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Cancelar propuesta"
      description={proposal.title ?? proposal.id}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Volver
          </Button>
          <Button disabled={!trimmed || busy} onClick={() => onConfirm(trimmed)}>
            {busy ? "Cancelando…" : "Cancelar propuesta"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          La propuesta queda cancelada y sus líneas dejan de estar en trabajo. Esta acción queda
          trazada con su motivo.
        </p>
        <Input
          label="Motivo (obligatorio)"
          placeholder="Ej: compra postergada al próximo mes…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}

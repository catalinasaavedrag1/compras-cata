import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { DateRangePicker } from "../components/ui/DateRangePicker";
import { InfoHint } from "../components/business/InfoHint";
import { PurchaseProcessBar } from "../components/business/PurchaseProcessBar";
import { IconPlus } from "../components/ui/icons";
import { usePickupPlan } from "../components/business/LogisticsPlan";
import { draftBudgetImpact } from "../utils/openToBuy";
import { purchaseOrders as mockPOs } from "../data/mockPurchaseOrders";
import { useCollection } from "../context/DataContext";
import { apiCreate, backendEnabled } from "../services/apiClient";
import { recommendations } from "../data/mockRecommendations";
import { rfqs } from "../data/mockRfq";
import { getProductBySku, products as allProducts } from "../data/mockProducts";
import { suppliers as mockSuppliers } from "../data/mockSuppliers";
import { orderSalesAtRisk, type ConsolidationCandidate } from "../utils/orderConsolidation";
import {
  OcDetailModal,
  DraftSummaryCard,
  OrdersKpiRow,
  OrdersTable,
  OrderDraftDrawer,
} from "./PurchaseOrdersSections";
import { buildOrderProcessStages } from "./purchaseOrders/processStages";
import { lineNet, type OcDraftItem } from "../context/OcDraftContext";
import { purchaseRules, resolveRuleForProduct } from "../data/mockRules";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { usePurchaseFlow } from "../context/PurchaseFlowContext";
import { useBuyer } from "../context/BuyerContext";
import { useRole } from "../context/RoleContext";
import { coverageDays, addDaysISO } from "../utils/calculations";
import { inRange, type IsoRange } from "../utils/dateRange";
import { TODAY_ISO, APPROVAL_ORDER_AMOUNT_CLP, APPROVAL_COVERAGE_DAYS } from "../utils/constants";
import type { ApprovalCriterion } from "../data/mockApprovals";
import { useLocalStorage } from "../utils/useLocalStorage";
import type { PurchaseOrder, PurchaseOrderStatus } from "../types/purchasing";
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
    clear,
    addItem,
    hasItem,
  } = useOcDraft();
  const toast = useToast();
  const { addApproval, addDecision, approvals, approvalState } = usePurchaseFlow();
  const { buyer } = useBuyer();
  const { role } = useRole();
  const seedPOs = useCollection<PurchaseOrder>("purchase-orders", mockPOs);

  // Persistente: órdenes creadas por el usuario + cambios de estado sobre las semilla
  const [createdOrders, setCreatedOrders] = useLocalStorage<PurchaseOrder[]>(
    "compras:po-created",
    []
  );
  const [statusOverrides, setStatusOverrides] = useLocalStorage<
    Record<string, PurchaseOrderStatus>
  >("compras:po-status", {});

  const initialTab = pathname.includes("/comprar/borradores")
    ? "draft"
    : pathname.includes("/comprar/seguimiento")
      ? "open"
      : "all";
  const [tab, setTab] = useState(initialTab);
  const [dates, setDates] = useState<IsoRange>({ from: "", to: "" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [createdNumber, setCreatedNumber] = useState<string | null>(null);
  const [draftContextSku, setDraftContextSku] = useState<string | null>(null);
  const [draftContextTab, setDraftContextTab] = useState("resumen");

  // Estado derivado de aprobación: una OC "por aprobar" pasa a "aprobada" cuando
  // todas sus líneas con solicitud quedan aprobadas (mismo número en el id APR-).
  const approvalDerivedStatus = (o: PurchaseOrder): PurchaseOrderStatus => {
    if (o.status !== "pending_approval") return o.status;
    const linked = approvals.filter((a) => a.id.startsWith(`APR-${o.number}-`));
    if (linked.length === 0) return o.status;
    const states = linked.map((a) => approvalState[a.id] ?? "pendiente");
    if (states.every((s) => s === "aprobada")) return "approved";
    return "pending_approval";
  };

  const orders = useMemo<PurchaseOrder[]>(() => {
    const apply = (o: PurchaseOrder) => {
      if (statusOverrides[o.id]) return { ...o, status: statusOverrides[o.id] };
      const derived = approvalDerivedStatus(o);
      return derived !== o.status ? { ...o, status: derived } : o;
    };
    const all = [...createdOrders.map(apply), ...seedPOs.map(apply)];
    // El comprador solo ve sus propias OC; el líder, las de todo el equipo.
    return role === "lider" ? all : all.filter((o) => o.buyerName === buyer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdOrders, statusOverrides, approvals, approvalState, seedPOs, role, buyer]);

  // Deep-link: /ordenes-compra?oc=OC-XXXX abre el detalle de esa orden.
  const [searchParams, setSearchParams] = useSearchParams();
  const ocParam = searchParams.get("oc");
  useEffect(() => {
    if (!ocParam) return;
    const po = orders.find((o) => o.number === ocParam);
    if (po) setDetail(po);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocParam, orders.length]);
  const closeDetail = () => {
    setDetail(null);
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
      draft: visible.filter((o) => o.status === "draft").length,
      open: visible.filter((o) => EMITTED_STATUSES.includes(o.status)).length,
      delayed: visible.filter((o) => o.status === "delayed").length,
      received: visible.filter((o) => o.status === "received" || o.status === "closed").length,
    };
  }, [visible]);

  // Venta en riesgo por OC: prioriza el seguimiento por impacto comercial, no
  // solo por días de atraso (una OC con 1 día de atraso que evita un quiebre
  // masivo pesa más que una muy atrasada de un producto sin venta).
  const riskByOrder = useMemo(() => {
    const map = new Map<string, ReturnType<typeof orderSalesAtRisk>>();
    visible.forEach((o) => {
      const arrivalDays = o.delayedDays > 0 ? o.delayedDays : Math.max(0, daysToDate(o.expectedDate));
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
    const rv = (o: PurchaseOrder) => riskByOrder.get(o.id)?.value ?? 0;
    const byRisk = (a: PurchaseOrder, b: PurchaseOrder) => rv(b) - rv(a) || b.delayedDays - a.delayedDays;
    switch (tab) {
      case "draft":
        return visible.filter((o) => o.status === "draft");
      case "open":
        return visible.filter((o) => EMITTED_STATUSES.includes(o.status)).sort(byRisk);
      case "delayed":
        return visible.filter((o) => o.status === "delayed").sort(byRisk);
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
  const draftCount = visible.filter((o) => o.status === "draft").length;
  const openRfqs = rfqs.filter((r) => !["convertida", "rechazada", "vencida"].includes(r.estado));
  const pendingApprovals = approvals.filter(
    (a) => (approvalState[a.id] ?? "pendiente") === "pendiente"
  );
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
    () => draftBudgetImpact(TODAY_ISO.slice(0, 7), items, createdOrders),
    [items, createdOrders]
  );

  const selectedDraftItem = items.find((i) => i.sku === draftContextSku) ?? items[0] ?? null;

  const markAsSent = (id: string) => {
    setStatusOverrides((prev) => ({ ...prev, [id]: "sent" }));
    setDetail(null);
    toast.success("Orden de compra marcada como enviada");
  };

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
    addItem({
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
    addItem({
      sku: c.sku,
      productName: c.productName,
      supplierName,
      quantity: c.suggestedQty,
      unitCost: c.unitCost,
      discountPct: c.discountPct,
    });
    toast.success(`${c.productName} agregado — consolidado con ${supplierName}`);
  };

  const createOrder = () => {
    if (count === 0) return;
    const buyerName = role === "lider" ? "Catalina Saavedra" : buyer;
    const expected = meta.expectedDate || addDaysISO(TODAY_ISO, 7);

    // Una orden de compra por proveedor (una OC no mezcla proveedores).
    const groups = new Map<string, OcDraftItem[]>();
    items.forEach((i) => {
      const arr = groups.get(i.supplierName) ?? [];
      arr.push(i);
      groups.set(i.supplierName, arr);
    });

    const created: PurchaseOrder[] = [];
    let approvalsCreated = 0;
    let seq = 0;

    groups.forEach((groupItems, supplierName) => {
      const num = `OC-2026-${String(143 + createdOrders.length + seq).padStart(4, "0")}`;
      seq++;
      let orderApprovals = 0;

      // "Monto alto" es a nivel de OC (política de Gobierno: OC sobre $10M),
      // no por línea: se evalúa contra el total neto de la orden.
      const grossGroup = groupItems.reduce((a, i) => a + i.quantity * i.unitCost, 0);
      const netGroup = groupItems.reduce((a, i) => a + lineNet(i), 0);
      const montoAltoOC = netGroup >= APPROVAL_ORDER_AMOUNT_CLP;

      groupItems.forEach((i, idx) => {
        const rec = recommendations.find((r) => r.sku === i.sku);
        const p = getProductBySku(i.sku);
        const suggested = rec?.suggestedQuantity ?? i.quantity;
        const diff = i.quantity - suggested;
        const diffPct = suggested > 0 ? Math.abs(diff / suggested) : i.quantity > 0 ? 1 : 0;

        const rule = p ? resolveRuleForProduct(p, purchaseRules) : null;
        const objetivo = rule?.targetInventoryDays ?? 45;
        const coverAfter =
          p && p.salesLast30Days > 0
            ? coverageDays(p.availableStock + i.quantity, p.salesLast30Days)
            : 0;
        const margin = p ? p.margin : 100;
        const minMargin = rule?.minMargin ?? 0;
        const lineAmount = lineNet(i);

        const criteria: ApprovalCriterion[] = [];
        if (suggested === 0 || diffPct > 0.2) criteria.push("desvio_sugerido");
        if (montoAltoOC) criteria.push("monto_alto");
        if (coverAfter > APPROVAL_COVERAGE_DAYS) criteria.push("cobertura_excesiva");
        if (margin < minMargin) criteria.push("margen_bajo");

        addDecision({
          id: `DEC-${num}-${idx}`,
          date: TODAY_ISO,
          sku: i.sku,
          productName: i.productName,
          supplierName: i.supplierName,
          buyerName,
          approvedBy: criteria.length > 0 ? "Pendiente" : "—",
          suggestedQty: suggested,
          purchasedQty: i.quantity,
          unitCost: i.unitCost,
          reason:
            criteria.length > 0
              ? `Desvío vs sugerido en ${num}`
              : `Compra alineada al sugerido (${num})`,
          resultDays: 0,
          outcome: "pendiente",
          resultText: `Compra recién creada en ${num}. Resultado en medición.`,
          learning: "—",
        });

        if (criteria.length > 0) {
          orderApprovals++;
          approvalsCreated++;
          addApproval({
            id: `APR-${num}-${idx}`,
            date: TODAY_ISO,
            sku: i.sku,
            productName: i.productName,
            supplierName: i.supplierName,
            buyerName,
            suggestedQty: suggested,
            requestedQty: i.quantity,
            unitCost: i.unitCost,
            amount: lineAmount,
            coberturaResultante: Math.round(coverAfter),
            coberturaObjetivo: objetivo,
            margin: Math.round(margin),
            minMargin,
            criteria,
            justification: "Pendiente de justificar por el comprador",
          });
        }
      });

      const effDisc = grossGroup > 0 ? Math.round(((grossGroup - netGroup) / grossGroup) * 100) : 0;

      const newOrder: PurchaseOrder = {
        id: `PO-${num}`,
        number: num,
        supplierName,
        createdAt: TODAY_ISO,
        expectedDate: expected,
        status: orderApprovals > 0 ? "pending_approval" : "draft",
        totalAmount: netGroup,
        skuCount: groupItems.length,
        destinationWarehouse: meta.destinationWarehouse,
        paymentTerms: meta.paymentTerms,
        comments: meta.notes || undefined,
        discountPct: effDisc || undefined,
        buyerName,
        delayedDays: 0,
        lines: groupItems.map((i) => ({
          sku: i.sku,
          productName: i.productName,
          quantity: i.quantity,
          unitCost: i.unitCost,
        })),
      };
      created.push(newOrder);
      if (backendEnabled) apiCreate("purchase-orders", newOrder).catch(() => {});
    });

    setCreatedOrders((prev) => [...created, ...prev]);
    const numbers = created.map((o) => o.number).join(", ");
    setCreatedNumber(numbers);
    clear();
    setDrawerOpen(false);
    setTab("draft");
    const n = created.length;
    toast.success(
      `${n} borrador${n === 1 ? "" : "es"} creado${n === 1 ? "" : "s"} (${numbers})` +
        (approvalsCreated > 0 ? ` · ${approvalsCreated} línea(s) requieren aprobación` : ""),
      approvalsCreated > 0
        ? { label: "Ver aprobaciones", onClick: () => navigate("/comprar/aprobaciones") }
        : undefined
    );
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
          pendingCount: pendingApprovals.length,
          ordersCount: visible.length,
          emittedCount: emittedOrders.length,
          receivingOrders,
        })}
      />

      {createdNumber && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-emerald-800">
            Borrador <span className="font-semibold">{createdNumber}</span> creado correctamente.
            Puedes revisarlo en la pestaña Borradores.
          </p>
          <button
            onClick={() => setCreatedNumber(null)}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
          >
            Cerrar
          </button>
        </div>
      )}

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

      <OrdersTable
        orders={filtered}
        riskOf={(id) => riskByOrder.get(id)}
        tab={tab}
        onOpenDetail={setDetail}
      />

      {/* Editor del borrador de orden de compra */}
      <OrderDraftDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navigate={navigate}
        createOrder={createOrder}
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

      <OcDetailModal detail={detail} onClose={closeDetail} onMarkSent={markAsSent} />
    </div>
  );
}

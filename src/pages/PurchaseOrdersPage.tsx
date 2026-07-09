import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useLocation, useSearchParams } from "react-router-dom";
import { supplierPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { StatusBadge } from "../components/business/StatusBadge";
import { Tabs } from "../components/ui/Tabs";
import { Button } from "../components/ui/Button";
import { Drawer } from "../components/ui/Drawer";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { DateRangePicker } from "../components/ui/DateRangePicker";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { PurchaseProcessBar } from "../components/business/PurchaseProcessBar";
import { IconPlus, IconReplenish, IconOrders, IconSearch, IconClose } from "../components/ui/icons";
import { purchaseOrders as mockPOs } from "../data/mockPurchaseOrders";
import { suppliers as mockSuppliers } from "../data/mockSuppliers";
import { useCollection } from "../context/DataContext";
import { apiCreate, backendEnabled } from "../services/apiClient";
import { recommendations } from "../data/mockRecommendations";
import { rfqs } from "../data/mockRfq";
import { getProductBySku, products as allProducts } from "../data/mockProducts";
import { OcDetailModal } from "./PurchaseOrdersSections";
import { lineNet, type OcDraftItem } from "../context/OcDraftContext";
import { purchaseRules, resolveRuleForProduct } from "../data/mockRules";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { usePurchaseFlow } from "../context/PurchaseFlowContext";
import { useBuyer } from "../context/BuyerContext";
import { useRole } from "../context/RoleContext";
import { coverageDays, addDaysISO } from "../utils/calculations";
import { inRange, type IsoRange } from "../utils/dateRange";
import { TODAY_ISO } from "../utils/constants";
import type { ApprovalCriterion } from "../data/mockApprovals";
import { useLocalStorage } from "../utils/useLocalStorage";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import type { PurchaseOrder, PurchaseOrderStatus } from "../types/purchasing";

const TABS = [
  { value: "all", label: "Todas" },
  { value: "draft", label: "Borradores" },
  { value: "open", label: "En curso" },
  { value: "delayed", label: "Atrasadas" },
  { value: "received", label: "Recibidas" },
];

const WAREHOUSES = [
  "Centro de Distribución",
  "Bodega Santiago",
  "Bodega Norte",
  "Bodega Sur",
  "Tienda Central",
];
const PAYMENT_TERMS = [
  "Contado",
  "15 días fecha factura",
  "30 días fecha factura",
  "60 días fecha factura",
  "90 días fecha factura",
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
    const open: PurchaseOrderStatus[] = [
      "sent",
      "confirmed",
      "partially_received",
      "with_difference",
    ];
    return {
      all: visible.length,
      draft: visible.filter((o) => o.status === "draft").length,
      open: visible.filter((o) => open.includes(o.status)).length,
      delayed: visible.filter((o) => o.status === "delayed").length,
      received: visible.filter((o) => o.status === "received" || o.status === "closed").length,
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const open: PurchaseOrderStatus[] = [
      "sent",
      "confirmed",
      "partially_received",
      "with_difference",
    ];
    switch (tab) {
      case "draft":
        return visible.filter((o) => o.status === "draft");
      case "open":
        return visible.filter((o) => open.includes(o.status));
      case "delayed":
        return visible.filter((o) => o.status === "delayed");
      case "received":
        return visible.filter((o) => o.status === "received" || o.status === "closed");
      default:
        return visible;
    }
  }, [visible, tab]);

  const totalOpenAmount = visible
    .filter((o) => !["received", "cancelled"].includes(o.status))
    .reduce((a, o) => a + o.totalAmount, 0);
  const delayedCount = visible.filter((o) => o.status === "delayed").length;
  const draftCount = visible.filter((o) => o.status === "draft").length;
  const openRfqs = rfqs.filter((r) => !["convertida", "rechazada", "vencida"].includes(r.estado));
  const pendingApprovals = approvals.filter(
    (a) => (approvalState[a.id] ?? "pendiente") === "pendiente"
  );
  const emittedOrders = visible.filter((o) =>
    ["sent", "confirmed", "partially_received", "with_difference"].includes(o.status)
  );
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
          !["received", "closed", "cancelled"].includes(o.status) &&
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
      budgetAvailable: 22000000,
    };
  }, [items, orders, supplierGroups]);

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
        if (lineAmount >= 5000000) criteria.push("monto_alto");
        if (coverAfter > objetivo * 1.3) criteria.push("cobertura_excesiva");
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

      const grossGroup = groupItems.reduce((a, i) => a + i.quantity * i.unitCost, 0);
      const netGroup = groupItems.reduce((a, i) => a + lineNet(i), 0);
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

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "number",
      header: "N° OC",
      render: (o) => (
        <div>
          <p className="font-medium text-slate-800">{o.number}</p>
          <p className="text-xs text-slate-400">{o.buyerName}</p>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      render: (o) => (
        <Link
          to={supplierPath(o.supplierName)}
          className="text-sm text-slate-700 hover:text-brand-700 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {o.supplierName}
        </Link>
      ),
    },
    {
      key: "dates",
      header: "Creación / Esperada",
      hideOnMobile: true,
      render: (o) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatDate(o.createdAt)}</p>
          <p className="text-xs text-slate-400">espera {formatDate(o.expectedDate)}</p>
        </div>
      ),
    },
    {
      key: "skus",
      header: "SKUs",
      align: "right",
      hideOnMobile: true,
      render: (o) => formatNumber(o.skuCount),
    },
    {
      key: "warehouse",
      header: "Bodega destino",
      hideOnMobile: true,
      render: (o) => <span className="text-sm text-slate-600">{o.destinationWarehouse}</span>,
    },
    {
      key: "amount",
      header: "Monto total",
      align: "right",
      render: (o) => (
        <span className="font-semibold text-slate-900">{formatCurrency(o.totalAmount)}</span>
      ),
    },
    {
      key: "delay",
      header: "Atraso",
      align: "center",
      render: (o) =>
        o.delayedDays > 0 ? (
          <Badge tone="red">{o.delayedDays} d</Badge>
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
    {
      key: "status",
      header: "Estado",
      render: (o) => <StatusBadge kind="purchaseOrder" value={o.status} />,
    },
    {
      key: "actions",
      header: "",
      render: (o) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDetail(o);
          }}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Ver detalle
        </button>
      ),
    },
  ];

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
      />

      <PurchaseProcessBar
        stages={[
          {
            label: "Necesidad",
            detail: "Decidir qué comprar",
            count: recommendations.filter((r) => r.status === "critical" || r.status === "buy_now")
              .length,
            to: "/comprar/decisiones",
            tone: "red",
          },
          {
            label: "Preparación",
            detail: "Cotizar y negociar",
            count: openRfqs.length,
            to: "/comprar/cotizaciones",
            tone: openRfqs.length > 0 ? "amber" : "neutral",
          },
          {
            label: "Borrador",
            detail: "Construir OC",
            count,
            to: "/comprar/borradores",
            active: pathname.includes("/comprar/borradores"),
            tone: count > 0 ? "blue" : "neutral",
          },
          {
            label: "Aprobación",
            detail: "Validar desvíos",
            count: pendingApprovals.length,
            to: "/comprar/aprobaciones",
            tone: pendingApprovals.length > 0 ? "amber" : "green",
          },
          {
            label: "Órdenes",
            detail: "Emitidas",
            count: visible.length,
            to: "/comprar/ordenes",
            active: pathname.includes("/comprar/ordenes"),
            tone: visible.length > 0 ? "blue" : "neutral",
          },
          {
            label: "Emitidas",
            detail: "OC en curso",
            count: emittedOrders.length,
            to: "/comprar/seguimiento",
            active: pathname.includes("/comprar/seguimiento"),
            tone: emittedOrders.length > 0 ? "blue" : "neutral",
          },
          {
            label: "Por recibir",
            detail: "Recepción",
            count: receivingOrders.length,
            to: "/comprar/recepciones",
            tone: receivingOrders.some((o) => o.status === "delayed") ? "red" : "blue",
          },
        ]}
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
        <Card className="mb-4 border-brand-200">
          <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                Compra en curso
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                Borrador · {draftSummary.mainSupplier}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {count} SKU · {formatCurrency(totalAmount)} · cobertura futura promedio{" "}
                {draftSummary.avgCoverage > 0 ? `${draftSummary.avgCoverage} días` : "sin venta"}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <DraftMetric
                  label="Presupuesto disp."
                  value={formatCurrencyCompact(draftSummary.budgetAvailable)}
                />
                <DraftMetric
                  label="Cobertura futura"
                  value={draftSummary.avgCoverage > 0 ? `${draftSummary.avgCoverage} d` : "n/a"}
                />
                <DraftMetric label="SKU críticos" value={formatNumber(draftSummary.critical)} />
                <DraftMetric label="Valor OC" value={formatCurrencyCompact(totalAmount)} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Observaciones antes de formalizar
              </p>
              <div className="mt-2 space-y-2 text-sm">
                <DraftWarning
                  count={draftSummary.openOverlap}
                  text="productos tienen OC abiertas"
                />
                <DraftWarning
                  count={draftSummary.overSuggested}
                  text="cantidades superan la recomendación"
                />
                <DraftWarning
                  count={draftSummary.highCoverage}
                  text="productos quedarían con cobertura mayor a 90 días"
                />
                <DraftWarning
                  count={Math.max(0, totalAmount - draftSummary.budgetAvailable)}
                  text="sobre presupuesto disponible"
                  currency
                />
              </div>
              <Button className="mt-3 w-full" size="sm" onClick={() => setDrawerOpen(true)}>
                Continuar trabajando
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Monto en curso"
          value={formatCurrencyCompact(totalOpenAmount)}
          tone="info"
          icon={<IconOrders className="w-4 h-4" />}
          description="Ver en curso"
          active={tab === "open"}
          onClick={() => setTab("open")}
        />
        <KpiCard
          title="Atrasadas"
          value={formatNumber(delayedCount)}
          tone="bad"
          icon={<IconReplenish className="w-4 h-4" />}
          description="Ver atrasadas"
          active={tab === "delayed"}
          onClick={() => setTab("delayed")}
        />
        <KpiCard
          title="Borradores"
          value={formatNumber(draftCount)}
          tone="warn"
          icon={<IconPlus className="w-4 h-4" />}
          description="Ver borradores"
          active={tab === "draft"}
          onClick={() => setTab("draft")}
        />
        <KpiCard
          title="Total OC"
          value={formatNumber(visible.length)}
          tone="neutral"
          icon={<IconOrders className="w-4 h-4" />}
          description="Ver todas"
          active={tab === "all"}
          onClick={() => setTab("all")}
        />
      </div>

      <HelpNote className="mb-4">
        Una OC pasa por: <b>borrador → enviada → confirmada → recibida</b>. Las <b>atrasadas</b>{" "}
        (rojo) superaron su fecha esperada y pueden provocar quiebre: priorízalas. Crea nuevas OC
        desde las sugerencias de reposición con el botón de arriba.
      </HelpNote>

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

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(o) => o.id}
          onRowClick={(o) => setDetail(o)}
          rowClassName={(o) => (o.status === "delayed" ? "bg-rose-50/40" : undefined)}
          emptyMessage={
            tab === "delayed"
              ? "No hay órdenes de compra atrasadas. Todas están dentro de su fecha esperada de entrega."
              : tab === "draft"
                ? "No tienes borradores. Crea uno desde las sugerencias de reposición."
                : "No hay órdenes de compra en esta vista."
          }
          mobileCard={(o) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{o.number}</p>
                  <p className="text-xs text-slate-400">
                    {o.supplierName} · {o.buyerName}
                  </p>
                </div>
                <StatusBadge kind="purchaseOrder" value={o.status} dot={false} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Esperada</p>
                  <p className="text-slate-700">{formatDate(o.expectedDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">SKUs</p>
                  <p className="text-slate-700">{formatNumber(o.skuCount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Monto</p>
                  <p className="text-slate-700">{formatCurrencyCompact(o.totalAmount)}</p>
                </div>
              </div>
            </div>
          )}
        />
      </Card>

      {/* Editor del borrador de orden de compra */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Borrador de orden de compra"
        description="Agrega productos, ajusta cantidad, costo y descuento, completa los datos y genera la OC."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={createOrder} disabled={count === 0}>
              {supplierGroups.length > 1 ? `Crear ${supplierGroups.length} OC` : "Crear borrador"} ·{" "}
              {formatCurrency(totalAmount)}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Buscar y agregar cualquier producto */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
              Agregar productos
            </p>
            <Input
              icon={<IconSearch className="w-4 h-4" />}
              placeholder="Buscar producto por nombre o SKU…"
              value={prodSearch}
              onChange={(e) => setProdSearch(e.target.value)}
            />
            {prodSearch.trim().length >= 2 && (
              <div className="mt-1.5 rounded-lg border border-slate-200 divide-y divide-slate-50 max-h-56 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-slate-400">Sin coincidencias.</p>
                ) : (
                  searchResults.map((p) => {
                    const added = hasItem(p.sku);
                    return (
                      <button
                        key={p.sku}
                        disabled={added}
                        onClick={() => addProduct(p.sku)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-60 disabled:cursor-default"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-800 truncate">
                            {p.name}
                          </span>
                          <span className="block text-xs text-slate-400">
                            {p.sku} · {p.supplierName || "Sin proveedor"} · {formatCurrency(p.cost)}
                          </span>
                        </span>
                        <span
                          className={`text-xs font-semibold flex-shrink-0 ${added ? "text-slate-400" : "text-brand-600"}`}
                        >
                          {added ? "En borrador" : "Agregar"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {count === 0 ? (
            <EmptyState
              title="El borrador está vacío"
              description="Busca un producto arriba, o agrégalos desde Reposición sugerida o las sugerencias de abajo."
              action={
                <Button
                  onClick={() => {
                    setDrawerOpen(false);
                    navigate("/comprar/decisiones");
                  }}
                >
                  Ir a reposición
                </Button>
              }
            />
          ) : (
            <>
              {/* Datos de cabecera de la orden */}
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2.5">
                  Datos de la orden
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Bodega destino"
                    value={meta.destinationWarehouse}
                    onChange={(e) => setMeta({ destinationWarehouse: e.target.value })}
                    options={WAREHOUSES.map((w) => ({ value: w, label: w }))}
                  />
                  <Select
                    label="Condición de pago"
                    value={meta.paymentTerms}
                    onChange={(e) => setMeta({ paymentTerms: e.target.value })}
                    options={PAYMENT_TERMS.map((t) => ({ value: t, label: t }))}
                  />
                  <Input
                    label="Fecha esperada"
                    type="date"
                    value={meta.expectedDate}
                    onChange={(e) => setMeta({ expectedDate: e.target.value })}
                  />
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Observaciones
                    </label>
                    <textarea
                      value={meta.notes}
                      onChange={(e) => setMeta({ notes: e.target.value })}
                      rows={2}
                      placeholder="Notas para el proveedor o internas…"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                </div>
              </div>

              {selectedDraftItem && (
                <DraftLineContext
                  item={selectedDraftItem}
                  orders={orders}
                  tab={draftContextTab}
                  onTabChange={setDraftContextTab}
                  onQuantityChange={(quantity) => updateQuantity(selectedDraftItem.sku, quantity)}
                  onOpenProduct={() => navigate(`/productos/${selectedDraftItem.sku}`)}
                />
              )}

              {/* Líneas agrupadas por proveedor */}
              {supplierGroups.map(([supplierName, groupItems]) => {
                const net = groupItems.reduce((a, i) => a + lineNet(i), 0);
                return (
                  <div
                    key={supplierName}
                    className="rounded-lg border border-slate-200 overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2 border-b border-slate-100">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {supplierName}
                      </span>
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {groupItems.length} línea{groupItems.length === 1 ? "" : "s"} ·{" "}
                        <b className="text-slate-700">{formatCurrency(net)}</b>
                      </span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {groupItems.map((it) => (
                        <div key={it.sku} className="px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">
                                {it.productName}
                              </p>
                              <p className="text-xs text-slate-400 font-mono">{it.sku}</p>
                            </div>
                            <button
                              onClick={() => removeItem(it.sku)}
                              aria-label={`Quitar ${it.productName}`}
                              className="text-slate-300 hover:text-rose-600 flex-shrink-0"
                            >
                              <IconClose className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <label className="block text-[11px] text-slate-500">
                              Cantidad
                              <Input
                                type="number"
                                min={0}
                                value={it.quantity}
                                onChange={(e) => updateQuantity(it.sku, Number(e.target.value))}
                              />
                            </label>
                            <label className="block text-[11px] text-slate-500">
                              Costo unit.
                              <Input
                                type="number"
                                min={0}
                                value={it.unitCost}
                                onChange={(e) =>
                                  updateItem(it.sku, {
                                    unitCost: Math.max(0, Number(e.target.value)),
                                  })
                                }
                              />
                            </label>
                            <label className="block text-[11px] text-slate-500">
                              Desc. %
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={it.discountPct ?? 0}
                                onChange={(e) =>
                                  updateItem(it.sku, {
                                    discountPct: Math.max(0, Math.min(100, Number(e.target.value))),
                                  })
                                }
                              />
                            </label>
                          </div>
                          <div className="flex justify-end items-baseline gap-2 mt-1.5 text-sm">
                            <button
                              type="button"
                              onClick={() => setDraftContextSku(it.sku)}
                              className="mr-auto text-xs font-medium text-brand-600 hover:text-brand-700"
                            >
                              Analizar línea
                            </button>
                            <span className="text-xs text-slate-400">Total línea</span>
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(lineNet(it))}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Totales */}
              <div className="rounded-lg bg-slate-50 px-3 py-2.5 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-700">{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Descuento</span>
                    <span className="text-emerald-600">− {formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-sm font-medium text-slate-600">Total</span>
                  <span className="text-base font-semibold text-slate-900">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                {supplierGroups.length > 1 && (
                  <p className="text-[11px] text-slate-400 pt-0.5">
                    Se generarán {supplierGroups.length} órdenes (una por proveedor).
                  </p>
                )}
              </div>
            </>
          )}

          {pendingSuggestions.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Sugerencias para agregar
              </p>
              <div className="space-y-2">
                {pendingSuggestions.slice(0, 6).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.productName}</p>
                      <p className="text-xs text-slate-500">
                        {r.supplierName} · {formatNumber(r.suggestedQuantity)} u. ·{" "}
                        {formatCurrency(r.suggestedPurchaseAmount)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<IconPlus className="w-3.5 h-3.5" />}
                      onClick={() => addProduct(r.sku)}
                    >
                      Agregar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Drawer>

      <OcDetailModal detail={detail} onClose={closeDetail} onMarkSent={markAsSent} />
    </div>
  );
}

function DraftLineContext({
  item,
  orders,
  tab,
  onTabChange,
  onQuantityChange,
  onOpenProduct,
}: {
  item: OcDraftItem;
  orders: PurchaseOrder[];
  tab: string;
  onTabChange: (value: string) => void;
  onQuantityChange: (quantity: number) => void;
  onOpenProduct: () => void;
}) {
  const product = getProductBySku(item.sku);
  const rec = recommendations.find((r) => r.sku === item.sku);
  const supplier = mockSuppliers.find((s) => s.name === item.supplierName);
  const openOrders = orders.filter(
    (o) =>
      o.supplierName === item.supplierName &&
      !["received", "closed", "cancelled"].includes(o.status) &&
      o.lines?.some((line) => line.sku === item.sku)
  );
  const currentCoverage = product
    ? coverageDays(product.availableStock, product.salesLast30Days)
    : 0;
  const futureCoverage =
    product && product.salesLast30Days > 0
      ? coverageDays(product.availableStock + item.quantity, product.salesLast30Days)
      : 0;
  const suggestedQty = rec?.suggestedQuantity ?? item.quantity;
  const deltaVsSuggested = item.quantity - suggestedQty;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Contexto de línea
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900 truncate">
            {item.productName}
          </h3>
          <p className="text-xs text-slate-500">
            {item.sku} · cantidad OC {formatNumber(item.quantity)} u. · sugerido{" "}
            {formatNumber(suggestedQty)} u.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onOpenProduct}>
          Ver SKU 360
        </Button>
      </div>

      <Tabs
        className="mt-3"
        value={tab}
        onChange={onTabChange}
        tabs={[
          { value: "resumen", label: "Resumen" },
          { value: "inventario", label: "Inventario" },
          { value: "venta", label: "Venta" },
          { value: "proveedor", label: "Proveedor" },
        ]}
      />

      {tab === "resumen" && (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DraftMetric
            label="Stock"
            value={product ? `${formatNumber(product.availableStock)} u.` : "n/a"}
          />
          <DraftMetric label="Cobertura actual" value={product ? `${currentCoverage} d` : "n/a"} />
          <DraftMetric label="Cobertura futura" value={product ? `${futureCoverage} d` : "n/a"} />
          <DraftMetric
            label="OC abiertas"
            value={
              openOrders.length > 0
                ? `${formatNumber(openOrders.reduce((sum, o) => sum + (o.lines?.find((l) => l.sku === item.sku)?.quantity ?? 0), 0))} u.`
                : "0 u."
            }
          />
        </div>
      )}

      {tab === "inventario" && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(product?.stockByLocation ?? []).slice(0, 3).map((loc) => (
            <div key={loc.locationName} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium text-slate-500">{loc.locationName}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatNumber(loc.available)} u.
              </p>
              <p className="text-xs text-slate-400">comprometido {formatNumber(loc.committed)}</p>
            </div>
          ))}
          {openOrders.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-3">
              <p className="text-sm font-medium text-amber-800">
                Hay {openOrders.length} OC abierta{openOrders.length === 1 ? "" : "s"} con este SKU.
              </p>
              <p className="text-xs text-amber-700">
                Revisa antes de duplicar compra o elevar cobertura.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "venta" && (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DraftMetric
            label="Venta 30d"
            value={product ? `${formatNumber(product.salesLast30Days)} u.` : "n/a"}
          />
          <DraftMetric
            label="Venta 90d"
            value={product ? `${formatNumber(product.salesLast90Days)} u.` : "n/a"}
          />
          <DraftMetric
            label="Rotación"
            value={product ? `${formatNumber(product.rotation)}x` : "n/a"}
          />
          <DraftMetric
            label="Variación OC"
            value={`${deltaVsSuggested > 0 ? "+" : ""}${formatNumber(deltaVsSuggested)} u.`}
          />
        </div>
      )}

      {tab === "proveedor" && (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Proveedor
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{item.supplierName}</p>
            <p className="text-xs text-slate-500">
              Cumplimiento {supplier ? `${supplier.deliveryCompliance}%` : "n/a"} · lead time{" "}
              {supplier ? `${supplier.averageLeadTimeDays} d` : "n/a"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Rentabilidad
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              Margen {product ? formatPercent(product.margin) : "n/a"}
            </p>
            <p className="text-xs text-slate-500">
              Costo {formatCurrency(item.unitCost)} · línea {formatCurrency(lineNet(item))}
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-end">
        <label className="block flex-1 text-xs font-medium text-slate-600">
          Cantidad OC
          <Input
            type="number"
            min={0}
            value={item.quantity}
            onChange={(e) => onQuantityChange(Number(e.target.value))}
          />
        </label>
        <div className="text-sm text-slate-500">
          Después de comprar:{" "}
          <span className="font-semibold text-slate-900">
            {product ? `${futureCoverage} días` : "sin cálculo"}
          </span>
        </div>
      </div>
    </div>
  );
}

function DraftMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DraftWarning({
  count,
  text,
  currency,
}: {
  count: number;
  text: string;
  currency?: boolean;
}) {
  const active = count > 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
      <span className={active ? "text-slate-700" : "text-slate-400"}>{text}</span>
      <Badge tone={active ? "amber" : "green"}>
        {currency ? (active ? formatCurrencyCompact(count) : "$0") : count}
      </Badge>
    </div>
  );
}

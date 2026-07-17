import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { DataTable, type Column, type SortState } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { PriorityBadge } from "../components/business/PriorityBadge";
import { StateLegend } from "../components/business/StateLegend";
import { PurchaseProcessBar } from "../components/business/PurchaseProcessBar";
import { recommendationUrgency, priorityUrgency } from "../components/business/statusInfo";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Tabs } from "../components/ui/Tabs";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { IconReplenish, IconAlerts, IconPlus, IconClose, IconInfo } from "../components/ui/icons";
import { PageSkeleton } from "../components/ui/Skeleton";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { rfqs } from "../data/mockRfq";
import { suppliers } from "../data/mockSuppliers";
import { monthlyPurchaseBudget } from "../data/mockRules";
import { filterRecommendations, uniqueValues } from "../utils/filters";
import { coverageDays } from "../utils/calculations";
import { cn } from "../utils/cn";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDays,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { usePurchaseFlow } from "../context/PurchaseFlowContext";
import { useUrlState } from "../utils/useUrlState";
import { ExportButton } from "../components/business/ExportButton";
import type { PurchaseRecommendation } from "../types/purchasing";
import { isHiddenByDefault, useReplenishment } from "../hooks/useReplenishment";
import type { PurchaseBffError } from "../services/purchaseBff";

import type { DecisionViewMode, OpenPoSignal } from "./replenishment/types";
import {
  buildDecisionGroups,
  decisionTypeLabel,
  purchaseMultiple,
  salesTrendPct,
} from "./replenishment/helpers";
import {
  CoverageCell,
  DecisionMetric,
  GroupedDecisionCards,
  RecommendationDecisionDrawer,
  RecommendationMobileCard,
  SegmentedControl,
} from "./replenishment/components";

const emptyToggles = {
  stockout: false,
  stockoutRisk: false,
  overstock: false,
  lowMargin: false,
  highRotation: false,
  lowRotation: false,
};

export function ReplenishmentPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { addItem, hasItem, count: draftCount } = useOcDraft();
  const toast = useToast();
  const { approvals } = usePurchaseFlow();

  // Datos reales del purchase-bff-service (reemplaza los mocks de
  // recomendaciones y los overrides/ignoradas en localStorage).
  const { rows, meta, warnings, loading, error, configured, refetch, applyAction } =
    useReplenishment();

  // Estado de UI
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>({ key: null, dir: "desc" });
  const [foco, setFoco] = useUrlState("foco", "all");
  const [query, setQuery] = useUrlState("q");
  const [category, setCategory] = useUrlState("cat");
  const [supplier, setSupplier] = useUrlState("prov");
  const [status, setStatus] = useUrlState("estado");
  const [priority, setPriority] = useUrlState("prioridad");
  const [toggles, setToggles] = useState(emptyToggles);
  const [viewMode, setViewMode] = useState<DecisionViewMode>("product");

  const [editing, setEditing] = useState<PurchaseRecommendation | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editSupplier, setEditSupplier] = useState("");
  const [editReason, setEditReason] = useState("");
  const [decision, setDecision] = useState<PurchaseRecommendation | null>(null);
  const [decisionQty, setDecisionQty] = useState(0);
  // Ignorar (una o varias) exige un motivo auditable → mini modal de motivo.
  const [ignoreTargets, setIgnoreTargets] = useState<PurchaseRecommendation[] | null>(null);
  const [ignoreReason, setIgnoreReason] = useState("");
  const [ignoreMode, setIgnoreMode] = useState<"ignore" | "snooze">("ignore");
  const [savingAction, setSavingAction] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);

  // Overrides ya vienen aplicados por el motor (suggestedQty con override).
  const recs = rows;

  // Ignoradas/pospuestas en el backend quedan fuera de la vista por defecto,
  // igual que el antiguo compras:rec-ignored.
  const hiddenCount = useMemo(() => recs.filter(isHiddenByDefault).length, [recs]);
  const visible = useMemo(
    () => (showIgnored ? recs : recs.filter((r) => !isHiddenByDefault(r))),
    [recs, showIgnored]
  );

  const filtered = useMemo(() => {
    let result = filterRecommendations(visible, {
      query,
      category,
      supplier,
      status,
      priority,
      ...toggles,
    });
    // Foco rápido (segmentos): reduce la tabla a lo que el comprador quiere ver
    if (foco === "urgent")
      result = result.filter((r) => r.status === "critical" || r.status === "buy_now");
    else if (foco === "review") result = result.filter((r) => r.status === "review");
    else if (foco === "overstock") result = result.filter((r) => r.status === "overstock");
    // Orden por defecto: lo más urgente primero (estado, luego prioridad, luego monto)
    return [...result].sort((a, b) => {
      const byStatus = recommendationUrgency[a.status] - recommendationUrgency[b.status];
      if (byStatus !== 0) return byStatus;
      const byPriority = priorityUrgency[a.priority] - priorityUrgency[b.priority];
      if (byPriority !== 0) return byPriority;
      return b.suggestedPurchaseAmount - a.suggestedPurchaseAmount;
    });
  }, [visible, query, category, supplier, status, priority, toggles, foco]);

  const urgentRecs = visible.filter((r) => r.status === "critical" || r.status === "buy_now");
  const topDecision = urgentRecs[0] ?? visible[0];
  const openRfqs = rfqs.filter((r) => !["convertida", "rechazada", "vencida"].includes(r.estado));
  const emittedOrders = purchaseOrders.filter((o) =>
    ["sent", "confirmed", "partially_received", "with_difference"].includes(o.status)
  );
  const receivingOrders = purchaseOrders.filter((o) =>
    ["sent", "confirmed", "partially_received", "delayed"].includes(o.status)
  );

  // Resumen (sobre lo visible, no ignoradas)
  const totalSuggested = visible.reduce((a, r) => a + r.suggestedPurchaseAmount, 0);
  const overstockCount = visible.filter((r) => r.status === "overstock").length;
  const lowMarginCount = visible.filter((r) => r.margin < 25).length;
  const overstockSavings = visible
    .filter((r) => r.status === "overstock")
    .reduce((a, r) => a + (r.availableStock - r.maxStock) * r.unitCost, 0);

  // Presupuesto
  const budgetUsedPct = (totalSuggested / monthlyPurchaseBudget) * 100;
  const overBudget = totalSuggested > monthlyPurchaseBudget;
  const budgetAvailable = monthlyPurchaseBudget - totalSuggested;
  const criticalCapital = urgentRecs.reduce((a, r) => a + r.suggestedPurchaseAmount, 0);
  const uncoveredCriticalCapital = Math.max(0, criticalCapital - Math.max(0, budgetAvailable));
  const budgetTone = overBudget ? "bad" : budgetUsedPct > 80 ? "warn" : "good";
  const budgetBar = overBudget
    ? "bg-rose-500"
    : budgetUsedPct > 80
      ? "bg-amber-500"
      : "bg-emerald-500";

  const openPoBySku = useMemo(() => {
    const activeStatuses = [
      "draft",
      "pending_approval",
      "approved",
      "sent",
      "confirmed",
      "partially_received",
      "delayed",
    ];
    const map = new Map<string, OpenPoSignal>();
    purchaseOrders
      .filter((order) => activeStatuses.includes(order.status))
      .forEach((order) => {
        order.lines?.forEach((line) => {
          if (!map.has(line.sku)) {
            map.set(line.sku, {
              number: order.number,
              quantity: line.quantity,
              expectedDate: order.expectedDate,
              status: order.status,
            });
          }
        });
      });
    return map;
  }, []);

  const supplierGroups = useMemo(
    () => buildDecisionGroups(filtered, (r) => r.supplierName, openPoBySku),
    [filtered, openPoBySku]
  );

  const categoryGroups = useMemo(
    () => buildDecisionGroups(filtered, (r) => r.category, openPoBySku),
    [filtered, openPoBySku]
  );

  // Selección
  const toggleRow = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = (keys: string[]) =>
    setSelected((prev) => (keys.every((k) => prev.includes(k)) ? [] : keys));

  const selectedRecs = filtered.filter((r) => selected.includes(r.id));
  const selectedTotal = selectedRecs.reduce((a, r) => a + r.suggestedPurchaseAmount, 0);
  const selectedExcess = Math.max(0, selectedTotal - Math.max(0, budgetAvailable));
  const selectedSupplierCount = new Set(selectedRecs.map((r) => r.supplierName)).size;

  const addSelectedToOc = () => {
    const toAdd = selectedRecs.filter((r) => r.suggestedQuantity > 0 && !hasItem(r.sku));
    toAdd.forEach((r) =>
      addItem({
        sku: r.sku,
        productName: r.productName,
        supplierName: r.supplierName,
        quantity: r.suggestedQuantity,
        unitCost: r.unitCost,
      })
    );
    setSelected([]);
    toast.success(
      toAdd.length > 0
        ? `${toAdd.length} producto${toAdd.length === 1 ? "" : "s"} agregado${toAdd.length === 1 ? "" : "s"} al borrador de OC`
        : "Esos productos ya estaban en el borrador de OC",
      toAdd.length > 0
        ? { label: "Ver borrador OC", onClick: () => navigate("/comprar/borradores") }
        : undefined
    );
  };

  const reviewUrgentBySupplier = () => {
    setFoco("urgent");
    setViewMode("supplier");
    toast.info("Urgentes agrupados por proveedor para preparar borradores de OC");
  };

  // Mensaje uniforme de error de acción (409 de concurrencia ya recarga la lista).
  const notifyActionError = (err: PurchaseBffError) => {
    if (err.code === "VERSION_CONFLICT") {
      toast.warning("La recomendación cambió; se recargó la lista");
    } else {
      toast.error(err.message || "No se pudo guardar el cambio");
    }
  };

  const ignoreSelected = () => {
    if (selectedRecs.length === 0) return;
    setIgnoreReason("");
    setIgnoreMode("ignore");
    setIgnoreTargets(selectedRecs);
  };

  const confirmIgnore = async () => {
    if (!ignoreTargets || ignoreTargets.length === 0 || !ignoreReason.trim()) return;
    setSavingAction(true);
    const reason = ignoreReason.trim();
    const snoozeUntil = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const results = await Promise.all(
      ignoreTargets.map((r) =>
        applyAction(
          r.id,
          ignoreMode === "snooze"
            ? { action: "snooze", snoozeUntil, reason }
            : { action: "ignore", reason }
        )
      )
    );
    setSavingAction(false);
    const failures = results.filter((r) => !r.ok);
    const okCount = results.length - failures.length;
    if (okCount > 0) {
      toast.info(
        ignoreMode === "snooze"
          ? `${okCount} sugerencia${okCount === 1 ? "" : "s"} postergada${okCount === 1 ? "" : "s"} 7 días`
          : `${okCount} sugerencia${okCount === 1 ? "" : "s"} ignorada${okCount === 1 ? "" : "s"}`
      );
    }
    const firstFailure = failures.find((r) => !r.ok);
    if (firstFailure && !firstFailure.ok) notifyActionError(firstFailure.error);
    setIgnoreTargets(null);
    setIgnoreReason("");
    setSelected([]);
  };

  const openEdit = (r: PurchaseRecommendation) => {
    setEditing(r);
    setEditQty(r.suggestedQuantity);
    setEditSupplier(r.supplierName);
    setEditReason("");
  };

  const saveEdit = async () => {
    if (!editing || !editReason.trim()) return;
    setSavingAction(true);
    const result = await applyAction(editing.id, {
      action: "override",
      qty: editQty,
      reason: editReason.trim(),
    });
    setSavingAction(false);
    if (result.ok) {
      toast.success(`Sugerencia de ${editing.productName} actualizada`);
    } else {
      notifyActionError(result.error);
    }
    setEditing(null);
    setEditReason("");
  };

  const handleAddQuantity = (r: PurchaseRecommendation, quantity: number) => {
    addItem({
      sku: r.sku,
      productName: r.productName,
      supplierName: r.supplierName,
      quantity,
      unitCost: r.unitCost,
    });
    toast.success(`${r.productName} agregado al borrador de OC`, {
      label: "Ver borrador OC",
      onClick: () => navigate("/comprar/borradores"),
    });
  };

  const handleAdd = (r: PurchaseRecommendation) => {
    handleAddQuantity(r, r.suggestedQuantity);
  };

  const openDecision = (r: PurchaseRecommendation) => {
    setDecision(r);
    setDecisionQty(r.suggestedQuantity);
  };

  const handleSort = (key: string) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setSupplier("");
    setStatus("");
    setPriority("");
    setToggles(emptyToggles);
    setFoco("all");
  };

  const columns: Column<PurchaseRecommendation>[] = [
    {
      key: "product",
      header: "Producto",
      sortable: true,
      sortValue: (r) => r.productName,
      render: (r) => (
        <div className="min-w-[230px]">
          <p className="font-medium text-slate-800 leading-snug">{r.productName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="font-mono text-slate-400">{r.sku}</span> · {r.brand}
          </p>
          <p className="text-xs text-slate-500">
            {r.supplierName} · LT {formatDays(r.supplierLeadTimeDays)}
          </p>
          <p className="text-xs text-slate-400">{r.category}</p>
        </div>
      ),
    },
    {
      key: "stock",
      header: "Stock disp.",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.availableStock,
      render: (r) => (
        <div className="text-sm">
          <p className={r.availableStock <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>
            {formatNumber(r.availableStock)} disp.
          </p>
          <p className="text-xs text-slate-400">{formatNumber(r.committedStock)} comp.</p>
        </div>
      ),
    },
    {
      key: "coverage",
      header: "Cobertura",
      align: "right",
      sortable: true,
      sortValue: (r) => coverageDays(r.availableStock, r.salesLast30Days),
      render: (r) => <CoverageCell rec={r} />,
    },
    {
      key: "sales",
      header: "Venta",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.salesLast30Days,
      render: (r) => {
        const trend = salesTrendPct(r);
        return (
          <div className="text-sm">
            <p className="text-slate-700">{formatNumber(r.salesLast30Days)} / 30d</p>
            <p className="text-xs text-slate-400">{formatNumber(r.salesLast90Days)} / 90d</p>
            <p
              className={cn(
                "text-xs font-medium",
                trend >= 0 ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {trend >= 0 ? "↑" : "↓"} {formatPercent(Math.abs(trend), 0)}
            </p>
          </div>
        );
      },
    },
    {
      key: "qty",
      header: "Cantidad sugerida",
      align: "right",
      sortable: true,
      sortValue: (r) => r.suggestedQuantity,
      render: (r) => {
        const coverAfter =
          r.salesLast30Days > 0
            ? Math.round((r.availableStock + r.suggestedQuantity) / (r.salesLast30Days / 30))
            : 0;
        return (
          <div className="text-sm">
            <p className="font-semibold text-slate-900">{formatNumber(r.suggestedQuantity)} u.</p>
            {r.suggestedQuantity > 0 ? (
              <>
                <p className="text-xs text-emerald-600">para ~{coverAfter} días</p>
                <p className="text-xs text-slate-400">múltiplo {purchaseMultiple(r)}</p>
              </>
            ) : (
              <p className="text-xs text-slate-400">{formatCurrency(r.unitCost)} c/u</p>
            )}
          </div>
        );
      },
    },
    {
      key: "amount",
      header: "Capital",
      align: "right",
      sortable: true,
      sortValue: (r) => r.suggestedPurchaseAmount,
      render: (r) => (
        <span className="font-semibold text-slate-900">
          {formatCurrency(r.suggestedPurchaseAmount)}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Prioridad",
      align: "center",
      sortable: true,
      sortValue: (r) => ({ high: 0, medium: 1, low: 2 })[r.priority],
      render: (r) => (
        <div className="inline-flex flex-col items-center gap-1">
          <PriorityBadge priority={r.priority} />
          <span className="text-xs font-medium text-slate-500">{decisionTypeLabel(r)}</span>
        </div>
      ),
    },
    {
      key: "open-po",
      header: "OC abierta",
      align: "center",
      hideOnMobile: true,
      render: (r) => {
        const openPo = openPoBySku.get(r.sku);
        if (!openPo) return <span className="text-xs text-slate-300">Sin OC</span>;
        return (
          <div className="text-xs">
            <Badge tone="blue">OC abierta</Badge>
            <p className="mt-1 text-slate-500">
              {formatNumber(openPo.quantity)} u. · {openPo.expectedDate}
            </p>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Acción",
      render: (r) => (
        <div className="flex flex-col gap-1 items-stretch min-w-[140px]">
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              openDecision(r);
            }}
          >
            Revisar
          </Button>
          {r.suggestedQuantity > 0 && (
            <Button
              size="sm"
              variant={hasItem(r.sku) ? "secondary" : "primary"}
              disabled={hasItem(r.sku)}
              onClick={(e) => {
                e.stopPropagation();
                handleAdd(r);
              }}
              icon={<IconPlus className="w-3.5 h-3.5" />}
            >
              {hasItem(r.sku) ? "En borrador" : "Agregar"}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const supplierOptions = uniqueValues(recs, (r) => r.supplierName).map((s) => ({
    value: s,
    label: s,
  }));

  const pageTitle = pathname.includes("/comprar/reposicion") ? "Reposición" : "Decisiones de compra";
  const pageDescription =
    "Prioriza necesidades, revisa recomendaciones y construye tus próximas órdenes.";

  // --------------------------------------------------------------------------
  //  Estados que exigen los datos reales: sin configurar, cargando y error.
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              conectar datos reales de recomendaciones.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && recs.length === 0) {
    return <PageSkeleton />;
  }

  if (error && recs.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las recomendaciones
            </p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={
          <div className="flex gap-2">
            <ExportButton
              filename="reposicion-sugerida"
              rows={filtered}
              columns={[
                { label: "SKU", value: (r) => r.sku },
                { label: "Producto", value: (r) => r.productName },
                { label: "Categoría", value: (r) => r.category },
                { label: "Marca", value: (r) => r.brand },
                { label: "Proveedor", value: (r) => r.supplierName },
                { label: "Stock disponible", value: (r) => r.availableStock },
                { label: "Venta 30 días", value: (r) => r.salesLast30Days },
                { label: "Días inventario", value: (r) => r.inventoryDays },
                { label: "Cantidad sugerida", value: (r) => r.suggestedQuantity },
                { label: "Costo unitario", value: (r) => r.unitCost },
                { label: "Compra sugerida $", value: (r) => r.suggestedPurchaseAmount },
                { label: "Margen %", value: (r) => r.margin },
                { label: "Prioridad", value: (r) => r.priority },
                { label: "Estado", value: (r) => r.status },
                { label: "Motivo", value: (r) => r.reason },
              ]}
            />
            <Button
              onClick={() => navigate("/comprar/borradores")}
              icon={<IconReplenish className="w-4 h-4" />}
            >
              Ver borrador OC
            </Button>
          </div>
        }
      />

      <PurchaseProcessBar
        stages={[
          {
            label: "Necesidad",
            detail: "Decidir qué comprar",
            count: urgentRecs.length,
            to: "/comprar/decisiones",
            active: true,
            tone: urgentRecs.length > 0 ? "red" : "green",
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
            count: draftCount,
            to: "/comprar/borradores",
            tone: draftCount > 0 ? "blue" : "neutral",
          },
          {
            label: "Aprobación",
            detail: "Validar desvíos",
            count: approvals.length,
            to: "/comprar/aprobaciones",
            tone: approvals.length > 0 ? "amber" : "green",
          },
          {
            label: "Emitidas",
            detail: "OC en curso",
            count: emittedOrders.length,
            to: "/comprar/seguimiento",
            tone: emittedOrders.length > 0 ? "blue" : "neutral",
          },
          {
            label: "Por recibir",
            detail: "Seguimiento y recepción",
            count: receivingOrders.length,
            to: "/comprar/recepciones",
            tone: receivingOrders.some((o) => o.status === "delayed") ? "red" : "blue",
          },
        ]}
      />

      {/* Bloque de presupuesto — siempre visible arriba */}
      <Card className="mb-4">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
          <div className="lg:w-80">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Presupuesto del mes
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-semibold text-slate-900">
                {formatCurrencyCompact(totalSuggested)}
              </span>
              <span className="text-sm text-slate-400">
                usado de {formatCurrencyCompact(monthlyPurchaseBudget)}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={overBudget ? "text-rose-600 font-medium" : "text-slate-500"}>
                {overBudget
                  ? `Excede el presupuesto en ${formatCurrency(totalSuggested - monthlyPurchaseBudget)}`
                  : `Disponible: ${formatCurrency(monthlyPurchaseBudget - totalSuggested)}`}
              </span>
              <span className="font-medium text-slate-600">
                {formatPercent(budgetUsedPct, 0)} usado
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${budgetBar}`}
                style={{ width: `${Math.min(100, budgetUsedPct)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Necesidades críticas no cubiertas:{" "}
              <b className={uncoveredCriticalCapital > 0 ? "text-rose-600" : "text-emerald-700"}>
                {formatCurrencyCompact(uncoveredCriticalCapital)}
              </b>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={budgetTone === "bad" ? "red" : budgetTone === "warn" ? "amber" : "green"}>
              {formatPercent(budgetUsedPct, 0)} usado
            </Badge>
            <Button size="sm" variant="secondary" onClick={() => setFoco("urgent")}>
              Optimizar presupuesto
            </Button>
          </div>
        </div>
      </Card>

      {topDecision && (
        <Card className="mb-4 border-brand-200">
          <div className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  Prioridad destacada
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {topDecision.productName}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{topDecision.risk}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={hasItem(topDecision.sku) || topDecision.suggestedQuantity <= 0}
                  onClick={() => handleAdd(topDecision)}
                  icon={<IconPlus className="w-3.5 h-3.5" />}
                >
                  Agregar {formatNumber(topDecision.suggestedQuantity)} u. al borrador
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openDecision(topDecision)}>
                  Revisar recomendación
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/productos/${topDecision.sku}`)}
                >
                  Ver SKU 360
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <DecisionMetric
                label="Stock"
                value={`${formatNumber(topDecision.availableStock)} u.`}
                tone={
                  topDecision.inventoryDays <= topDecision.supplierLeadTimeDays ? "red" : "amber"
                }
              />
              <DecisionMetric
                label="Cobertura"
                value={formatDays(topDecision.inventoryDays)}
                tone={
                  topDecision.inventoryDays <= topDecision.supplierLeadTimeDays ? "red" : "amber"
                }
              />
              <DecisionMetric
                label="Venta 30d"
                value={`${formatNumber(topDecision.salesLast30Days)} u.`}
                tone="blue"
              />
              <DecisionMetric
                label="Lead time"
                value={formatDays(topDecision.supplierLeadTimeDays)}
                tone="amber"
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Decisión sugerida
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {decisionTypeLabel(topDecision)} · comprar{" "}
                  <b className="text-slate-900">{formatNumber(topDecision.suggestedQuantity)} u.</b>{" "}
                  · capital {formatCurrencyCompact(topDecision.suggestedPurchaseAmount)}
                </p>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                {[
                  {
                    label: "Conservador",
                    qty: Math.max(0, Math.round(topDecision.suggestedQuantity * 0.7)),
                  },
                  { label: "Sugerido", qty: topDecision.suggestedQuantity },
                  { label: "Agresivo", qty: Math.round(topDecision.suggestedQuantity * 1.3) },
                ].map((scenario) => (
                  <button
                    key={scenario.label}
                    type="button"
                    onClick={() => {
                      setDecision(topDecision);
                      setDecisionQty(scenario.qty);
                    }}
                    className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
                  >
                    {scenario.label} {formatNumber(scenario.qty)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {draftCount > 0 && (
        <Card className="mb-4 border-brand-200 bg-brand-50/30">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Continuar trabajo
              </p>
              <p className="text-sm font-medium text-slate-800">
                Borrador OC · {draftCount} SKU en preparación
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate("/comprar/borradores")}
              icon={<IconReplenish className="h-3.5 w-3.5" />}
            >
              Continuar borrador
            </Button>
          </div>
        </Card>
      )}

      <section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-card">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {visible.length} decisiones · impacto total {formatCurrencyCompact(totalSuggested)}
            </p>
            <Tabs
              value={foco}
              onChange={setFoco}
              tabs={[
                { value: "all", label: "Todos", count: visible.length },
                { value: "urgent", label: "Comprar ahora", count: urgentRecs.length },
                {
                  value: "review",
                  label: "Revisar",
                  count: visible.filter((r) => r.status === "review").length,
                },
                { value: "overstock", label: "No comprar", count: overstockCount },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SegmentedControl
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "product", label: "Producto" },
                { value: "supplier", label: "Proveedor" },
                { value: "category", label: "Categoría" },
              ]}
            />
            {urgentRecs.length > 0 && (
              <Button
                size="sm"
                onClick={reviewUrgentBySupplier}
                icon={<IconAlerts className="w-3.5 h-3.5" />}
              >
                Revisar y preparar {urgentRecs.length} urgentes
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <IconInfo className="h-3.5 w-3.5 text-slate-400" />
            Cantidad sugerida = lead time + cobertura objetivo.
          </span>
          {lowMarginCount === 0 && <span>Sin alertas de margen bajo.</span>}
          {overstockSavings > 0 && (
            <span className="text-emerald-700">
              Ajustar sobrestock libera <b>{formatCurrency(overstockSavings)}</b>.
            </span>
          )}
          <details className="relative">
            <summary className="cursor-pointer font-medium text-brand-600">Estados</summary>
            <div className="absolute right-0 z-20 mt-2 w-[min(560px,90vw)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <StateLegend />
            </div>
          </details>
        </div>
      </section>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por SKU o producto"
          resultCount={filtered.length}
          onClear={clearFilters}
          selects={[
            {
              key: "cat",
              placeholder: "Categoría",
              value: category,
              onChange: setCategory,
              options: uniqueValues(recs, (r) => r.category).map((c) => ({
                value: c,
                label: c,
              })),
            },
            {
              key: "sup",
              placeholder: "Proveedor",
              value: supplier,
              onChange: setSupplier,
              options: supplierOptions,
            },
            {
              key: "status",
              placeholder: "Estado",
              value: status,
              onChange: setStatus,
              options: [
                { value: "critical", label: "Crítico" },
                { value: "buy_now", label: "Comprar ahora" },
                { value: "review", label: "Revisar" },
                { value: "normal", label: "Normal" },
                { value: "overstock", label: "Sobrestock" },
              ],
            },
            {
              key: "priority",
              placeholder: "Prioridad",
              value: priority,
              onChange: setPriority,
              options: [
                { value: "high", label: "Alta" },
                { value: "medium", label: "Media" },
                { value: "low", label: "Baja" },
              ],
            },
          ]}
          toggles={[
            {
              key: "stockout",
              label: "Con quiebre",
              active: toggles.stockout,
              onToggle: () => setToggles((t) => ({ ...t, stockout: !t.stockout })),
            },
            {
              key: "risk",
              label: "Riesgo de quiebre",
              active: toggles.stockoutRisk,
              onToggle: () => setToggles((t) => ({ ...t, stockoutRisk: !t.stockoutRisk })),
            },
            {
              key: "overstock",
              label: "Sobrestock",
              active: toggles.overstock,
              onToggle: () => setToggles((t) => ({ ...t, overstock: !t.overstock })),
            },
            {
              key: "lowMargin",
              label: "Margen bajo",
              active: toggles.lowMargin,
              onToggle: () => setToggles((t) => ({ ...t, lowMargin: !t.lowMargin })),
            },
            {
              key: "highRot",
              label: "Alta rotación",
              active: toggles.highRotation,
              onToggle: () => setToggles((t) => ({ ...t, highRotation: !t.highRotation })),
            },
            {
              key: "lowRot",
              label: "Baja rotación",
              active: toggles.lowRotation,
              onToggle: () => setToggles((t) => ({ ...t, lowRotation: !t.lowRotation })),
            },
          ]}
        />
      </div>

      {meta?.partial && warnings.length > 0 && (
        <Card className="mb-3 border-amber-200 bg-amber-50/60">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-xs text-amber-800">
            <Badge tone="amber">Datos parciales</Badge>
            {warnings.map((w) => (
              <span key={w.code}>{w.message}</span>
            ))}
          </div>
        </Card>
      )}

      {hiddenCount > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
          <Badge tone="neutral">{hiddenCount} sugerencia(s) ignorada(s) o pospuesta(s)</Badge>
          <button
            onClick={() => setShowIgnored((prev) => !prev)}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            {showIgnored ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      )}

      {/* Barra de acciones masivas */}
      {selected.length > 0 && (
        <div className="sticky top-[68px] z-20 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-600 px-4 py-2.5 text-white shadow-lg">
          <span className="text-sm font-medium">
            {selected.length} seleccionado{selected.length === 1 ? "" : "s"} · capital{" "}
            {formatCurrency(selectedTotal)}
          </span>
          <span className="text-xs text-white/80">
            disponible {formatCurrency(Math.max(0, budgetAvailable))}
          </span>
          {selectedExcess > 0 && (
            <span className="rounded-full bg-white/15 px-2 py-1 text-xs font-medium">
              exceso {formatCurrency(selectedExcess)}
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={() => {
              setFoco("urgent");
              setViewMode("supplier");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Revisar por proveedor
          </button>
          <button
            onClick={addSelectedToOc}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <IconPlus className="w-4 h-4" /> Crear borradores ({selectedSupplierCount})
          </button>
          <button
            onClick={ignoreSelected}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Ignorar
          </button>
          <button
            onClick={() => setSelected([])}
            className="inline-flex items-center gap-1 rounded-lg hover:bg-white/15 px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Limpiar selección"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>
      )}

      {viewMode === "product" ? (
        <Card>
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(r) => r.id}
            emptyMessage="Sin recomendaciones para los filtros seleccionados."
            onRowClick={openDecision}
            rowClassName={(r) => (r.status === "critical" ? "bg-rose-50/40" : undefined)}
            sort={sort}
            onSortChange={handleSort}
            selection={{
              selectedKeys: selected,
              onToggle: toggleRow,
              onToggleAll: toggleAll,
            }}
            mobileCard={(r) => (
              <RecommendationMobileCard
                rec={r}
                openPo={openPoBySku.get(r.sku)}
                alreadyInOc={hasItem(r.sku)}
                onReview={openDecision}
                onAdd={handleAdd}
              />
            )}
          />
        </Card>
      ) : (
        <GroupedDecisionCards
          title={viewMode === "supplier" ? "Decisiones por proveedor" : "Decisiones por categoría"}
          groups={viewMode === "supplier" ? supplierGroups : categoryGroups}
          onSelectGroup={(group) => {
            setSelected(group.items.map((item) => item.id));
            if (viewMode === "supplier") setSupplier(group.label);
            else setCategory(group.label);
            setViewMode("product");
          }}
          onReviewFirst={(group) => openDecision(group.items[0])}
        />
      )}

      <RecommendationDecisionDrawer
        rec={decision}
        quantity={decisionQty}
        onQuantityChange={setDecisionQty}
        onClose={() => setDecision(null)}
        onAdd={(rec, quantity) => handleAddQuantity(rec, quantity)}
        onEdit={(rec) => {
          setDecision(null);
          openEdit(rec);
        }}
        onIgnore={(rec) => {
          setDecision(null);
          setIgnoreReason("");
          setIgnoreMode("snooze");
          setIgnoreTargets([rec]);
        }}
        onViewSku={(rec) => navigate(`/productos/${rec.sku}`)}
        alreadyInOc={decision ? hasItem(decision.sku) : false}
        openPo={decision ? openPoBySku.get(decision.sku) : undefined}
        budgetAvailable={budgetAvailable}
        onViewOpenPo={(openPo) => navigate(`/comprar/seguimiento?oc=${openPo.number}`)}
      />

      {/* Modal ajustar cantidad / cambiar proveedor */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Ajustar sugerencia"
        description={editing ? `${editing.sku} · ${editing.productName}` : ""}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!editReason.trim() || savingAction}
              onClick={() => void saveEdit()}
            >
              {savingAction ? "Guardando…" : "Guardar cambios"}
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Input
              label="Cantidad sugerida (unidades)"
              type="number"
              min={0}
              value={editQty}
              onChange={(e) => setEditQty(Number(e.target.value))}
            />
            <Select
              label="Proveedor"
              value={editSupplier}
              onChange={(e) => setEditSupplier(e.target.value)}
              options={suppliers.map((s) => ({ value: s.name, label: s.name }))}
            />
            <Input
              label="Motivo del ajuste (obligatorio)"
              placeholder="Ej: demanda estacional, acuerdo con proveedor…"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
            />
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Costo unitario</span>
                <span className="font-medium">{formatCurrency(editing.unitCost)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">Total compra</span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(editQty * editing.unitCost)}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500">{editing.reason}</p>
          </div>
        )}
      </Modal>

      {/* Modal de motivo para ignorar/postergar (el backend lo exige, auditable) */}
      <Modal
        open={!!ignoreTargets}
        onClose={() => setIgnoreTargets(null)}
        title={ignoreMode === "snooze" ? "Postergar sugerencia 7 días" : "Ignorar sugerencia"}
        description={
          ignoreTargets && ignoreTargets.length === 1
            ? `${ignoreTargets[0].sku} · ${ignoreTargets[0].productName}`
            : `${ignoreTargets?.length ?? 0} sugerencias seleccionadas`
        }
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIgnoreTargets(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!ignoreReason.trim() || savingAction}
              onClick={() => void confirmIgnore()}
            >
              {savingAction ? "Guardando…" : "Ignorar"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Motivo (obligatorio)"
            placeholder="Ej: compra ya gestionada, producto en descontinuación…"
            value={ignoreReason}
            onChange={(e) => setIgnoreReason(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            El motivo queda registrado en la auditoría de la recomendación.
          </p>
        </div>
      </Modal>
    </div>
  );
}

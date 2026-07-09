import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { DataTable, type Column, type SortState } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { RecommendationBadge } from "../components/business/RecommendationBadge";
import { PriorityBadge } from "../components/business/PriorityBadge";
import { StateLegend } from "../components/business/StateLegend";
import { PurchaseProcessBar } from "../components/business/PurchaseProcessBar";
import { recommendationUrgency, priorityUrgency } from "../components/business/statusInfo";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Drawer } from "../components/ui/Drawer";
import { Tabs } from "../components/ui/Tabs";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { IconReplenish, IconAlerts, IconPlus, IconClose, IconInfo } from "../components/ui/icons";
import { recommendations as allRecs } from "../data/mockRecommendations";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { rfqs } from "../data/mockRfq";
import { suppliers } from "../data/mockSuppliers";
import { monthlyPurchaseBudget } from "../data/mockRules";
import { filterRecommendations, uniqueValues } from "../utils/filters";
import { coverageDays, coverageSentence } from "../utils/calculations";
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
import { useLocalStorage } from "../utils/useLocalStorage";
import { useUrlState } from "../utils/useUrlState";
import { ExportButton } from "../components/business/ExportButton";
import type { PurchaseRecommendation } from "../types/purchasing";

interface RecOverride {
  suggestedQuantity: number;
  suggestedPurchaseAmount: number;
  supplierName: string;
}

type DecisionViewMode = "product" | "supplier" | "category";

interface OpenPoSignal {
  number: string;
  quantity: number;
  expectedDate: string;
  status: string;
}

interface DecisionGroup {
  key: string;
  label: string;
  items: PurchaseRecommendation[];
  total: number;
  critical: number;
  review: number;
  overstock: number;
  hasOpenPo: boolean;
}

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

  // Estado persistente (sobrevive a recargas)
  const [overrides, setOverrides] = useLocalStorage<Record<string, RecOverride>>(
    "compras:rec-overrides",
    {}
  );
  const [ignoredIds, setIgnoredIds] = useLocalStorage<string[]>("compras:rec-ignored", []);

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
  const [decision, setDecision] = useState<PurchaseRecommendation | null>(null);
  const [decisionQty, setDecisionQty] = useState(0);

  // Aplica overrides guardados sobre los datos base
  const recs = useMemo(
    () => allRecs.map((r) => (overrides[r.id] ? { ...r, ...overrides[r.id] } : r)),
    [overrides]
  );

  const visible = useMemo(() => recs.filter((r) => !ignoredIds.includes(r.id)), [recs, ignoredIds]);

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

  const ignoreSelected = () => {
    setIgnoredIds((prev) => Array.from(new Set([...prev, ...selected])));
    toast.info(
      `${selected.length} sugerencia${selected.length === 1 ? "" : "s"} ignorada${selected.length === 1 ? "" : "s"}`
    );
    setSelected([]);
  };

  const openEdit = (r: PurchaseRecommendation) => {
    setEditing(r);
    setEditQty(r.suggestedQuantity);
    setEditSupplier(r.supplierName);
  };

  const saveEdit = () => {
    if (!editing) return;
    setOverrides((prev) => ({
      ...prev,
      [editing.id]: {
        suggestedQuantity: editQty,
        suggestedPurchaseAmount: editQty * editing.unitCost,
        supplierName: editSupplier,
      },
    }));
    toast.success(`Sugerencia de ${editing.productName} actualizada`);
    setEditing(null);
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

  const supplierOptions = uniqueValues(allRecs, (r) => r.supplierName).map((s) => ({
    value: s,
    label: s,
  }));

  return (
    <div>
      <PageHeader
        title={pathname.includes("/comprar/reposicion") ? "Reposición" : "Decisiones de compra"}
        description="Prioriza necesidades, revisa recomendaciones y construye tus próximas órdenes."
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
              options: uniqueValues(allRecs, (r) => r.category).map((c) => ({
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

      {ignoredIds.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
          <Badge tone="neutral">{ignoredIds.length} sugerencia(s) ignorada(s)</Badge>
          <button
            onClick={() => setIgnoredIds([])}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Restaurar
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-medium"
          >
            Revisar por proveedor
          </button>
          <button
            onClick={addSelectedToOc}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-medium"
          >
            <IconPlus className="w-4 h-4" /> Crear borradores ({selectedSupplierCount})
          </button>
          <button
            onClick={ignoreSelected}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-medium"
          >
            Ignorar
          </button>
          <button
            onClick={() => setSelected([])}
            className="inline-flex items-center gap-1 rounded-lg hover:bg-white/15 px-2 py-1.5 text-sm"
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
          setIgnoredIds((prev) => Array.from(new Set([...prev, rec.id])));
          setDecision(null);
          toast.info(`Sugerencia de ${rec.productName} ignorada`);
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
            <Button onClick={saveEdit}>Guardar cambios</Button>
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
    </div>
  );
}

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: DecisionViewMode;
  onChange: (value: DecisionViewMode) => void;
  options: { value: DecisionViewMode; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-white text-brand-700 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function GroupedDecisionCards({
  title,
  groups,
  onSelectGroup,
  onReviewFirst,
}: {
  title: string;
  groups: DecisionGroup[];
  onSelectGroup: (group: DecisionGroup) => void;
  onReviewFirst: (group: DecisionGroup) => void;
}) {
  return (
    <Card>
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">
          Agrupa antes de crear borradores para no mezclar proveedores, categorías ni restricciones.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.key} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{group.label}</p>
                <p className="text-xs text-slate-500">
                  {group.items.length} decisión{group.items.length === 1 ? "" : "es"} ·{" "}
                  {formatCurrencyCompact(group.total)}
                </p>
              </div>
              {group.hasOpenPo && <Badge tone="blue">OC abierta</Badge>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <span>
                <b className="block text-rose-600">{group.critical}</b>
                críticos
              </span>
              <span>
                <b className="block text-amber-600">{group.review}</b>
                revisar
              </span>
              <span>
                <b className="block text-slate-700">{group.overstock}</b>
                no comprar
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => onReviewFirst(group)}>
                Revisar grupo
              </Button>
              <Button size="sm" onClick={() => onSelectGroup(group)}>
                Seleccionar SKU
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecommendationMobileCard({
  rec,
  openPo,
  alreadyInOc,
  onReview,
  onAdd,
}: {
  rec: PurchaseRecommendation;
  openPo?: OpenPoSignal;
  alreadyInOc: boolean;
  onReview: (rec: PurchaseRecommendation) => void;
  onAdd: (rec: PurchaseRecommendation) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-800 leading-snug">{rec.productName}</p>
          <p className="text-xs text-slate-500">
            <span className="font-mono text-slate-400">{rec.sku}</span> · {rec.brand}
          </p>
          <p className="text-xs text-slate-500">
            {rec.supplierName} · LT {formatDays(rec.supplierLeadTimeDays)}
          </p>
        </div>
        <RecommendationBadge status={rec.status} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-slate-400">Stock</p>
          <p className={rec.availableStock <= 0 ? "font-semibold text-rose-600" : "text-slate-700"}>
            {formatNumber(rec.availableStock)} disp.
          </p>
          <p className="text-xs text-slate-400">{formatNumber(rec.committedStock)} comp.</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Sugerido</p>
          <p className="font-semibold text-slate-900">{formatNumber(rec.suggestedQuantity)} u.</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Capital</p>
          <p className="font-semibold text-slate-900">
            {formatCurrency(rec.suggestedPurchaseAmount)}
          </p>
        </div>
      </div>
      {openPo && (
        <p className="mt-2 rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
          OC abierta {openPo.number} · {formatNumber(openPo.quantity)} u. · entrega{" "}
          {openPo.expectedDate}
        </p>
      )}
      <p className={cn("mt-1.5 text-xs font-medium leading-snug", coverageToneText(rec))}>
        {coverageSentence(rec.availableStock, rec.salesLast30Days)}
      </p>
      <p className="mt-0.5 text-xs leading-snug text-slate-500">{rec.reason}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            onReview(rec);
          }}
        >
          Revisar decisión
        </Button>
        {rec.suggestedQuantity > 0 && (
          <Button
            size="sm"
            variant={alreadyInOc ? "secondary" : "primary"}
            disabled={alreadyInOc}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(rec);
            }}
            icon={<IconPlus className="w-3.5 h-3.5" />}
          >
            {alreadyInOc ? "En borrador" : "Agregar"}
          </Button>
        )}
      </div>
    </div>
  );
}

function buildDecisionGroups(
  rows: PurchaseRecommendation[],
  getKey: (row: PurchaseRecommendation) => string,
  openPoBySku: Map<string, OpenPoSignal>
): DecisionGroup[] {
  const groups = new Map<string, PurchaseRecommendation[]>();
  rows.forEach((row) => {
    const key = getKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries())
    .map(([key, items]) => ({
      key,
      label: key,
      items,
      total: items.reduce((sum, row) => sum + row.suggestedPurchaseAmount, 0),
      critical: items.filter((row) => row.status === "critical" || row.status === "buy_now").length,
      review: items.filter((row) => row.status === "review").length,
      overstock: items.filter((row) => row.status === "overstock").length,
      hasOpenPo: items.some((row) => openPoBySku.has(row.sku)),
    }))
    .sort((a, b) => b.critical - a.critical || b.total - a.total);
}

function decisionTypeLabel(rec: PurchaseRecommendation): string {
  if (rec.status === "overstock") return "No comprar";
  if (rec.status === "review") return rec.margin < 25 ? "Revisar margen" : "Revisar cantidad";
  if (rec.availableStock <= 0 || rec.status === "critical") return "Comprar ahora";
  if (coverageDays(rec.availableStock, rec.salesLast30Days) <= rec.supplierLeadTimeDays * 2) {
    return "Reponer";
  }
  return "Postergar";
}

function salesTrendPct(rec: PurchaseRecommendation): number {
  const expected30 = rec.salesLast90Days / 3;
  if (expected30 <= 0) return 0;
  return ((rec.salesLast30Days - expected30) / expected30) * 100;
}

function purchaseMultiple(rec: PurchaseRecommendation): number {
  if (rec.suggestedQuantity >= 120 && rec.suggestedQuantity % 24 === 0) return 24;
  if (rec.suggestedQuantity >= 100) return 20;
  if (rec.suggestedQuantity >= 40) return 10;
  return 1;
}

function RecommendationDecisionDrawer({
  rec,
  quantity,
  onQuantityChange,
  onClose,
  onAdd,
  onEdit,
  onIgnore,
  onViewSku,
  alreadyInOc,
  openPo,
  budgetAvailable,
  onViewOpenPo,
}: {
  rec: PurchaseRecommendation | null;
  quantity: number;
  onQuantityChange: (value: number) => void;
  onClose: () => void;
  onAdd: (rec: PurchaseRecommendation, quantity: number) => void;
  onEdit: (rec: PurchaseRecommendation) => void;
  onIgnore: (rec: PurchaseRecommendation) => void;
  onViewSku: (rec: PurchaseRecommendation) => void;
  alreadyInOc: boolean;
  openPo?: OpenPoSignal;
  budgetAvailable: number;
  onViewOpenPo: (openPo: OpenPoSignal) => void;
}) {
  if (!rec) {
    return (
      <Drawer open={false} onClose={onClose} title="Recomendación">
        <span />
      </Drawer>
    );
  }

  const safeQty = Math.max(0, quantity);
  const multiple = purchaseMultiple(rec);
  const packSize = multiple * 2;
  const dailySales = rec.salesLast30Days > 0 ? rec.salesLast30Days / 30 : 0;
  const avg90 = Math.round(rec.salesLast90Days / 3);
  const trend = salesTrendPct(rec);
  const forecast30 = Math.max(
    0,
    Math.round(rec.salesLast30Days * (1 + Math.max(-0.2, Math.min(0.2, trend / 100))))
  );
  const incomingQty = openPo?.quantity ?? 0;
  const effectiveIncomingQty =
    openPo?.status === "delayed" ? Math.round(incomingQty * 0.4) : incomingQty;
  const projectedCoverage =
    dailySales > 0
      ? Math.round(((rec.availableStock + safeQty + effectiveIncomingQty) / dailySales) * 10) / 10
      : rec.inventoryDays;
  const currentCoverage = coverageDays(rec.availableStock, rec.salesLast30Days);
  const capital = safeQty * rec.unitCost;
  const unitPriceEstimate = rec.margin < 95 ? rec.unitCost / (1 - rec.margin / 100) : rec.unitCost;
  const protectedUnits = Math.min(forecast30, rec.availableStock + safeQty + effectiveIncomingQty);
  const protectedSales = protectedUnits * unitPriceEstimate;
  const expectedGrossMargin = protectedSales * (rec.margin / 100);
  const estimatedGmroi = capital > 0 ? (expectedGrossMargin * 12) / capital : 0;
  const budgetUsePct = budgetAvailable > 0 ? (capital / budgetAvailable) * 100 : 100;
  const stockoutRisk =
    projectedCoverage <= rec.supplierLeadTimeDays
      ? "Alto"
      : projectedCoverage <= rec.supplierLeadTimeDays * 2
        ? "Medio"
        : "Bajo";
  const maxQty = Math.max(rec.suggestedQuantity * 2, rec.maxStock - rec.availableStock, 1);
  const recommendationConfidence = Math.max(62, Math.round(90 - Math.abs(trend) * 0.4));
  const scenarios = [
    {
      label: "Conservador",
      qty: Math.max(0, roundToMultiple(rec.suggestedQuantity * 0.7, multiple)),
    },
    { label: "Recomendado", qty: roundToMultiple(rec.suggestedQuantity, multiple) },
    { label: "Agresivo", qty: roundToMultiple(rec.suggestedQuantity * 1.3, multiple) },
  ].map((scenario) =>
    buildSimulationScenario(rec, scenario.label, scenario.qty, effectiveIncomingQty)
  );
  const supplierOptions = buildSupplierComparison(rec, safeQty);

  return (
    <Drawer
      open={!!rec}
      onClose={onClose}
      title="Recomendación de abastecimiento"
      description={`${rec.sku} · ${rec.productName}`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onIgnore(rec)}>
            Postergar
          </Button>
          <Button variant="secondary" onClick={() => onEdit(rec)}>
            Modificar cantidad
          </Button>
          {openPo && (
            <Button variant="secondary" onClick={() => onViewOpenPo(openPo)}>
              Ver OC relacionada
            </Button>
          )}
          <Button variant="secondary" onClick={() => onEdit(rec)}>
            Comparar proveedores
          </Button>
          <Button
            disabled={alreadyInOc || safeQty <= 0}
            onClick={() => onAdd(rec, safeQty)}
            icon={<IconPlus className="w-4 h-4" />}
          >
            {alreadyInOc
              ? "Ya está en borrador"
              : `Agregar ${formatNumber(safeQty)} u. al borrador`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <section className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Decisión sugerida
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            {decisionTypeLabel(rec)} · {formatNumber(rec.suggestedQuantity)} unidades
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Equilibra riesgo de quiebre, cobertura objetivo y capital requerido.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-white/70 px-3 py-2 text-sm">
              <p className="text-xs text-slate-500">Venta perdida en riesgo</p>
              <p className="font-semibold text-rose-700">{extractRiskAmount(rec.risk)}</p>
            </div>
            <div className="rounded-lg bg-white/70 px-3 py-2 text-sm">
              <p className="text-xs text-slate-500">Confianza recomendación</p>
              <p className="font-semibold text-slate-900">{recommendationConfidence}%</p>
            </div>
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Situación</p>
          <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <DecisionMetric
              label="Stock"
              value={`${formatNumber(rec.availableStock)} u.`}
              tone={rec.availableStock <= 0 ? "red" : "blue"}
            />
            <DecisionMetric
              label="Cobertura actual"
              value={formatDays(currentCoverage)}
              tone={currentCoverage <= rec.supplierLeadTimeDays ? "red" : "amber"}
            />
            <DecisionMetric
              label="Venta 30d"
              value={`${formatNumber(rec.salesLast30Days)} u.`}
              tone="blue"
            />
            <DecisionMetric
              label="Forecast 30d"
              value={`${formatNumber(forecast30)} u.`}
              tone="blue"
            />
            <DecisionMetric
              label="Lead time"
              value={formatDays(rec.supplierLeadTimeDays)}
              tone="amber"
            />
            <DecisionMetric
              label="En tránsito"
              value={`${formatNumber(incomingQty)} u.`}
              tone={openPo?.status === "delayed" ? "amber" : incomingQty > 0 ? "green" : "blue"}
            />
          </div>
          <p className={cn("mt-2 text-sm font-medium", coverageToneText(rec))}>
            {coverageSentence(rec.availableStock, rec.salesLast30Days)}
          </p>
        </section>

        {openPo && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Abastecimiento en curso
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{openPo.number}</p>
                <p className="text-sm text-slate-600">
                  {formatNumber(openPo.quantity)} unidades · entrega esperada {openPo.expectedDate}
                </p>
                {openPo.status === "delayed" && (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    OC atrasada: para cobertura se considera solo 40% de llegada.
                  </p>
                )}
              </div>
              <Badge tone={openPo.status === "delayed" ? "amber" : "blue"}>
                {openPo.status === "delayed" ? "Atrasada" : "En curso"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Cobertura total proyectada con esta simulación: <b>{formatDays(projectedCoverage)}</b>
              .
            </p>
          </section>
        )}

        <CoverageTargetBar current={currentCoverage} simulated={projectedCoverage} />

        <section className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Simular cantidad
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Múltiplo de compra: {formatNumber(multiple)} u. · caja/pallet:{" "}
                {formatNumber(packSize)} u. · mínimo operacional {formatNumber(rec.minStock)} u.
              </p>
            </div>
            <div className="inline-flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onQuantityChange(Math.max(0, safeQty - multiple))}
              >
                -{formatNumber(multiple)}
              </Button>
              <span className="min-w-[96px] rounded-lg bg-slate-100 px-3 py-2 text-center text-lg font-semibold text-slate-900">
                {formatNumber(safeQty)} u.
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onQuantityChange(Math.min(maxQty, safeQty + multiple))}
              >
                +{formatNumber(multiple)}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <DecisionMetric
              label="Cobertura total"
              value={formatDays(projectedCoverage)}
              tone={stockoutRisk === "Alto" ? "red" : stockoutRisk === "Medio" ? "amber" : "green"}
            />
            <DecisionMetric label="Capital" value={formatCurrencyCompact(capital)} tone="blue" />
            <DecisionMetric
              label="Venta protegida"
              value={formatCurrencyCompact(protectedSales)}
              tone="green"
            />
            <DecisionMetric
              label="Margen esperado"
              value={formatCurrencyCompact(expectedGrossMargin)}
              tone="green"
            />
            <DecisionMetric
              label="GMROI estimado"
              value={estimatedGmroi.toFixed(1).replace(".", ",")}
              tone={estimatedGmroi >= 4 ? "green" : "amber"}
            />
            <DecisionMetric
              label="Presupuesto"
              value={`${formatPercent(budgetUsePct, 0)} disp.`}
              tone={capital <= budgetAvailable ? "green" : "red"}
            />
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Comparar escenarios
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-3">
            {scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.label}
                scenario={scenario}
                selected={scenario.qty === safeQty}
                recommended={scenario.label === "Recomendado"}
                onUse={() => onQuantityChange(scenario.qty)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Por qué {formatNumber(rec.suggestedQuantity)} u.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li>✓ Cubre el lead time de {formatDays(rec.supplierLeadTimeDays)}.</li>
            <li>
              ✓{" "}
              {projectedCoverage <= 60
                ? "Deja la cobertura dentro del objetivo 45-60 días."
                : `Compra sola queda cerca del objetivo; con OC en curso proyecta ${formatDays(
                    projectedCoverage
                  )}.`}
            </li>
            <li>
              ✓{" "}
              {projectedCoverage <= 60
                ? "Mantiene riesgo de sobrestock bajo frente a venta reciente."
                : "Conviene validar si se espera la OC abierta o se reduce la cantidad."}
            </li>
            <li>✓ Requiere {formatCurrencyCompact(rec.suggestedPurchaseAmount)} de capital.</li>
          </ul>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2">
            <p>
              <b>Por qué no menos:</b> menor colchón ante una aceleración de venta.
            </p>
            <p>
              <b>Por qué no más:</b> aumenta capital inmovilizado y baja retorno de inventario.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Demanda</p>
          <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <DecisionMetric
              label="30d"
              value={`${formatNumber(rec.salesLast30Days)} u.`}
              tone="blue"
            />
            <DecisionMetric label="Prom. 90d" value={`${formatNumber(avg90)} u.`} tone="blue" />
            <DecisionMetric
              label="Tendencia"
              value={`${trend >= 0 ? "+" : ""}${formatPercent(trend, 0)}`}
              tone={trend >= 0 ? "green" : "amber"}
            />
            <DecisionMetric label="Forecast" value={`${formatNumber(forecast30)} u.`} tone="blue" />
          </div>
        </section>

        <section>
          <details className="rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Probar sensibilidad de demanda
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[-20, 0, 20].map((change) => (
                <SensitivityCard
                  key={change}
                  change={change}
                  rec={rec}
                  qty={safeQty + effectiveIncomingQty}
                />
              ))}
            </div>
          </details>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Comparar proveedores
          </p>
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Proveedor</th>
                  <th className="px-3 py-2 text-right">Costo</th>
                  <th className="px-3 py-2 text-right">Lead time</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {supplierOptions.map((option) => (
                  <tr key={option.name} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{option.name}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(option.cost)}</td>
                    <td className="px-3 py-2 text-right">{formatDays(option.leadTime)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {formatCurrencyCompact(option.total)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatDays(option.coverage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Un proveedor más rápido puede costar algo más, pero reduce riesgo de quiebre por llegada
            anticipada.
          </p>
        </section>

        <Button variant="secondary" className="w-full" onClick={() => onViewSku(rec)}>
          Ver SKU 360
        </Button>
      </div>
    </Drawer>
  );
}

interface SimulationScenario {
  label: string;
  qty: number;
  coverage: number;
  capital: number;
  stockoutRisk: "Alto" | "Medio" | "Bajo";
  overstockRisk: "Medio" | "Bajo";
  gmroi: number;
}

function roundToMultiple(value: number, multiple: number) {
  if (multiple <= 1) return Math.max(0, Math.round(value));
  return Math.max(0, Math.round(value / multiple) * multiple);
}

function buildSimulationScenario(
  rec: PurchaseRecommendation,
  label: string,
  qty: number,
  incomingQty: number
): SimulationScenario {
  const dailySales = rec.salesLast30Days > 0 ? rec.salesLast30Days / 30 : 0;
  const coverage =
    dailySales > 0
      ? Math.round(((rec.availableStock + qty + incomingQty) / dailySales) * 10) / 10
      : rec.inventoryDays;
  const capital = qty * rec.unitCost;
  const unitPriceEstimate = rec.margin < 95 ? rec.unitCost / (1 - rec.margin / 100) : rec.unitCost;
  const protectedSales =
    Math.min(rec.salesLast30Days, rec.availableStock + qty + incomingQty) * unitPriceEstimate;
  const grossMargin = protectedSales * (rec.margin / 100);
  const gmroi = capital > 0 ? (grossMargin * 12) / capital : 0;
  const stockoutRisk =
    coverage <= rec.supplierLeadTimeDays
      ? "Alto"
      : coverage <= rec.supplierLeadTimeDays * 2
        ? "Medio"
        : "Bajo";
  const overstockRisk =
    coverage > 60 || rec.availableStock + qty + incomingQty > rec.maxStock ? "Medio" : "Bajo";
  return { label, qty, coverage, capital, stockoutRisk, overstockRisk, gmroi };
}

function buildSupplierComparison(rec: PurchaseRecommendation, qty: number) {
  const related = suppliers.filter((supplier) => supplier.categories.includes(rec.category));
  const fallback = suppliers.filter((supplier) => supplier.name !== rec.supplierName);
  const candidates = [
    { name: rec.supplierName, leadTime: rec.supplierLeadTimeDays, costFactor: 1 },
    ...[...related, ...fallback]
      .filter((supplier) => supplier.name !== rec.supplierName)
      .slice(0, 2)
      .map((supplier, index) => ({
        name: supplier.name,
        leadTime: supplier.averageLeadTimeDays,
        costFactor: index === 0 ? 1.04 : 0.96,
      })),
  ];

  return candidates.map((candidate) => {
    const cost = Math.round(rec.unitCost * candidate.costFactor);
    const coverage =
      rec.salesLast30Days > 0
        ? Math.round(((rec.availableStock + qty) / (rec.salesLast30Days / 30)) * 10) / 10
        : rec.inventoryDays;
    return {
      ...candidate,
      cost,
      total: cost * qty,
      coverage,
    };
  });
}

function extractRiskAmount(risk: string) {
  const match = risk.match(/\$[\d.,]+(?:\s?[MK])?/i);
  return match?.[0] ?? "No estimada";
}

function CoverageTargetBar({ current, simulated }: { current: number; simulated: number }) {
  const currentPct = Math.min(100, Math.max(0, current));
  const simulatedPct = Math.min(100, Math.max(0, simulated));
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Cobertura después de comprar
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <span>
          <b className="block text-slate-900">{formatDays(current)}</b>
          actual
        </span>
        <span>
          <b className="block text-slate-900">45-60 d</b>
          objetivo
        </span>
        <span>
          <b className="block text-slate-900">{formatDays(simulated)}</b>
          simulada
        </span>
      </div>
      <div className="relative mt-4 h-4 rounded-full bg-slate-100">
        <div className="absolute left-[45%] h-full w-[15%] rounded-full bg-emerald-200" />
        <span
          className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-slate-400"
          style={{ left: `${currentPct}%` }}
          title="Cobertura actual"
        />
        <span
          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow"
          style={{ left: `${simulatedPct}%` }}
          title="Cobertura simulada"
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">La zona verde marca el rango objetivo.</p>
    </section>
  );
}

function ScenarioCard({
  scenario,
  selected,
  recommended,
  onUse,
}: {
  scenario: SimulationScenario;
  selected: boolean;
  recommended: boolean;
  onUse: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        selected ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{scenario.label}</p>
          <p className="text-lg font-semibold text-slate-900">{formatNumber(scenario.qty)} u.</p>
        </div>
        {recommended && <Badge tone="blue">Recomendado</Badge>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <span>
          <b className="block text-slate-900">{formatDays(scenario.coverage)}</b>
          cobertura
        </span>
        <span>
          <b className="block text-slate-900">{formatCurrencyCompact(scenario.capital)}</b>
          capital
        </span>
        <span>
          <b
            className={
              scenario.stockoutRisk === "Bajo" ? "block text-emerald-700" : "block text-amber-700"
            }
          >
            {scenario.stockoutRisk}
          </b>
          quiebre
        </span>
        <span>
          <b
            className={
              scenario.overstockRisk === "Bajo" ? "block text-emerald-700" : "block text-amber-700"
            }
          >
            {scenario.overstockRisk}
          </b>
          sobrestock
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        GMROI est. {scenario.gmroi.toFixed(1).replace(".", ",")}
      </p>
      <Button
        className="mt-3 w-full"
        size="sm"
        variant={selected ? "secondary" : "primary"}
        onClick={onUse}
      >
        {selected ? "Seleccionado" : "Usar escenario"}
      </Button>
    </div>
  );
}

function SensitivityCard({
  change,
  rec,
  qty,
}: {
  change: number;
  rec: PurchaseRecommendation;
  qty: number;
}) {
  const adjustedSales = Math.max(1, rec.salesLast30Days * (1 + change / 100));
  const coverage = Math.round((qty / (adjustedSales / 30)) * 10) / 10;
  const overstock = coverage > 60 ? "Medio" : "Bajo";
  const stockout = coverage <= rec.supplierLeadTimeDays * 2 ? "Medio" : "Bajo";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="font-semibold text-slate-800">
        {change > 0 ? "+" : ""}
        {change}% demanda
      </p>
      <p className="mt-1 text-xs text-slate-500">Cobertura {formatDays(coverage)}</p>
      <p className="text-xs text-slate-500">Quiebre {stockout}</p>
      <p className="text-xs text-slate-500">Sobrestock {overstock}</p>
    </div>
  );
}

function DecisionMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "red" | "amber" | "blue" | "green";
}) {
  const toneClass = {
    red: "border-rose-200 bg-rose-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-brand-200 bg-brand-50",
    green: "border-emerald-200 bg-emerald-50",
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

/** Color de la frase de cobertura según urgencia frente al lead time. */
function coverageToneText(rec: PurchaseRecommendation): string {
  if (rec.salesLast30Days <= 0) return "text-slate-400";
  const cover = coverageDays(rec.availableStock, rec.salesLast30Days);
  const lead = rec.supplierLeadTimeDays;
  if (rec.availableStock <= 0 || cover <= lead) return "text-rose-600";
  if (cover <= lead * 2) return "text-amber-600";
  return "text-emerald-600";
}

/** Celda de cobertura en días con barra y color según el lead time. */
function CoverageCell({ rec }: { rec: PurchaseRecommendation }) {
  const cover = coverageDays(rec.availableStock, rec.salesLast30Days);
  const lead = rec.supplierLeadTimeDays;

  // Sin venta: no aplica cobertura por riesgo de quiebre
  if (rec.salesLast30Days <= 0) {
    return <span className="text-xs text-slate-400">sin venta</span>;
  }

  const tone = cover <= lead ? "rose" : cover <= lead * 2 ? "amber" : "emerald";
  const toneText = { rose: "text-rose-600", amber: "text-amber-600", emerald: "text-emerald-600" };
  const toneBar = { rose: "bg-rose-500", amber: "bg-amber-500", emerald: "bg-emerald-500" };
  // Escala visual sobre 60 días
  const pct = Math.min(100, (cover / 60) * 100);

  return (
    <div className="inline-flex flex-col items-end gap-1 min-w-[64px]">
      <span className={`text-sm font-medium ${toneText[tone]}`}>
        {cover >= 999 ? "+999" : formatNumber(cover)} d
      </span>
      <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${toneBar[tone]}`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
    </div>
  );
}

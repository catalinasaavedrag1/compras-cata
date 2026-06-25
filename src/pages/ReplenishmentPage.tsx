import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card } from "../components/ui/Card";
import { DataTable, type Column, type SortState } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { RecommendationBadge } from "../components/business/RecommendationBadge";
import { PriorityBadge } from "../components/business/PriorityBadge";
import { StateLegend } from "../components/business/StateLegend";
import { recommendationUrgency, priorityUrgency } from "../components/business/statusInfo";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Tabs } from "../components/ui/Tabs";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { IconReplenish, IconAlerts, IconBox, IconPlus, IconClose, IconInfo } from "../components/ui/icons";
import { recommendations as allRecs } from "../data/mockRecommendations";
import { suppliers } from "../data/mockSuppliers";
import { monthlyPurchaseBudget } from "../data/mockRules";
import { filterRecommendations, uniqueValues } from "../utils/filters";
import { coverageDays } from "../utils/calculations";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { useLocalStorage } from "../utils/useLocalStorage";
import { useUrlState } from "../utils/useUrlState";
import { ExportButton } from "../components/business/ExportButton";
import type { PurchaseRecommendation } from "../types/purchasing";

interface RecOverride {
  suggestedQuantity: number;
  suggestedPurchaseAmount: number;
  supplierName: string;
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
  const { addItem, hasItem } = useOcDraft();
  const toast = useToast();

  // Estado persistente (sobrevive a recargas)
  const [overrides, setOverrides] = useLocalStorage<Record<string, RecOverride>>(
    "compras:rec-overrides",
    {}
  );
  const [ignoredIds, setIgnoredIds] = useLocalStorage<string[]>(
    "compras:rec-ignored",
    []
  );

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

  const [editing, setEditing] = useState<PurchaseRecommendation | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editSupplier, setEditSupplier] = useState("");

  // Aplica overrides guardados sobre los datos base
  const recs = useMemo(
    () => allRecs.map((r) => (overrides[r.id] ? { ...r, ...overrides[r.id] } : r)),
    [overrides]
  );

  const visible = useMemo(
    () => recs.filter((r) => !ignoredIds.includes(r.id)),
    [recs, ignoredIds]
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
    if (foco === "urgent") result = result.filter((r) => r.status === "critical" || r.status === "buy_now");
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

  // Resumen (sobre lo visible, no ignoradas)
  const totalSuggested = visible.reduce((a, r) => a + r.suggestedPurchaseAmount, 0);
  const criticalCount = visible.filter((r) => r.status === "critical").length;
  const buyNowCount = visible.filter((r) => r.status === "buy_now").length;
  const overstockCount = visible.filter((r) => r.status === "overstock").length;
  const lowMarginCount = visible.filter((r) => r.margin < 25).length;
  const overstockSavings = visible
    .filter((r) => r.status === "overstock")
    .reduce((a, r) => a + (r.availableStock - r.maxStock) * r.unitCost, 0);

  // Presupuesto
  const budgetUsedPct = (totalSuggested / monthlyPurchaseBudget) * 100;
  const overBudget = totalSuggested > monthlyPurchaseBudget;
  const budgetTone = overBudget ? "bad" : budgetUsedPct > 80 ? "warn" : "good";
  const budgetBar = overBudget ? "bg-rose-500" : budgetUsedPct > 80 ? "bg-amber-500" : "bg-emerald-500";

  // Selección
  const toggleRow = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  const toggleAll = (keys: string[]) =>
    setSelected((prev) => (keys.every((k) => prev.includes(k)) ? [] : keys));

  const selectedRecs = filtered.filter((r) => selected.includes(r.id));
  const selectedTotal = selectedRecs.reduce((a, r) => a + r.suggestedPurchaseAmount, 0);

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
      toAdd.length > 0 ? { label: "Ver borrador OC", onClick: () => navigate("/ordenes-compra") } : undefined
    );
  };

  const addAllUrgent = () => {
    const toAdd = urgentRecs.filter((r) => r.suggestedQuantity > 0 && !hasItem(r.sku));
    toAdd.forEach((r) =>
      addItem({
        sku: r.sku,
        productName: r.productName,
        supplierName: r.supplierName,
        quantity: r.suggestedQuantity,
        unitCost: r.unitCost,
      })
    );
    toast.success(
      toAdd.length > 0
        ? `${toAdd.length} producto${toAdd.length === 1 ? "" : "s"} urgente${toAdd.length === 1 ? "" : "s"} agregado${toAdd.length === 1 ? "" : "s"} a OC`
        : "Todos los urgentes ya están en el borrador de OC",
      { label: "Ver borrador OC", onClick: () => navigate("/ordenes-compra") }
    );
  };

  const ignoreSelected = () => {
    setIgnoredIds((prev) => Array.from(new Set([...prev, ...selected])));
    toast.info(`${selected.length} sugerencia${selected.length === 1 ? "" : "s"} ignorada${selected.length === 1 ? "" : "s"}`);
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

  const handleAdd = (r: PurchaseRecommendation) => {
    addItem({
      sku: r.sku,
      productName: r.productName,
      supplierName: r.supplierName,
      quantity: r.suggestedQuantity,
      unitCost: r.unitCost,
    });
    toast.success(`${r.productName} agregado al borrador de OC`, { label: "Ver borrador OC", onClick: () => navigate("/ordenes-compra") });
  };

  const handleSort = (key: string) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
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
        <div className="min-w-[200px]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">{r.sku}</span>
            <span className="text-xs text-slate-400">{r.brand}</span>
          </div>
          <p className="font-medium text-slate-800 leading-snug">{r.productName}</p>
          <p className="text-xs text-slate-500">{r.category}</p>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor sugerido",
      hideOnMobile: true,
      render: (r) => (
        <div className="text-sm">
          <p className="text-slate-700">{r.supplierName}</p>
          <p className="text-xs text-slate-400">Lead time {r.supplierLeadTimeDays} d</p>
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
            {formatNumber(r.availableStock)}
          </p>
          <p className="text-xs text-slate-400">comp. {formatNumber(r.committedStock)}</p>
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
      header: "Venta 30/90",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.salesLast30Days,
      render: (r) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatNumber(r.salesLast30Days)}</p>
          <p className="text-xs text-slate-400">{formatNumber(r.salesLast90Days)} (90d)</p>
        </div>
      ),
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
              <p className="text-xs text-emerald-600">para ~{coverAfter} días</p>
            ) : (
              <p className="text-xs text-slate-400">{formatCurrency(r.unitCost)} c/u</p>
            )}
          </div>
        );
      },
    },
    {
      key: "amount",
      header: "Compra $",
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
      key: "margin",
      header: "Margen",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.margin,
      render: (r) => (
        <span className={r.margin < 25 ? "text-amber-600 font-medium" : "text-slate-700"}>
          {formatPercent(r.margin)}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Prioridad",
      align: "center",
      sortable: true,
      sortValue: (r) => ({ high: 0, medium: 1, low: 2 })[r.priority],
      render: (r) => <PriorityBadge priority={r.priority} />,
    },
    {
      key: "status",
      header: "Acción",
      render: (r) => <RecommendationBadge status={r.status} />,
    },
    {
      key: "reason",
      header: "Motivo / Riesgo",
      hideOnMobile: true,
      render: (r) => (
        <div className="max-w-xs">
          <p className="text-xs text-slate-600 leading-snug">{r.reason}</p>
          <p className="text-xs text-rose-500 mt-1 leading-snug">⚠ {r.risk}</p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex flex-col gap-1 items-stretch min-w-[140px]">
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
              {hasItem(r.sku) ? "En OC" : "Agregar a OC"}
            </Button>
          )}
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEdit(r);
              }}
              className="flex-1 text-xs text-slate-500 hover:text-brand-600 border border-slate-200 rounded-md py-1"
            >
              Ajustar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIgnoredIds((prev) => Array.from(new Set([...prev, r.id])));
                toast.info(`Sugerencia de ${r.productName} ignorada`);
              }}
              className="flex-1 text-xs text-slate-500 hover:text-rose-600 border border-slate-200 rounded-md py-1"
            >
              Ignorar
            </button>
          </div>
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
        title="Reposición sugerida"
        description="Qué comprar, cuánto y por qué — priorizado por riesgo de quiebre."
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
            <Button onClick={() => navigate("/ordenes-compra")} icon={<IconReplenish className="w-4 h-4" />}>
              Ir a órdenes de compra
            </Button>
          </div>
        }
      />

      {/* Bloque de presupuesto — siempre visible arriba */}
      <Card className="mb-4">
        <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="lg:w-72">
            <p className="text-xs font-medium text-slate-500">Compra sugerida del mes</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-semibold text-slate-900">
                {formatCurrency(totalSuggested)}
              </span>
              <span className="text-sm text-slate-400">
                de {formatCurrencyCompact(monthlyPurchaseBudget)}
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
              <span className="font-medium text-slate-600">{formatPercent(budgetUsedPct, 0)} usado</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${budgetBar}`}
                style={{ width: `${Math.min(100, budgetUsedPct)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Suma de la reposición recomendada vigente (excluye sugerencias ignoradas). Ajusta cantidades para encajar en presupuesto.
            </p>
          </div>
          <Badge tone={budgetTone === "bad" ? "red" : budgetTone === "warn" ? "amber" : "green"}>
            {overBudget ? "Sobre presupuesto" : budgetUsedPct > 80 ? "Cerca del límite" : "Dentro de presupuesto"}
          </Badge>
        </div>
      </Card>

      {/* Cards resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard title="Compra sugerida total" value={formatCurrencyCompact(totalSuggested)} tone="info" icon={<IconReplenish className="w-4 h-4" />} description="Ver urgentes" active={foco === "urgent"} onClick={() => setFoco("urgent")} />
        <KpiCard title="SKUs críticos" value={formatNumber(criticalCount)} tone="bad" icon={<IconAlerts className="w-4 h-4" />} description="Comprar de inmediato" active={foco === "urgent"} onClick={() => setFoco("urgent")} />
        <KpiCard title="Para comprar ahora" value={formatNumber(buyNowCount)} tone="warn" icon={<IconReplenish className="w-4 h-4" />} description="Stock bajo vs lead time" active={foco === "urgent"} onClick={() => setFoco("urgent")} />
        <KpiCard title="Con sobrestock" value={formatNumber(overstockCount)} tone="warn" icon={<IconBox className="w-4 h-4" />} description="No conviene comprar" active={foco === "overstock"} onClick={() => setFoco("overstock")} />
        <KpiCard title="Con margen bajo" value={formatNumber(lowMarginCount)} tone="warn" icon={<IconBox className="w-4 h-4" />} description="Margen menor a 25%" active={toggles.lowMargin} onClick={() => setToggles((t) => ({ ...t, lowMargin: !t.lowMargin }))} />
      </div>

      {/* Ayuda breve + leyenda de estados (colapsable) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <IconInfo className="w-3.5 h-3.5 text-slate-400" />
          La cantidad sugerida cubre lead time + días objetivo. <b className="font-medium text-slate-600">"para ~N días"</b> = cobertura tras comprar.
        </span>
        {overstockSavings > 0 && (
          <span className="text-emerald-700">
            Ajustar sobrestock libera <b>{formatCurrency(overstockSavings)}</b>.
          </span>
        )}
      </div>
      <div className="mb-4">
        <StateLegend />
      </div>

      {/* Foco rápido: segmenta la tabla con un clic */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <Tabs
          value={foco}
          onChange={setFoco}
          tabs={[
            { value: "all", label: "Todos", count: visible.length },
            { value: "urgent", label: "Comprar ahora", count: urgentRecs.length },
            { value: "review", label: "Revisar", count: visible.filter((r) => r.status === "review").length },
            { value: "overstock", label: "Sobrestock", count: overstockCount },
          ]}
        />
        {urgentRecs.length > 0 && (
          <Button size="sm" onClick={addAllUrgent} icon={<IconPlus className="w-3.5 h-3.5" />}>
            Agregar {urgentRecs.length} urgentes a OC
          </Button>
        )}
      </div>

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
              options: uniqueValues(allRecs, (r) => r.category).map((c) => ({ value: c, label: c })),
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
            { key: "stockout", label: "Con quiebre", active: toggles.stockout, onToggle: () => setToggles((t) => ({ ...t, stockout: !t.stockout })) },
            { key: "risk", label: "Riesgo de quiebre", active: toggles.stockoutRisk, onToggle: () => setToggles((t) => ({ ...t, stockoutRisk: !t.stockoutRisk })) },
            { key: "overstock", label: "Sobrestock", active: toggles.overstock, onToggle: () => setToggles((t) => ({ ...t, overstock: !t.overstock })) },
            { key: "lowMargin", label: "Margen bajo", active: toggles.lowMargin, onToggle: () => setToggles((t) => ({ ...t, lowMargin: !t.lowMargin })) },
            { key: "highRot", label: "Alta rotación", active: toggles.highRotation, onToggle: () => setToggles((t) => ({ ...t, highRotation: !t.highRotation })) },
            { key: "lowRot", label: "Baja rotación", active: toggles.lowRotation, onToggle: () => setToggles((t) => ({ ...t, lowRotation: !t.lowRotation })) },
          ]}
        />
      </div>

      {ignoredIds.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
          <Badge tone="neutral">{ignoredIds.length} sugerencia(s) ignorada(s)</Badge>
          <button onClick={() => setIgnoredIds([])} className="font-medium text-brand-600 hover:text-brand-700">
            Restaurar
          </button>
        </div>
      )}

      {/* Barra de acciones masivas */}
      {selected.length > 0 && (
        <div className="sticky top-[68px] z-20 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-600 px-4 py-2.5 text-white shadow-lg">
          <span className="text-sm font-medium">
            {selected.length} seleccionado{selected.length === 1 ? "" : "s"} · {formatCurrency(selectedTotal)}
          </span>
          <div className="flex-1" />
          <button
            onClick={addSelectedToOc}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-medium"
          >
            <IconPlus className="w-4 h-4" /> Agregar a OC
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

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/productos/${r.sku}`)}
          rowClassName={(r) => (r.status === "critical" ? "bg-rose-50/40" : undefined)}
          sort={sort}
          onSortChange={handleSort}
          selection={{
            selectedKeys: selected,
            onToggle: toggleRow,
            onToggleAll: toggleAll,
          }}
          mobileCard={(r) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-slate-400">{r.sku}</span>
                  <p className="font-medium text-slate-800 leading-snug">{r.productName}</p>
                  <p className="text-xs text-slate-500">{r.category} · {r.supplierName}</p>
                </div>
                <RecommendationBadge status={r.status} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Stock disp.</p>
                  <p className={r.availableStock <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>{formatNumber(r.availableStock)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Sugerido</p>
                  <p className="font-semibold text-slate-900">{formatNumber(r.suggestedQuantity)} u.</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Compra</p>
                  <p className="font-semibold text-slate-900">{formatCurrency(r.suggestedPurchaseAmount)}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 leading-snug">{r.reason}</p>
              {r.suggestedQuantity > 0 && (
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  variant={hasItem(r.sku) ? "secondary" : "primary"}
                  disabled={hasItem(r.sku)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdd(r);
                  }}
                  icon={<IconPlus className="w-3.5 h-3.5" />}
                >
                  {hasItem(r.sku) ? "En OC" : "Agregar a OC"}
                </Button>
              )}
            </div>
          )}
        />
      </Card>

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

/** Celda de cobertura en días con barra y color según el lead time. */
function CoverageCell({ rec }: { rec: PurchaseRecommendation }) {
  const cover = coverageDays(rec.availableStock, rec.salesLast30Days);
  const lead = rec.supplierLeadTimeDays;

  // Sin venta: no aplica cobertura por riesgo de quiebre
  if (rec.salesLast30Days <= 0) {
    return <span className="text-xs text-slate-400">sin venta</span>;
  }

  const tone =
    cover <= lead ? "rose" : cover <= lead * 2 ? "amber" : "emerald";
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
        <div className={`h-full rounded-full ${toneBar[tone]}`} style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </div>
  );
}

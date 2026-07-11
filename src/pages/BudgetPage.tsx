import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { DataTable, type Column } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { HelpNote } from "../components/business/HelpNote";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { cn } from "../utils/cn";
import {
  BUDGET_MONTHS,
  DEFAULT_BUDGET_MONTH,
  formatBudgetMonth,
  type BudgetStatus,
} from "../data/mockBudgets";
import { computeOtb, type CategoryOtb } from "../utils/openToBuy";
import { useOcDraft } from "../context/OcDraftContext";
import { useLocalStorage } from "../utils/useLocalStorage";
import type { PurchaseOrder } from "../types/purchasing";
import { formatCurrency, formatCurrencyCompact, formatPercent } from "../utils/formatters";
import { IconInventory, IconCart, IconBox, IconAlerts } from "../components/ui/icons";

const STATUS_META: Record<BudgetStatus, { label: string; tone: BadgeTone }> = {
  ok: { label: "En presupuesto", tone: "green" },
  ajustado: { label: "Ajustado", tone: "amber" },
  excedido: { label: "Excedido", tone: "red" },
};

/** Color de la barra de progreso según cuán comprometido está el presupuesto. */
function barColor(estado: BudgetStatus): string {
  if (estado === "excedido") return "bg-rose-500";
  if (estado === "ajustado") return "bg-amber-500";
  return "bg-emerald-500";
}

function UsageBar({ row }: { row: CategoryOtb }) {
  const pct = Math.min(100, Math.round(row.usadoPct));
  const over = row.usadoPct > 100;
  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={cn("text-xs font-medium", over ? "text-rose-600" : "text-slate-600")}>
          {formatPercent(row.usadoPct, 0)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor(row.estado))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function BudgetPage() {
  const [month, setMonth] = useState<string>(DEFAULT_BUDGET_MONTH);
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState("");
  const { items: draftItems, count: draftCount } = useOcDraft();
  const [createdOrders] = useLocalStorage<PurchaseOrder[]>("compras:po-created", []);

  // Open-to-Buy en vivo: el borrador y las OC creadas consumen presupuesto.
  const views = useMemo(
    () => computeOtb(month, draftItems, createdOrders),
    [month, draftItems, createdOrders]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return views
      .filter((v) => {
        if (q && !v.categoria.toLowerCase().includes(q)) return false;
        if (estado && v.estado !== estado) return false;
        return true;
      })
      .sort((a, b) => b.presupuesto - a.presupuesto);
  }, [views, query, estado]);

  // KPIs del mes completo (no se filtran, dan la foto global del mes).
  const totals = useMemo(() => {
    return views.reduce(
      (acc, v) => {
        acc.presupuesto += v.presupuesto;
        acc.comprometido += v.comprometido;
        acc.recibido += v.recibido;
        acc.enBorrador += v.enBorrador;
        return acc;
      },
      { presupuesto: 0, comprometido: 0, recibido: 0, enBorrador: 0 }
    );
  }, [views]);

  const disponibleTotal = totals.presupuesto - totals.comprometido - totals.enBorrador;
  const usadoTotalPct =
    totals.presupuesto > 0
      ? ((totals.comprometido + totals.enBorrador) / totals.presupuesto) * 100
      : 0;
  const excedidas = views.filter((v) => v.estado === "excedido");
  const draftCategories = views.filter((v) => v.enBorrador > 0);

  const clearFilters = () => {
    setQuery("");
    setEstado("");
  };

  const columns: Column<CategoryOtb>[] = [
    {
      key: "categoria",
      header: "Categoría",
      render: (v) => <span className="font-medium text-slate-800">{v.categoria}</span>,
      sortable: true,
      sortValue: (v) => v.categoria,
    },
    {
      key: "presupuesto",
      header: "Presupuesto",
      align: "right",
      render: (v) => <span className="text-slate-700">{formatCurrencyCompact(v.presupuesto)}</span>,
      sortable: true,
      sortValue: (v) => v.presupuesto,
    },
    {
      key: "comprometido",
      header: "Comprometido",
      align: "right",
      hideOnMobile: true,
      render: (v) => (
        <span className="text-slate-700">{formatCurrencyCompact(v.comprometido)}</span>
      ),
      sortable: true,
      sortValue: (v) => v.comprometido,
    },
    {
      key: "borrador",
      header: "En borrador",
      align: "right",
      render: (v) =>
        v.enBorrador > 0 ? (
          <span className="font-medium text-brand-600">
            + {formatCurrencyCompact(v.enBorrador)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        ),
      sortable: true,
      sortValue: (v) => v.enBorrador,
    },
    {
      key: "disponible",
      header: "Disponible (OTB)",
      align: "right",
      render: (v) => (
        <span
          className={cn("font-semibold", v.disponible < 0 ? "text-rose-600" : "text-slate-900")}
        >
          {formatCurrencyCompact(v.disponible)}
        </span>
      ),
      sortable: true,
      sortValue: (v) => v.disponible,
    },
    {
      key: "usado",
      header: "% usado",
      align: "left",
      hideOnMobile: true,
      render: (v) => <UsageBar row={v} />,
      sortable: true,
      sortValue: (v) => v.usadoPct,
    },
    {
      key: "estado",
      header: "Estado",
      render: (v) => <Badge tone={STATUS_META[v.estado].tone}>{STATUS_META[v.estado].label}</Badge>,
      sortable: true,
      sortValue: (v) => v.estado,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Presupuesto por categoría"
        description="Open-to-Buy: cuánto puedes comprar en cada categoría después de descontar lo ya comprometido y lo que estás armando en el borrador."
        action={
          <div className="w-44">
            <Select
              aria-label="Mes del presupuesto"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              options={BUDGET_MONTHS.map((m) => ({ value: m, label: formatBudgetMonth(m) }))}
            />
          </div>
        }
      />

      <HelpNote className="mb-4">
        El <b>disponible (OTB)</b> es lo que aún puedes comprar: presupuesto − <b>comprometido</b>{" "}
        (OC ya emitidas, haya llegado o no la mercadería) − lo que tienes <b>en borrador</b> ahora
        mismo. Si armas una compra, verás bajar el disponible de su categoría en vivo, para no
        gastar plata que ya está reservada.
      </HelpNote>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Presupuesto del mes"
          value={formatCurrencyCompact(totals.presupuesto)}
          tone="info"
          icon={<IconInventory className="w-4 h-4" />}
          description={formatBudgetMonth(month)}
        />
        <KpiCard
          title="Comprometido"
          value={formatCurrencyCompact(totals.comprometido)}
          tone={usadoTotalPct > 100 ? "bad" : usadoTotalPct >= 85 ? "warn" : "good"}
          icon={<IconCart className="w-4 h-4" />}
          description={`${formatPercent(usadoTotalPct, 0)} con borrador`}
        />
        <KpiCard
          title="En borrador"
          value={formatCurrencyCompact(totals.enBorrador)}
          tone={totals.enBorrador > 0 ? "warn" : "neutral"}
          icon={<IconBox className="w-4 h-4" />}
          description={draftCount > 0 ? `${draftCount} SKU sin emitir` : "Sin borrador en curso"}
        />
        <KpiCard
          title="Disponible (OTB)"
          value={formatCurrencyCompact(disponibleTotal)}
          tone={disponibleTotal < 0 ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description={disponibleTotal < 0 ? "Presupuesto sobregirado" : "Saldo por comprometer"}
        />
      </div>

      {draftCategories.length > 0 && (
        <HelpNote variant="tip" className="mb-4">
          Tu borrador en curso suma <b>{formatCurrency(totals.enBorrador)}</b> en{" "}
          {draftCategories.length} categoría{draftCategories.length === 1 ? "" : "s"} (
          {draftCategories.map((v) => v.categoria).join(", ")}). El disponible ya lo refleja.
        </HelpNote>
      )}

      {excedidas.length > 0 && (
        <HelpNote variant="tip" className="mb-4">
          <b>{excedidas.length}</b> categoría{excedidas.length === 1 ? "" : "s"} quedaría
          {excedidas.length === 1 ? "" : "n"} sobre presupuesto en {formatBudgetMonth(month)}:{" "}
          {excedidas.map((v) => v.categoria).join(", ")}. Revisa antes de emitir la orden de compra.
        </HelpNote>
      )}

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar categoría"
          resultCount={filtered.length}
          onClear={clearFilters}
          selects={[
            {
              key: "estado",
              placeholder: "Estado",
              value: estado,
              onChange: setEstado,
              options: [
                { value: "ok", label: "En presupuesto" },
                { value: "ajustado", label: "Ajustado" },
                { value: "excedido", label: "Excedido" },
              ],
            },
          ]}
        />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(v) => v.categoria}
          rowClassName={(v) =>
            v.estado === "excedido"
              ? "bg-rose-50/60"
              : v.enBorrador > 0
                ? "bg-brand-50/40"
                : undefined
          }
          emptyMessage="No hay categorías que coincidan con los filtros."
          mobileCard={(v) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-slate-800">{v.categoria}</p>
                <Badge tone={STATUS_META[v.estado].tone}>{STATUS_META[v.estado].label}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Presupuesto</p>
                  <p className="text-slate-700">{formatCurrencyCompact(v.presupuesto)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">En borrador</p>
                  <p className={v.enBorrador > 0 ? "text-brand-600" : "text-slate-400"}>
                    {v.enBorrador > 0 ? `+ ${formatCurrencyCompact(v.enBorrador)}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Disponible</p>
                  <p
                    className={cn(
                      "font-semibold",
                      v.disponible < 0 ? "text-rose-600" : "text-slate-900"
                    )}
                  >
                    {formatCurrencyCompact(v.disponible)}
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <UsageBar row={v} />
              </div>
            </div>
          )}
        />
      </Card>
    </div>
  );
}

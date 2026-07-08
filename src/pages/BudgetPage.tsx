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
  getBudgetViews,
  type BudgetStatus,
  type CategoryBudgetView,
} from "../data/mockBudgets";
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

function UsageBar({ row }: { row: CategoryBudgetView }) {
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

  const views = useMemo(() => getBudgetViews(month), [month]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return views.filter((v) => {
      if (q && !v.categoria.toLowerCase().includes(q)) return false;
      if (estado && v.estado !== estado) return false;
      return true;
    });
  }, [views, query, estado]);

  // KPIs del mes completo (no se filtran, dan la foto global del mes).
  const totals = useMemo(() => {
    return views.reduce(
      (acc, v) => {
        acc.presupuesto += v.presupuesto;
        acc.comprometido += v.comprometido;
        acc.recibido += v.recibido;
        return acc;
      },
      { presupuesto: 0, comprometido: 0, recibido: 0 }
    );
  }, [views]);

  const disponibleTotal = totals.presupuesto - totals.comprometido;
  const usadoTotalPct =
    totals.presupuesto > 0 ? (totals.comprometido / totals.presupuesto) * 100 : 0;
  const excedidas = views.filter((v) => v.estado === "excedido");

  const clearFilters = () => {
    setQuery("");
    setEstado("");
  };

  const columns: Column<CategoryBudgetView>[] = [
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
      render: (v) => <span className="text-slate-700">{formatCurrency(v.presupuesto)}</span>,
      sortable: true,
      sortValue: (v) => v.presupuesto,
    },
    {
      key: "comprometido",
      header: "Comprometido",
      align: "right",
      render: (v) => <span className="text-slate-700">{formatCurrency(v.comprometido)}</span>,
      sortable: true,
      sortValue: (v) => v.comprometido,
    },
    {
      key: "recibido",
      header: "Recibido",
      align: "right",
      hideOnMobile: true,
      render: (v) => <span className="text-slate-600">{formatCurrency(v.recibido)}</span>,
      sortable: true,
      sortValue: (v) => v.recibido,
    },
    {
      key: "disponible",
      header: "Disponible",
      align: "right",
      render: (v) => (
        <span
          className={cn("font-semibold", v.disponible < 0 ? "text-rose-600" : "text-slate-900")}
        >
          {formatCurrency(v.disponible)}
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
      key: "proyeccion",
      header: "Proyección cierre",
      align: "right",
      hideOnMobile: true,
      render: (v) => (
        <span
          className={cn(
            v.proyeccionCierre > v.presupuesto ? "text-rose-600 font-medium" : "text-slate-600"
          )}
        >
          {formatCurrency(v.proyeccionCierre)}
        </span>
      ),
      sortable: true,
      sortValue: (v) => v.proyeccionCierre,
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
        description="Controla el presupuesto de compra mensual: cuánto está comprometido, cuánto ya llegó y cuánto queda disponible por categoría."
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
        <b>Comprometido</b> es la caja que ya reservaste al aprobar órdenes de compra, haya llegado
        o no la mercadería. <b>Recibido</b> es solo lo que ya se recepcionó (un subconjunto de lo
        comprometido). El <b>disponible</b> se calcula sobre lo comprometido, no sobre lo recibido,
        para no volver a gastar plata que ya está reservada.
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
          description={`${formatPercent(usadoTotalPct, 0)} del presupuesto`}
        />
        <KpiCard
          title="Recibido"
          value={formatCurrencyCompact(totals.recibido)}
          tone="neutral"
          icon={<IconBox className="w-4 h-4" />}
          description="Mercadería recepcionada"
        />
        <KpiCard
          title="Disponible"
          value={formatCurrencyCompact(disponibleTotal)}
          tone={disponibleTotal < 0 ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description={disponibleTotal < 0 ? "Presupuesto sobregirado" : "Saldo por comprometer"}
        />
      </div>

      {excedidas.length > 0 && (
        <HelpNote variant="tip" className="mb-4">
          <b>{excedidas.length}</b> categoría{excedidas.length === 1 ? "" : "s"} ya superó su
          presupuesto de {formatBudgetMonth(month)}: {excedidas.map((v) => v.categoria).join(", ")}.
          Revisa antes de aprobar nuevas órdenes de compra.
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
          rowClassName={(v) => (v.estado === "excedido" ? "bg-rose-50/60" : undefined)}
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
                  <p className="text-xs text-slate-400">Comprometido</p>
                  <p className="text-slate-700">{formatCurrencyCompact(v.comprometido)}</p>
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

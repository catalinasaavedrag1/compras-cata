import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { DataTable, type Column } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { HelpNote } from "../components/business/HelpNote";
import { InfoHint } from "../components/business/InfoHint";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { cn } from "../utils/cn";
import {
  computeOtb,
  formatBudgetMonth,
  type BudgetStatus,
  type CategoryOtb,
} from "../utils/openToBuy";
import { supplierPath } from "../utils/entityLinks";
import { Link } from "react-router-dom";
import { useOcDraft } from "../context/OcDraftContext";
import { useBudget, useSupplierSpend } from "../hooks/useBudget";
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

/** Compra por proveedor (ventana móvil real del dominio) + concentración. */
function SupplierSpendCard() {
  const { data, loading, error, refetch } = useSupplierSpend(90);

  const rows = data?.items ?? [];
  const topSupplier = rows[0];
  const namesStale = (data?.warnings ?? []).some((w) => w.code === "SUPPLIER_DATA_STALE");

  return (
    <Card className="mt-4">
      <CardHeader
        title={`Compra por proveedor (${data?.windowDays ?? 90} días)`}
        description="En qué proveedores se concentra el gasto. La dependencia excesiva es un riesgo."
      />
      <CardBody>
        {loading && rows.length === 0 && (
          <div className="space-y-2.5" aria-busy="true" aria-label="Cargando compra por proveedor">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-40 flex-shrink-0" />
                <Skeleton className="h-2 flex-1 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        )}
        {!loading && error && rows.length === 0 && (
          <div className="py-4 text-center">
            <p className="text-sm text-slate-500">No se pudo cargar la compra por proveedor.</p>
            <Button className="mt-3" size="sm" variant="secondary" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">
            Sin órdenes de compra en la ventana. El gasto por proveedor aparecerá al emitir OC.
          </p>
        )}
        {rows.length > 0 && (
          <>
            {namesStale && (
              <p className="mb-2 text-xs text-slate-400">
                Nombres de proveedor no disponibles; se muestra la referencia interna.
              </p>
            )}
            {topSupplier && topSupplier.share > 0.3 && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <IconAlerts className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <span>
                  Concentración alta: <b>{topSupplier.supplierName}</b> representa el{" "}
                  {formatPercent(topSupplier.share * 100, 0)} de la compra. Evalúa alternativas para
                  reducir dependencia.
                </span>
              </div>
            )}
            <div className="space-y-2">
              {rows.slice(0, 8).map((s) => (
                <div key={s.supplierId} className="flex items-center gap-3">
                  <Link
                    to={supplierPath(s.supplierName)}
                    className="w-40 flex-shrink-0 truncate text-sm font-medium text-slate-700 hover:text-brand-700 hover:underline"
                  >
                    {s.supplierName}
                  </Link>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        s.share > 0.3 ? "bg-amber-400" : "bg-brand-500"
                      )}
                      style={{ width: `${Math.round(s.share * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 flex-shrink-0 text-right text-xs font-medium text-slate-500">
                    {formatPercent(s.share * 100, 0)}
                  </span>
                  <span className="w-20 flex-shrink-0 text-right text-sm font-semibold text-slate-900">
                    {formatCurrencyCompact(s.totalClp)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

export function BudgetPage() {
  // undefined = mes efectivo del BFF (el más reciente configurado).
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState("");
  const { items: draftItems, count: draftCount } = useOcDraft();
  const { data, loading, error, configured, refetch } = useBudget(month);

  const effectiveMonth = data?.month ?? month ?? null;
  const months = data?.months ?? [];

  // Open-to-Buy en vivo: buckets reales + el borrador en curso por categoría.
  const views = useMemo(
    () => computeOtb(data?.items ?? [], draftItems),
    [data, draftItems]
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
        acc.enBorrador += v.enBorrador;
        return acc;
      },
      { presupuesto: 0, comprometido: 0, enBorrador: 0 }
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

  const pageTitle = "Presupuesto por categoría";
  const pageDescription =
    "Open-to-Buy: cuánto puedes comprar en cada categoría después de descontar lo ya comprometido y lo que estás armando en el borrador.";

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando y error (patrón flujo 1).
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
              ver el presupuesto real (Open-to-Buy) del servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando presupuesto">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-40 flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar el presupuesto
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

  // Presupuesto no configurado en el dominio: estado vacío honesto.
  if (data && data.month === null) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Presupuesto no configurado</p>
            <p className="mt-1 text-sm text-slate-500">
              Aún no hay buckets de Open-to-Buy definidos para ninguna categoría. Cuando el área de
              finanzas los configure, verás aquí el presupuesto del mes y su consumo.
            </p>
          </div>
        </Card>
      </div>
    );
  }

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
        title={pageTitle}
        description={pageDescription}
        action={
          months.length > 0 && effectiveMonth ? (
            <div className="w-44">
              <Select
                aria-label="Mes del presupuesto"
                value={effectiveMonth}
                onChange={(e) => setMonth(e.target.value)}
                options={months.map((m) => ({ value: m, label: formatBudgetMonth(m) }))}
              />
            </div>
          ) : undefined
        }
        help={
          <InfoHint label="Qué es el disponible (OTB)">
            <p>
              El <b>disponible (OTB)</b> es lo que aún puedes comprar: presupuesto −{" "}
              <b>comprometido</b> (OC ya emitidas, haya llegado o no la mercadería) − lo que tienes{" "}
              <b>en borrador</b> ahora mismo.
            </p>
            <p>
              Si armas una compra, verás bajar el disponible de su categoría en vivo, para no gastar
              plata que ya está reservada.
            </p>
          </InfoHint>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Presupuesto del mes"
          value={formatCurrencyCompact(totals.presupuesto)}
          tone="info"
          icon={<IconInventory className="w-4 h-4" />}
          description={effectiveMonth ? formatBudgetMonth(effectiveMonth) : "—"}
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

      {excedidas.length > 0 && effectiveMonth && (
        <HelpNote variant="tip" className="mb-4">
          <b>{excedidas.length}</b> categoría{excedidas.length === 1 ? "" : "s"} quedaría
          {excedidas.length === 1 ? "" : "n"} sobre presupuesto en{" "}
          {formatBudgetMonth(effectiveMonth)}: {excedidas.map((v) => v.categoria).join(", ")}.
          Revisa antes de emitir la orden de compra.
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
          rowKey={(v) => v.categoryId}
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

      <SupplierSpendCard />
    </div>
  );
}

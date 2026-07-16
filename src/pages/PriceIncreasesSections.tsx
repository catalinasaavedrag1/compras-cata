import { Link } from "react-router-dom";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { DataTable, type Column } from "../components/ui/Table";
import { productPath, categoryPath, supplierPath } from "../utils/entityLinks";
import { IconArrowUp, IconArrowDown } from "../components/ui/icons";
import { formatCurrency, formatPercent, formatDelta, formatDate } from "../utils/formatters";
import {
  TARGET_MARGIN_BY_CATEGORY,
  LOW_MARGIN_THRESHOLD,
  summarizeList,
  type PriceList,
  type PriceListItem,
  type PriceListEstado,
} from "../data/mockPriceLists";

type SortState = { key: string | null; dir: "asc" | "desc" };
type PriceListSummary = ReturnType<typeof summarizeList>;

const ESTADO_CFG: Record<PriceListEstado, { label: string; tone: "amber" | "green" | "red" }> = {
  pendiente: { label: "Pendiente", tone: "amber" },
  aprobada: { label: "Aprobada", tone: "green" },
  rechazada: { label: "Rechazada", tone: "red" },
};

/** Margen objetivo de una categoría (fallback 25%). */
function targetFor(category: string): number {
  return TARGET_MARGIN_BY_CATEGORY[category] ?? 25;
}

/** Selector de listas de precios (una tarjeta por proveedor con su estado). */
export function PriceListSelector({
  lists,
  selectedId,
  onSelect,
}: {
  lists: PriceList[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5 mb-4">
      {lists.map((l) => {
        const active = l.id === selectedId;
        const cfg = ESTADO_CFG[l.estado];
        return (
          <button
            key={l.id}
            onClick={() => onSelect(l.id)}
            className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-2.5 min-w-[170px] text-left ${active ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
          >
            <span className={`text-sm font-semibold ${active ? "text-brand-700" : "text-slate-700"}`}>
              {l.proveedor}
            </span>
            <span className="flex items-center gap-1.5">
              <Badge tone={cfg.tone}>{cfg.label}</Badge>
              <span className={`text-xs ${active ? "text-brand-500" : "text-slate-400"}`}>
                {l.items.length} prod.
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Resumen de la lista activa: proveedor, alza promedio, alzas/bajas e impacto. */
export function PriceListSummaryCard({
  selected,
  summary,
}: {
  selected: PriceList;
  summary: PriceListSummary;
}) {
  return (
    <Card className="mb-4">
      <CardBody className="flex flex-wrap items-center gap-7">
        <div className="min-w-[200px]">
          <div className="flex items-center gap-2">
            <Link
              to={supplierPath(selected.proveedor)}
              className="text-lg font-bold text-slate-900 hover:text-brand-700 hover:underline"
            >
              {selected.proveedor}
            </Link>
            <Badge tone={ESTADO_CFG[selected.estado].tone} dot>
              {ESTADO_CFG[selected.estado].label}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {selected.id} · vigente desde {formatDate(selected.vigenteDesde)}
          </p>
        </div>
        <div className="flex gap-6 flex-wrap">
          <div>
            <p className="text-xs text-slate-400">Productos</p>
            <p className="text-lg font-semibold text-slate-800">{summary.productos}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Alza prom.</p>
            <p
              className={`text-lg font-semibold ${summary.alzaPromedioPct > 0 ? "text-rose-600" : summary.alzaPromedioPct < 0 ? "text-emerald-600" : "text-slate-700"}`}
            >
              {formatDelta(summary.alzaPromedioPct)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Alzas / bajas</p>
            <p className="text-lg font-semibold text-slate-800">
              {summary.enAlza} / {summary.enBaja}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Impacto margen</p>
            <p
              className={`text-lg font-semibold ${summary.impactoMargenPts < 0 ? "text-rose-600" : "text-emerald-600"}`}
            >
              {summary.impactoMargenPts.toLocaleString("es-CL", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{" "}
              pts
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Margen bajo</p>
            <p
              className={`text-lg font-semibold ${summary.conMargenBajo > 0 ? "text-rose-600" : "text-emerald-600"}`}
            >
              {summary.conMargenBajo}
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/** Tabla de ítems de la lista (costo actual→nuevo, margen, precio sugerido). */
export function PriceItemsTable({
  items,
  sort,
  onSortChange,
}: {
  items: PriceListItem[];
  sort: SortState;
  onSortChange: (key: string) => void;
}) {
  const columns: Column<PriceListItem>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (it) => (
        <div className="min-w-0">
          <Link
            to={productPath(it.sku)}
            className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
          >
            {it.productName}
          </Link>
          <p className="text-[11px] text-slate-400">
            {it.sku} ·{" "}
            <Link to={categoryPath(it.category)} className="hover:text-brand-700 hover:underline">
              {it.category}
            </Link>
          </p>
        </div>
      ),
    },
    {
      key: "costo",
      header: "Costo actual → nuevo",
      align: "right",
      sortable: true,
      sortValue: (it) => it.alzaPct,
      render: (it) => {
        const isAlza = it.alzaPct > 0;
        const isBaja = it.alzaPct < 0;
        return (
          <div className="whitespace-nowrap">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[11px] text-slate-400 line-through">
                {formatCurrency(it.costoActual)}
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {formatCurrency(it.costoNuevo)}
              </span>
            </div>
            <Badge tone={isAlza ? "red" : isBaja ? "green" : "neutral"} className="mt-0.5">
              {isAlza ? (
                <IconArrowUp className="w-3 h-3" />
              ) : isBaja ? (
                <IconArrowDown className="w-3 h-3" />
              ) : null}
              {it.alzaPct === 0 ? "Sin cambio" : formatDelta(it.alzaPct)}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "margen",
      header: "Margen actual → nuevo",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (it) => it.margenNuevoPct,
      render: (it) => {
        const cae = it.margenNuevoPct < it.margenActualPct;
        const bajo = it.margenNuevoPct < LOW_MARGIN_THRESHOLD;
        return (
          <div className="whitespace-nowrap">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[11px] text-slate-400">{formatPercent(it.margenActualPct)}</span>
              <span className="text-slate-300">→</span>
              <span
                className={`text-sm font-semibold ${bajo ? "text-rose-600" : cae ? "text-amber-600" : "text-emerald-600"}`}
              >
                {formatPercent(it.margenNuevoPct)}
              </span>
            </div>
            {bajo && (
              <p className="text-[11px] text-rose-500">Quedaría bajo {LOW_MARGIN_THRESHOLD}%</p>
            )}
          </div>
        );
      },
    },
    {
      key: "sugerido",
      header: "Precio venta sugerido",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (it) => it.precioVentaSugerido,
      render: (it) => (
        <div className="whitespace-nowrap">
          <span className="text-sm font-semibold text-brand-700">
            {formatCurrency(it.precioVentaSugerido)}
          </span>
          <p className="text-[11px] text-slate-400">
            objetivo {formatPercent(targetFor(it.category), 0)}
          </p>
        </div>
      ),
    },
  ];

  const mobileCard = (it: PriceListItem) => {
    const isAlza = it.alzaPct > 0;
    const isBaja = it.alzaPct < 0;
    const bajo = it.margenNuevoPct < LOW_MARGIN_THRESHOLD;
    return (
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={productPath(it.sku)}
              className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline block truncate"
            >
              {it.productName}
            </Link>
            <p className="text-[11px] text-slate-400">
              {it.sku} · {it.category}
            </p>
          </div>
          <Badge tone={isAlza ? "red" : isBaja ? "green" : "neutral"}>
            {it.alzaPct === 0 ? "Sin cambio" : formatDelta(it.alzaPct)}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Costo</span>
          <span>
            <span className="text-slate-400 line-through">{formatCurrency(it.costoActual)}</span>{" "}
            <b className="text-slate-800">{formatCurrency(it.costoNuevo)}</b>
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Margen</span>
          <span>
            <span className="text-slate-400">{formatPercent(it.margenActualPct)}</span> →{" "}
            <b className={bajo ? "text-rose-600" : "text-slate-800"}>
              {formatPercent(it.margenNuevoPct)}
            </b>
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Precio sugerido</span>
          <b className="text-brand-700">{formatCurrency(it.precioVentaSugerido)}</b>
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <DataTable
        columns={columns}
        data={items}
        rowKey={(it) => it.sku}
        sort={sort}
        onSortChange={onSortChange}
        rowClassName={(it) => (it.margenNuevoPct < LOW_MARGIN_THRESHOLD ? "bg-rose-50/40" : undefined)}
        emptyMessage="No hay productos con estos filtros en esta lista."
        mobileCard={mobileCard}
      />
    </Card>
  );
}

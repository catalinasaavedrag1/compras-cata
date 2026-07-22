import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { DataTable, type Column } from "../components/ui/Table";
import { productPath, categoryPath, supplierPath } from "../utils/entityLinks";
import { IconArrowUp, IconArrowDown } from "../components/ui/icons";
import { formatCurrency, formatDelta, formatDate } from "../utils/formatters";
import type { PriceChangeView } from "../services/purchaseBff";

// ============================================================================
//  Tabla de la vigilancia de precios de COMPRA (F26). Cada fila es un cambio de
//  costo real detectado desde las OC (no un precio de venta). Muestra el costo
//  anterior → actual con su variación, el costo acordado vigente (contraste) y
//  la última OC que fijó el nuevo costo. Sin listas de venta ni márgenes: eso no
//  tiene fuente en el contrato de vigilancia de costos.
// ============================================================================

export type PriceSortState = { key: string | null; dir: "asc" | "desc" };

const fmtDate = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : "—");

/** Tabla de cambios de costo de compra por SKU. */
export function PriceChangesTable({
  items,
  sort,
  onSortChange,
}: {
  items: PriceChangeView[];
  sort: PriceSortState;
  onSortChange: (key: string) => void;
}) {
  const columns: Column<PriceChangeView>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (it) => (
        <div className="min-w-0">
          <Link
            to={productPath(it.sku)}
            className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
          >
            {it.skuName || it.sku}
          </Link>
          <p className="text-[11px] text-slate-400">
            {it.sku}
            {it.categoryId ? (
              <>
                {" · "}
                <Link
                  to={categoryPath(it.categoryId)}
                  className="hover:text-brand-700 hover:underline"
                >
                  {it.categoryId}
                </Link>
              </>
            ) : null}
          </p>
        </div>
      ),
    },
    {
      key: "proveedor",
      header: "Proveedor",
      hideOnMobile: true,
      render: (it) =>
        it.supplierRef ? (
          <Link
            to={supplierPath(it.supplierRef)}
            className="text-sm text-brand-600 hover:text-brand-700 hover:underline"
          >
            {it.supplierRef}
          </Link>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        ),
    },
    {
      key: "costo",
      header: "Costo anterior → actual",
      align: "right",
      sortable: true,
      sortValue: (it) => it.deltaPct,
      render: (it) => {
        const isAlza = it.deltaPct > 0;
        const isBaja = it.deltaPct < 0;
        return (
          <div className="whitespace-nowrap">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[11px] text-slate-400 line-through">
                {formatCurrency(it.previousCostClp)}
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {formatCurrency(it.currentCostClp)}
              </span>
            </div>
            <Badge tone={isAlza ? "red" : isBaja ? "green" : "neutral"} className="mt-0.5">
              {isAlza ? (
                <IconArrowUp className="w-3 h-3" />
              ) : isBaja ? (
                <IconArrowDown className="w-3 h-3" />
              ) : null}
              {it.deltaPct === 0 ? "Sin cambio" : formatDelta(it.deltaPct)}
            </Badge>
            <p className="text-[11px] text-slate-400">{fmtDate(it.currentAt)}</p>
          </div>
        );
      },
    },
    {
      key: "acordado",
      header: "Costo acordado",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (it) => it.agreedUnitCostClp ?? Number.NEGATIVE_INFINITY,
      render: (it) => {
        if (it.agreedUnitCostClp == null) {
          return <span className="text-sm text-slate-400">—</span>;
        }
        const overAgreement = it.currentCostClp > it.agreedUnitCostClp;
        const underAgreement = it.currentCostClp < it.agreedUnitCostClp;
        return (
          <div className="whitespace-nowrap">
            <span className="text-sm font-medium text-slate-700">
              {formatCurrency(it.agreedUnitCostClp)}
            </span>
            {overAgreement && (
              <p className="text-[11px] text-rose-500">Actual sobre lo acordado</p>
            )}
            {underAgreement && (
              <p className="text-[11px] text-emerald-600">Actual bajo lo acordado</p>
            )}
          </div>
        );
      },
    },
    {
      key: "oc",
      header: "Última OC",
      align: "right",
      hideOnMobile: true,
      render: (it) => (
        <div className="whitespace-nowrap text-right">
          <span className="text-sm text-slate-700">{it.currentPoNumber || "—"}</span>
          <p className="text-[11px] text-slate-400">
            {it.purchasesInWindow} compra{it.purchasesInWindow === 1 ? "" : "s"} en la ventana
          </p>
        </div>
      ),
    },
  ];

  const mobileCard = (it: PriceChangeView) => {
    const isAlza = it.deltaPct > 0;
    const isBaja = it.deltaPct < 0;
    return (
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={productPath(it.sku)}
              className="block truncate text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
            >
              {it.skuName || it.sku}
            </Link>
            <p className="text-[11px] text-slate-400">
              {it.sku} · {it.supplierRef || "—"}
            </p>
          </div>
          <Badge tone={isAlza ? "red" : isBaja ? "green" : "neutral"}>
            {it.deltaPct === 0 ? "Sin cambio" : formatDelta(it.deltaPct)}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Costo</span>
          <span>
            <span className="text-slate-400 line-through">{formatCurrency(it.previousCostClp)}</span>{" "}
            <b className="text-slate-800">{formatCurrency(it.currentCostClp)}</b>
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Acordado</span>
          <span className="text-slate-700">
            {it.agreedUnitCostClp == null ? "—" : formatCurrency(it.agreedUnitCostClp)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Última OC</span>
          <span className="text-slate-700">{it.currentPoNumber || "—"}</span>
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <DataTable
        columns={columns}
        data={items}
        rowKey={(it) => `${it.sku}-${it.supplierRef}`}
        sort={sort}
        onSortChange={onSortChange}
        rowClassName={(it) => (it.deltaPct > 0 ? "bg-rose-50/40" : undefined)}
        emptyMessage="No hay cambios de costo con estos filtros."
        mobileCard={mobileCard}
      />
    </Card>
  );
}

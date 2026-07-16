import type { Dispatch, SetStateAction } from "react";
import { Card, CardHeader } from "../../components/ui/Card";
import { KpiCard } from "../../components/business/KpiCard";
import { DataTable, type Column, type SortState } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { StatusBadge } from "../../components/business/StatusBadge";
import { HelpNote } from "../../components/business/HelpNote";
import { ExportButton } from "../../components/business/ExportButton";
import { IconOrders, IconCart, IconAlerts } from "../../components/ui/icons";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatDate,
} from "../../utils/formatters";
import {
  makeToggleSort,
  type BuyerBuyRow,
  type CategoryBuyRow,
  type OpenOrderRow,
  type SupplierBuyRow,
} from "./definitions";
import { buyerCsv, categoryCsv, openCsv, supplierCsv } from "./csv";

/** 1 · Compras por proveedor: monto por proveedor, Nº OC y monto promedio. */
export function SupplierBuyReport({
  rows,
  sort,
  setSort,
}: {
  rows: SupplierBuyRow[];
  sort: SortState;
  setSort: Dispatch<SetStateAction<SortState>>;
}) {
  const columns: Column<SupplierBuyRow>[] = [
    {
      key: "name",
      header: "Proveedor",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => <span className="font-medium text-slate-800">{r.name}</span>,
    },
    {
      key: "orders",
      header: "Nº OC",
      align: "right",
      sortable: true,
      sortValue: (r) => r.orderCount,
      render: (r) => formatNumber(r.orderCount),
    },
    {
      key: "total",
      header: "Monto comprado",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total,
      render: (r) => <span className="font-semibold text-slate-900">{formatCurrency(r.total)}</span>,
    },
    {
      key: "avg",
      header: "Monto prom. OC",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.avg,
      render: (r) => <span className="text-slate-700">{formatCurrency(r.avg)}</span>,
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Compras por proveedor"
        description="Suma del monto de las OC por proveedor, número de OC y monto promedio."
        action={<ExportButton filename="compras-por-proveedor" rows={rows} columns={supplierCsv} />}
      />
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.name}
        sort={sort}
        onSortChange={makeToggleSort(setSort)}
        emptyMessage="No hay OC para los filtros actuales."
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">{r.name}</p>
              <p className="text-xs text-slate-500">
                {formatNumber(r.orderCount)} OC · prom. {formatCurrencyCompact(r.avg)}
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
              {formatCurrencyCompact(r.total)}
            </span>
          </div>
        )}
      />
    </Card>
  );
}

/** 2 · Compras por categoría: derivado de las líneas de OC unidas al producto. */
export function CategoryBuyReport({
  rows,
  sort,
  setSort,
  ordersWithLines,
  scopedOrdersCount,
}: {
  rows: CategoryBuyRow[];
  sort: SortState;
  setSort: Dispatch<SetStateAction<SortState>>;
  ordersWithLines: number;
  scopedOrdersCount: number;
}) {
  const columns: Column<CategoryBuyRow>[] = [
    {
      key: "category",
      header: "Categoría",
      sortable: true,
      sortValue: (r) => r.category,
      render: (r) => <span className="font-medium text-slate-800">{r.category}</span>,
    },
    {
      key: "lines",
      header: "Nº líneas",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.lines,
      render: (r) => formatNumber(r.lines),
    },
    {
      key: "units",
      header: "Unidades",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.units,
      render: (r) => formatNumber(r.units),
    },
    {
      key: "total",
      header: "Monto comprado",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total,
      render: (r) => <span className="font-semibold text-slate-900">{formatCurrency(r.total)}</span>,
    },
  ];
  return (
    <div className="space-y-4">
      <HelpNote title="Cómo se calcula:">
        Las OC no guardan categoría. Este reporte une cada <b>línea de OC</b> con su producto (por
        SKU) y suma <b>cantidad × costo unitario</b> agrupando por la categoría del producto. Solo
        aportan las OC con detalle de líneas: <b>{ordersWithLines}</b> de {scopedOrdersCount} OC en
        el rango tienen líneas; el resto no se puede desglosar por categoría.
      </HelpNote>
      <Card>
        <CardHeader
          title="Compras por categoría"
          description="Monto comprado por categoría, derivado de las líneas de OC unidas al producto."
          action={
            <ExportButton filename="compras-por-categoria" rows={rows} columns={categoryCsv} />
          }
        />
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.category}
          sort={sort}
          onSortChange={makeToggleSort(setSort)}
          emptyMessage="No hay líneas de OC para desglosar por categoría en el rango."
          mobileCard={(r) => (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 truncate">{r.category}</p>
                <p className="text-xs text-slate-500">
                  {formatNumber(r.lines)} líneas · {formatNumber(r.units)} u.
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                {formatCurrencyCompact(r.total)}
              </span>
            </div>
          )}
        />
      </Card>
    </div>
  );
}

/** 3 · Compras por comprador: monto y Nº OC por comprador responsable. */
export function BuyerBuyReport({
  rows,
  sort,
  setSort,
}: {
  rows: BuyerBuyRow[];
  sort: SortState;
  setSort: Dispatch<SetStateAction<SortState>>;
}) {
  const columns: Column<BuyerBuyRow>[] = [
    {
      key: "name",
      header: "Comprador",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => <span className="font-medium text-slate-800">{r.name}</span>,
    },
    {
      key: "orders",
      header: "Nº OC",
      align: "right",
      sortable: true,
      sortValue: (r) => r.orderCount,
      render: (r) => formatNumber(r.orderCount),
    },
    {
      key: "total",
      header: "Monto comprado",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total,
      render: (r) => <span className="font-semibold text-slate-900">{formatCurrency(r.total)}</span>,
    },
    {
      key: "avg",
      header: "Monto prom. OC",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.avg,
      render: (r) => <span className="text-slate-700">{formatCurrency(r.avg)}</span>,
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Compras por comprador"
        description="Monto y número de OC por comprador responsable."
        action={<ExportButton filename="compras-por-comprador" rows={rows} columns={buyerCsv} />}
      />
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.name}
        sort={sort}
        onSortChange={makeToggleSort(setSort)}
        emptyMessage="No hay OC para los filtros actuales."
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">{r.name}</p>
              <p className="text-xs text-slate-500">
                {formatNumber(r.orderCount)} OC · prom. {formatCurrencyCompact(r.avg)}
              </p>
            </div>
            <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
              {formatCurrencyCompact(r.total)}
            </span>
          </div>
        )}
      />
    </Card>
  );
}

/** 4 · OC abiertas y atrasadas: órdenes en curso, con marca de atraso. */
export function OpenOrdersReport({
  rows,
  sort,
  setSort,
  delayedCount,
  pendingAmount,
}: {
  rows: OpenOrderRow[];
  sort: SortState;
  setSort: Dispatch<SetStateAction<SortState>>;
  delayedCount: number;
  pendingAmount: number;
}) {
  const columns: Column<OpenOrderRow>[] = [
    {
      key: "number",
      header: "OC",
      sortable: true,
      sortValue: (r) => r.order.number,
      render: (r) => <span className="font-mono text-xs text-slate-700">{r.order.number}</span>,
    },
    {
      key: "supplier",
      header: "Proveedor",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.order.supplierName,
      render: (r) => <span className="text-slate-700">{r.order.supplierName}</span>,
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      sortValue: (r) => r.order.status,
      render: (r) => <StatusBadge kind="purchaseOrder" value={r.order.status} />,
    },
    {
      key: "expected",
      header: "Fecha esperada",
      align: "right",
      sortable: true,
      sortValue: (r) => r.order.expectedDate,
      render: (r) => <span className="text-slate-700">{formatDate(r.order.expectedDate)}</span>,
    },
    {
      key: "delay",
      header: "Atraso",
      align: "right",
      sortable: true,
      sortValue: (r) => (r.delayed ? Math.max(r.order.delayedDays, -r.daysToExpected, 1) : 0),
      render: (r) =>
        r.delayed ? (
          <Badge tone="red" dot>
            {r.order.delayedDays > 0 ? `${formatNumber(r.order.delayedDays)} d` : "Vencida"}
          </Badge>
        ) : (
          <span className="text-xs text-emerald-600">En plazo</span>
        ),
    },
    {
      key: "amount",
      header: "Monto",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.order.totalAmount,
      render: (r) => (
        <span className="font-semibold text-slate-900">{formatCurrency(r.order.totalAmount)}</span>
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard
          title="OC abiertas"
          value={formatNumber(rows.length)}
          tone="info"
          icon={<IconOrders className="w-4 h-4" />}
          description="En curso, no cerradas"
        />
        <KpiCard
          title="OC atrasadas"
          value={formatNumber(delayedCount)}
          tone={delayedCount ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="Vencidas o marcadas"
        />
        <KpiCard
          title="Monto pendiente"
          value={formatCurrencyCompact(pendingAmount)}
          tone="warn"
          icon={<IconCart className="w-4 h-4" />}
          description="En OC abiertas"
        />
      </div>
      <Card>
        <CardHeader
          title="OC abiertas y atrasadas"
          description="Órdenes en curso con su fecha esperada; se marcan las atrasadas (vencidas respecto a hoy o en estado atrasado)."
          action={<ExportButton filename="oc-abiertas-atrasadas" rows={rows} columns={openCsv} />}
        />
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.order.id}
          sort={sort}
          onSortChange={makeToggleSort(setSort)}
          rowClassName={(r) => (r.delayed ? "bg-rose-50/40" : undefined)}
          emptyMessage="No hay OC abiertas para los filtros actuales."
          mobileCard={(r) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-700">{r.order.number}</p>
                  <p className="text-sm text-slate-800 truncate">{r.order.supplierName}</p>
                </div>
                <StatusBadge kind="purchaseOrder" value={r.order.status} />
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5 text-xs text-slate-500">
                <span>Esperada {formatDate(r.order.expectedDate)}</span>
                {r.delayed && (
                  <Badge tone="red" dot>
                    {r.order.delayedDays > 0 ? `${r.order.delayedDays} d` : "Vencida"}
                  </Badge>
                )}
                <span className="font-semibold text-slate-900">
                  {formatCurrencyCompact(r.order.totalAmount)}
                </span>
              </div>
            </div>
          )}
        />
      </Card>
    </div>
  );
}

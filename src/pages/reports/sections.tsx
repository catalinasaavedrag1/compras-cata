import type { Dispatch, SetStateAction } from "react";
import { Card, CardHeader } from "../../components/ui/Card";
import { KpiCard } from "../../components/business/KpiCard";
import { DataTable, type Column, type SortState } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { StatusBadge } from "../../components/business/StatusBadge";
import { HelpNote } from "../../components/business/HelpNote";
import { ExportButton } from "../../components/business/ExportButton";
import { IconOrders, IconCart, IconAlerts, IconBox } from "../../components/ui/icons";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
  formatDays,
  formatDate,
} from "../../utils/formatters";
import type { Product, Supplier } from "../../types/purchasing";
import {
  makeToggleSort,
  type BuyerBuyRow,
  type CategoryBuyRow,
  type CategoryMarginRow,
  type OpenOrderRow,
  type ProductAlertRow,
  type SupplierBuyRow,
} from "./definitions";
import {
  alertCsv,
  buyerCsv,
  categoryCsv,
  marginCsv,
  openCsv,
  perfCsv,
  rotationCsv,
  supplierCsv,
} from "./csv";

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

/** 5 · Rotación y días de inventario por producto. */
export function RotationReport({
  rows,
  sort,
  setSort,
}: {
  rows: Product[];
  sort: SortState;
  setSort: Dispatch<SetStateAction<SortState>>;
}) {
  const columns: Column<Product>[] = [
    {
      key: "product",
      header: "Producto",
      sortable: true,
      sortValue: (p) => p.name,
      render: (p) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-slate-800 leading-snug">{p.name}</p>
          <p className="text-xs font-mono text-slate-400">{p.sku}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoría",
      hideOnMobile: true,
      sortable: true,
      sortValue: (p) => p.category,
      render: (p) => <span className="text-sm text-slate-600">{p.category}</span>,
    },
    {
      key: "rotation",
      header: "Rotación (año)",
      align: "right",
      sortable: true,
      sortValue: (p) => p.rotation,
      render: (p) => (
        <span className="font-semibold text-slate-900">
          {p.rotation.toLocaleString("es-CL", { maximumFractionDigits: 1 })}
        </span>
      ),
    },
    {
      key: "inventoryDays",
      header: "Días inventario",
      align: "right",
      sortable: true,
      sortValue: (p) => p.inventoryDays,
      render: (p) => (
        <span className={p.inventoryDays >= 180 ? "text-amber-600 font-medium" : "text-slate-700"}>
          {p.inventoryDays >= 999 ? "+999 d" : formatDays(p.inventoryDays)}
        </span>
      ),
    },
    {
      key: "stock",
      header: "Stock disp.",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (p) => p.availableStock,
      render: (p) => <span className="text-slate-700">{formatNumber(p.availableStock)}</span>,
    },
    {
      key: "sales",
      header: "Venta 30d",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (p) => p.salesLast30Days,
      render: (p) => <span className="text-slate-700">{formatNumber(p.salesLast30Days)}</span>,
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Rotación y días de inventario por producto"
        description="Ordena por rotación o días de inventario para ver top/bottom: lo que más gira y lo que está detenido."
        action={<ExportButton filename="rotacion-inventario" rows={rows} columns={rotationCsv} />}
      />
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(p) => p.sku}
        sort={sort}
        onSortChange={makeToggleSort(setSort)}
        mobileCard={(p) => (
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 truncate">{p.name}</p>
                <p className="text-xs text-slate-500">{p.category}</p>
              </div>
              <span className="text-sm font-semibold text-slate-900 flex-shrink-0">
                {p.rotation.toLocaleString("es-CL", { maximumFractionDigits: 1 })}x
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {p.inventoryDays >= 999 ? "+999 d" : formatDays(p.inventoryDays)} de inventario · vende{" "}
              {formatNumber(p.salesLast30Days)} u./mes
            </p>
          </div>
        )}
      />
    </Card>
  );
}

/** 6 · Margen por categoría: margen promedio y valor de inventario asociado. */
export function MarginReport({
  rows,
  sort,
  setSort,
}: {
  rows: CategoryMarginRow[];
  sort: SortState;
  setSort: Dispatch<SetStateAction<SortState>>;
}) {
  const columns: Column<CategoryMarginRow>[] = [
    {
      key: "category",
      header: "Categoría",
      sortable: true,
      sortValue: (r) => r.category,
      render: (r) => <span className="font-medium text-slate-800">{r.category}</span>,
    },
    {
      key: "skuCount",
      header: "Nº SKUs",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.skuCount,
      render: (r) => formatNumber(r.skuCount),
    },
    {
      key: "avgMargin",
      header: "Margen prom.",
      align: "right",
      sortable: true,
      sortValue: (r) => r.avgMargin,
      render: (r) => (
        <span
          className={
            r.avgMargin < 20 ? "text-amber-600 font-medium" : "text-slate-900 font-semibold"
          }
        >
          {formatPercent(r.avgMargin)}
        </span>
      ),
    },
    {
      key: "inventoryValue",
      header: "Valor inventario",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.inventoryValue,
      render: (r) => <span className="text-slate-700">{formatCurrency(r.inventoryValue)}</span>,
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Margen por categoría"
        description="Margen promedio de los productos de cada categoría y valor de inventario asociado."
        action={<ExportButton filename="margen-por-categoria" rows={rows} columns={marginCsv} />}
      />
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.category}
        sort={sort}
        onSortChange={makeToggleSort(setSort)}
        mobileCard={(r) => (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate">{r.category}</p>
              <p className="text-xs text-slate-500">
                {formatNumber(r.skuCount)} SKUs · inv. {formatCurrencyCompact(r.inventoryValue)}
              </p>
            </div>
            <span
              className={`text-sm font-semibold flex-shrink-0 ${r.avgMargin < 20 ? "text-amber-600" : "text-slate-900"}`}
            >
              {formatPercent(r.avgMargin)}
            </span>
          </div>
        )}
      />
    </Card>
  );
}

/** 7 · Productos sin venta y críticos: capital detenido y cobertura crítica. */
export function ProductAlertsReport({
  rows,
  sort,
  setSort,
  noSalesCount,
  criticalCount,
}: {
  rows: ProductAlertRow[];
  sort: SortState;
  setSort: Dispatch<SetStateAction<SortState>>;
  noSalesCount: number;
  criticalCount: number;
}) {
  const columns: Column<ProductAlertRow>[] = [
    {
      key: "product",
      header: "Producto",
      sortable: true,
      sortValue: (r) => r.product.name,
      render: (r) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-slate-800 leading-snug">{r.product.name}</p>
          <p className="text-xs font-mono text-slate-400">
            {r.product.sku} · {r.product.category}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Motivo",
      sortable: true,
      sortValue: (r) => r.type,
      render: (r) => (
        <Badge tone={r.type === "sin_venta" ? "violet" : "red"} dot>
          {r.reasonLabel}
        </Badge>
      ),
    },
    {
      key: "stock",
      header: "Stock disp.",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.product.availableStock,
      render: (r) => <span className="text-slate-700">{formatNumber(r.product.availableStock)}</span>,
    },
    {
      key: "coverage",
      header: "Cobertura",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.coverage,
      render: (r) => (
        <span className="text-slate-700">
          {r.coverage >= 999 ? "+999 d" : formatDays(r.coverage)}
        </span>
      ),
    },
    {
      key: "frozen",
      header: "Capital detenido",
      align: "right",
      sortable: true,
      sortValue: (r) => r.frozenCapital,
      render: (r) => (
        <span className={r.frozenCapital > 0 ? "font-semibold text-rose-600" : "text-slate-400"}>
          {r.frozenCapital > 0 ? formatCurrency(r.frozenCapital) : "—"}
        </span>
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          title="Sin venta (30d)"
          value={formatNumber(noSalesCount)}
          tone={noSalesCount ? "warn" : "good"}
          icon={<IconBox className="w-4 h-4" />}
          description="Con stock detenido"
        />
        <KpiCard
          title="Críticos"
          value={formatNumber(criticalCount)}
          tone={criticalCount ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="Cobertura ≤ lead time"
        />
      </div>
      <Card>
        <CardHeader
          title="Productos sin venta y críticos"
          description="Sin venta: 0 ventas en 30 días con stock (capital detenido). Críticos: con venta pero cobertura por debajo del lead time del proveedor."
          action={
            <ExportButton filename="productos-sin-venta-criticos" rows={rows} columns={alertCsv} />
          }
        />
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.product.sku}
          sort={sort}
          onSortChange={makeToggleSort(setSort)}
          emptyMessage="No hay productos sin venta ni críticos."
          mobileCard={(r) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{r.product.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.product.sku} · {r.product.category}
                  </p>
                </div>
                <Badge tone={r.type === "sin_venta" ? "violet" : "red"} dot>
                  {r.type === "sin_venta" ? "Sin venta" : "Crítico"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Stock {formatNumber(r.product.availableStock)} ·{" "}
                {r.coverage >= 999 ? "+999 d" : formatDays(r.coverage)}
                {r.frozenCapital > 0 && (
                  <span className="text-rose-600"> · {formatCurrencyCompact(r.frozenCapital)} detenido</span>
                )}
              </p>
            </div>
          )}
        />
      </Card>
    </div>
  );
}

/** 8 · Cumplimiento de proveedores: entrega, lead time, OC abiertas y pendiente. */
export function SupplierPerfReport({
  rows,
  sort,
  setSort,
}: {
  rows: Supplier[];
  sort: SortState;
  setSort: Dispatch<SetStateAction<SortState>>;
}) {
  const columns: Column<Supplier>[] = [
    {
      key: "name",
      header: "Proveedor",
      sortable: true,
      sortValue: (s) => s.name,
      render: (s) => <span className="font-medium text-slate-800">{s.name}</span>,
    },
    {
      key: "compliance",
      header: "Cumplimiento",
      align: "right",
      sortable: true,
      sortValue: (s) => s.deliveryCompliance,
      render: (s) => (
        <Badge
          tone={s.deliveryCompliance >= 85 ? "green" : s.deliveryCompliance >= 70 ? "amber" : "red"}
        >
          {formatPercent(s.deliveryCompliance, 0)}
        </Badge>
      ),
    },
    {
      key: "leadTime",
      header: "Lead time",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (s) => s.averageLeadTimeDays,
      render: (s) => <span className="text-slate-700">{formatDays(s.averageLeadTimeDays)}</span>,
    },
    {
      key: "openOc",
      header: "OC abiertas",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (s) => s.openPurchaseOrders,
      render: (s) => formatNumber(s.openPurchaseOrders),
    },
    {
      key: "pending",
      header: "Monto pendiente",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (s) => s.pendingAmount,
      render: (s) => <span className="text-slate-700">{formatCurrency(s.pendingAmount)}</span>,
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      sortValue: (s) => s.status,
      render: (s) => <StatusBadge kind="supplier" value={s.status} />,
    },
  ];
  return (
    <div className="space-y-4">
      <HelpNote title="Cómo leerlo:">
        Ordenado por <b>cumplimiento de entrega</b> ascendente: arriba quedan los proveedores con
        peor cumplimiento, candidatos a revisar o reemplazar. Verde ≥ 85%, ámbar 70–84%, rojo &lt;
        70%.
      </HelpNote>
      <Card>
        <CardHeader
          title="Cumplimiento de proveedores"
          description="Cumplimiento de entrega, lead time, OC abiertas y monto pendiente por proveedor."
          action={<ExportButton filename="cumplimiento-proveedores" rows={rows} columns={perfCsv} />}
        />
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(s) => s.id}
          sort={sort}
          onSortChange={makeToggleSort(setSort)}
          mobileCard={(s) => (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 truncate">{s.name}</p>
                <p className="text-xs text-slate-500">
                  Lead {formatDays(s.averageLeadTimeDays)} · {formatNumber(s.openPurchaseOrders)} OC
                  abiertas
                </p>
              </div>
              <Badge
                tone={
                  s.deliveryCompliance >= 85 ? "green" : s.deliveryCompliance >= 70 ? "amber" : "red"
                }
              >
                {formatPercent(s.deliveryCompliance, 0)}
              </Badge>
            </div>
          )}
        />
      </Card>
    </div>
  );
}

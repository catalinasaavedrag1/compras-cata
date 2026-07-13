import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, type Column, type SortState } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { StatusBadge } from "../components/business/StatusBadge";
import { HelpNote } from "../components/business/HelpNote";
import { ExportButton } from "../components/business/ExportButton";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { products, getProductBySku } from "../data/mockProducts";
import { suppliers } from "../data/mockSuppliers";
import { coverageDays } from "../utils/calculations";
import { inRange, type IsoRange } from "../utils/dateRange";
import { TODAY_ISO } from "../utils/constants";
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent, formatDays, formatDate } from "../utils/formatters";
import { IconOrders, IconCart, IconSuppliers, IconCategories, IconAlerts, IconBox } from "../components/ui/icons";
import type { Product } from "../types/purchasing";
import { daysBetween, makeToggleSort, OPEN_PO_STATUSES, REPORTS, type BuyerBuyRow, type CategoryBuyRow, type CategoryMarginRow, type OpenOrderRow, type ProductAlertRow, type ReportKey, type SupplierBuyRow } from "./reports/definitions";
import { ExportLauncher } from "./reports/ExportLauncher";
import { alertCsv, buyerCsv, categoryCsv, marginCsv, openCsv, perfCsv, rotationCsv, supplierCsv } from "./reports/csv";

// ============================================================================
//  #24 Reportes consolidados
//  Reportes operativos y estratégicos que la plataforma no tenía centralizados,
//  cada uno exportable a CSV. Todo se DERIVA de los datos mock existentes
//  (agregaciones en useMemo); no se inventan campos nuevos.
// ============================================================================

export function ReportsPage() {
  const [report, setReport] = useState<ReportKey>("compras_proveedor");
  // Filtro de fechas para los reportes con datos temporales (OC).
  const [range, setRange] = useState<IsoRange>({ from: "", to: "" });

  // Orden por reporte.
  const [supplierSort, setSupplierSort] = useState<SortState>({ key: "total", dir: "desc" });
  const [categorySort, setCategorySort] = useState<SortState>({ key: "total", dir: "desc" });
  const [buyerSort, setBuyerSort] = useState<SortState>({ key: "total", dir: "desc" });
  const [openSort, setOpenSort] = useState<SortState>({ key: "expected", dir: "asc" });
  const [rotationSort, setRotationSort] = useState<SortState>({ key: "rotation", dir: "asc" });
  const [marginSort, setMarginSort] = useState<SortState>({ key: "avgMargin", dir: "asc" });
  const [alertSort, setAlertSort] = useState<SortState>({ key: "frozen", dir: "desc" });
  const [perfSort, setPerfSort] = useState<SortState>({ key: "compliance", dir: "asc" });

  const dateScopesReport =
    report === "compras_proveedor" ||
    report === "compras_categoria" ||
    report === "compras_comprador" ||
    report === "oc_abiertas";

  // OC dentro del rango de fechas (por fecha de creación). Sin rango = todas.
  const scopedOrders = useMemo(
    () => purchaseOrders.filter((o) => inRange(o.createdAt, range)),
    [range]
  );

  // ---- KPIs globales (sobre las OC en alcance) ----
  const totalBought = useMemo(
    () => scopedOrders.reduce((acc, o) => acc + o.totalAmount, 0),
    [scopedOrders]
  );
  const distinctSuppliers = useMemo(
    () => new Set(scopedOrders.map((o) => o.supplierName)).size,
    [scopedOrders]
  );
  const distinctCategories = useMemo(
    () =>
      new Set(
        products.filter((p) => p.salesLast30Days > 0 || p.availableStock > 0).map((p) => p.category)
      ).size,
    []
  );

  // =====================================================================
  //  1. Compras por proveedor (suma totalAmount por supplierName)
  // =====================================================================
  const supplierRows = useMemo<SupplierBuyRow[]>(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const o of scopedOrders) {
      const cur = map.get(o.supplierName) ?? { total: 0, count: 0 };
      cur.total += o.totalAmount;
      cur.count += 1;
      map.set(o.supplierName, cur);
    }
    return Array.from(map.entries()).map(([name, v]) => ({
      name,
      orderCount: v.count,
      total: v.total,
      avg: v.count ? v.total / v.count : 0,
    }));
  }, [scopedOrders]);

  // =====================================================================
  //  2. Compras por categoría
  //  Las OC no traen categoría: se obtiene uniendo cada línea de OC con el
  //  producto (getProductBySku → category) y sumando quantity * unitCost.
  //  Solo las OC con detalle de líneas aportan a este reporte; las OC sin
  //  líneas no se pueden desglosar por categoría (se documenta en pantalla).
  // =====================================================================
  const categoryRows = useMemo<CategoryBuyRow[]>(() => {
    const map = new Map<string, { lines: number; units: number; total: number }>();
    for (const o of scopedOrders) {
      if (!o.lines) continue;
      for (const line of o.lines) {
        const prod = getProductBySku(line.sku);
        const category = prod?.category ?? "Sin categoría";
        const cur = map.get(category) ?? { lines: 0, units: 0, total: 0 };
        cur.lines += 1;
        cur.units += line.quantity;
        cur.total += line.quantity * line.unitCost;
        map.set(category, cur);
      }
    }
    return Array.from(map.entries()).map(([category, v]) => ({
      category,
      lines: v.lines,
      units: v.units,
      total: v.total,
    }));
  }, [scopedOrders]);

  const ordersWithLines = useMemo(
    () => scopedOrders.filter((o) => o.lines && o.lines.length > 0).length,
    [scopedOrders]
  );

  // =====================================================================
  //  3. Compras por comprador (por buyerName)
  // =====================================================================
  const buyerRows = useMemo<BuyerBuyRow[]>(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const o of scopedOrders) {
      const cur = map.get(o.buyerName) ?? { total: 0, count: 0 };
      cur.total += o.totalAmount;
      cur.count += 1;
      map.set(o.buyerName, cur);
    }
    return Array.from(map.entries()).map(([name, v]) => ({
      name,
      orderCount: v.count,
      total: v.total,
      avg: v.count ? v.total / v.count : 0,
    }));
  }, [scopedOrders]);

  // =====================================================================
  //  4. OC abiertas / atrasadas
  //  Abierta = estado en curso (no recibida/cerrada/cancelada).
  //  Atrasada = estado "delayed" o cuya fecha esperada ya pasó (vs hoy).
  // =====================================================================
  const openOrders = useMemo<OpenOrderRow[]>(() => {
    return scopedOrders
      .filter((o) => OPEN_PO_STATUSES.includes(o.status))
      .map((o) => {
        const daysToExpected = daysBetween(o.expectedDate, TODAY_ISO);
        const delayed = o.status === "delayed" || o.delayedDays > 0 || daysToExpected < 0;
        return { order: o, delayed, daysToExpected };
      });
  }, [scopedOrders]);

  const delayedCount = useMemo(() => openOrders.filter((o) => o.delayed).length, [openOrders]);
  const pendingAmount = useMemo(
    () => openOrders.reduce((acc, o) => acc + o.order.totalAmount, 0),
    [openOrders]
  );

  // =====================================================================
  //  5. Rotación y días de inventario por producto (desde mockProducts)
  // =====================================================================
  const rotationRows = useMemo(() => [...products], []);

  // =====================================================================
  //  6. Margen por categoría (promedio de productos agrupados por categoría)
  // =====================================================================
  const categoryMarginRows = useMemo<CategoryMarginRow[]>(() => {
    const map = new Map<string, { marginSum: number; count: number; invValue: number }>();
    for (const p of products) {
      const cur = map.get(p.category) ?? { marginSum: 0, count: 0, invValue: 0 };
      cur.marginSum += p.margin;
      cur.count += 1;
      cur.invValue += p.cost * p.availableStock;
      map.set(p.category, cur);
    }
    return Array.from(map.entries()).map(([category, v]) => ({
      category,
      skuCount: v.count,
      avgMargin: v.count ? v.marginSum / v.count : 0,
      inventoryValue: v.invValue,
    }));
  }, []);

  // =====================================================================
  //  7. Productos sin venta (0 ventas 30d con stock) y productos críticos
  //  (cobertura ≤ lead time, con venta). Usa coverageDays de calculations.
  // =====================================================================
  const productAlertRows = useMemo<ProductAlertRow[]>(() => {
    const rows: ProductAlertRow[] = [];
    for (const p of products) {
      const cover = coverageDays(p.availableStock, p.salesLast30Days);
      if (p.salesLast30Days === 0 && p.availableStock > 0) {
        rows.push({
          product: p,
          type: "sin_venta",
          reasonLabel: "Sin venta (30d) con stock",
          coverage: cover,
          frozenCapital: p.availableStock * p.cost,
        });
      } else if (p.salesLast30Days > 0 && cover <= p.supplierLeadTimeDays) {
        rows.push({
          product: p,
          type: "critico",
          reasonLabel: "Crítico (cobertura ≤ lead time)",
          coverage: cover,
          frozenCapital: 0,
        });
      }
    }
    return rows;
  }, []);

  const noSalesCount = useMemo(
    () => productAlertRows.filter((r) => r.type === "sin_venta").length,
    [productAlertRows]
  );
  const criticalCount = useMemo(
    () => productAlertRows.filter((r) => r.type === "critico").length,
    [productAlertRows]
  );

  // =====================================================================
  //  8. Peores proveedores por cumplimiento (deliveryCompliance ascendente)
  // =====================================================================
  const supplierPerfRows = useMemo(() => [...suppliers], []);

  // ====================== Columnas por reporte ==========================
  const supplierColumns: Column<SupplierBuyRow>[] = [
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
      render: (r) => (
        <span className="font-semibold text-slate-900">{formatCurrency(r.total)}</span>
      ),
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

  const categoryColumns: Column<CategoryBuyRow>[] = [
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
      render: (r) => (
        <span className="font-semibold text-slate-900">{formatCurrency(r.total)}</span>
      ),
    },
  ];

  const buyerColumns: Column<BuyerBuyRow>[] = [
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
      render: (r) => (
        <span className="font-semibold text-slate-900">{formatCurrency(r.total)}</span>
      ),
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

  const openColumns: Column<OpenOrderRow>[] = [
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

  const rotationColumns: Column<Product>[] = [
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

  const marginColumns: Column<CategoryMarginRow>[] = [
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

  const alertColumns: Column<ProductAlertRow>[] = [
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
      render: (r) => (
        <span className="text-slate-700">{formatNumber(r.product.availableStock)}</span>
      ),
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

  const perfColumns: Column<(typeof suppliers)[number]>[] = [
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
    <div>
      <PageHeader
        title="Reportes consolidados"
        description="Reportes operativos y estratégicos de compras, inventario y proveedores. Cada tabla se puede exportar a CSV (Excel)."
        action={
          <ExportLauncher
            report={report}
            supplierRows={supplierRows}
            categoryRows={categoryRows}
            buyerRows={buyerRows}
            openOrders={openOrders}
            rotationRows={rotationRows}
            categoryMarginRows={categoryMarginRows}
            productAlertRows={productAlertRows}
            supplierPerfRows={supplierPerfRows}
          />
        }
      />

      {/* KPIs resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Monto comprado"
          value={formatCurrencyCompact(totalBought)}
          tone="info"
          icon={<IconCart className="w-4 h-4" />}
          description={range.from || range.to ? "En el rango" : "Total OC"}
        />
        <KpiCard
          title="Órdenes de compra"
          value={formatNumber(scopedOrders.length)}
          tone="neutral"
          icon={<IconOrders className="w-4 h-4" />}
          description="OC en alcance"
        />
        <KpiCard
          title="Proveedores"
          value={formatNumber(distinctSuppliers)}
          tone="neutral"
          icon={<IconSuppliers className="w-4 h-4" />}
          description="Con compras"
        />
        <KpiCard
          title="Categorías activas"
          value={formatNumber(distinctCategories)}
          tone="neutral"
          icon={<IconCategories className="w-4 h-4" />}
          description="Con stock o venta"
        />
      </div>

      <div className="mb-4">
        <Tabs
          tabs={REPORTS.map((r) => ({ value: r.value, label: r.label }))}
          value={report}
          onChange={(v) => setReport(v as ReportKey)}
        />
      </div>

      {/* Filtro de fechas: solo en reportes con datos temporales (OC). */}
      {dateScopesReport && (
        <div className="mb-4">
          <FilterBar
            searchValue=""
            onSearchChange={() => {}}
            searchPlaceholder="Filtra por fecha de creación de la OC"
            dateRange={{ value: range, onChange: setRange, label: "Todas las fechas" }}
            onClear={() => setRange({ from: "", to: "" })}
            summary={`${scopedOrders.length} OC en el rango · monto ${formatCurrency(totalBought)}`}
          />
        </div>
      )}

      {/* =================== 1. Compras por proveedor =================== */}
      {report === "compras_proveedor" && (
        <Card>
          <CardHeader
            title="Compras por proveedor"
            description="Suma del monto de las OC por proveedor, número de OC y monto promedio."
            action={
              <ExportButton
                filename="compras-por-proveedor"
                rows={supplierRows}
                columns={supplierCsv}
              />
            }
          />
          <DataTable
            columns={supplierColumns}
            data={supplierRows}
            rowKey={(r) => r.name}
            sort={supplierSort}
            onSortChange={makeToggleSort(setSupplierSort)}
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
      )}

      {/* =================== 2. Compras por categoría =================== */}
      {report === "compras_categoria" && (
        <div className="space-y-4">
          <HelpNote title="Cómo se calcula:">
            Las OC no guardan categoría. Este reporte une cada <b>línea de OC</b> con su producto
            (por SKU) y suma <b>cantidad × costo unitario</b> agrupando por la categoría del
            producto. Solo aportan las OC con detalle de líneas: <b>{ordersWithLines}</b> de{" "}
            {scopedOrders.length} OC en el rango tienen líneas; el resto no se puede desglosar por
            categoría.
          </HelpNote>
          <Card>
            <CardHeader
              title="Compras por categoría"
              description="Monto comprado por categoría, derivado de las líneas de OC unidas al producto."
              action={
                <ExportButton
                  filename="compras-por-categoria"
                  rows={categoryRows}
                  columns={categoryCsv}
                />
              }
            />
            <DataTable
              columns={categoryColumns}
              data={categoryRows}
              rowKey={(r) => r.category}
              sort={categorySort}
              onSortChange={makeToggleSort(setCategorySort)}
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
      )}

      {/* =================== 3. Compras por comprador =================== */}
      {report === "compras_comprador" && (
        <Card>
          <CardHeader
            title="Compras por comprador"
            description="Monto y número de OC por comprador responsable."
            action={
              <ExportButton filename="compras-por-comprador" rows={buyerRows} columns={buyerCsv} />
            }
          />
          <DataTable
            columns={buyerColumns}
            data={buyerRows}
            rowKey={(r) => r.name}
            sort={buyerSort}
            onSortChange={makeToggleSort(setBuyerSort)}
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
      )}

      {/* =================== 4. OC abiertas / atrasadas =================== */}
      {report === "oc_abiertas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <KpiCard
              title="OC abiertas"
              value={formatNumber(openOrders.length)}
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
              action={
                <ExportButton
                  filename="oc-abiertas-atrasadas"
                  rows={openOrders}
                  columns={openCsv}
                />
              }
            />
            <DataTable
              columns={openColumns}
              data={openOrders}
              rowKey={(r) => r.order.id}
              sort={openSort}
              onSortChange={makeToggleSort(setOpenSort)}
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
      )}

      {/* =================== 5. Rotación e inventario =================== */}
      {report === "rotacion" && (
        <Card>
          <CardHeader
            title="Rotación y días de inventario por producto"
            description="Ordena por rotación o días de inventario para ver top/bottom: lo que más gira y lo que está detenido."
            action={
              <ExportButton
                filename="rotacion-inventario"
                rows={rotationRows}
                columns={rotationCsv}
              />
            }
          />
          <DataTable
            columns={rotationColumns}
            data={rotationRows}
            rowKey={(p) => p.sku}
            sort={rotationSort}
            onSortChange={makeToggleSort(setRotationSort)}
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
                  {p.inventoryDays >= 999 ? "+999 d" : formatDays(p.inventoryDays)} de inventario ·
                  vende {formatNumber(p.salesLast30Days)} u./mes
                </p>
              </div>
            )}
          />
        </Card>
      )}

      {/* =================== 6. Margen por categoría =================== */}
      {report === "margen_categoria" && (
        <Card>
          <CardHeader
            title="Margen por categoría"
            description="Margen promedio de los productos de cada categoría y valor de inventario asociado."
            action={
              <ExportButton
                filename="margen-por-categoria"
                rows={categoryMarginRows}
                columns={marginCsv}
              />
            }
          />
          <DataTable
            columns={marginColumns}
            data={categoryMarginRows}
            rowKey={(r) => r.category}
            sort={marginSort}
            onSortChange={makeToggleSort(setMarginSort)}
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
      )}

      {/* =================== 7. Productos sin venta / críticos =================== */}
      {report === "alertas_producto" && (
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
                <ExportButton
                  filename="productos-sin-venta-criticos"
                  rows={productAlertRows}
                  columns={alertCsv}
                />
              }
            />
            <DataTable
              columns={alertColumns}
              data={productAlertRows}
              rowKey={(r) => r.product.sku}
              sort={alertSort}
              onSortChange={makeToggleSort(setAlertSort)}
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
                      <span className="text-rose-600">
                        {" "}
                        · {formatCurrencyCompact(r.frozenCapital)} detenido
                      </span>
                    )}
                  </p>
                </div>
              )}
            />
          </Card>
        </div>
      )}

      {/* =================== 8. Cumplimiento de proveedores =================== */}
      {report === "peores_proveedores" && (
        <div className="space-y-4">
          <HelpNote title="Cómo leerlo:">
            Ordenado por <b>cumplimiento de entrega</b> ascendente: arriba quedan los proveedores
            con peor cumplimiento, candidatos a revisar o reemplazar. Verde ≥ 85%, ámbar 70–84%,
            rojo &lt; 70%.
          </HelpNote>
          <Card>
            <CardHeader
              title="Cumplimiento de proveedores"
              description="Cumplimiento de entrega, lead time, OC abiertas y monto pendiente por proveedor."
              action={
                <ExportButton
                  filename="cumplimiento-proveedores"
                  rows={supplierPerfRows}
                  columns={perfCsv}
                />
              }
            />
            <DataTable
              columns={perfColumns}
              data={supplierPerfRows}
              rowKey={(s) => s.id}
              sort={perfSort}
              onSortChange={makeToggleSort(setPerfSort)}
              mobileCard={(s) => (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      Lead {formatDays(s.averageLeadTimeDays)} ·{" "}
                      {formatNumber(s.openPurchaseOrders)} OC abiertas
                    </p>
                  </div>
                  <Badge
                    tone={
                      s.deliveryCompliance >= 85
                        ? "green"
                        : s.deliveryCompliance >= 70
                          ? "amber"
                          : "red"
                    }
                  >
                    {formatPercent(s.deliveryCompliance, 0)}
                  </Badge>
                </div>
              )}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================================
//  Columnas CSV por reporte (label + value).
// ============================================================================

import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/business/KpiCard";
import { type SortState } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { Tabs } from "../components/ui/Tabs";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { products, getProductBySku } from "../data/mockProducts";
import { suppliers } from "../data/mockSuppliers";
import { coverageDays } from "../utils/calculations";
import { inRange, type IsoRange } from "../utils/dateRange";
import { TODAY_ISO } from "../utils/constants";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../utils/formatters";
import { IconOrders, IconCart, IconSuppliers, IconCategories } from "../components/ui/icons";
import { daysBetween, OPEN_PO_STATUSES, REPORTS, type BuyerBuyRow, type CategoryBuyRow, type CategoryMarginRow, type OpenOrderRow, type ProductAlertRow, type ReportKey, type SupplierBuyRow } from "./reports/definitions";
import { ExportLauncher } from "./reports/ExportLauncher";
import {
  SupplierBuyReport,
  CategoryBuyReport,
  BuyerBuyReport,
  OpenOrdersReport,
  RotationReport,
  MarginReport,
  ProductAlertsReport,
  SupplierPerfReport,
} from "./reports/sections";

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
        <SupplierBuyReport rows={supplierRows} sort={supplierSort} setSort={setSupplierSort} />
      )}

      {/* =================== 2. Compras por categoría =================== */}
      {report === "compras_categoria" && (
        <CategoryBuyReport
          rows={categoryRows}
          sort={categorySort}
          setSort={setCategorySort}
          ordersWithLines={ordersWithLines}
          scopedOrdersCount={scopedOrders.length}
        />
      )}

      {/* =================== 3. Compras por comprador =================== */}
      {report === "compras_comprador" && (
        <BuyerBuyReport rows={buyerRows} sort={buyerSort} setSort={setBuyerSort} />
      )}

      {/* =================== 4. OC abiertas / atrasadas =================== */}
      {report === "oc_abiertas" && (
        <OpenOrdersReport
          rows={openOrders}
          sort={openSort}
          setSort={setOpenSort}
          delayedCount={delayedCount}
          pendingAmount={pendingAmount}
        />
      )}

      {/* =================== 5. Rotación e inventario =================== */}
      {report === "rotacion" && (
        <RotationReport rows={rotationRows} sort={rotationSort} setSort={setRotationSort} />
      )}

      {/* =================== 6. Margen por categoría =================== */}
      {report === "margen_categoria" && (
        <MarginReport rows={categoryMarginRows} sort={marginSort} setSort={setMarginSort} />
      )}

      {/* =================== 7. Productos sin venta / críticos =================== */}
      {report === "alertas_producto" && (
        <ProductAlertsReport
          rows={productAlertRows}
          sort={alertSort}
          setSort={setAlertSort}
          noSalesCount={noSalesCount}
          criticalCount={criticalCount}
        />
      )}

      {/* =================== 8. Cumplimiento de proveedores =================== */}
      {report === "peores_proveedores" && (
        <SupplierPerfReport rows={supplierPerfRows} sort={perfSort} setSort={setPerfSort} />
      )}
    </div>
  );
}

// ============================================================================
//  Columnas CSV por reporte (label + value).
// ============================================================================

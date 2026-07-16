import { suppliers } from "../../data/mockSuppliers";
import type { Product } from "../../types/purchasing";
import type { BuyerBuyRow, CategoryBuyRow, CategoryMarginRow, OpenOrderRow, ProductAlertRow, SupplierBuyRow } from "./definitions";

export const supplierCsv = [
  { label: "Proveedor", value: (r: SupplierBuyRow) => r.name },
  { label: "Nº OC", value: (r: SupplierBuyRow) => r.orderCount },
  { label: "Monto comprado", value: (r: SupplierBuyRow) => r.total },
  { label: "Monto promedio OC", value: (r: SupplierBuyRow) => Math.round(r.avg) },
];

export const categoryCsv = [
  { label: "Categoría", value: (r: CategoryBuyRow) => r.category },
  { label: "Nº líneas", value: (r: CategoryBuyRow) => r.lines },
  { label: "Unidades", value: (r: CategoryBuyRow) => r.units },
  { label: "Monto comprado", value: (r: CategoryBuyRow) => r.total },
];

export const buyerCsv = [
  { label: "Comprador", value: (r: BuyerBuyRow) => r.name },
  { label: "Nº OC", value: (r: BuyerBuyRow) => r.orderCount },
  { label: "Monto comprado", value: (r: BuyerBuyRow) => r.total },
  { label: "Monto promedio OC", value: (r: BuyerBuyRow) => Math.round(r.avg) },
];

export const openCsv = [
  { label: "OC", value: (r: OpenOrderRow) => r.order.number },
  { label: "Proveedor", value: (r: OpenOrderRow) => r.order.supplierName },
  { label: "Comprador", value: (r: OpenOrderRow) => r.order.buyerName },
  { label: "Estado", value: (r: OpenOrderRow) => r.order.status },
  { label: "Fecha creación", value: (r: OpenOrderRow) => r.order.createdAt },
  { label: "Fecha esperada", value: (r: OpenOrderRow) => r.order.expectedDate },
  { label: "Atrasada", value: (r: OpenOrderRow) => (r.delayed ? "Sí" : "No") },
  { label: "Días de atraso", value: (r: OpenOrderRow) => r.order.delayedDays },
  { label: "Monto", value: (r: OpenOrderRow) => r.order.totalAmount },
];

export const rotationCsv = [
  { label: "SKU", value: (p: Product) => p.sku },
  { label: "Producto", value: (p: Product) => p.name },
  { label: "Categoría", value: (p: Product) => p.category },
  { label: "Rotación (año)", value: (p: Product) => p.rotation },
  { label: "Días inventario", value: (p: Product) => p.inventoryDays },
  { label: "Stock disponible", value: (p: Product) => p.availableStock },
  { label: "Venta 30d", value: (p: Product) => p.salesLast30Days },
];

export const marginCsv = [
  { label: "Categoría", value: (r: CategoryMarginRow) => r.category },
  { label: "Nº SKUs", value: (r: CategoryMarginRow) => r.skuCount },
  {
    label: "Margen promedio %",
    value: (r: CategoryMarginRow) => Math.round(r.avgMargin * 10) / 10,
  },
  { label: "Valor inventario", value: (r: CategoryMarginRow) => Math.round(r.inventoryValue) },
];

export const alertCsv = [
  { label: "SKU", value: (r: ProductAlertRow) => r.product.sku },
  { label: "Producto", value: (r: ProductAlertRow) => r.product.name },
  { label: "Categoría", value: (r: ProductAlertRow) => r.product.category },
  { label: "Motivo", value: (r: ProductAlertRow) => r.reasonLabel },
  { label: "Stock disponible", value: (r: ProductAlertRow) => r.product.availableStock },
  { label: "Cobertura (días)", value: (r: ProductAlertRow) => r.coverage },
  { label: "Capital detenido", value: (r: ProductAlertRow) => Math.round(r.frozenCapital) },
];

export const perfCsv = [
  { label: "Proveedor", value: (s: (typeof suppliers)[number]) => s.name },
  { label: "Cumplimiento %", value: (s: (typeof suppliers)[number]) => s.deliveryCompliance },
  { label: "Lead time (días)", value: (s: (typeof suppliers)[number]) => s.averageLeadTimeDays },
  { label: "OC abiertas", value: (s: (typeof suppliers)[number]) => s.openPurchaseOrders },
  { label: "Monto pendiente", value: (s: (typeof suppliers)[number]) => s.pendingAmount },
  { label: "Estado", value: (s: (typeof suppliers)[number]) => s.status },
];

import type { Dispatch, SetStateAction } from "react";
import type { SortState } from "../../components/ui/Table";
import type { PurchaseOrder, PurchaseOrderStatus, Product } from "../../types/purchasing";

export type ReportKey =
  | "compras_proveedor"
  | "compras_categoria"
  | "compras_comprador"
  | "oc_abiertas"
  | "rotacion"
  | "margen_categoria"
  | "alertas_producto"
  | "peores_proveedores";

export const REPORTS: { value: ReportKey; label: string }[] = [
  { value: "compras_proveedor", label: "Compras por proveedor" },
  { value: "compras_categoria", label: "Compras por categoría" },
  { value: "compras_comprador", label: "Compras por comprador" },
  { value: "oc_abiertas", label: "OC abiertas / atrasadas" },
  { value: "rotacion", label: "Rotación e inventario" },
  { value: "margen_categoria", label: "Margen por categoría" },
  { value: "alertas_producto", label: "Productos sin venta / críticos" },
  { value: "peores_proveedores", label: "Cumplimiento de proveedores" },
];

// Estados de OC que consideramos "abiertas" (en curso, aún no cerradas).
export const OPEN_PO_STATUSES: PurchaseOrderStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "confirmed",
  "partially_received",
  "with_difference",
  "delayed",
];

// --- Filas agregadas ---
export interface SupplierBuyRow {
  name: string;
  orderCount: number;
  total: number;
  avg: number;
}

export interface CategoryBuyRow {
  category: string;
  lines: number;
  units: number;
  total: number;
}

export interface BuyerBuyRow {
  name: string;
  orderCount: number;
  total: number;
  avg: number;
}

export interface OpenOrderRow {
  order: PurchaseOrder;
  delayed: boolean;
  daysToExpected: number; // negativo = atrasado respecto a hoy
}

export interface CategoryMarginRow {
  category: string;
  skuCount: number;
  avgMargin: number;
  inventoryValue: number;
}

export interface ProductAlertRow {
  product: Product;
  type: "sin_venta" | "critico";
  reasonLabel: string;
  coverage: number;
  frozenCapital: number;
}

// Diferencia en días entre dos fechas ISO (a - b), en horario local.
export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00`).getTime();
  const b = new Date(`${bIso}T00:00:00`).getTime();
  return Math.round((a - b) / 86_400_000);
}

// Alterna la dirección de orden de una columna (desc por defecto).
export function makeToggleSort(setter: Dispatch<SetStateAction<SortState>>) {
  return (key: string) =>
    setter((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
}


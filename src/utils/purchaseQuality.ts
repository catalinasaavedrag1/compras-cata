import { DEFAULT_TARGET_COVERAGE_DAYS } from "./constants";

// ============================================================================
//  Calidad de compra (sección 3 del spec) sobre datos REALES.
//  Mide si el surtido está bien cubierto: la cobertura actual de cada SKU
//  (stock ÷ venta diaria, que entrega el motor) frente al rango objetivo de la
//  regla de compra aplicable. Clasifica cada SKU en corta / saludable / alta /
//  sobrecompra. Sin venta reciente no se puede evaluar ("sin_venta").
// ============================================================================

export type PurchaseClass = "corta" | "saludable" | "alta" | "sobrecompra" | "sin_venta";

export const PURCHASE_CLASS: Record<
  PurchaseClass,
  { label: string; tone: "red" | "green" | "amber" | "violet" | "neutral" }
> = {
  corta: { label: "Cobertura corta", tone: "red" },
  saludable: { label: "Saludable", tone: "green" },
  alta: { label: "Cobertura alta", tone: "amber" },
  sobrecompra: { label: "Sobrestock", tone: "violet" },
  sin_venta: { label: "Sin venta", tone: "neutral" },
};

export interface PurchaseQualityLine {
  sku: string;
  productName: string;
  supplierName: string;
  categoryName: string;
  /** Stock disponible real (u.). null = sin dato. */
  stockUnits: number | null;
  /** Valor del stock a costo (CLP). null = sin costo. */
  stockValueClp: number | null;
  /** Venta diaria estimada (venta 30d ÷ 30). */
  dailyDemand: number | null;
  /** Cobertura actual real (días). null = sin venta / sin dato. */
  coverageDays: number | null;
  objMin: number;
  objMax: number;
  klass: PurchaseClass;
}

/** Rango objetivo ±30% en torno a la cobertura objetivo de la regla. */
export function targetRange(targetDays: number): { objMin: number; objMax: number } {
  return { objMin: Math.round(targetDays * 0.7), objMax: Math.round(targetDays * 1.3) };
}

/** Clasifica la cobertura real frente al rango objetivo. */
export function classifyCoverage(
  coverageDays: number | null,
  dailyDemand: number | null,
  objMin: number,
  objMax: number
): PurchaseClass {
  if (dailyDemand == null || dailyDemand <= 0 || coverageDays == null) return "sin_venta";
  if (coverageDays < objMin) return "corta";
  if (coverageDays <= objMax) return "saludable";
  if (coverageDays <= objMax * 1.8) return "alta";
  return "sobrecompra";
}

export const DEFAULT_TARGET_COVERAGE = DEFAULT_TARGET_COVERAGE_DAYS;

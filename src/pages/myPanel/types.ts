import type { Product, Supplier } from "../../types/purchasing";

// ============================================================================
//  Tipos de la vista "Mi cartera" (Inicio del comprador).
//  Filas y agrupaciones derivadas de la cartera para el resumen ejecutivo,
//  productos clave, marcas, proveedores y oportunidades.
// ============================================================================

export interface RiskRow {
  product: Product;
  coverage: number;
  stockoutDate: string | null;
  suggestedQty: number;
  coverageAfter: number;
}

export interface SalesPaceRow {
  product: Product;
  expected30: number;
  diffUnits: number;
  diffPct: number;
  coverage: number;
}

export type PortfolioProductRole =
  | "Estrella"
  | "Tractor"
  | "Margen"
  | "Emergente"
  | "Deterioro"
  | "Detenido"
  | "Riesgo";

export interface KeyProductRow {
  product: Product;
  role: PortfolioProductRole;
  salesValue: number;
  grossProfit: number;
  gmroi: number;
  growthPct: number;
  coverage: number;
  reason: string;
}

export type PortfolioFocus =
  | "resumen"
  | "productos-clave"
  | "marcas"
  | "proveedores"
  | "oportunidades";

export interface BrandPortfolioRow {
  brand: string;
  sales: number;
  margin: number;
  inventory: number;
  growth: number;
  stockouts: number;
  skus: number;
}

export interface SupplierPortfolioRow {
  supplier: Supplier;
  sales: number;
  stalled: number;
  skus: number;
  alternatives: number;
  dependency: number;
}

export interface PortfolioOpportunity {
  title: string;
  label: string;
  detail: string;
  to: string;
  tone: "blue" | "green" | "amber";
}

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

/** Una decisión priorizada de la portada de Inicio (bandeja del comprador). */
export interface AgendaItem {
  id: string;
  dueDate: string;
  days: number;
  kind: "Compra" | "OC" | "Proveedor" | "Aprobación" | "Inventario" | "Margen" | "Catálogo";
  urgency: string;
  title: string;
  meta: string;
  impact: string;
  recommendation: string;
  actionLabel: string;
  to: string;
  tone: "red" | "amber" | "violet" | "blue";
  priority: number;
  impactValue: number;
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

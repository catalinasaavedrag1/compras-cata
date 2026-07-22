import type { ReplenishmentRecommendation } from "../../hooks/useReplenishment";

// ============================================================================
//  Tipos de la vista "Mi cartera" (Inicio del comprador).
//  Filas derivadas de las fuentes reales del purchase-bff (motor de
//  reposición, paneles F12 y desempeño F19). Las agrupaciones que dependían
//  del maestro mock de productos (roles, marcas) se eliminaron: no existen
//  en el contrato actual.
// ============================================================================

/** Fila de riesgo de quiebre, construida sobre la recomendación real del motor. */
export interface RiskRow {
  rec: ReplenishmentRecommendation;
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

/** Ritmo de venta 30d vs promedio 90d/3, derivado de las filas reales del motor. */
export interface SalesPaceRow {
  rec: ReplenishmentRecommendation;
  expected30: number;
  diffUnits: number;
  diffPct: number;
  coverage: number;
}

export type PortfolioFocus =
  | "resumen"
  | "productos-clave"
  | "marcas"
  | "proveedores"
  | "oportunidades";

export interface PortfolioOpportunity {
  title: string;
  label: string;
  detail: string;
  to: string;
  tone: "blue" | "green" | "amber";
}

/** Contador del resumen de oportunidades (null = fuente no disponible). */
export interface OpportunitySummaryItem {
  label: string;
  count: number | null;
  tone: "green" | "blue" | "amber" | "violet";
  to: string;
}

/** Foco accionable de "Principales focos" (solo se listan los calculables). */
export interface PortfolioFoco {
  dot: string;
  text: string;
  to: string;
}

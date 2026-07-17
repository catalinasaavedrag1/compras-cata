import type { PurchaseRecommendation } from "../../types/purchasing";

// ============================================================================
//  Tipos de la vista de Reposición / Decisiones de compra.
// ============================================================================

export type DecisionViewMode = "product" | "supplier" | "category";

export interface OpenPoSignal {
  number: string;
  quantity: number;
  /** Fecha esperada de entrega (las OC reales pueden no tenerla aún). */
  expectedDate: string | null;
  status: string;
}

export interface DecisionGroup {
  key: string;
  label: string;
  items: PurchaseRecommendation[];
  total: number;
  critical: number;
  review: number;
  overstock: number;
  hasOpenPo: boolean;
}

import type { PurchaseRecommendation } from "../../types/purchasing";

// ============================================================================
//  Tipos de la vista de Reposición / Decisiones de compra.
// ============================================================================

export interface RecOverride {
  suggestedQuantity: number;
  suggestedPurchaseAmount: number;
  supplierName: string;
}

export type DecisionViewMode = "product" | "supplier" | "category";

export interface OpenPoSignal {
  number: string;
  quantity: number;
  expectedDate: string;
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

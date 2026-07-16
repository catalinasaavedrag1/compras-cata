import { coverageDays } from "../../utils/calculations";
import type { PurchaseRecommendation } from "../../types/purchasing";
import type { DecisionGroup, OpenPoSignal } from "./types";

// ============================================================================
//  Helpers de decisión de reposición, compartidos por la página y sus
//  componentes: etiqueta de decisión, tendencia de venta y múltiplo de compra.
// ============================================================================

export function decisionTypeLabel(rec: PurchaseRecommendation): string {
  if (rec.status === "overstock") return "No comprar";
  if (rec.status === "review") return rec.margin < 25 ? "Revisar margen" : "Revisar cantidad";
  if (rec.availableStock <= 0 || rec.status === "critical") return "Comprar ahora";
  if (coverageDays(rec.availableStock, rec.salesLast30Days) <= rec.supplierLeadTimeDays * 2) {
    return "Reponer";
  }
  return "Postergar";
}

export function salesTrendPct(rec: PurchaseRecommendation): number {
  const expected30 = rec.salesLast90Days / 3;
  if (expected30 <= 0) return 0;
  return ((rec.salesLast30Days - expected30) / expected30) * 100;
}

export function purchaseMultiple(rec: PurchaseRecommendation): number {
  if (rec.suggestedQuantity >= 120 && rec.suggestedQuantity % 24 === 0) return 24;
  if (rec.suggestedQuantity >= 100) return 20;
  if (rec.suggestedQuantity >= 40) return 10;
  return 1;
}

/**
 * Cobertura (días) proyectada a partir de un total de unidades y la venta diaria,
 * redondeada a 1 decimal. Si no hay venta, cae al valor de inventario conocido.
 */
export function projectedCoverageDays(
  totalUnits: number,
  dailySales: number,
  fallback: number
): number {
  return dailySales > 0 ? Math.round((totalUnits / dailySales) * 10) / 10 : fallback;
}

export function buildDecisionGroups(
  rows: PurchaseRecommendation[],
  getKey: (row: PurchaseRecommendation) => string,
  openPoBySku: Map<string, OpenPoSignal>
): DecisionGroup[] {
  const groups = new Map<string, PurchaseRecommendation[]>();
  rows.forEach((row) => {
    const key = getKey(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries())
    .map(([key, items]) => ({
      key,
      label: key,
      items,
      total: items.reduce((sum, row) => sum + row.suggestedPurchaseAmount, 0),
      critical: items.filter((row) => row.status === "critical" || row.status === "buy_now").length,
      review: items.filter((row) => row.status === "review").length,
      overstock: items.filter((row) => row.status === "overstock").length,
      hasOpenPo: items.some((row) => openPoBySku.has(row.sku)),
    }))
    .sort((a, b) => b.critical - a.critical || b.total - a.total);
}

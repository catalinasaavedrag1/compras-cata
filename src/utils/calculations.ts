// ============================================================================
//  Cálculos de negocio de compras
//  Lógica coherente (no perfecta) para márgenes, rotación, días de inventario,
//  prioridad, estado de recomendación y cantidad sugerida de compra.
// ============================================================================

import type { Priority, RecommendationStatus } from "../types/purchasing";

/** Margen % sobre precio de venta: (precio - costo) / precio * 100 */
export function calculateMargin(price: number, cost: number): number {
  if (!price) return 0;
  return Math.round(((price - cost) / price) * 1000) / 10;
}

/** Días de inventario = stock disponible / (venta mensual / 30) */
export function calculateInventoryDays(
  stock: number,
  monthlySales: number
): number {
  if (monthlySales <= 0) return stock > 0 ? 999 : 0;
  return Math.round((stock / (monthlySales / 30)) * 10) / 10;
}

/** Rotación anual aproximada = ventas 90 días * 4 / stock promedio */
export function calculateRotation(
  salesLast90Days: number,
  averageStock: number
): number {
  if (averageStock <= 0) return 0;
  return Math.round(((salesLast90Days * 4) / averageStock) * 10) / 10;
}

export interface SuggestedPurchaseInput {
  availableStock: number;
  committedStock: number;
  monthlySales: number;
  leadTimeDays: number;
  targetInventoryDays: number;
  minStock: number;
  maxStock: number;
}

export interface SuggestedPurchaseResult {
  suggestedQuantity: number;
  coverageDays: number;
}

/**
 * Calcula la cantidad sugerida de compra.
 *
 * Idea: queremos cubrir el lead time del proveedor + los días objetivo de
 * inventario. Calculamos la demanda esperada en ese horizonte, le restamos
 * el stock disponible (descontando comprometido) y respetamos stock mín/máx.
 */
export function calculateSuggestedPurchase(
  input: SuggestedPurchaseInput
): SuggestedPurchaseResult {
  const {
    availableStock,
    committedStock,
    monthlySales,
    leadTimeDays,
    targetInventoryDays,
    minStock,
    maxStock,
  } = input;

  const dailyDemand = monthlySales / 30;
  const netStock = Math.max(0, availableStock - committedStock);

  // Demanda esperada durante lead time + días objetivo de cobertura
  const horizonDays = leadTimeDays + targetInventoryDays;
  const demandOverHorizon = dailyDemand * horizonDays;

  // Objetivo de stock = demanda del horizonte, acotado por mín/máx
  let target = Math.max(demandOverHorizon, minStock);
  if (maxStock > 0) target = Math.min(target, maxStock);

  let suggested = Math.ceil(target - netStock);
  if (suggested < 0) suggested = 0;

  const coverageDays =
    dailyDemand > 0
      ? Math.round(((netStock + suggested) / dailyDemand) * 10) / 10
      : 999;

  return { suggestedQuantity: suggested, coverageDays };
}

/** Días de cobertura del stock disponible considerando venta mensual */
export function coverageDays(
  availableStock: number,
  monthlySales: number
): number {
  if (monthlySales <= 0) return availableStock > 0 ? 999 : 0;
  return Math.round((availableStock / (monthlySales / 30)) * 10) / 10;
}

/**
 * Determina el estado de recomendación según cobertura, lead time y rotación.
 */
export function calculateRecommendationStatus(params: {
  availableStock: number;
  monthlySales: number;
  leadTimeDays: number;
  inventoryDays: number;
}): RecommendationStatus {
  const { availableStock, monthlySales, leadTimeDays, inventoryDays } = params;
  const cover = coverageDays(availableStock, monthlySales);

  if (monthlySales <= 0 && availableStock > 0) return "overstock";
  if (inventoryDays >= 180) return "overstock";
  if (availableStock <= 0 && monthlySales > 0) return "critical";
  if (cover <= leadTimeDays) return "critical";
  if (cover <= leadTimeDays * 1.5) return "buy_now";
  if (cover <= leadTimeDays * 2.5) return "review";
  return "normal";
}

/** Calcula la prioridad de compra a partir del estado y la venta */
export function calculatePriority(params: {
  status: RecommendationStatus;
  monthlySales: number;
}): Priority {
  const { status, monthlySales } = params;
  if (status === "critical") return "high";
  if (status === "buy_now") return monthlySales >= 15 ? "high" : "medium";
  if (status === "review") return "medium";
  return "low";
}

/** Capital inmovilizado estimado por sobrestock (unidades sobre el máximo) */
export function frozenCapital(
  availableStock: number,
  maxStock: number,
  unitCost: number
): number {
  const excess = Math.max(0, availableStock - maxStock);
  return excess * unitCost;
}

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
  /** Factor estacional para la demanda del horizonte (1 = sin ajuste). */
  seasonalFactor?: number;
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
    seasonalFactor = 1,
  } = input;

  const dailyDemand = monthlySales / 30;
  const netStock = Math.max(0, availableStock - committedStock);

  // Demanda esperada durante lead time + días objetivo de cobertura,
  // ajustada por el factor estacional del horizonte (temporada alta/baja).
  const horizonDays = leadTimeDays + targetInventoryDays;
  const demandOverHorizon = dailyDemand * horizonDays * seasonalFactor;

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
 * Frase en lenguaje natural que explica la situación de stock sin tecnicismos:
 * "Vendiste 30 en 30 días · te queda para 3 días".
 * Pensada para que cualquiera entienda de un vistazo por qué hay que comprar.
 */
export function coverageSentence(
  availableStock: number,
  salesLast30Days: number
): string {
  if (salesLast30Days <= 0) {
    return availableStock > 0
      ? "No vendiste nada en 30 días · stock parado"
      : "Sin venta y sin stock";
  }
  const days = coverageDays(availableStock, salesLast30Days);
  if (availableStock <= 0) {
    return `Vendiste ${Math.round(salesLast30Days)} en 30 días · te quedaste sin stock`;
  }
  const daysLabel =
    days >= 999
      ? "+999 días"
      : days < 1
        ? "menos de 1 día"
        : `${Math.round(days)} ${Math.round(days) === 1 ? "día" : "días"}`;
  return `Vendiste ${Math.round(salesLast30Days)} en 30 días · te queda para ${daysLabel}`;
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

/** Suma días a una fecha ISO (aaaa-mm-dd) y devuelve ISO. */
export function addDaysISO(baseISO: string, days: number): string {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

/**
 * Fecha estimada de quiebre: hoy + días de cobertura del stock disponible.
 * Si no hay venta, no hay quiebre previsible (devuelve null).
 * Si el stock ya es 0 con venta, el quiebre es hoy.
 */
export function estimatedStockoutDate(
  availableStock: number,
  monthlySales: number,
  todayISO: string
): string | null {
  if (monthlySales <= 0) return null;
  const days = coverageDays(availableStock, monthlySales);
  if (days >= 999) return null;
  return addDaysISO(todayISO, days);
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

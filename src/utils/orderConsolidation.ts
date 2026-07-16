// ============================================================================
//  Coach de consolidación de compra.
//
//  Objetivo de negocio: que el comprador arme una MEJOR orden, no solo una
//  orden. Tres ayudas concretas que un buen comprador hace de cabeza y aquí se
//  automatizan:
//
//   1. Mínimo del proveedor — ¿la OC alcanza el mínimo de compra? Si no, cuánto
//      falta y qué agregar para llegar (o negociar), en vez de emitir una OC que
//      el proveedor rechaza o despacha con recargo.
//   2. Consolidación — ¿qué otros SKU de ESTE proveedor se van a quebrar pronto?
//      Agregarlos ahora evita emitir una segunda OC (y pagar un segundo flete/
//      retiro) al mismo proveedor en pocos días.
//   3. Fecha límite de emisión — ¿hasta cuándo puedo emitir para que llegue
//      antes del quiebre? (quiebre estimado − lead time del proveedor).
//
//  Lógica pura, sin dependencias de React, para poder testearla y reutilizarla.
// ============================================================================

import type { Product, PurchaseRecommendation, Supplier } from "../types/purchasing";
import { addDaysISO, coverageDays, estimatedStockoutDate } from "./calculations";

// ----------------------------------------------------------------------------
//  1. Mínimo de compra del proveedor
// ----------------------------------------------------------------------------
export interface SupplierMinimumStatus {
  type: "monto" | "unidades";
  target: number; // mínimo exigido por el proveedor
  current: number; // monto neto (o unidades) del grupo en el borrador
  meets: boolean;
  shortfall: number; // cuánto falta para el mínimo (0 si ya se cumple)
  pct: number; // avance 0..1 para la barra
}

/**
 * Estado del mínimo de compra de un proveedor dado el contenido actual de su
 * grupo en el borrador. Devuelve null si el proveedor no define mínimo.
 */
export function supplierMinimumStatus(
  supplier: Supplier | undefined,
  groupNet: number,
  groupUnits: number
): SupplierMinimumStatus | null {
  if (!supplier?.minimoCompra || supplier.minimoCompra <= 0) return null;
  const type = supplier.minimoCompraTipo ?? "monto";
  const current = type === "unidades" ? groupUnits : groupNet;
  const target = supplier.minimoCompra;
  return {
    type,
    target,
    current,
    meets: current >= target,
    shortfall: Math.max(0, target - current),
    pct: target > 0 ? Math.min(1, current / target) : 1,
  };
}

// ----------------------------------------------------------------------------
//  2. Candidatos a consolidar (otros SKU del mismo proveedor por quebrar)
// ----------------------------------------------------------------------------
export interface ConsolidationCandidate {
  sku: string;
  productName: string;
  suggestedQty: number;
  unitCost: number;
  discountPct?: number;
  lineValue: number; // valor neto estimado de la línea
  daysToStockout: number; // días de cobertura del stock disponible
  stockoutDate: string | null;
  reason: string;
}

export interface ConsolidationInput {
  supplierName: string;
  draftSkus: Set<string>;
  products: Product[];
  recommendations: PurchaseRecommendation[];
  /** Ventana de anticipación en días (normalmente lead time + colchón). */
  horizonDays: number;
  todayISO: string;
  limit?: number;
}

/**
 * SKU del mismo proveedor que NO están en el borrador y se quebrarán dentro del
 * horizonte: candidatos naturales a sumar a esta misma OC. Ordenados por
 * urgencia (quiebre más próximo primero).
 */
export function consolidationCandidates(input: ConsolidationInput): ConsolidationCandidate[] {
  const {
    supplierName,
    draftSkus,
    products,
    recommendations,
    horizonDays,
    todayISO,
    limit = 3,
  } = input;
  const recBySku = new Map(recommendations.map((r) => [r.sku, r] as const));
  const out: ConsolidationCandidate[] = [];

  for (const p of products) {
    if (p.supplierName !== supplierName) continue;
    if (draftSkus.has(p.sku)) continue;
    // No proponer lo que no se debe comprar ni lo que ya sobra.
    if (p.purchaseStatus === "do_not_buy" || p.purchaseStatus === "overstock") continue;
    if (p.salesLast30Days <= 0) continue; // solo lo que efectivamente vende

    const cover = coverageDays(p.availableStock, p.salesLast30Days);
    if (cover > horizonDays) continue; // todavía no necesita reposición

    const rec = recBySku.get(p.sku);
    const dailyDemand = p.salesLast30Days / 30;
    const fallbackQty = Math.max(
      p.multiploCompra ?? 1,
      Math.round(dailyDemand * (p.supplierLeadTimeDays + 30))
    );
    const suggestedQty =
      rec?.suggestedQuantity && rec.suggestedQuantity > 0 ? rec.suggestedQuantity : fallbackQty;
    if (suggestedQty <= 0) continue;

    const lineValue = suggestedQty * p.cost * (1 - (p.descuentoVigentePct ?? 0) / 100);
    const daysToStockout = Math.max(0, Math.round(cover));

    out.push({
      sku: p.sku,
      productName: p.name,
      suggestedQty,
      unitCost: p.cost,
      discountPct: p.descuentoVigentePct,
      lineValue,
      daysToStockout,
      stockoutDate: estimatedStockoutDate(p.availableStock, p.salesLast30Days, todayISO),
      reason: p.availableStock <= 0 ? "Ya sin stock" : `Se queda sin stock en ~${daysToStockout} d`,
    });
  }

  out.sort((a, b) => a.daysToStockout - b.daysToStockout);
  return out.slice(0, limit);
}

// ----------------------------------------------------------------------------
//  3. Fecha límite de emisión (order-by)
// ----------------------------------------------------------------------------
export type OrderByStatus = "overdue" | "urgent" | "soon" | "ok" | "none";

export interface OrderBySignal {
  stockoutDate: string | null;
  /** Última fecha para emitir y alcanzar a llegar antes del quiebre. */
  orderByDate: string | null;
  /** Días desde hoy hasta la fecha límite (negativo si ya pasó). */
  daysToOrderBy: number | null;
  status: OrderByStatus;
}

/**
 * Fecha límite para emitir la OC: quiebre estimado − lead time del proveedor.
 * Si ya se pasó, la reposición llegará con quiebre (status "overdue").
 */
export function orderBySignal(
  availableStock: number,
  salesLast30Days: number,
  leadTimeDays: number,
  todayISO: string
): OrderBySignal {
  const stockoutDate = estimatedStockoutDate(availableStock, salesLast30Days, todayISO);
  if (!stockoutDate) {
    return { stockoutDate: null, orderByDate: null, daysToOrderBy: null, status: "none" };
  }
  const cover = coverageDays(availableStock, salesLast30Days);
  const daysToOrderBy = Math.round(cover - leadTimeDays);
  const orderByDate = addDaysISO(todayISO, daysToOrderBy);
  const status: OrderByStatus =
    daysToOrderBy < 0 ? "overdue" : daysToOrderBy <= 2 ? "urgent" : daysToOrderBy <= 7 ? "soon" : "ok";
  return { stockoutDate, orderByDate, daysToOrderBy, status };
}

// ----------------------------------------------------------------------------
//  4. Venta en riesgo de una orden de compra (para priorizar el seguimiento)
// ----------------------------------------------------------------------------
export interface OrderRiskProduct {
  availableStock: number;
  salesLast30Days: number;
  price: number;
}

export interface OrderSalesAtRisk {
  /** Venta mensual (CLP) de los SKU de la OC que se quiebran antes de que llegue. */
  value: number;
  /** Cuántos SKU de la OC están expuestos a quiebre. */
  skus: number;
}

/**
 * Venta en riesgo de una OC en curso: suma de la venta mensual de los SKU cuya
 * cobertura se agota antes de que la orden llegue. Así el seguimiento prioriza
 * por impacto comercial (una OC con 1 día de atraso que evita un quiebre masivo
 * pesa más que una OC muy atrasada de un producto sin venta), no solo por días
 * de atraso.
 *
 * @param arrivalDays días hasta que llega la orden (o días de atraso si ya venció).
 * @param resolve función que entrega los datos del producto por SKU.
 */
export function orderSalesAtRisk(
  lines: { sku: string }[] | undefined,
  arrivalDays: number,
  resolve: (sku: string) => OrderRiskProduct | undefined
): OrderSalesAtRisk {
  if (!lines || lines.length === 0) return { value: 0, skus: 0 };
  let value = 0;
  let skus = 0;
  for (const line of lines) {
    const p = resolve(line.sku);
    if (!p || p.salesLast30Days <= 0) continue;
    const coverage = p.availableStock / (p.salesLast30Days / 30);
    if (coverage <= arrivalDays) {
      value += Math.round(p.salesLast30Days * p.price);
      skus += 1;
    }
  }
  return { value, skus };
}

/**
 * Fecha límite de emisión más urgente entre un conjunto de líneas (para mostrar
 * a nivel de grupo de proveedor). Devuelve la señal con menor `daysToOrderBy`.
 */
export function earliestOrderBy(
  lines: { availableStock: number; salesLast30Days: number; leadTimeDays: number }[],
  todayISO: string
): OrderBySignal | null {
  let best: OrderBySignal | null = null;
  for (const l of lines) {
    const sig = orderBySignal(l.availableStock, l.salesLast30Days, l.leadTimeDays, todayISO);
    if (sig.daysToOrderBy === null) continue;
    if (!best || (best.daysToOrderBy ?? Infinity) > sig.daysToOrderBy) best = sig;
  }
  return best;
}

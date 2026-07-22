// ============================================================================
//  Motor de razonamiento de la recomendación de compra.
//
//  Objetivo: que el comprador entienda POR QUÉ el sistema sugiere N unidades,
//  con un desglose factor por factor que suma exactamente la cantidad
//  recomendada. Cuando se entiende el motivo, se confía en la sugerencia y se
//  decide mejor.
//
//  La cantidad objetivo se descompone en:
//     Demanda durante el lead time
//   + Stock de seguridad
//   + Cobertura objetivo adicional
//   = Necesitas tener (unidades)
//   − Stock disponible
//   − En tránsito (OC en curso)
//   = Comprar
//
// ============================================================================

import type { PurchaseRecommendation } from "../types/purchasing";

export interface ReasoningFactor {
  key: string;
  label: string;
  /** Explicación corta del cálculo (ej. "12 días × 4 u/día"). */
  detail: string;
  units: number;
  sign: "+" | "−";
}

export interface RecommendationReasoning {
  dailyDemand: number;
  leadTimeDays: number;
  safetyStockDays: number;
  coverageObjectiveDays: number;
  projectedCoverageDays: number;
  /** Unidades que se necesita tener en total (objetivo). */
  needUnits: number;
  netStock: number;
  incoming: number;
  suggested: number;
  /** Factores que componen el objetivo de cobertura (suman needUnits). */
  needFactors: ReasoningFactor[];
  /** Lo que ya se tiene y se descuenta (disponible + en tránsito). */
  haveFactors: ReasoningFactor[];
  /** Resumen en una línea del motivo principal. */
  summary: string;
}

function round(n: number): number {
  return Math.round(n);
}

/**
 * Construye el razonamiento de una recomendación.
 * @param incoming unidades en tránsito consideradas para cobertura (ya
 *   ajustadas por atraso si corresponde). Por defecto 0.
 */
export function buildRecommendationReasoning(
  rec: PurchaseRecommendation,
  incoming = 0
): RecommendationReasoning {
  const dailyDemand = rec.salesLast30Days > 0 ? rec.salesLast30Days / 30 : 0;
  const leadTimeDays = rec.supplierLeadTimeDays;
  const netStock = Math.max(0, rec.availableStock);
  const suggested = Math.max(0, rec.suggestedQuantity);

  // Total que se tendrá tras la compra y lo en tránsito = objetivo a explicar.
  const needUnits = netStock + suggested + incoming;

  // Demanda que hay que cubrir mientras llega el proveedor.
  const leadTimeDemand = Math.min(needUnits, round(dailyDemand * leadTimeDays));

  // Stock de seguridad: colchón implícito en el punto de reorden por sobre la
  // demanda del lead time. Acotado para no exceder el objetivo.
  const rawSafety = Math.max(0, round(rec.reorderPoint - dailyDemand * leadTimeDays));
  const safetyUnits = Math.min(rawSafety, Math.max(0, needUnits - leadTimeDemand));

  // Cobertura objetivo adicional = lo que resta del objetivo (cierra la suma).
  const coverageObjUnits = Math.max(0, needUnits - leadTimeDemand - safetyUnits);

  const safetyStockDays = dailyDemand > 0 ? safetyUnits / dailyDemand : 0;
  const coverageObjectiveDays = dailyDemand > 0 ? coverageObjUnits / dailyDemand : 0;
  const projectedCoverageDays = dailyDemand > 0 ? needUnits / dailyDemand : 999;

  const needFactors: ReasoningFactor[] = [
    {
      key: "leadtime",
      label: "Demanda durante el lead time",
      detail: `${leadTimeDays} días × ${round(dailyDemand)} u/día`,
      units: leadTimeDemand,
      sign: "+",
    },
    {
      key: "safety",
      label: "Stock de seguridad",
      detail:
        safetyStockDays >= 1
          ? `colchón de ${round(safetyStockDays)} días ante variaciones`
          : "colchón mínimo ante variaciones",
      units: safetyUnits,
      sign: "+",
    },
    {
      key: "coverage",
      label: "Cobertura objetivo",
      detail: `${round(coverageObjectiveDays)} días adicionales de inventario`,
      units: coverageObjUnits,
      sign: "+",
    },
  ];

  const haveFactors: ReasoningFactor[] = [
    {
      key: "onhand",
      label: "Stock disponible",
      detail: netStock > 0 ? "ya en bodega" : "sin stock en bodega",
      units: netStock,
      sign: "−",
    },
  ];
  if (incoming > 0) {
    haveFactors.push({
      key: "intransit",
      label: "En tránsito (OC en curso)",
      detail: "llega antes de necesitarlo",
      units: incoming,
      sign: "−",
    });
  }

  const summary =
    netStock <= 0
      ? `Sin stock y vendes ${round(rec.salesLast30Days)} u./mes: el proveedor demora ${leadTimeDays} días en reponer.`
      : `Cubres el lead time de ${leadTimeDays} días más un colchón de seguridad y la cobertura objetivo.`;

  return {
    dailyDemand,
    leadTimeDays,
    safetyStockDays,
    coverageObjectiveDays,
    projectedCoverageDays,
    needUnits,
    netStock,
    incoming,
    suggested,
    needFactors,
    haveFactors,
    summary,
  };
}

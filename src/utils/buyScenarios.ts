import type { Product } from "../types/purchasing";

// ============================================================================
//  Escenarios de compra (simulación antes de aprobar).
//  Compara una compra conservadora, la recomendada y una por volumen para que
//  el comprador entienda el COSTO COMPLETO de aceptar un descuento por volumen:
//  más inversión y más riesgo de sobrestock a cambio del descuento.
// ============================================================================

export type ScenarioKey = "conservador" | "recomendado" | "volumen";
export type RiskLevel = "bajo" | "medio" | "alto";

export interface BuyScenario {
  key: ScenarioKey;
  label: string;
  qty: number;
  discountPct: number;
  investment: number; // inversión neta (CLP)
  coverageDays: number; // cobertura tras la compra
  stockoutRisk: RiskLevel;
  overstockRisk: RiskLevel;
  /** Ahorro por el descuento adicional de volumen vs el descuento base (CLP). */
  volumeSaving: number;
  note: string;
  recommended?: boolean;
}

/** Descuento extra que desbloquea la compra por volumen (puntos porcentuales). */
const VOLUME_DISCOUNT_BUMP = 4;

function stockoutRisk(coverage: number, leadTimeDays: number): RiskLevel {
  if (coverage <= leadTimeDays * 1.5) return "alto";
  if (coverage < 45) return "medio";
  return "bajo";
}

function overstockRisk(coverage: number): RiskLevel {
  if (coverage > 90) return "alto";
  if (coverage > 60) return "medio";
  return "bajo";
}

/**
 * Construye los tres escenarios para un SKU. `baseDiscountPct` es el descuento
 * ya negociado de la línea; el escenario por volumen suma un descuento extra.
 */
export function buyScenarios(
  product: Product,
  suggestedQty: number,
  unitCost: number,
  baseDiscountPct = 0
): BuyScenario[] {
  const dailyDemand = product.salesLast30Days > 0 ? product.salesLast30Days / 30 : 0;
  const available = Math.max(0, product.availableStock);
  const multiple = product.multiploCompra && product.multiploCompra > 0 ? product.multiploCompra : 1;
  const leadTime = product.supplierLeadTimeDays;

  const roundToMultiple = (n: number) => Math.max(multiple, Math.round(n / multiple) * multiple);
  const qtyForDays = (days: number) =>
    dailyDemand > 0 ? Math.max(0, roundToMultiple(dailyDemand * days - available)) : 0;
  const coverageOf = (qty: number) =>
    dailyDemand > 0 ? Math.round((available + qty) / dailyDemand) : 999;
  const investmentOf = (qty: number, disc: number) =>
    Math.round(qty * unitCost * (1 - disc / 100));

  // Conservador: cubre ~30 días (mínima inversión, mayor riesgo de quiebre).
  const consQty = qtyForDays(30);
  // Recomendado: la cantidad sugerida por el sistema.
  const recoQty = Math.max(multiple, roundToMultiple(suggestedQty));
  // Volumen: cobertura ~110 días para desbloquear el descuento por volumen.
  const volQty = Math.max(recoQty, qtyForDays(110));

  const consInv = investmentOf(consQty, baseDiscountPct);
  const recoInv = investmentOf(recoQty, baseDiscountPct);
  const volDisc = baseDiscountPct + VOLUME_DISCOUNT_BUMP;
  const volInv = investmentOf(volQty, volDisc);
  // Ahorro real del descuento de volumen (sobre el mismo volumen).
  const volumeSaving = Math.round(volQty * unitCost * (VOLUME_DISCOUNT_BUMP / 100));

  const consCov = coverageOf(consQty);
  const recoCov = coverageOf(recoQty);
  const volCov = coverageOf(volQty);

  return [
    {
      key: "conservador",
      label: "Conservador",
      qty: consQty,
      discountPct: baseDiscountPct,
      investment: consInv,
      coverageDays: consCov,
      stockoutRisk: stockoutRisk(consCov, leadTime),
      overstockRisk: overstockRisk(consCov),
      volumeSaving: 0,
      note: "Mínima inversión. Cobertura corta: mayor riesgo de quiebre si sube la venta.",
    },
    {
      key: "recomendado",
      label: "Recomendado",
      qty: recoQty,
      discountPct: baseDiscountPct,
      investment: recoInv,
      coverageDays: recoCov,
      stockoutRisk: stockoutRisk(recoCov, leadTime),
      overstockRisk: overstockRisk(recoCov),
      volumeSaving: 0,
      note: "Cobertura objetivo equilibrada entre servicio y capital.",
      recommended: true,
    },
    {
      key: "volumen",
      label: "Por volumen",
      qty: volQty,
      discountPct: volDisc,
      investment: volInv,
      coverageDays: volCov,
      stockoutRisk: stockoutRisk(volCov, leadTime),
      overstockRisk: overstockRisk(volCov),
      volumeSaving,
      note: `Desbloquea ${VOLUME_DISCOUNT_BUMP}% de descuento (ahorra ~${volumeSaving.toLocaleString("es-CL")}), pero inmoviliza más capital y arriesga sobrestock.`,
    },
  ];
}

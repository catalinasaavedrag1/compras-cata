// ============================================================================
//  Perfil del SKU: clasificación ABC (impacto en venta) y XYZ (predictibilidad
//  de la demanda). Son dos ejes clásicos de gestión de categorías que ayudan a
//  decidir cuánta atención y cuánto colchón merece cada producto:
//
//    · ABC → cuánto pesa el SKU en la venta valorizada (Pareto 80/15/5).
//    · XYZ → qué tan estable/predecible es su demanda (baja/media/alta
//            variabilidad), estimada con la dispersión entre los tramos de
//            venta 30/90/180 días.
//
//  Todo se deriva de `mockProducts` de forma determinista (sin azar) para que
//  la clasificación sea estable entre renders.
// ============================================================================

import { products } from "../data/mockProducts";
import type { Product } from "../types/purchasing";

export type AbcClass = "A" | "B" | "C";
export type XyzClass = "X" | "Y" | "Z";

export interface SkuProfile {
  abc: AbcClass;
  /** Participación acumulada de venta valorizada hasta este SKU (0-1). */
  abcCumShare: number;
  /** Participación individual del SKU en la venta valorizada (0-1). */
  abcShare: number;
  xyz: XyzClass;
  /** Coeficiente de variación de la demanda (0 = perfectamente estable). */
  demandCv: number;
}

/** Venta valorizada anualizada (proxy de importancia comercial del SKU). */
function annualRevenue(p: Product): number {
  // salesLast90Days × 4 aproxima la venta anual sin depender de estacionalidad
  // puntual; se valoriza a precio de venta para reflejar peso comercial real.
  return Math.max(0, p.salesLast90Days) * 4 * p.price;
}

/**
 * Coeficiente de variación de la demanda a partir de los tres tramos de venta
 * normalizados a venta mensual (30d, 90d/3, 180d/6). Menos dispersión = demanda
 * más predecible = mejor candidato a stock de seguridad ajustado.
 */
function demandCv(p: Product): number {
  const monthly = [p.salesLast30Days, p.salesLast90Days / 3, p.salesLast180Days / 6].filter((v) =>
    Number.isFinite(v)
  );
  const mean = monthly.reduce((s, v) => s + v, 0) / monthly.length;
  if (mean <= 0) return 1;
  const variance = monthly.reduce((s, v) => s + (v - mean) ** 2, 0) / monthly.length;
  return Math.sqrt(variance) / mean;
}

const profileMap: Map<string, SkuProfile> = (() => {
  const map = new Map<string, SkuProfile>();
  const ranked = [...products].sort((a, b) => annualRevenue(b) - annualRevenue(a));
  const total = ranked.reduce((s, p) => s + annualRevenue(p), 0);

  let cumulative = 0;
  for (const p of ranked) {
    const revenue = annualRevenue(p);
    const share = total > 0 ? revenue / total : 0;
    cumulative += revenue;
    const cumShare = total > 0 ? cumulative / total : 1;
    // ABC clásico: A = primer 80% de la venta, B = siguiente 15%, C = último 5%.
    const abc: AbcClass = cumShare <= 0.8 ? "A" : cumShare <= 0.95 ? "B" : "C";

    const cv = demandCv(p);
    // XYZ: X = demanda estable, Y = variabilidad media, Z = errática.
    const xyz: XyzClass = cv <= 0.25 ? "X" : cv <= 0.5 ? "Y" : "Z";

    map.set(p.sku, { abc, abcCumShare: cumShare, abcShare: share, xyz, demandCv: cv });
  }
  return map;
})();

export function skuProfileOf(sku: string): SkuProfile | null {
  return profileMap.get(sku) ?? null;
}

export const ABC_LABEL: Record<AbcClass, string> = {
  A: "Clase A",
  B: "Clase B",
  C: "Clase C",
};

export const ABC_DESCRIPTION: Record<AbcClass, string> = {
  A: "Alto impacto en venta · máxima atención",
  B: "Impacto medio · seguimiento regular",
  C: "Bajo impacto · gestión por excepción",
};

export const XYZ_LABEL: Record<XyzClass, string> = {
  X: "Demanda estable",
  Y: "Demanda variable",
  Z: "Demanda errática",
};

export const XYZ_DESCRIPTION: Record<XyzClass, string> = {
  X: "Muy predecible · pronóstico confiable",
  Y: "Predecible con reservas · revisar tendencia",
  Z: "Poco predecible · mantener colchón mayor",
};

import type { ImportOrder } from "../types/purchasing";

// ============================================================================
//  Costo puesto en bodega de una importación.
//  El precio FOB no es el costo real: hay que convertir a CLP con el tipo de
//  cambio y sumar flete internacional, arancel, gastos portuarios, transporte
//  terrestre y agente de aduana. Se recalcula cuando cambia cualquiera de esos
//  factores (sobre todo el tipo de cambio).
// ============================================================================

export interface ImportLandedBreakdown {
  fobClp: number; // FOB convertido a CLP
  arancel: number; // arancel en CLP
  flete: number;
  portuarios: number;
  terrestre: number;
  aduana: number;
  /** Costo total puesto en bodega (CLP). */
  landed: number;
  /** Sobrecosto de internación sobre el FOB, en %. */
  extraPct: number;
  /** Costo puesto en bodega por SKU (referencia gruesa). */
  perSku: number;
}

/**
 * Calcula el costo puesto en bodega. `tipoCambioOverride` permite simular el
 * impacto de un tipo de cambio distinto sin tocar el dato original.
 */
export function importLanded(
  imp: ImportOrder,
  tipoCambioOverride?: number
): ImportLandedBreakdown {
  const tc = tipoCambioOverride ?? imp.tipoCambio;
  const fobClp = Math.round(imp.montoFob * tc);
  const arancel = Math.round((fobClp * imp.arancelPct) / 100);
  const flete = imp.fleteInternacional;
  const portuarios = imp.gastosPortuarios;
  const terrestre = imp.transporteTerrestre;
  const aduana = imp.agenteAduana;
  const landed = fobClp + arancel + flete + portuarios + terrestre + aduana;
  const extra = landed - fobClp;
  return {
    fobClp,
    arancel,
    flete,
    portuarios,
    terrestre,
    aduana,
    landed,
    extraPct: fobClp > 0 ? (extra / fobClp) * 100 : 0,
    perSku: imp.skuCount > 0 ? Math.round(landed / imp.skuCount) : landed,
  };
}

/** Días desde hoy hasta la ETA (negativo si ya pasó). */
export function daysToEta(etaISO: string, todayISO: string): number {
  return Math.round(
    (new Date(`${etaISO}T00:00:00`).getTime() - new Date(`${todayISO}T00:00:00`).getTime()) /
      86400000
  );
}

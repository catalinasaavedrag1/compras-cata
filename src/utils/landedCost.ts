import type { HandlingType, Product } from "../types/purchasing";
import { productLogistics, TRUCKS } from "../data/logistics";

// ============================================================================
//  Costo puesto en bodega (landed cost)
//  ---------------------------------------------------------------------------
//  El precio de factura no es el costo real: hay que sumarle el flete, el
//  arancel de importación y el manejo especial. Este cálculo se apoya en el
//  mismo motor de logística (capacidades y costos de camión) para estimar el
//  flete por unidad, y así el comprador decide por COSTO TOTAL, no solo por el
//  precio de compra. Es una estimación para comparar, no un costeo contable.
// ============================================================================

/** Marcas que la cadena trae de importación (demo). */
const IMPORTED_BRANDS: ReadonlySet<string> = new Set([
  "Bosch",
  "Makita",
  "DeWalt",
  "Rotoplas",
  "Tricapa",
]);

const DEFAULT_ARANCEL_PCT = 6;

/** Recargo de manejo por tipo de manipulación (fracción del costo del producto). */
const HANDLING_RATE: Record<HandlingType, number> = {
  manual: 0,
  horquilla: 0.01,
  rampla: 0.015,
  grua: 0.03,
  pluma: 0.04,
};

export function isImported(p: Product): boolean {
  return p.esImportado ?? IMPORTED_BRANDS.has(p.brand);
}

export interface LandedCostBreakdown {
  /** Costo neto de factura (por unidad). */
  productCost: number;
  /** Flete estimado por unidad (desde el motor de logística). */
  freight: number;
  /** Arancel de importación por unidad. */
  duty: number;
  /** Manejo especial por unidad (grúa/pluma/horquilla). */
  handling: number;
  /** Costo total puesto en bodega por unidad. */
  landed: number;
  /** Sobrecosto logístico sobre la factura, en %. */
  extraPct: number;
  /** Margen con el costo de factura (nominal). */
  nominalMargin: number;
  /** Margen real con el costo puesto en bodega. */
  landedMargin: number;
  isImported: boolean;
}

/**
 * Estima el costo puesto en bodega por unidad de un producto. El flete se deriva
 * del camión estándar (rampla): se cobra por el recurso más escaso (peso o
 * volumen), igual que en el plan de retiro. `unitCostOverride` permite usar el
 * costo negociado de una línea en vez del costo de lista.
 */
export function landedCost(p: Product, unitCostOverride?: number): LandedCostBreakdown {
  const log = productLogistics(p);
  const truck = TRUCKS.camion_rampla;
  const costPerKg = truck.baseCost / truck.capacityKg;
  const costPerM3 = truck.baseCost / truck.capacityM3;
  const freight = Math.round(Math.max(log.pesoUnitarioKg * costPerKg, log.volumenM3 * costPerM3));

  const productCost = unitCostOverride ?? p.cost;
  const imported = isImported(p);
  const arancelPct = imported ? (p.arancelPct ?? DEFAULT_ARANCEL_PCT) : 0;
  const duty = Math.round((productCost * arancelPct) / 100);
  const handling = Math.round(productCost * (HANDLING_RATE[log.manipulacion] ?? 0));

  const landed = productCost + freight + duty + handling;
  const extra = landed - productCost;
  const nominalMargin = p.price > 0 ? ((p.price - productCost) / p.price) * 100 : 0;
  const landedMargin = p.price > 0 ? ((p.price - landed) / p.price) * 100 : 0;

  return {
    productCost,
    freight,
    duty,
    handling,
    landed,
    extraPct: productCost > 0 ? (extra / productCost) * 100 : 0,
    nominalMargin,
    landedMargin,
    isImported: imported,
  };
}

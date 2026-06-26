import type { Product } from "../types/purchasing";
import { products } from "../data/mockProducts";

// ============================================================================
//  Inteligencia de negociación por producto (simulada en frontend, determinista).
//  Reúne lo que el comprador no tiene en el maestro pero necesita para negociar:
//  costo neto real, historial de costo, precio competencia, calidad del
//  proveedor y demanda futura. Todo derivado del SKU para ser estable.
// ============================================================================

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
// Valor determinista en [min,max] a partir del SKU + sal
function pick(sku: string, salt: string, min: number, max: number): number {
  const h = hashStr(sku + salt);
  return min + (h % 1000) / 1000 * (max - min);
}

export interface CostLine {
  label: string;
  amount: number;
  kind: "base" | "discount" | "extra" | "total";
  hint?: string;
}

export interface ProductNegotiation {
  // Costo neto real (waterfall)
  costoLista: number;
  costLines: CostLine[];
  costoNetoFactura: number;
  costoReal: number;
  margenNominal: number;
  margenReal: number;
  // Historial de costo / precio
  ultimoCosto: number;
  varCostoPct: number;
  precioPromedioVendido: number;
  descuentoPromVenta: number;
  precioCompetencia: number;
  vsCompetenciaPct: number;
  // Calidad del proveedor (para exigir condiciones)
  condicionesPago: number;
  devolucionesPct: number;
  notasCredito: number;
  reclamos: number;
  quiebresProvocados: number;
  // Demanda futura
  proyeccion90: number;
  tendenciaPct: number;
  demandTag: { label: string; tone: "good" | "warn" | "bad" | "neutral" };
  sustitutos: { sku: string; name: string; supplierName: string; price: number; margin: number }[];
}

export function productNegotiation(p: Product): ProductNegotiation {
  // ---- Costo neto real (waterfall) ----
  // Tratamos el costo del maestro como costo neto de factura y reconstruimos la
  // lista hacia arriba (descuentos) y el costo real hacia abajo (logística).
  const descComercial = Math.round(pick(p.sku, "dc", 6, 12));
  const descVolumen = p.salesLast30Days >= 50 ? Math.round(pick(p.sku, "dv", 2, 6)) : Math.round(pick(p.sku, "dv", 0, 3));
  const bonificacion = Math.round(pick(p.sku, "bo", 0, 3));
  const rebate = Math.round(pick(p.sku, "re", 0, 4));
  const descTotalPct = descComercial + descVolumen + bonificacion + rebate;
  const costoLista = Math.round(p.cost / (1 - descTotalPct / 100));
  const dcAmt = Math.round(costoLista * descComercial / 100);
  const dvAmt = Math.round(costoLista * descVolumen / 100);
  const boAmt = Math.round(costoLista * bonificacion / 100);
  const reAmt = Math.round(costoLista * rebate / 100);
  const costoNetoFactura = costoLista - dcAmt - dvAmt - boAmt - reAmt;

  const fletePct = pick(p.sku, "fl", 2, 5);
  const logisticaPct = pick(p.sku, "lo", 1, 3);
  const mermaPct = pick(p.sku, "me", 0.5, 2);
  const fleteAmt = Math.round(costoNetoFactura * fletePct / 100);
  const logiAmt = Math.round(costoNetoFactura * logisticaPct / 100);
  const mermaAmt = Math.round(costoNetoFactura * mermaPct / 100);
  const costoReal = costoNetoFactura + fleteAmt + logiAmt + mermaAmt;

  const costLines: CostLine[] = [
    { label: "Costo lista", amount: costoLista, kind: "base" },
    { label: `Descuento comercial (${descComercial}%)`, amount: -dcAmt, kind: "discount" },
    { label: `Descuento volumen (${descVolumen}%)`, amount: -dvAmt, kind: "discount" },
    { label: `Bonificación (${bonificacion}%)`, amount: -boAmt, kind: "discount" },
    { label: `Rebate (${rebate}%)`, amount: -reAmt, kind: "discount" },
    { label: "Costo neto factura", amount: costoNetoFactura, kind: "total" },
    { label: "Flete", amount: fleteAmt, kind: "extra" },
    { label: "Logística", amount: logiAmt, kind: "extra" },
    { label: "Merma esperada", amount: mermaAmt, kind: "extra" },
    { label: "Costo real", amount: costoReal, kind: "total" },
  ];

  const margenNominal = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
  const margenReal = p.price > 0 ? ((p.price - costoReal) / p.price) * 100 : 0;

  // ---- Historial de costo / precio ----
  const varCostoPct = pick(p.sku, "vc", -6, 12); // alza típica
  const ultimoCosto = Math.round(p.cost / (1 + varCostoPct / 100));
  const descuentoPromVenta = pick(p.sku, "pp", 0, 9);
  const precioPromedioVendido = Math.round(p.price * (1 - descuentoPromVenta / 100));
  const vsCompetenciaPct = pick(p.sku, "co", -6, 9);
  const precioCompetencia = Math.round(p.price * (1 - vsCompetenciaPct / 100));

  // ---- Calidad del proveedor ----
  const condicionesPago = [30, 30, 45, 60][hashStr(p.sku + "cp") % 4];
  const devolucionesPct = pick(p.sku, "de", 0.5, 5);
  const notasCredito = Math.round(pick(p.sku, "nc", 0, 5));
  const reclamos = Math.round(pick(p.sku, "rc", 0, 4));
  const quiebresProvocados = Math.round(pick(p.sku, "qp", 0, 6));

  // ---- Demanda futura ----
  const tendenciaPct = p.salesLast90Days > 0 ? (p.salesLast30Days / (p.salesLast90Days / 3) - 1) * 100 : 0;
  const proyeccion90 = Math.round(p.salesLast30Days * 3 * (1 + tendenciaPct / 200));
  const demandTag =
    tendenciaPct > 15
      ? { label: "En crecimiento", tone: "good" as const }
      : tendenciaPct < -15
        ? { label: "En caída", tone: "bad" as const }
        : { label: "Estable", tone: "neutral" as const };

  const sustitutos = products
    .filter((x) => x.sku !== p.sku && x.subcategory === p.subcategory)
    .sort((a, b) => b.salesLast30Days - a.salesLast30Days)
    .slice(0, 4)
    .map((x) => ({ sku: x.sku, name: x.name, supplierName: x.supplierName, price: x.price, margin: x.margin }));

  return {
    costoLista,
    costLines,
    costoNetoFactura,
    costoReal,
    margenNominal,
    margenReal,
    ultimoCosto,
    varCostoPct,
    precioPromedioVendido,
    descuentoPromVenta,
    precioCompetencia,
    vsCompetenciaPct,
    condicionesPago,
    devolucionesPct,
    notasCredito,
    reclamos,
    quiebresProvocados,
    proyeccion90,
    tendenciaPct,
    demandTag,
    sustitutos,
  };
}

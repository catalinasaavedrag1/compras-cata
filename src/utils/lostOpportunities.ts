import { products } from "../data/mockProducts";
import type { Product } from "../types/purchasing";
import { hashString as hashStr } from "./hash";

// ============================================================================
//  Oportunidades no capturadas (sección 6 del spec).
//  Venta cero no siempre es falta de demanda: a veces es que el producto quedó
//  sin stock, no se volvió a comprar, y la categoría siguió vendiendo. Eso es
//  venta perdida no capturada. Se deriva del maestro de productos en frontend.
// ============================================================================

export interface LostOpportunity {
  sku: string;
  name: string;
  category: string;
  supplierName: string;
  histMonthly: number; // venta mensual histórica (run-rate)
  recent: number; // venta últimos 30 días
  ventaPerdida: number; // $/mes que se está dejando de vender
  mesesSinCompra: number;
  motivo: string;
  accion: string;
  tone: "red" | "amber" | "blue";
  insight: string;
}

// Demanda mensual histórica: lo que vendía de forma estable antes del quiebre.
function histMonthlyOf(p: Product): number {
  return Math.round(Math.max(p.salesLast90Days / 3, p.salesLast180Days / 6));
}

export function lostOpportunities(): LostOpportunity[] {
  // Venta reciente por categoría (para saber si la categoría sigue viva)
  const catRecent = new Map<string, number>();
  for (const p of products)
    catRecent.set(p.category, (catRecent.get(p.category) ?? 0) + p.salesLast30Days);

  const out: LostOpportunity[] = [];
  for (const p of products) {
    const histMonthly = histMonthlyOf(p);
    const recent = p.salesLast30Days;
    const sinStock = p.availableStock <= Math.max(2, p.reorderPoint * 0.25);
    const ventaCayo = recent <= histMonthly * 0.5;
    const vendiaAntes = histMonthly >= 8;
    const categoriaViva = (catRecent.get(p.category) ?? 0) - recent > 0;

    if (!(vendiaAntes && sinStock && ventaCayo && categoriaViva)) continue;

    const ventaPerdida = Math.round((histMonthly - recent) * p.price);
    const mesesSinCompra = 2 + (hashStr(p.sku) % 5); // 2..6 meses (simulado)

    let motivo: string, accion: string, tone: LostOpportunity["tone"];
    if (recent === 0 && p.availableStock <= 0) {
      motivo = "Sin stock y sin recompra";
      accion = "Reponer stock base";
      tone = "red";
    } else if (p.availableStock <= 0) {
      motivo = "Agotado, venta cayó";
      accion = "Comprar ahora";
      tone = "amber";
    } else {
      motivo = "Categoría creciendo sin reposición";
      accion = "Reactivar compra";
      tone = "blue";
    }

    const insight = `Vendía ~${histMonthly} u./mes y dejó de comprarse hace ${mesesSinCompra} meses. La categoría ${p.category} siguió vendiendo, así que no es falta de demanda: es una oportunidad no capturada de ~${Math.round(ventaPerdida / 1000)}k/mes. ${accion}.`;

    out.push({
      sku: p.sku,
      name: p.name,
      category: p.category,
      supplierName: p.supplierName,
      histMonthly,
      recent,
      ventaPerdida,
      mesesSinCompra,
      motivo,
      accion,
      tone,
      insight,
    });
  }

  return out.sort((a, b) => b.ventaPerdida - a.ventaPerdida);
}

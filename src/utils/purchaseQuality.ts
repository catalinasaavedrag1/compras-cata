import { purchaseOrders } from "../data/mockPurchaseOrders";
import { getProductBySku } from "../data/mockProducts";
import { purchaseRules, resolveRuleForProduct } from "../data/mockRules";

// ============================================================================
//  Calidad de compra (sección 3 del spec).
//  Mide si el comprador compró bien: "días comprados" = cantidad / venta diaria,
//  comparado contra el rango objetivo de cobertura de la regla aplicable.
//  Clasifica cada línea en corta / saludable / alta / sobrecompra.
// ============================================================================

export type PurchaseClass = "corta" | "saludable" | "alta" | "sobrecompra" | "sin_venta";

export const PURCHASE_CLASS: Record<
  PurchaseClass,
  { label: string; tone: "red" | "green" | "amber" | "violet" | "neutral" }
> = {
  corta: { label: "Compra corta", tone: "red" },
  saludable: { label: "Saludable", tone: "green" },
  alta: { label: "Compra alta", tone: "amber" },
  sobrecompra: { label: "Sobrecompra", tone: "violet" },
  sin_venta: { label: "Sin venta", tone: "neutral" },
};

export interface PurchaseQualityLine {
  poId: string;
  poNumber: string;
  supplierName: string;
  buyerName: string;
  createdAt: string;
  sku: string;
  productName: string;
  quantity: number;
  amount: number;
  dailyDemand: number;
  diasComprados: number;
  objMin: number;
  objMax: number;
  klass: PurchaseClass;
}

export function purchaseQualityLines(): PurchaseQualityLine[] {
  const out: PurchaseQualityLine[] = [];
  for (const po of purchaseOrders) {
    for (const l of po.lines ?? []) {
      const p = getProductBySku(l.sku);
      const dailyDemand = p ? p.monthlySales / 30 : 0;
      const rule = p ? resolveRuleForProduct(p, purchaseRules) : null;
      const obj = rule?.targetInventoryDays ?? 45;
      const objMin = Math.round(obj * 0.7);
      const objMax = Math.round(obj * 1.3);
      const diasComprados = dailyDemand > 0 ? Math.round(l.quantity / dailyDemand) : 0;

      let klass: PurchaseClass;
      if (dailyDemand <= 0) klass = "sin_venta";
      else if (diasComprados < objMin) klass = "corta";
      else if (diasComprados <= objMax) klass = "saludable";
      else if (diasComprados <= objMax * 1.8) klass = "alta";
      else klass = "sobrecompra";

      out.push({
        poId: po.id,
        poNumber: po.number,
        supplierName: po.supplierName,
        buyerName: po.buyerName,
        createdAt: po.createdAt,
        sku: l.sku,
        productName: l.productName,
        quantity: l.quantity,
        amount: l.quantity * l.unitCost,
        dailyDemand,
        diasComprados,
        objMin,
        objMax,
        klass,
      });
    }
  }
  return out;
}

// ============================================================================
//  Filtros reutilizables para productos, recomendaciones y alertas
// ============================================================================

import type { CommercialAlert, Product, PurchaseRecommendation } from "../types/purchasing";

function matchesText(haystack: string[], query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return haystack.some((h) => h.toLowerCase().includes(q));
}

export interface ProductFilters {
  query?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  supplier?: string;
  productStatus?: string;
  purchaseStatus?: string;
  lowMargin?: boolean;
  noSupplier?: boolean;
  noSales?: boolean;
}

export function filterProducts(products: Product[], f: ProductFilters): Product[] {
  return products.filter((p) => {
    if (!matchesText([p.sku, p.name, p.brand], f.query ?? "")) return false;
    if (f.category && p.category !== f.category) return false;
    if (f.subcategory && p.subcategory !== f.subcategory) return false;
    if (f.brand && p.brand !== f.brand) return false;
    if (f.supplier && p.supplierName !== f.supplier) return false;
    if (f.productStatus && p.productStatus !== f.productStatus) return false;
    if (f.purchaseStatus && p.purchaseStatus !== f.purchaseStatus) return false;
    if (f.lowMargin && p.margin >= 20) return false;
    if (f.noSupplier && p.supplierName) return false;
    if (f.noSales && p.salesLast30Days > 0) return false;
    return true;
  });
}

export interface RecommendationFilters {
  query?: string;
  category?: string;
  supplier?: string;
  brand?: string;
  status?: string;
  priority?: string;
  stockout?: boolean;
  stockoutRisk?: boolean;
  overstock?: boolean;
  lowMargin?: boolean;
  highRotation?: boolean;
  lowRotation?: boolean;
}

export function filterRecommendations(
  recs: PurchaseRecommendation[],
  f: RecommendationFilters
): PurchaseRecommendation[] {
  return recs.filter((r) => {
    if (!matchesText([r.sku, r.productName, r.brand], f.query ?? "")) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.supplier && r.supplierName !== f.supplier) return false;
    if (f.brand && r.brand !== f.brand) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.priority && r.priority !== f.priority) return false;
    if (f.stockout && r.availableStock > 0) return false;
    if (f.stockoutRisk && r.status !== "critical" && r.status !== "buy_now") return false;
    if (f.overstock && r.status !== "overstock") return false;
    if (f.lowMargin && r.margin >= 20) return false;
    if (f.highRotation && r.rotation < 8) return false;
    if (f.lowRotation && r.rotation >= 4) return false;
    return true;
  });
}

export interface AlertFilters {
  query?: string;
  type?: string;
  severity?: string;
  status?: string;
}

export function filterAlerts(alerts: CommercialAlert[], f: AlertFilters): CommercialAlert[] {
  return alerts.filter((a) => {
    if (!matchesText([a.relatedEntity, a.description, a.relatedSku ?? ""], f.query ?? ""))
      return false;
    if (f.type && a.type !== f.type) return false;
    if (f.severity && a.severity !== f.severity) return false;
    if (f.status && a.status !== f.status) return false;
    return true;
  });
}

/** Extrae valores únicos de un campo para poblar selects de filtro */
export function uniqueValues<T>(items: T[], key: (item: T) => string): string[] {
  return Array.from(new Set(items.map(key).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "es")
  );
}

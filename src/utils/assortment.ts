import type { BadgeTone } from "../components/ui/Badge";
import type { Category, Product } from "../types/purchasing";

// ============================================================================
//  Gestión de surtido (category management)
//  ---------------------------------------------------------------------------
//  Decide QUÉ surtido llevar, no solo cuánto reponer:
//    · rol estratégico de cada categoría (tráfico / margen / nicho / conveniencia),
//    · surtido por tienda/cluster y sus brechas,
//    · penetración de marca propia,
//    · altas (NPI) y candidatos a salida (line review).
//  Todo se deriva de los datos que ya existen (categorías, productos, stock por
//  ubicación). Es una estimación para decidir, no un planograma real.
// ============================================================================

// ----------------------------------------------------------------------------
//  Rol de categoría
// ----------------------------------------------------------------------------

export type CategoryRole = "trafico" | "margen" | "nicho" | "conveniencia";

export const CATEGORY_ROLE_META: Record<
  CategoryRole,
  { label: string; description: string; tone: BadgeTone }
> = {
  trafico: {
    label: "Tráfico",
    description: "Genera visitas y volumen. Nunca puede quebrar; precio competitivo.",
    tone: "blue",
  },
  margen: {
    label: "Margen",
    description: "Aporta rentabilidad. Cuida el mix y protege el margen.",
    tone: "green",
  },
  nicho: {
    label: "Nicho",
    description: "Especialista/proyecto. Profundiza surtido donde eres referente.",
    tone: "violet",
  },
  conveniencia: {
    label: "Conveniencia",
    description: "Completa la misión de compra. Surtido acotado, sin sobreinvertir.",
    tone: "neutral",
  },
};

/**
 * Clasifica el rol de cada categoría de forma relativa al conjunto: las de mayor
 * venta cumplen rol de tráfico; entre el resto, las de mejor margen son de margen;
 * las de surtido amplio y venta media son de nicho; las chicas, de conveniencia.
 */
export function classifyCategoryRoles(categories: Category[]): Map<string, CategoryRole> {
  const roles = new Map<string, CategoryRole>();
  if (categories.length === 0) return roles;

  const bySales = [...categories].sort((a, b) => b.salesLast30Days - a.salesLast30Days);
  const trafficCut = Math.max(1, Math.ceil(categories.length * 0.3));
  const trafficIds = new Set(bySales.slice(0, trafficCut).map((c) => c.id));

  const marginSorted = [...categories].sort((a, b) => b.averageMargin - a.averageMargin);
  const medianMargin = marginSorted[Math.floor(marginSorted.length / 2)].averageMargin;
  const medianSkus = [...categories].sort((a, b) => a.activeSkus - b.activeSkus)[
    Math.floor(categories.length / 2)
  ].activeSkus;

  for (const c of categories) {
    if (trafficIds.has(c.id)) {
      roles.set(c.id, "trafico");
    } else if (c.averageMargin >= medianMargin) {
      roles.set(c.id, "margen");
    } else if (c.activeSkus >= medianSkus) {
      roles.set(c.id, "nicho");
    } else {
      roles.set(c.id, "conveniencia");
    }
  }
  return roles;
}

// ----------------------------------------------------------------------------
//  Marca propia / private label
// ----------------------------------------------------------------------------

/** Marcas que la cadena maneja como propias (demo). */
export const PRIVATE_LABEL_BRANDS: ReadonlySet<string> = new Set(["Andes", "Genérica", "Fix"]);

export function isPrivateLabel(product: Product): boolean {
  return product.marcaPropia ?? PRIVATE_LABEL_BRANDS.has(product.brand);
}

export interface PrivateLabelRow {
  category: string;
  skus: number;
  privateSkus: number;
  /** % del surtido que es marca propia. */
  skuMixPct: number;
  sales: number;
  privateSales: number;
  /** % de la venta que aporta la marca propia. */
  salesMixPct: number;
  /** Margen promedio ponderado de la marca propia (0 si no hay). */
  privateMarginPct: number;
  /** Margen promedio ponderado de la marca nacional. */
  nationalMarginPct: number;
}

function weightedMargin(items: Product[]): number {
  const units = items.reduce((a, p) => a + p.salesLast30Days, 0);
  if (units <= 0) return items.length ? items.reduce((a, p) => a + p.margin, 0) / items.length : 0;
  return items.reduce((a, p) => a + p.margin * p.salesLast30Days, 0) / units;
}

/** Penetración de marca propia por categoría (mix de SKU, de venta y margen). */
export function privateLabelByCategory(products: Product[]): PrivateLabelRow[] {
  const byCat = new Map<string, Product[]>();
  for (const p of products) {
    const arr = byCat.get(p.category) ?? [];
    arr.push(p);
    byCat.set(p.category, arr);
  }
  const rows: PrivateLabelRow[] = [];
  for (const [category, items] of byCat) {
    const priv = items.filter(isPrivateLabel);
    const nat = items.filter((p) => !isPrivateLabel(p));
    const sales = items.reduce((a, p) => a + p.salesLast30Days * p.price, 0);
    const privateSales = priv.reduce((a, p) => a + p.salesLast30Days * p.price, 0);
    rows.push({
      category,
      skus: items.length,
      privateSkus: priv.length,
      skuMixPct: items.length ? (priv.length / items.length) * 100 : 0,
      sales,
      privateSales,
      salesMixPct: sales > 0 ? (privateSales / sales) * 100 : 0,
      privateMarginPct: weightedMargin(priv),
      nationalMarginPct: weightedMargin(nat),
    });
  }
  return rows.sort((a, b) => b.sales - a.sales);
}

// ----------------------------------------------------------------------------
//  Surtido por tienda / cluster
// ----------------------------------------------------------------------------

/** Agrupa las ubicaciones físicas en clusters legibles (demo, por palabra clave). */
export function clusterOf(locationName: string): string {
  const n = locationName.toLowerCase();
  if (n.includes("san javier")) return "Zona San Javier";
  if (n.includes("santiago") || n.includes("central")) return "Zona Centro";
  if (n.includes("distribución") || n.includes("distribucion")) return "Centro de Distribución";
  if (n.includes("norte")) return "Zona Norte";
  if (n.includes("sur")) return "Zona Sur";
  return "Otras";
}

export interface ClusterAssortment {
  cluster: string;
  /** SKU con presencia (stock) en el cluster. */
  presentes: number;
  /** SKU que venden a nivel nacional pero no tienen stock en el cluster. */
  brechas: number;
  brechaSkus: { sku: string; name: string; category: string; sales30: number }[];
}

/**
 * Cobertura de surtido por cluster: cuántos SKU están presentes y qué SKU que sí
 * venden a nivel nacional faltan en cada cluster (brecha de surtido localizado).
 */
export function assortmentByCluster(products: Product[]): ClusterAssortment[] {
  const clusters = new Map<string, { present: Set<string> }>();
  for (const p of products) {
    for (const loc of p.stockByLocation) {
      const cl = clusterOf(loc.locationName);
      const entry = clusters.get(cl) ?? { present: new Set<string>() };
      if (loc.stock > 0) entry.present.add(p.sku);
      clusters.set(cl, entry);
    }
  }

  // Un SKU es "vendedor" si tiene venta relevante a nivel nacional.
  const sellers = products.filter((p) => p.salesLast30Days >= 10);

  const rows: ClusterAssortment[] = [];
  for (const [cluster, { present }] of clusters) {
    // Brecha: SKU que vende a nivel nacional pero no tiene stock en el cluster
    // (no se lleva ahí, o está quebrado localmente).
    const brechaSkus = sellers
      .filter((p) => !present.has(p.sku))
      .map((p) => ({ sku: p.sku, name: p.name, category: p.category, sales30: p.salesLast30Days }))
      .sort((a, b) => b.sales30 - a.sales30);
    rows.push({
      cluster,
      presentes: present.size,
      brechas: brechaSkus.length,
      brechaSkus: brechaSkus.slice(0, 8),
    });
  }
  return rows.sort((a, b) => b.presentes - a.presentes);
}

// ----------------------------------------------------------------------------
//  NPI (altas) y line review (candidatos a salida)
// ----------------------------------------------------------------------------

export interface AssortmentChange {
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  supplierName: string;
  sales30: number;
  margin: number;
  availableStock: number;
  /** Motivo del ingreso o de la salida. */
  reason: string;
}

/** Productos nuevos por evaluar en el surtido (NPI). */
export function newProducts(products: Product[]): AssortmentChange[] {
  return products
    .filter((p) => p.productStatus === "new")
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      subcategory: p.subcategory,
      brand: p.brand,
      supplierName: p.supplierName,
      sales30: p.salesLast30Days,
      margin: p.margin,
      availableStock: p.availableStock,
      reason:
        p.salesLast30Days > 0
          ? "Nuevo con venta inicial: confirma reposición y espacio."
          : "Nuevo sin venta aún: valida rotación antes de reordenar.",
    }))
    .sort((a, b) => b.sales30 - a.sales30);
}

/** Candidatos a salida del surtido (line review): sin venta, descontinuados o baja rotación. */
export function exitCandidates(products: Product[]): AssortmentChange[] {
  return products
    .filter(
      (p) =>
        p.productStatus === "discontinued" ||
        p.productStatus === "no_sales" ||
        (p.salesLast90Days === 0 && p.availableStock > 0) ||
        p.purchaseStatus === "do_not_buy"
    )
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      subcategory: p.subcategory,
      brand: p.brand,
      supplierName: p.supplierName,
      sales30: p.salesLast30Days,
      margin: p.margin,
      availableStock: p.availableStock,
      reason:
        p.productStatus === "discontinued"
          ? "Descontinuado: liquida el saldo y libera espacio."
          : p.salesLast90Days === 0
            ? "Sin venta en 90 días con stock: candidato a salida."
            : "Marcado no comprar: revisa si sale del surtido.",
    }))
    .sort((a, b) => b.availableStock * b.margin - a.availableStock * a.margin);
}

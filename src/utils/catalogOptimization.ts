import type { Product } from "../types/purchasing";
import { formatNumber } from "./formatters";

// ============================================================================
//  Optimización de catálogo: detección de productos redundantes por exceso de
//  variedad dentro de un mismo tipo de producto (subcategoría).
//
//  Idea de negocio: para un mismo tipo de producto (p. ej. "alargador 5 m")
//  basta con UNA opción por gama de precio — económica, media y premium. Cada
//  gama sirve a un cliente distinto, así que conviene conservar la mejor de
//  cada una. Tener VARIAS opciones en la misma gama es redundante: duplican el
//  mismo segmento sin aportar diferenciación, inmovilizan capital y complican
//  la operación (el caso de "10 martillos" o "10 alargadores iguales").
// ============================================================================

export type RedundancyAction = "liquidate" | "discontinue" | "review";
export type RedundancySeverity = "high" | "medium";
export type PriceTier = "low" | "mid" | "high";

export const TIER_LABEL: Record<PriceTier, string> = {
  low: "económica",
  mid: "media",
  high: "premium",
};

export interface RedundantCandidate {
  product: Product;
  /** SKU/nombre del referente que ya cubre esa gama (a conservar). */
  leaderSku: string;
  leaderName: string;
  segment: PriceTier;
  /** Venta del candidato como fracción (0-1) de la del referente. */
  salesShareVsLeader: number;
  reason: string;
  /** Capital inmovilizado en este SKU (costo × stock total). */
  tiedCapital: number;
  action: RedundancyAction;
  severity: RedundancySeverity;
}

export interface KeeperProduct {
  product: Product;
  segment: PriceTier;
  /** El mejor de su gama, pero marcado "no comprar"/descontinuado: conviene
   *  reactivarlo en vez de dejar uno peor. (Caso de surtido invertido.) */
  reactivate: boolean;
}

export interface RedundancyGroup {
  category: string;
  subcategory: string;
  /** Surtido sugerido: el mejor SKU de cada gama presente. */
  keepers: KeeperProduct[];
  candidates: RedundantCandidate[];
  /** Todos los SKUs del grupo. */
  members: Product[];
  /** Capital liberable sumando los candidatos del grupo. */
  freeableCapital: number;
}

export interface CatalogAnalysis {
  groups: RedundancyGroup[];
  /** N.º de tipos de producto (subcategorías) con exceso de variedad. */
  saturatedSubcategories: number;
  /** N.º total de SKUs redundantes. */
  candidateCount: number;
  /** SKUs que bastarían en los grupos con exceso (suma de "keepers"). */
  curatedCount: number;
  /** Referentes (mejores de su gama) marcados "no comprar" a reactivar. */
  reactivateCount: number;
  /** Capital inmovilizado total que podría liberarse. */
  freeableCapital: number;
  /** Total de SKUs analizados en el ámbito. */
  totalSkus: number;
  /** Fracción del surtido (0-1) que es redundante. */
  redundantShare: number;
}

/**
 * Ordena de mejor a peor desempeño: primero venta reciente, luego rotación y
 * por último margen (más rentable). Así el referente de cada gama es el que
 * realmente conviene conservar, no el que esté activo por inercia.
 */
function better(a: Product, b: Product): number {
  return b.salesLast30Days - a.salesLast30Days || b.rotation - a.rotation || b.margin - a.margin;
}

/** El mejor de su gama, pero marcado "no comprar" o descontinuado. */
function needsReactivation(p: Product): boolean {
  return p.purchaseStatus === "do_not_buy" || p.productStatus === "discontinued";
}

/** Gama de precio del SKU dentro del rango de precios de su tipo de producto. */
function tierOf(price: number, min: number, max: number): PriceTier {
  if (max <= min) return "mid"; // todos al mismo precio → misma gama
  const t = (price - min) / (max - min);
  if (t < 1 / 3) return "low";
  if (t > 2 / 3) return "high";
  return "mid";
}

function buildReason(p: Product, keeper: Product, segment: PriceTier, share: number): string {
  const gama = TIER_LABEL[segment];
  if (p.productStatus === "discontinued")
    return `Descontinuado; duplica la gama ${gama} (“${keeper.name}”)`;
  if (p.productStatus === "no_sales")
    return `Sin ventas; duplica la gama ${gama} (“${keeper.name}”)`;
  const pct = Math.round(share * 100);
  return `Gama ${gama} ya cubierta por “${keeper.name}” · vende ${formatNumber(p.salesLast30Days)}/mes (${pct}% del referente)`;
}

function classify(p: Product): { action: RedundancyAction; severity: RedundancySeverity } {
  const dead = p.productStatus === "no_sales" || p.productStatus === "discontinued";
  const action: RedundancyAction = dead || p.totalStock === 0 ? "discontinue" : "liquidate";
  const severity: RedundancySeverity = dead || p.inventoryDays >= 120 ? "high" : "medium";
  return { action, severity };
}

const TIER_ORDER: PriceTier[] = ["low", "mid", "high"];

export function analyzeCatalog(products: Product[]): CatalogAnalysis {
  // Agrupar por tipo de producto: categoría → subcategoría.
  const byKey = new Map<string, Product[]>();
  for (const p of products) {
    const key = `${p.category}|||${p.subcategory}`;
    const arr = byKey.get(key);
    if (arr) arr.push(p);
    else byKey.set(key, [p]);
  }

  const groups: RedundancyGroup[] = [];
  for (const members of byKey.values()) {
    if (members.length < 2) continue;

    const prices = members.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Repartir en gamas y, dentro de cada gama, conservar el de mejor desempeño.
    const buckets = new Map<PriceTier, Product[]>();
    for (const p of members) {
      const tier = tierOf(p.price, min, max);
      const b = buckets.get(tier);
      if (b) b.push(p);
      else buckets.set(tier, [p]);
    }

    const keepers: KeeperProduct[] = [];
    const candidates: RedundantCandidate[] = [];
    for (const tier of TIER_ORDER) {
      const bucket = buckets.get(tier);
      if (!bucket || bucket.length === 0) continue;
      const sorted = [...bucket].sort(better);
      const keeper = sorted[0];
      keepers.push({ product: keeper, segment: tier, reactivate: needsReactivation(keeper) });
      for (const p of sorted.slice(1)) {
        const share =
          keeper.salesLast30Days > 0
            ? p.salesLast30Days / keeper.salesLast30Days
            : p.salesLast30Days > 0
              ? 1
              : 0;
        const { action, severity } = classify(p);
        candidates.push({
          product: p,
          leaderSku: keeper.sku,
          leaderName: keeper.name,
          segment: tier,
          salesShareVsLeader: share,
          reason: buildReason(p, keeper, tier, share),
          tiedCapital: Math.round(p.cost * p.totalStock),
          action,
          severity,
        });
      }
    }
    if (candidates.length === 0) continue;

    const freeableCapital = candidates.reduce((s, c) => s + c.tiedCapital, 0);
    groups.push({
      category: members[0].category,
      subcategory: members[0].subcategory,
      keepers,
      candidates,
      members,
      freeableCapital,
    });
  }

  // Mayor capital liberable primero: prioriza dónde optimizar.
  groups.sort((a, b) => b.freeableCapital - a.freeableCapital);

  const candidateCount = groups.reduce((n, g) => n + g.candidates.length, 0);
  const curatedCount = groups.reduce((n, g) => n + g.keepers.length, 0);
  const reactivateCount = groups.reduce(
    (n, g) => n + g.keepers.filter((k) => k.reactivate).length,
    0
  );
  const freeableCapital = groups.reduce((s, g) => s + g.freeableCapital, 0);
  const totalSkus = products.length;
  return {
    groups,
    saturatedSubcategories: groups.length,
    candidateCount,
    curatedCount,
    reactivateCount,
    freeableCapital,
    totalSkus,
    redundantShare: totalSkus > 0 ? candidateCount / totalSkus : 0,
  };
}

export const ACTION_LABEL: Record<RedundancyAction, string> = {
  liquidate: "Liquidar",
  discontinue: "Descontinuar",
  review: "Revisar",
};

// ----------------------------------------------------------------------------
//  Estado de optimización de un SKU concreto, para conectar con otras vistas
//  (detalle de producto, dashboard, etc.).
// ----------------------------------------------------------------------------

export interface SkuOptimizationStatus {
  kind: "redundant" | "reactivate" | "none";
  category?: string;
  subcategory?: string;
  segment?: PriceTier;
  action?: RedundancyAction;
  /** Referente que ya cubre la gama (en el caso redundante). */
  leaderName?: string;
}

export function skuOptimizationStatus(sku: string, products: Product[]): SkuOptimizationStatus {
  const { groups } = analyzeCatalog(products);
  for (const g of groups) {
    const cand = g.candidates.find((c) => c.product.sku === sku);
    if (cand) {
      return {
        kind: "redundant",
        category: g.category,
        subcategory: g.subcategory,
        segment: cand.segment,
        action: cand.action,
        leaderName: cand.leaderName,
      };
    }
    const keep = g.keepers.find((k) => k.reactivate && k.product.sku === sku);
    if (keep) {
      return {
        kind: "reactivate",
        category: g.category,
        subcategory: g.subcategory,
        segment: keep.segment,
      };
    }
  }
  return { kind: "none" };
}

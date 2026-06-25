import type { Product } from "../types/purchasing";
import { formatNumber, formatDays } from "./formatters";

// ============================================================================
//  Optimización de catálogo: detección de productos redundantes.
//
//  Idea de negocio: dentro de una misma categoría → subcategoría suele haber
//  varios SKUs que compiten por la misma demanda. Cuando hay 2+, el de mejor
//  venta/rotación es el "líder a conservar" y los que lo duplican con bajo
//  desempeño son candidatos a liquidar o descontinuar. Racionalizar el surtido
//  libera capital inmovilizado y simplifica la operación.
// ============================================================================

export type RedundancyAction = "liquidate" | "discontinue" | "review";
export type RedundancySeverity = "high" | "medium";

export interface RedundantCandidate {
  product: Product;
  leaderSku: string;
  leaderName: string;
  /** Venta del candidato como fracción (0-1) de la del líder. */
  salesShareVsLeader: number;
  /** Motivo por el que se considera redundante, en lenguaje de negocio. */
  reason: string;
  /** Capital inmovilizado en este SKU (costo × stock total). */
  tiedCapital: number;
  action: RedundancyAction;
  severity: RedundancySeverity;
}

export interface RedundancyGroup {
  category: string;
  subcategory: string;
  /** SKU con mejor desempeño del grupo (a conservar). */
  leader: Product;
  /** Todos los SKUs del grupo, ordenados por desempeño. */
  members: Product[];
  candidates: RedundantCandidate[];
  /** Capital liberable sumando los candidatos del grupo. */
  freeableCapital: number;
}

export interface CatalogAnalysis {
  groups: RedundancyGroup[];
  /** N.º de subcategorías con al menos un SKU redundante. */
  saturatedSubcategories: number;
  /** N.º total de SKUs redundantes. */
  candidateCount: number;
  /** Capital inmovilizado total que podría liberarse. */
  freeableCapital: number;
  /** Total de SKUs analizados en el ámbito. */
  totalSkus: number;
  /** Fracción del surtido (0-1) que es redundante. */
  redundantShare: number;
}

/** Desempeño comparable de un SKU: venta reciente, con rotación como desempate. */
function performance(p: Product): number {
  return p.salesLast30Days * 1000 + p.rotation;
}

function buildReason(p: Product, leader: Product, share: number): string {
  if (p.productStatus === "discontinued") return `Descontinuado; duplica a “${leader.name}”`;
  if (p.productStatus === "no_sales") return `Sin ventas; duplica a “${leader.name}”`;
  const pct = Math.round(share * 100);
  const parts = [`Vende ${formatNumber(p.salesLast30Days)}/mes (${pct}% del líder)`];
  if (p.inventoryDays >= 90) parts.push(`${formatDays(p.inventoryDays)} de inventario`);
  if (p.purchaseStatus === "overstock") parts.push("en sobrestock");
  return parts.join(" · ");
}

function classify(p: Product): { action: RedundancyAction; severity: RedundancySeverity } {
  const dead = p.productStatus === "no_sales" || p.productStatus === "discontinued";
  let action: RedundancyAction;
  if (dead || p.totalStock === 0) action = "discontinue";
  else action = "liquidate";
  const severity: RedundancySeverity = dead || p.inventoryDays >= 120 ? "high" : "medium";
  return { action, severity };
}

/**
 * Un SKU no-líder es redundante si claramente sub-rinde frente al líder de su
 * subcategoría, o si su estado lo señala (sin ventas, descontinuado, sobrestock).
 */
function isRedundant(p: Product, leader: Product, share: number): boolean {
  if (p.productStatus === "no_sales" || p.productStatus === "discontinued") return true;
  if (p.purchaseStatus === "overstock" || p.purchaseStatus === "do_not_buy") return true;
  if (share < 0.4) return true;
  if (leader.rotation > 0 && p.rotation < leader.rotation * 0.5) return true;
  return false;
}

export function analyzeCatalog(products: Product[]): CatalogAnalysis {
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
    const sorted = [...members].sort((a, b) => performance(b) - performance(a));
    const leader = sorted[0];

    const candidates: RedundantCandidate[] = [];
    for (const p of sorted.slice(1)) {
      const share =
        leader.salesLast30Days > 0
          ? p.salesLast30Days / leader.salesLast30Days
          : p.salesLast30Days > 0
            ? 1
            : 0;
      if (!isRedundant(p, leader, share)) continue;
      const { action, severity } = classify(p);
      candidates.push({
        product: p,
        leaderSku: leader.sku,
        leaderName: leader.name,
        salesShareVsLeader: share,
        reason: buildReason(p, leader, share),
        tiedCapital: Math.round(p.cost * p.totalStock),
        action,
        severity,
      });
    }
    if (candidates.length === 0) continue;

    const freeableCapital = candidates.reduce((s, c) => s + c.tiedCapital, 0);
    groups.push({
      category: leader.category,
      subcategory: leader.subcategory,
      leader,
      members: sorted,
      candidates,
      freeableCapital,
    });
  }

  // Mayor capital liberable primero: prioriza dónde optimizar.
  groups.sort((a, b) => b.freeableCapital - a.freeableCapital);

  const candidateCount = groups.reduce((n, g) => n + g.candidates.length, 0);
  const freeableCapital = groups.reduce((s, g) => s + g.freeableCapital, 0);
  const totalSkus = products.length;
  return {
    groups,
    saturatedSubcategories: groups.length,
    candidateCount,
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

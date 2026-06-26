import type { BadgeTone } from "../components/ui/Badge";
import type { Workload, Buyer } from "../types/team";

// ============================================================================
//  Helpers de score, tendencia y carga del equipo de compras.
// ============================================================================

export function scoreLabel(s: number): string {
  if (s >= 90) return "Excelente";
  if (s >= 80) return "Muy bueno";
  if (s >= 70) return "Bueno";
  if (s >= 55) return "Debe mejorar";
  return "Crítico";
}

export function scoreTone(s: number): BadgeTone {
  if (s >= 90) return "green";
  if (s >= 80) return "blue";
  if (s >= 55) return "amber";
  return "red";
}

/** Color hex para textos/gráficos según score. */
export function scoreColor(s: number): string {
  if (s >= 90) return "#059669";
  if (s >= 80) return "#1b3bad";
  if (s >= 70) return "#b45309";
  if (s >= 55) return "#d97706";
  return "#be123c";
}

export const WORKLOAD_CFG: Record<Workload, { label: string; tone: BadgeTone }> = {
  muy_baja: { label: "Muy baja", tone: "slate" },
  baja: { label: "Baja", tone: "blue" },
  normal: { label: "Normal", tone: "green" },
  alta: { label: "Alta", tone: "amber" },
  critica: { label: "Crítica", tone: "red" },
};

/** Color hex de la barra de carga. */
export function workloadBarColor(pct: number): string {
  if (pct >= 90) return "#f43f5e";
  if (pct >= 75) return "#f59e0b";
  return "#10b981";
}

export function trendText(t: number): string {
  if (t > 0) return `+${t} pts`;
  if (t < 0) return `${t} pts`;
  return "Sin cambio";
}

export function trendColor(t: number): string {
  if (t > 0) return "#059669";
  if (t < 0) return "#e11d48";
  return "#94a3b8";
}

/** Agregados del equipo a partir de la lista de compradores. */
export function teamAggregate(bs: Buyer[]) {
  const n = bs.length || 1;
  const sum = (f: (b: Buyer) => number) => bs.reduce((a, b) => a + f(b), 0);
  return {
    n: bs.length,
    avgScore: Math.round(sum((b) => b.score) / n),
    goalArea: Math.round(sum((b) => b.goalComp) / n),
    fillRate: Math.round(sum((b) => b.fillRate) / n),
    sla: Math.round(sum((b) => b.sla) / n),
    stockouts: sum((b) => b.stockouts),
    critical: sum((b) => b.critical),
    overstock: sum((b) => b.overstock),
    pending: sum((b) => b.pending),
    openPO: sum((b) => b.openPO),
    replen: Math.round(sum((b) => b.replenDays) / n),
    categories: sum((b) => b.categories.length),
    suppliers: sum((b) => b.suppliers),
    brands: sum((b) => b.brands),
    products: sum((b) => b.products),
    sales: sum((b) => b.sales),
    savings: sum((b) => b.savings),
  };
}

const WORKLOAD_ORDER: Record<Workload, number> = {
  critica: 0,
  alta: 1,
  normal: 2,
  baja: 3,
  muy_baja: 4,
};

export function byWorkloadDesc(a: Buyer, b: Buyer): number {
  return WORKLOAD_ORDER[a.workload] - WORKLOAD_ORDER[b.workload];
}

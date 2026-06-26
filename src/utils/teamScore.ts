import type { BadgeTone } from "../components/ui/Badge";
import type { Workload, Buyer } from "../types/team";
import { TODAY_ISO } from "./constants";

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

// ----------------------------------------------------------------------------
//  Ligas / niveles del comprador
// ----------------------------------------------------------------------------
export interface League {
  name: string;
  min: number;
  max: number;
  tone: BadgeTone;
  color: string;
}

export const LEAGUES: League[] = [
  { name: "Bronce", min: 0, max: 59, tone: "slate", color: "#a16207" },
  { name: "Plata", min: 60, max: 74, tone: "blue", color: "#64748b" },
  { name: "Oro", min: 75, max: 84, tone: "amber", color: "#d97706" },
  { name: "Elite", min: 85, max: 94, tone: "violet", color: "#7c3aed" },
  { name: "Leyenda", min: 95, max: 100, tone: "green", color: "#059669" },
];

export function leagueOf(score: number): { league: League; next: League | null; ptsToNext: number } {
  const idx = LEAGUES.findIndex((l) => score >= l.min && score <= l.max);
  const i = idx < 0 ? 0 : idx;
  const next = i < LEAGUES.length - 1 ? LEAGUES[i + 1] : null;
  return { league: LEAGUES[i], next, ptsToNext: next ? next.min - score : 0 };
}

/** Recuperación = puntos ganados/perdidos en el historial de score (6 semanas). */
export function recovery(b: Buyer): number {
  if (!b.scoreHist.length) return 0;
  return b.scoreHist[b.scoreHist.length - 1] - b.scoreHist[0];
}

/** Tasa de quiebre aproximada = quiebres / SKUs gestionados. */
export function stockoutRate(b: Buyer): number {
  return b.products > 0 ? Math.round((b.stockouts / b.products) * 1000) / 10 : 0;
}

/** Percentil del comprador comparado con quienes tienen carga similar (±20 pts). */
export function percentileSimilarLoad(b: Buyer, all: Buyer[]): number {
  let group = all.filter((x) => Math.abs(x.workloadPct - b.workloadPct) <= 20);
  if (group.length < 3) group = all;
  const sorted = [...group].sort((x, y) => x.score - y.score);
  const rank = sorted.findIndex((x) => x.id === b.id); // 0 = peor
  if (sorted.length <= 1) return 100;
  return Math.round((rank / (sorted.length - 1)) * 100);
}

export interface RankingDef {
  key: string;
  title: string;
  /** valor a mostrar por comprador */
  valueText: (b: Buyer) => string;
  /** orden: número comparable (mayor = mejor salvo asc) */
  sortValue: (b: Buyer) => number;
  asc?: boolean; // true = menor es mejor
}

/** Rankings específicos del spec (margen, quiebres, rotación, recuperación, sobrestock). */
export const RANKING_DEFS: RankingDef[] = [
  { key: "margen", title: "Mejor margen bruto", valueText: (b) => `${b.margin.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, sortValue: (b) => b.margin },
  { key: "quiebres", title: "Menor tasa de quiebres", valueText: (b) => `${stockoutRate(b).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, sortValue: (b) => stockoutRate(b), asc: true },
  { key: "rotacion", title: "Mayor rotación saludable", valueText: (b) => `${b.rotation.toLocaleString("es-CL", { maximumFractionDigits: 1 })}x`, sortValue: (b) => b.rotation },
  { key: "recuperacion", title: "Mayor mejora vs mes anterior", valueText: (b) => `${recovery(b) > 0 ? "+" : ""}${recovery(b)} pts`, sortValue: (b) => recovery(b) },
];

export interface Badge {
  key: string;
  label: string;
  winner: Buyer;
  valueText: string;
}

/** Reconocimientos del mes: el mejor de cada dimensión. */
export function badgesOf(buyers: Buyer[]): Badge[] {
  if (!buyers.length) return [];
  const best = (fn: (b: Buyer) => number, asc = false): Buyer =>
    [...buyers].sort((a, b) => (asc ? fn(a) - fn(b) : fn(b) - fn(a)))[0];
  const f1 = (n: number) => n.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const defs: { key: string; label: string; winner: Buyer; valueText: string }[] = [
    (() => { const w = best((b) => b.margin); return { key: "margen", label: "Mejor margen", winner: w, valueText: `${f1(w.margin)}%` }; })(),
    (() => { const w = best((b) => stockoutRate(b), true); return { key: "quiebres", label: "Menos quiebres", winner: w, valueText: `${f1(stockoutRate(w))}%` }; })(),
    (() => { const w = best((b) => b.rotation); return { key: "rotacion", label: "Mejor rotación", winner: w, valueText: `${w.rotation.toLocaleString("es-CL", { maximumFractionDigits: 1 })}x` }; })(),
    (() => { const w = best((b) => recovery(b)); return { key: "mejora", label: "Mayor mejora", winner: w, valueText: `${recovery(w) > 0 ? "+" : ""}${recovery(w)} pts` }; })(),
    (() => { const w = best((b) => b.overstock, true); return { key: "sobrestock", label: "Mejor sobrestock", winner: w, valueText: `${w.overstock} SKUs` }; })(),
    (() => { const w = best((b) => b.savings); return { key: "ahorro", label: "Mejor negociador", winner: w, valueText: `$${(w.savings / 1e6).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M` }; })(),
  ];
  return defs;
}

// ----------------------------------------------------------------------------
//  Temporada: días para el cierre y movimiento de liga (ascenso/descenso)
// ----------------------------------------------------------------------------
export function daysToClose(toISO: string): number {
  const end = new Date(`${toISO}T00:00:00`).getTime();
  const today = new Date(`${TODAY_ISO}T00:00:00`).getTime();
  return Math.max(0, Math.round((end - today) / 86400000));
}

export type SeasonMove = "ascenso" | "descenso" | "mantiene";

export function seasonStatus(b: Buyer): { move: SeasonMove; from: League; to: League; delta: number } {
  const to = leagueOf(b.score).league;
  const from = leagueOf(b.prevSeasonScore).league;
  const delta = LEAGUES.indexOf(to) - LEAGUES.indexOf(from);
  const move: SeasonMove = delta > 0 ? "ascenso" : delta < 0 ? "descenso" : "mantiene";
  return { move, from, to, delta };
}

export const SEASON_MOVE_CFG: Record<SeasonMove, { label: string; tone: BadgeTone; arrow: string }> = {
  ascenso: { label: "Ascenso", tone: "green", arrow: "▲" },
  descenso: { label: "Descenso", tone: "red", arrow: "▼" },
  mantiene: { label: "Mantiene", tone: "slate", arrow: "=" },
};

/** Consejos por dimensión del score para "cómo subir mi score". */
export const SCORE_ADVICE: Record<string, string> = {
  "Cumplimiento de venta": "Asegura disponibilidad en tus productos de mayor venta",
  "Margen bruto": "Renegocia costos con proveedores críticos o ajusta el precio",
  "Reducción de quiebres": "Repón a tiempo los SKUs en riesgo de quiebre",
  "Rotación de inventario": "Compra más ajustado: evita sobrecomprar",
  "Cumplimiento de OC": "Regulariza las OC atrasadas y revisa los lead times",
  "Gestión de sobrestock": "Liquida o promociona el stock sobre el máximo",
};

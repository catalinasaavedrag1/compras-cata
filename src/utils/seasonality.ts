import { products } from "../data/mockProducts";
import { getSupplierByName } from "../data/mockSuppliers";
import { supplierFulfillment } from "./supplierPerf";

// ============================================================================
//  Inteligencia estacional del proveedor (simulada en frontend, determinista).
//  Genera 24 meses de venta/margen/quiebres/fill y deriva temporada, score,
//  clasificación, pre-temporada y recomendación accionable.
// ============================================================================

const MABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Perfiles estacionales por grupo de categoría (multiplicador por mes, idx 0=Ene)
const PROFILES: Record<string, number[]> = {
  construccion: [1.15, 1.05, 1.1, 0.95, 0.85, 0.8, 0.8, 0.85, 1.05, 1.2, 1.25, 1.15],
  jardin: [1.4, 1.3, 1.05, 0.8, 0.55, 0.45, 0.45, 0.55, 0.9, 1.2, 1.45, 1.5],
  herramientas: [0.95, 0.9, 0.95, 0.95, 1.0, 1.25, 1.0, 0.95, 1.0, 1.05, 1.35, 1.2],
  pinturas: [1.2, 1.1, 1.1, 1.0, 0.85, 0.75, 0.75, 0.85, 1.05, 1.2, 1.2, 1.15],
  flat: [1, 1, 1, 1, 0.95, 0.95, 0.95, 1, 1, 1.05, 1.1, 1.05],
};

function profileFor(category: string): number[] {
  const c = category.toLowerCase();
  if (/(construcci|madera|ferreter|gasfiter|electric)/.test(c)) return PROFILES.construccion;
  if (/(jard|agr)/.test(c)) return PROFILES.jardin;
  if (/(herramient|seguridad)/.test(c)) return PROFILES.herramientas;
  if (/pintura/.test(c)) return PROFILES.pinturas;
  return PROFILES.flat;
}

export interface MonthPoint {
  ym: string;
  label: string;
  monthIdx: number;
  sales: number;
  units: number;
  margin: number;
  stockouts: number;
  fill: number;
  lost: number;
}

export interface SeasonTopProduct {
  sku: string;
  name: string;
  sales: number;
  margin: number;
  type: string;
  action: string;
}

export interface SupplierSeasonality {
  series: MonthPoint[];
  ventaActual: number;
  ventaPrev: number;
  varPct: number;
  marginAvg: number;
  quiebres12: number;
  lost12: number;
  fill: number;
  leadTime: number;
  sobrestock: number;
  score: number;
  classification: { label: string; tone: "violet" | "blue" | "slate" | "red"; risky: boolean };
  peakMonths: string[];
  preSeason: { month: string; days: number } | null;
  recommendation: string;
  topProducts: SeasonTopProduct[];
}

const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 5; // Junio (idx)

export function supplierSeasonality(name: string): SupplierSeasonality {
  const sup = getSupplierByName(name);
  const prods = products.filter((p) => p.supplierName === name);
  const baseSales = prods.reduce((a, p) => a + p.salesLast30Days * p.price, 0) || 1;
  const baseUnits = prods.reduce((a, p) => a + p.salesLast30Days, 0) || 1;
  const baseMargin = prods.reduce((a, p) => a + p.salesLast30Days * (p.price - p.cost), 0) / baseSales * 100 || 30;
  const perf = supplierFulfillment(name);
  const fill = perf.arrivedOrders > 0 ? perf.fillRate : sup?.deliveryCompliance ?? 90;
  const leadTime = sup?.averageLeadTimeDays ?? 10;
  const profile = profileFor(prods[0]?.category ?? sup?.categories[0] ?? "");
  const avgMult = profile.reduce((a, b) => a + b, 0) / 12;
  const peakMult = Math.max(...profile);
  const yearFactor: Record<number, number> = { 2024: 0.85, 2025: 0.95, 2026: 1.0 };

  // Construir 24 meses terminando en 2026-06
  const ymList: { y: number; m: number }[] = [];
  let y = CURRENT_YEAR;
  let m = CURRENT_MONTH;
  for (let i = 0; i < 24; i++) {
    ymList.unshift({ y, m });
    m--;
    if (m < 0) { m = 11; y--; }
  }

  const series: MonthPoint[] = ymList.map(({ y, m }) => {
    const mult = profile[m];
    const wobble = (((m * 7 + (y % 100)) % 5) - 2) / 100;
    const sales = Math.round(baseSales * mult * (yearFactor[y] ?? 1) * (1 + wobble));
    const units = Math.round(sales / (baseSales / baseUnits));
    const peak = mult >= avgMult * 1.1;
    const monthFill = peak ? Math.max(60, Math.round(fill - 10)) : Math.round(fill);
    const stockouts = peak ? Math.max(1, Math.round((mult - 1) * 14 * (1 - fill / 100))) : mult > avgMult ? 1 : 0;
    const lost = stockouts > 0 ? Math.round(sales * (1 - monthFill / 100) * 0.25) : 0;
    const margin = Math.round(baseMargin + (mult - avgMult) * 8);
    return { ym: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${MABBR[m]} ${String(y).slice(2)}`, monthIdx: m, sales, units, margin, stockouts, fill: monthFill, lost };
  });

  const last12 = series.slice(12);
  const prev12 = series.slice(0, 12);
  const ventaActual = last12.reduce((a, p) => a + p.sales, 0);
  const ventaPrev = prev12.reduce((a, p) => a + p.sales, 0) || 1;
  const varPct = (ventaActual / ventaPrev - 1) * 100;
  const quiebres12 = last12.reduce((a, p) => a + p.stockouts, 0);
  const lost12 = last12.reduce((a, p) => a + p.lost, 0);
  const marginAvg = Math.round(last12.reduce((a, p) => a + p.margin, 0) / 12);
  const sobrestock = prods.filter((p) => p.purchaseStatus === "overstock").reduce((a, p) => a + p.availableStock * p.cost, 0);

  // Score de temporada
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const ventaScore = clamp((ventaActual / (ventaPrev * 1.05)) * 100);
  const margenScore = clamp((marginAvg / 35) * 100);
  const invScore = clamp(100 - quiebres12 * 2);
  const postScore = sobrestock > 0 ? 70 : 90;
  const score = Math.round(0.4 * ventaScore + 0.2 * margenScore + 0.2 * fill + 0.1 * invScore + 0.1 * postScore);

  // Clasificación
  const ratio = peakMult / avgMult;
  const risky = fill < 85 && quiebres12 >= 8;
  const base = ratio >= 1.3 ? "Estacional fuerte" : ratio >= 1.12 ? "Estacional suave" : "Permanente";
  const classification = {
    label: base + (risky ? " · riesgo de quiebre" : ""),
    tone: (risky ? "red" : ratio >= 1.3 ? "violet" : ratio >= 1.12 ? "blue" : "slate") as "violet" | "blue" | "slate" | "red",
    risky,
  };

  const peakMonths = profile.map((v, i) => ({ v, i })).filter((x) => x.v >= avgMult * 1.12).map((x) => MABBR[x.i]);

  // Pre-temporada: próximo mes peak dentro de 60 días
  let preSeason: { month: string; days: number } | null = null;
  for (let off = 1; off <= 3; off++) {
    const idx = (CURRENT_MONTH + off) % 12;
    if (profile[idx] >= peakMult * 0.9) { preSeason = { month: MABBR[idx], days: off * 30 }; break; }
  }

  // Top productos de temporada
  const topProducts: SeasonTopProduct[] = [...prods]
    .sort((a, b) => b.salesLast30Days * b.price - a.salesLast30Days * a.price)
    .slice(0, 6)
    .map((p) => {
      const type = ratio >= 1.3 ? "Estacional" : ratio >= 1.12 ? "Extendida" : "Permanente";
      const action =
        p.purchaseStatus === "overstock" ? "Liquidar postemporada" :
        fill < 90 ? "Asegurar stock / despacho" :
        ratio >= 1.12 ? "Reforzar antes de temporada" : "Mantener stock base";
      return { sku: p.sku, name: p.name, sales: p.salesLast30Days * p.price, margin: p.margin, type, action };
    });

  const peakStr = peakMonths.length ? peakMonths.join(", ") : "todo el año";
  const recommendation = risky
    ? `Temporada alta en ${peakStr}: la venta sube pero el cumplimiento cae justo en el peak (fill ${fill}%, ${quiebres12} quiebres/12m). Negocia ${preSeason ? preSeason.days + " días antes" : "con anticipación"}: stock reservado para los top SKUs, fill mínimo 95% y despacho parcial semanal.`
    : base === "Permanente"
      ? `Venta estable todo el año. Conviene mantener stock base permanente y negociar volumen anual con despacho continuo en lugar de grandes compras puntuales.`
      : `Temporada marcada en ${peakStr}. Compra anticipada y asegura stock antes del peak; en postemporada, liquida lentos con apoyo del proveedor.`;

  return { series, ventaActual, ventaPrev, varPct, marginAvg, quiebres12, lost12, fill, leadTime, sobrestock, score, classification, peakMonths, preSeason, recommendation, topProducts };
}

import type { Product } from "../types/purchasing";

// ============================================================================
//  Demanda por canal (por qué se compra)
//  ---------------------------------------------------------------------------
//  La misma categoría se vende por varios canales — tienda, ecommerce,
//  marketplace, venta empresa (B2B) y licitaciones — y cada uno tiene su propia
//  estacionalidad: el ecommerce sube en CyberDay y fin de año, las licitaciones
//  son escalonadas (ejecución de presupuesto público), la venta empresa es más
//  pareja. Este modelo descompone la demanda mensual por canal para que el
//  comprador entienda CUÁNTO compra y POR QUÉ, no solo el total.
//  Es una estimación determinista en frontend, no datos transaccionales reales.
// ============================================================================

export type DemandChannel = "tienda" | "ecommerce" | "marketplace" | "empresa" | "licitaciones";

export const DEMAND_CHANNELS: DemandChannel[] = [
  "tienda",
  "ecommerce",
  "marketplace",
  "empresa",
  "licitaciones",
];

export const CHANNEL_META: Record<
  DemandChannel,
  { label: string; short: string; color: string; description: string }
> = {
  tienda: {
    label: "Tienda física",
    short: "Tienda",
    color: "#1f49d6",
    description: "Venta en sala, sigue la estacionalidad retail.",
  },
  ecommerce: {
    label: "Ecommerce propio",
    short: "Ecommerce",
    color: "#0ea5e9",
    description: "Web propia: peaks en CyberDay (mayo) y fin de año.",
  },
  marketplace: {
    label: "Marketplace",
    short: "Marketplace",
    color: "#8b5cf6",
    description: "Terceros: alto volumen en campañas, margen más ajustado.",
  },
  empresa: {
    label: "Venta empresa (B2B)",
    short: "Empresa",
    color: "#10b981",
    description: "Constructoras y maestros: demanda pareja con temporada de obra.",
  },
  licitaciones: {
    label: "Licitaciones / proyectos",
    short: "Licitaciones",
    color: "#f59e0b",
    description: "Compras escalonadas por ejecución de presupuesto (marzo-abril, oct-nov).",
  },
};

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Perfil estacional propio de cada canal (multiplicador por mes, idx 0 = Ene).
const CHANNEL_PROFILE: Record<DemandChannel, number[]> = {
  tienda: [1.15, 1.05, 1.1, 0.95, 0.85, 0.8, 0.8, 0.85, 1.05, 1.2, 1.25, 1.15],
  ecommerce: [0.9, 0.85, 0.9, 0.95, 1.25, 1.0, 0.95, 0.95, 1.0, 1.05, 1.35, 1.3],
  marketplace: [0.95, 0.9, 0.95, 1.0, 1.2, 1.0, 0.95, 0.95, 1.0, 1.05, 1.25, 1.2],
  empresa: [1.0, 1.0, 1.05, 1.0, 0.95, 0.9, 0.9, 0.95, 1.1, 1.15, 1.1, 0.95],
  licitaciones: [0.6, 0.8, 1.4, 1.5, 1.0, 0.8, 0.7, 0.8, 1.1, 1.4, 1.3, 0.6],
};

type Mix = Record<DemandChannel, number>;

// Mezcla base de canales por familia de categoría (debe sumar 1).
const MIX_CONSTRUCTION: Mix = {
  tienda: 0.3,
  ecommerce: 0.1,
  marketplace: 0.08,
  empresa: 0.3,
  licitaciones: 0.22,
};
const MIX_FERRETERIA: Mix = {
  tienda: 0.42,
  ecommerce: 0.22,
  marketplace: 0.18,
  empresa: 0.12,
  licitaciones: 0.06,
};
const MIX_JARDIN: Mix = {
  tienda: 0.45,
  ecommerce: 0.2,
  marketplace: 0.15,
  empresa: 0.12,
  licitaciones: 0.08,
};
const MIX_INSTALACION: Mix = {
  tienda: 0.38,
  ecommerce: 0.18,
  marketplace: 0.14,
  empresa: 0.18,
  licitaciones: 0.12,
};
const MIX_DEFAULT: Mix = {
  tienda: 0.4,
  ecommerce: 0.2,
  marketplace: 0.15,
  empresa: 0.15,
  licitaciones: 0.1,
};

function mixForCategory(category: string): Mix {
  const c = category.toLowerCase();
  if (/(construcci|cement|árido|arido|acero|madera|ladrillo)/.test(c)) return MIX_CONSTRUCTION;
  if (/(ferret|herramient|seguridad)/.test(c)) return MIX_FERRETERIA;
  if (/(jard|agr)/.test(c)) return MIX_JARDIN;
  if (/(pintura|gasfiter|electric)/.test(c)) return MIX_INSTALACION;
  return MIX_DEFAULT;
}

const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

export interface ChannelMonthly {
  monthIdx: number;
  label: string;
  total: number;
  byChannel: Record<DemandChannel, number>;
}

export interface ChannelSummary {
  channel: DemandChannel;
  /** Participación en la demanda anual (0-100). */
  mixPct: number;
  /** Unidades/mes promedio de este canal. */
  unitsPerMonth: number;
  /** Venta anual estimada del canal (CLP). */
  annualSales: number;
  /** Meses peak del canal. */
  peakMonths: string[];
}

export interface ChannelDemand {
  baseUnitsPerMonth: number;
  avgPrice: number;
  monthly: ChannelMonthly[];
  channels: ChannelSummary[];
  /** Mes de mayor demanda total. */
  peakMonth: string;
  /** % que aportan los canales digitales (ecommerce + marketplace). */
  digitalPct: number;
  /** % que aportan empresa + licitaciones (proyectos). */
  projectPct: number;
}

/**
 * Descompone la demanda de una categoría por canal y mes. `baseUnits` es la
 * demanda mensual promedio (p. ej. unidades vendidas en 30 días); `avgPrice`
 * valoriza la venta. Si no se pasan, se derivan de los productos entregados.
 */
export function channelDemandForCategory(category: string, products: Product[]): ChannelDemand {
  const baseUnits = products.reduce((a, p) => a + p.salesLast30Days, 0);
  const value = products.reduce((a, p) => a + p.salesLast30Days * p.price, 0);
  const avgPrice = baseUnits > 0 ? value / baseUnits : 0;
  const mix = mixForCategory(category);

  // Unidades por canal y mes: base × mezcla × perfil normalizado por su promedio.
  const monthly: ChannelMonthly[] = MONTHS.map((label, m) => {
    const byChannel = {} as Record<DemandChannel, number>;
    let total = 0;
    for (const ch of DEMAND_CHANNELS) {
      const prof = CHANNEL_PROFILE[ch];
      const units = Math.round((baseUnits * mix[ch] * prof[m]) / avg(prof));
      byChannel[ch] = units;
      total += units;
    }
    return { monthIdx: m, label, total, byChannel };
  });

  const grandTotal = monthly.reduce((a, mo) => a + mo.total, 0) || 1;

  const channels: ChannelSummary[] = DEMAND_CHANNELS.map((ch) => {
    const units = monthly.reduce((a, mo) => a + mo.byChannel[ch], 0);
    const prof = CHANNEL_PROFILE[ch];
    const profAvg = avg(prof);
    const peakMonths = prof
      .map((v, i) => ({ v, i }))
      .filter((x) => x.v >= profAvg * 1.15)
      .map((x) => MONTHS[x.i]);
    return {
      channel: ch,
      mixPct: (units / grandTotal) * 100,
      unitsPerMonth: Math.round(units / 12),
      annualSales: Math.round(units * avgPrice),
      peakMonths,
    };
  }).sort((a, b) => b.mixPct - a.mixPct);

  const peak = monthly.reduce((best, mo) => (mo.total > best.total ? mo : best), monthly[0]);
  const digitalPct = channels
    .filter((c) => c.channel === "ecommerce" || c.channel === "marketplace")
    .reduce((a, c) => a + c.mixPct, 0);
  const projectPct = channels
    .filter((c) => c.channel === "empresa" || c.channel === "licitaciones")
    .reduce((a, c) => a + c.mixPct, 0);

  return {
    baseUnitsPerMonth: baseUnits,
    avgPrice,
    monthly,
    channels,
    peakMonth: peak.label,
    digitalPct,
    projectPct,
  };
}

/** Reparte una cantidad de compra sugerida según la mezcla de canales. */
export function splitPurchaseByChannel(
  demand: ChannelDemand,
  suggestedQty: number
): { channel: DemandChannel; qty: number; pct: number }[] {
  return demand.channels.map((c) => ({
    channel: c.channel,
    qty: Math.round((suggestedQty * c.mixPct) / 100),
    pct: c.mixPct,
  }));
}

// ============================================================================
//  Rendimiento SIMULADO de campañas (demo).
//
//  En producción estas métricas vendrían de las integraciones reales: la web
//  (analítica del sitio), Google Ads, la plataforma de mailing, Mercado Libre,
//  las redes sociales y el punto de venta de la tienda.
//
//  Aquí todo es DETERMINISTA: las cifras se derivan de entradas estables
//  (presupuesto, venta estimada, precio, hash del SKU e índice). No se usa
//  Math.random ni Date.now, por lo que el mismo plan siempre produce los mismos
//  números.
// ============================================================================

import type { CampaignPlan, CampaignProduct, PromoChannelKey } from "./mockCampaignPlans";

/** Canales del desglose de rendimiento (incluye plataformas de ads y mailing). */
export type PerfChannelKey = PromoChannelKey | "google_ads" | "email";

export interface PerfChannelMeta {
  label: string;
  tone: "violet" | "amber" | "blue" | "green" | "red" | "neutral";
  /** Path de icono SVG (viewBox 0 0 24 24), consistente con PROMO_CHANNEL_META. */
  icon: string;
}

export const PERF_CHANNEL_META: Record<PerfChannelKey, PerfChannelMeta> = {
  web: { label: "Web", tone: "blue", icon: "M3 3h18v18H3zM3 9h18M9 21V9" },
  ml: {
    label: "Mercado Libre",
    tone: "amber",
    icon: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 2.8 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.8zM7 7h.01",
  },
  redes: {
    label: "Redes Sociales",
    tone: "violet",
    icon: "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z",
  },
  tienda: {
    label: "Tienda física",
    tone: "green",
    icon: "M3 9l1-5h16l1 5M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M3 9h18M9 21v-6h6v6",
  },
  google_ads: {
    label: "Google Ads",
    tone: "red",
    icon: "M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9 4.9 19.1",
  },
  email: {
    label: "Mailing / Email",
    tone: "neutral",
    icon: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
  },
};

/** Orden estable para mostrar los canales en la tabla. */
export const PERF_CHANNEL_ORDER: PerfChannelKey[] = [
  "web",
  "google_ads",
  "ml",
  "redes",
  "email",
  "tienda",
];

export interface ProductPerformance {
  sku: string;
  name: string;
  category: string;
  channel: PromoChannelKey;
  channelLabel: string;
  /** Posición del banner dentro de su placement (1 = primero). */
  order: number;
  placementLabel: string;
  impressions: number;
  clicks: number;
  ctr: number; // %
  conversions: number;
  conversionRate: number; // %
  revenue: number;
  spend: number;
  roas: number;
}

export interface ChannelPerformance {
  channel: PerfChannelKey;
  label: string;
  impressions: number;
  clicks: number;
  ctr: number; // %
  conversions: number;
  revenue: number;
  spend: number;
  roas: number;
}

export interface CampaignTotals {
  impressions: number;
  clicks: number;
  ctr: number; // %
  conversions: number;
  revenue: number;
  spend: number;
  roas: number;
}

export interface CampaignPerformance {
  byProduct: ProductPerformance[];
  byChannel: ChannelPerformance[];
  totals: CampaignTotals;
}

/** Hash determinista (FNV-1a) de un string -> entero positivo. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pseudo-aleatorio determinista en [0,1) derivado del hash. */
function unit(hash: number, salt: number): number {
  const v = (hash ^ Math.imul(salt + 1, 2654435761)) >>> 0;
  return (v % 100000) / 100000;
}

// Tasas base por canal (CTR y conversión) — coherentes con el comportamiento
// típico de cada superficie. Son referencias del demo, no datos reales.
const CHANNEL_BASE: Record<
  PromoChannelKey,
  { ctr: number; conv: number; impPerCLP: number; googleShare: number; emailShare: number }
> = {
  // impPerCLP: impresiones generadas por cada $1 de presupuesto.
  web: { ctr: 2.6, conv: 4.2, impPerCLP: 0.09, googleShare: 0.45, emailShare: 0.12 },
  ml: { ctr: 3.8, conv: 6.5, impPerCLP: 0.05, googleShare: 0, emailShare: 0 },
  redes: { ctr: 1.4, conv: 2.3, impPerCLP: 0.16, googleShare: 0, emailShare: 0.1 },
  tienda: { ctr: 9.0, conv: 12.0, impPerCLP: 0.012, googleShare: 0, emailShare: 0 },
};

function round(n: number): number {
  return Math.round(n);
}

/** Métricas de un producto (determinista a partir de sus campos + índice). */
function productMetrics(p: CampaignProduct, index: number): ProductPerformance {
  const base = CHANNEL_BASE[p.channel];
  const h = hashStr(p.sku);
  // ±25% de variación estable por producto sobre las tasas base.
  const ctr = base.ctr * (0.75 + unit(h, 1) * 0.5);
  const conv = base.conv * (0.75 + unit(h, 2) * 0.5);
  // Las posiciones más altas (order menor) reciben más impresiones.
  const orderBoost = 1 + Math.max(0, 3 - (p.order ?? 1)) * 0.18;
  const impressions = round(p.budget * base.impPerCLP * orderBoost * (0.85 + unit(h, 3) * 0.3));
  const clicks = round(impressions * (ctr / 100));
  const conversions = round(clicks * (conv / 100));
  const revenue = round(conversions * p.promo);
  const spend = p.budget;
  const roas = spend > 0 ? revenue / spend : 0;
  return {
    sku: p.sku,
    name: p.name,
    category: p.category,
    channel: p.channel,
    channelLabel: PERF_CHANNEL_META[p.channel].label,
    order: p.order ?? index + 1,
    placementLabel: p.placementLabel,
    impressions,
    clicks,
    ctr,
    conversions,
    conversionRate: conv,
    revenue,
    spend,
    roas,
  };
}

interface ChannelAccum {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  spend: number;
}

function emptyAccum(): ChannelAccum {
  return { impressions: 0, clicks: 0, conversions: 0, revenue: 0, spend: 0 };
}

function addTo(acc: Record<PerfChannelKey, ChannelAccum>, key: PerfChannelKey, m: ChannelAccum) {
  const a = acc[key];
  a.impressions += m.impressions;
  a.clicks += m.clicks;
  a.conversions += m.conversions;
  a.revenue += m.revenue;
  a.spend += m.spend;
}

/**
 * Rendimiento completo de un plan de campaña.
 *
 * El desglose por canal reparte la actividad de cada producto entre su canal
 * nativo y, cuando corresponde, Google Ads y Mailing/Email:
 *  - Web: parte de su tráfico/inversión se atribuye a Google Ads (búsqueda)
 *    y una fracción menor a Mailing.
 *  - Redes: una fracción se atribuye a Mailing (campañas de email de apoyo).
 *  - Mercado Libre y Tienda física: se mantienen íntegros en su canal.
 */
export function campaignPerformance(plan: CampaignPlan): CampaignPerformance {
  const byProduct = plan.products.map((p, i) => productMetrics(p, i));

  const acc: Record<PerfChannelKey, ChannelAccum> = {
    web: emptyAccum(),
    ml: emptyAccum(),
    redes: emptyAccum(),
    tienda: emptyAccum(),
    google_ads: emptyAccum(),
    email: emptyAccum(),
  };

  byProduct.forEach((m) => {
    const base = CHANNEL_BASE[m.channel];
    const gShare = base.googleShare;
    const eShare = base.emailShare;
    const nativeShare = 1 - gShare - eShare;

    const split = (frac: number): ChannelAccum => ({
      impressions: round(m.impressions * frac),
      clicks: round(m.clicks * frac),
      conversions: round(m.conversions * frac),
      revenue: round(m.revenue * frac),
      spend: round(m.spend * frac),
    });

    addTo(acc, m.channel, split(nativeShare));
    if (gShare > 0) addTo(acc, "google_ads", split(gShare));
    if (eShare > 0) addTo(acc, "email", split(eShare));
  });

  const byChannel: ChannelPerformance[] = PERF_CHANNEL_ORDER.map((channel) => {
    const a = acc[channel];
    return {
      channel,
      label: PERF_CHANNEL_META[channel].label,
      impressions: a.impressions,
      clicks: a.clicks,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      conversions: a.conversions,
      revenue: a.revenue,
      spend: a.spend,
      roas: a.spend > 0 ? a.revenue / a.spend : 0,
    };
  }).filter((c) => c.spend > 0 || c.impressions > 0);

  const totals = byProduct.reduce<CampaignTotals>(
    (t, m) => {
      t.impressions += m.impressions;
      t.clicks += m.clicks;
      t.conversions += m.conversions;
      t.revenue += m.revenue;
      t.spend += m.spend;
      return t;
    },
    { impressions: 0, clicks: 0, ctr: 0, conversions: 0, revenue: 0, spend: 0, roas: 0 }
  );
  totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  totals.roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

  return { byProduct, byChannel, totals };
}

/** Tono de Badge según el ROAS (>=3 bueno, >=1.5 medio, resto bajo). */
export function roasTone(roas: number): "green" | "amber" | "red" {
  if (roas >= 3) return "green";
  if (roas >= 1.5) return "amber";
  return "red";
}

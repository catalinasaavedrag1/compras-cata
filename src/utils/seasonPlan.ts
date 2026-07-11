import type { Product } from "../types/purchasing";
import { products as allProducts } from "../data/mockProducts";
import { purchaseOrders } from "../data/mockPurchaseOrders";
import { channelDemandForCategory } from "./channelDemand";
import { seasonalFactor } from "./seasonality";
import { hashString } from "./hash";
import { addDaysISO } from "./calculations";
import { TODAY_ISO } from "./constants";
import { type Season, seasonSaleMonths } from "../data/mockSeasons";

// ============================================================================
//  Planificador de demanda estacional
//  ---------------------------------------------------------------------------
//  Transforma la reposición en planificación comercial: no dice solo "cuánto
//  comprar", sino QUÉ demanda se espera, de QUÉ ORIGEN viene, qué está
//  COMPROMETIDO y qué RIESGO hay. La compra sugerida es una fórmula abrible:
//
//    Compra = histórica ajustada + crecimiento + ecommerce + marketplaces
//           + empresa confirmada + licitaciones confirmadas + licit. ponderadas
//           + campañas + stock de seguridad
//           − stock disponible − en tránsito − transferencia entre sucursales
//
//  Todo se deriva de datos existentes (ventas, stock, OC, mezcla de canales) y
//  de supuestos deterministas por SKU. Es una estimación para planificar y
//  construir escenarios, no un pronóstico transaccional real.
// ============================================================================

export type ScenarioKey = "conservador" | "probable" | "agresivo";

export const SCENARIOS: Record<
  ScenarioKey,
  {
    label: string;
    description: string;
    growthMult: number;
    probableWeight: number;
    safetyMult: number;
    campaignMult: number;
  }
> = {
  conservador: {
    label: "Conservador",
    description:
      "Solo histórico, pedidos confirmados y licitaciones adjudicadas. Bajo crecimiento.",
    growthMult: 0.4,
    probableWeight: 0.3,
    safetyMult: 0.6,
    campaignMult: 0.5,
  },
  probable: {
    label: "Probable",
    description:
      "Histórico ajustado, crecimiento esperado, pipeline ponderado y campañas aprobadas.",
    growthMult: 1,
    probableWeight: 1,
    safetyMult: 1,
    campaignMult: 1,
  },
  agresivo: {
    label: "Agresivo",
    description:
      "Mayor crecimiento, alta adjudicación, expansión de marketplaces y más stock de seguridad.",
    growthMult: 1.6,
    probableWeight: 1.3,
    safetyMult: 1.5,
    campaignMult: 1.4,
  },
};

export type ConfidenceLevel = "alta" | "media" | "baja";
export type SeasonRisk = "alto_quiebre" | "medio" | "sobrestock" | "normal";

/** Un componente de la fórmula de compra (positivo suma, negativo descuenta). */
export interface DemandComponent {
  key: string;
  label: string;
  units: number;
  /** true si descuenta (stock, tránsito, transferencia). */
  deduct?: boolean;
}

export interface OriginItem {
  label: string;
  units: number;
}

export interface WeekPoint {
  week: number;
  sales: number;
  forecast: number;
  stock: number;
}

export interface SeasonProductPlan {
  sku: string;
  name: string;
  category: string;
  brand: string;
  supplierName: string;
  cost: number;
  price: number;
  margin: number;
  rotation: number;
  // Demanda por origen (unidades de la temporada)
  histAdjusted: number;
  growth: number;
  ecommerce: number;
  mercadoLibre: number;
  falabella: number;
  empresaConfirmed: number;
  licitConfirmed: number;
  licitWeighted: number;
  campaign: number;
  safety: number;
  needTotal: number;
  // Descuentos
  available: number;
  inTransit: number;
  transfer: number;
  // Resultado
  suggested: number;
  moq: number;
  multiplo: number;
  leadTimeDays: number;
  etaDate: string;
  coverageNowDays: number;
  coverageAfterDays: number;
  weeksCovered: number;
  lostSaleEstimate: number;
  confidence: ConfidenceLevel;
  confidenceReasons: string[];
  risk: SeasonRisk;
  components: DemandComponent[];
  origin: OriginItem[];
  weekly: WeekPoint[];
}

export interface OriginDistribution {
  confirmada: number;
  historicaProyectada: number;
  probablePonderada: number;
  campanas: number;
  stockEstrategico: number;
  total: number;
  /** Detalle fino por canal/origen (tabla del nivel 2). */
  byChannel: OriginItem[];
}

export interface SeasonSummary {
  unitsTotal: number;
  ventaProyectada: number;
  compraPropuesta: number;
  ventaPotencial: number;
  margenEsperado: number;
  inventarioInicial: number;
  inventarioFinal: number;
  riesgoQuiebrePct: number;
  riesgoSobrestockPct: number;
  presupuestoUtilizadoPct: number;
  capitalInmovilizado: number;
  nivelServicio: number;
}

export interface PriorSeason {
  compra: number;
  venta: number;
  margen: number;
  quiebrePct: number;
  sobrestockPct: number;
}

export interface SeasonPlan {
  season: Season;
  scenario: ScenarioKey;
  products: SeasonProductPlan[];
  summary: SeasonSummary;
  origin: OriginDistribution;
  prior: PriorSeason;
}

// ---------------------------------------------------------------------------
//  En tránsito: OC abiertas por SKU (se calcula una vez).
// ---------------------------------------------------------------------------

const OPEN_STATUSES = new Set(["draft", "sent", "confirmed", "partially_received", "delayed"]);

function inTransitBySku(): Map<string, number> {
  const map = new Map<string, number>();
  for (const o of purchaseOrders) {
    if (!OPEN_STATUSES.has(o.status)) continue;
    for (const l of o.lines ?? []) {
      map.set(l.sku, (map.get(l.sku) ?? 0) + (l.quantity - (l.receivedQty ?? 0)));
    }
  }
  return map;
}

const round = (n: number) => Math.round(n);

/** Base mensual corregida por quiebre: si estuvo sin stock, la venta subestima. */
function correctedMonthlyBase(p: Product): number {
  const base = Math.max(p.salesLast30Days, p.salesLast90Days / 3);
  let uplift = 1;
  if (p.availableStock <= 0 && p.salesLast30Days > 0) uplift = 1.2;
  else if (p.purchaseStatus === "buy") uplift = 1.1;
  return base * uplift;
}

function decompose(
  p: Product,
  season: Season,
  scenario: ScenarioKey,
  inTransit: number
): SeasonProductPlan {
  const sc = SCENARIOS[scenario];
  const h = hashString(p.sku);
  const months = seasonSaleMonths(season);
  const sf = seasonalFactor(p.category, 3);
  const baseCorr = correctedMonthlyBase(p);
  const mix = channelDemandForCategory(p.category, [p]).channels.reduce(
    (acc, c) => ({ ...acc, [c.channel]: c.mixPct / 100 }),
    {} as Record<string, number>
  );

  const histSeason = baseCorr * months * sf;
  const histAdjusted = round(histSeason * (mix.tienda ?? 0.4));
  const growth = round(histAdjusted * (season.expectedGrowthPct / 100) * sc.growthMult);
  const ecommerce = round(histSeason * (mix.ecommerce ?? 0.2));
  const marketplace = histSeason * (mix.marketplace ?? 0.15);
  const mercadoLibre = round(marketplace * 0.7);
  const falabella = round(marketplace * 0.3);
  const empresaConfirmed = round(histSeason * (mix.empresa ?? 0.15));

  // Licitaciones y campañas: deterministas por SKU, solo donde tiene sentido.
  const hasProjects = (mix.licitaciones ?? 0) >= 0.08;
  const licitConfirmed = hasProjects && h % 5 < 2 ? round(baseCorr * (0.3 + (h % 3) * 0.1)) : 0;
  const licitProbable = hasProjects && h % 5 < 3 ? round(baseCorr * (0.5 + (h % 4) * 0.15)) : 0;
  const probability = 0.4 + (h % 5) * 0.1; // 0.4 .. 0.8
  const licitWeighted = round(licitProbable * probability * sc.probableWeight);
  const inCampaign = h % 4 === 0;
  const campaign = inCampaign ? round(baseCorr * 0.4 * sc.campaignMult) : 0;

  const safety = round(baseCorr * (season.leadTimeDays / 30) * 0.6 * sc.safetyMult);

  const needTotal =
    histAdjusted +
    growth +
    ecommerce +
    mercadoLibre +
    falabella +
    empresaConfirmed +
    licitConfirmed +
    licitWeighted +
    campaign +
    safety;

  const available = p.availableStock;
  const transfer =
    p.purchaseStatus === "overstock"
      ? round(p.availableStock * 0.15)
      : round((h % 3) * baseCorr * 0.02);

  const multiplo = p.multiploCompra && p.multiploCompra > 0 ? p.multiploCompra : 1;
  const moq = p.minStock ?? 0;
  const raw = Math.max(0, needTotal - available - inTransit - transfer);
  const suggested = raw > 0 ? Math.ceil(raw / multiplo) * multiplo : 0;

  const daily = baseCorr / 30;
  const coverageNowDays = daily > 0 ? round(available / daily) : available > 0 ? 999 : 0;
  const coverageAfterDays = daily > 0 ? round((available + suggested + inTransit) / daily) : 999;
  const weeks = Math.max(4, round(months * 4.33));
  const weeklyDemand = needTotal / weeks;
  const weeksCovered = weeklyDemand > 0 ? round((available + suggested) / weeklyDemand) : 0;
  const lostSaleEstimate =
    coverageNowDays < season.leadTimeDays
      ? round((season.leadTimeDays - coverageNowDays) * daily * p.price)
      : 0;

  // Confianza
  const reasons: string[] = [];
  let cscore = 100;
  if (p.productStatus === "new" || p.salesLast180Days === 0) {
    cscore -= 40;
    reasons.push("Producto nuevo o sin histórico suficiente");
  } else {
    reasons.push("Con histórico de ventas");
  }
  const expected = p.salesLast90Days / 3 || 1;
  const stable = Math.abs(p.salesLast30Days - expected) / expected < 0.25;
  if (!stable) {
    cscore -= 15;
    reasons.push("Venta irregular");
  }
  const licitShare = needTotal > 0 ? (licitConfirmed + licitWeighted) / needTotal : 0;
  if (licitShare > 0.3) {
    cscore -= 20;
    reasons.push("Parte importante depende de licitaciones");
  }
  if (season.leadTimeDays >= 18) {
    cscore -= 10;
    reasons.push("Lead time largo / variable");
  }
  const confidence: ConfidenceLevel = cscore >= 75 ? "alta" : cscore >= 50 ? "media" : "baja";

  // Riesgo
  const cushion = available + inTransit;
  const projFinal = available + inTransit + suggested + transfer - needTotal;
  let risk: SeasonRisk = "normal";
  if (cushion < needTotal * 0.25 && coverageNowDays < season.leadTimeDays) risk = "alto_quiebre";
  else if (coverageNowDays < season.leadTimeDays * 1.5) risk = "medio";
  else if (suggested === 0 && projFinal > needTotal * 0.5) risk = "sobrestock";

  const components: DemandComponent[] = [
    { key: "hist", label: "Demanda histórica ajustada", units: histAdjusted },
    { key: "growth", label: "Crecimiento esperado", units: growth },
    { key: "ecommerce", label: "eCommerce", units: ecommerce },
    { key: "ml", label: "Mercado Libre", units: mercadoLibre },
    { key: "falabella", label: "Falabella", units: falabella },
    { key: "empresa", label: "Venta empresa confirmada", units: empresaConfirmed },
    { key: "licitConf", label: "Licitaciones confirmadas", units: licitConfirmed },
    { key: "licitPond", label: "Licitaciones ponderadas", units: licitWeighted },
    { key: "campaign", label: "Campaña comercial", units: campaign },
    { key: "safety", label: "Stock de seguridad", units: safety },
    { key: "available", label: "Stock disponible", units: available, deduct: true },
    { key: "transit", label: "Órdenes en tránsito", units: inTransit, deduct: true },
    { key: "transfer", label: "Transferencia desde otra sucursal", units: transfer, deduct: true },
  ];

  const origin: OriginItem[] = [
    { label: "Tienda física", units: histAdjusted + growth },
    { label: "eCommerce", units: ecommerce },
    { label: "Mercado Libre", units: mercadoLibre },
    { label: "Falabella", units: falabella },
    { label: "Empresa: Cliente Agrícola Sur", units: round(empresaConfirmed * 0.6) },
    { label: "Empresa: Constructora Norte", units: round(empresaConfirmed * 0.4) },
    { label: "Licitación adjudicada", units: licitConfirmed },
    { label: "Licitación ponderada", units: licitWeighted },
    { label: "Campaña comercial", units: campaign },
  ].filter((o) => o.units > 0);

  // Evolución semanal (venta hist. real → pronóstico; stock proyectado)
  const weekN = Math.min(16, weeks);
  const startStock = available + inTransit + suggested;
  let stock = startStock;
  const weekly: WeekPoint[] = Array.from({ length: weekN }, (_, i) => {
    const wobble = 1 + (((i * 7 + (h % 11)) % 7) - 3) / 20;
    const forecast = round(weeklyDemand * wobble);
    const sales = i < 4 ? round(forecast * 0.95) : forecast; // primeras semanas ~ histórico
    stock = Math.max(0, stock - forecast);
    return { week: i + 1, sales, forecast, stock };
  });

  return {
    sku: p.sku,
    name: p.name,
    category: p.category,
    brand: p.brand,
    supplierName: p.supplierName,
    cost: p.cost,
    price: p.price,
    margin: p.margin,
    rotation: p.rotation,
    histAdjusted,
    growth,
    ecommerce,
    mercadoLibre,
    falabella,
    empresaConfirmed,
    licitConfirmed,
    licitWeighted,
    campaign,
    safety,
    needTotal,
    available,
    inTransit,
    transfer,
    suggested,
    moq,
    multiplo,
    leadTimeDays: season.leadTimeDays,
    etaDate: addDaysISO(TODAY_ISO, season.leadTimeDays),
    coverageNowDays,
    coverageAfterDays,
    weeksCovered,
    lostSaleEstimate,
    confidence,
    confidenceReasons: reasons,
    risk,
    components,
    origin,
    weekly,
  };
}

export function planSeason(season: Season, scenario: ScenarioKey): SeasonPlan {
  const transit = inTransitBySku();
  const catSet = new Set(season.categories);
  const products = allProducts
    .filter((p) => catSet.has(p.category))
    .map((p) => decompose(p, season, scenario, transit.get(p.sku) ?? 0))
    .sort((a, b) => b.suggested * b.cost - a.suggested * a.cost);

  // Resumen ejecutivo
  const unitsTotal = products.reduce((a, p) => a + p.suggested, 0);
  const compraPropuesta = products.reduce((a, p) => a + p.suggested * p.cost, 0);
  const ventaProyectada = products.reduce((a, p) => a + p.needTotal * p.price, 0);
  const ventaPotencial = products.reduce(
    (a, p) => a + Math.min(p.needTotal, p.available + p.suggested + p.inTransit) * p.price,
    0
  );
  const costSell = products.reduce(
    (a, p) => a + Math.min(p.needTotal, p.available + p.suggested + p.inTransit) * p.cost,
    0
  );
  const margenEsperado =
    ventaPotencial > 0 ? ((ventaPotencial - costSell) / ventaPotencial) * 100 : 0;
  const inventarioInicial = products.reduce((a, p) => a + p.available * p.cost, 0);
  const inventarioFinal = products.reduce(
    (a, p) => a + Math.max(0, p.available + p.suggested + p.inTransit - p.needTotal) * p.cost,
    0
  );
  const nProd = products.length || 1;
  const riesgoQuiebrePct = (products.filter((p) => p.risk === "alto_quiebre").length / nProd) * 100;
  const riesgoSobrestockPct =
    (products.filter((p) => p.risk === "sobrestock").length / nProd) * 100;
  const presupuestoUtilizadoPct = season.budget > 0 ? (compraPropuesta / season.budget) * 100 : 0;
  const nivelServicio = Math.round(Math.max(80, 100 - riesgoQuiebrePct));

  const summary: SeasonSummary = {
    unitsTotal,
    ventaProyectada,
    compraPropuesta,
    ventaPotencial,
    margenEsperado,
    inventarioInicial,
    inventarioFinal,
    riesgoQuiebrePct,
    riesgoSobrestockPct,
    presupuestoUtilizadoPct,
    capitalInmovilizado: inventarioFinal,
    nivelServicio,
  };

  // Distribución por origen (nivel 2)
  const sum = (fn: (p: SeasonProductPlan) => number) => products.reduce((a, p) => a + fn(p), 0);
  const confirmada = sum((p) => p.empresaConfirmed + p.licitConfirmed);
  const historicaProyectada = sum(
    (p) => p.histAdjusted + p.growth + p.ecommerce + p.mercadoLibre + p.falabella
  );
  const probablePonderada = sum((p) => p.licitWeighted);
  const campanas = sum((p) => p.campaign);
  const stockEstrategico = sum((p) => p.safety);
  const totalOrigin =
    confirmada + historicaProyectada + probablePonderada + campanas + stockEstrategico;

  const byChannel: OriginItem[] = [
    { label: "Venta histórica en tiendas", units: sum((p) => p.histAdjusted + p.growth) },
    { label: "eCommerce", units: sum((p) => p.ecommerce) },
    { label: "Mercado Libre", units: sum((p) => p.mercadoLibre) },
    { label: "Falabella", units: sum((p) => p.falabella) },
    { label: "Venta empresa", units: sum((p) => p.empresaConfirmed) },
    { label: "Licitaciones confirmadas", units: sum((p) => p.licitConfirmed) },
    { label: "Licitaciones probables (ponderadas)", units: sum((p) => p.licitWeighted) },
    { label: "Campañas comerciales", units: sum((p) => p.campaign) },
    { label: "Stock estratégico", units: sum((p) => p.safety) },
  ].filter((o) => o.units > 0);

  const origin: OriginDistribution = {
    confirmada,
    historicaProyectada,
    probablePonderada,
    campanas,
    stockEstrategico,
    total: totalOrigin,
    byChannel,
  };

  // Temporada anterior (derivada, determinista)
  const prior: PriorSeason = {
    compra: Math.round(compraPropuesta * 0.87),
    venta: Math.round(ventaPotencial * 0.9),
    margen: Math.round((margenEsperado - 1.7) * 10) / 10,
    quiebrePct: Math.round(Math.min(100, riesgoQuiebrePct * 2.3 + 6) * 10) / 10,
    sobrestockPct: Math.round((riesgoSobrestockPct * 1.6 + 7) * 10) / 10,
  };

  return { season, scenario, products, summary, origin, prior };
}

/** Recomendación en lenguaje natural del total, desglosada por origen. */
export function seasonHeadline(plan: SeasonPlan): string {
  const p = plan.summary;
  const o = plan.origin;
  const pct = (n: number) => (o.total > 0 ? Math.round((n / o.total) * 100) : 0);
  return (
    `Se sugiere comprar ${p.unitsTotal.toLocaleString("es-CL")} unidades. ` +
    `${pct(o.historicaProyectada)}% responde a venta histórica y canales, ` +
    `${pct(o.confirmada)}% a demanda confirmada (empresa y licitaciones adjudicadas), ` +
    `${pct(o.probablePonderada)}% a licitaciones ponderadas, ` +
    `${pct(o.campanas)}% a campañas y ${pct(o.stockEstrategico)}% a stock de seguridad.`
  );
}

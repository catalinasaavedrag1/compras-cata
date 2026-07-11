import type { SeasonPlan, SeasonProductPlan } from "./seasonPlan";
import { CHANNEL_META, type DemandChannel } from "./channelDemand";
import { hashString } from "./hash";

// ============================================================================
//  Seguimiento de temporada (ejecución)
//  ---------------------------------------------------------------------------
//  La planificación no termina al emitir la OC: durante la temporada hay que
//  comparar el plan con la venta real, el pronóstico actualizado, lo emitido,
//  lo recibido y el stock actual — y avisar para replanificar. Este módulo
//  simula ese avance de forma determinista (demo) y genera las alertas y las
//  acciones sugeridas. No son datos de venta reales.
// ============================================================================

/** Avance sintético de la temporada (demo): ~45% de la ventana ejecutada. */
export const SEASON_PROGRESS = 0.45;

const round = (n: number) => Math.round(n);

// Desvío por canal respecto al plan (ilustra los ejemplos del brief).
const CHANNEL_ACTUAL_FACTOR: Record<DemandChannel, number> = {
  tienda: 1.05,
  ecommerce: 1.35,
  marketplace: 0.8,
  empresa: 1.15,
  licitaciones: 0.7,
};

export interface ChannelTracking {
  channel: DemandChannel;
  label: string;
  color: string;
  plannedSeason: number;
  expectedToDate: number;
  actualToDate: number;
  variancePct: number;
  status: "over" | "under" | "on";
}

export interface ProductTracking {
  sku: string;
  name: string;
  category: string;
  supplierName: string;
  plan: number;
  emitido: number;
  recibido: number;
  ventaReal: number;
  stockActual: number;
  pronosticoActual: number;
  stockoutWeek: number | null;
  invFinalProyectado: number;
  maxStock: number;
  overMax: boolean;
  delayDays: number;
}

export type AlertTone = "high" | "medium" | "low";

export interface TrackingAlert {
  id: string;
  tone: AlertTone;
  message: string;
  action: string;
}

export interface SeasonTracking {
  progressPct: number;
  channels: ChannelTracking[];
  products: ProductTracking[];
  alerts: TrackingAlert[];
  /** Acciones de replanificación disponibles. */
  replanActions: string[];
}

function channelPlanned(plan: SeasonPlan): Record<DemandChannel, number> {
  const sum = (fn: (p: SeasonProductPlan) => number) =>
    plan.products.reduce((a, p) => a + fn(p), 0);
  return {
    tienda: sum((p) => p.histAdjusted + p.growth),
    ecommerce: sum((p) => p.ecommerce),
    marketplace: sum((p) => p.mercadoLibre + p.falabella),
    empresa: sum((p) => p.empresaConfirmed),
    licitaciones: sum((p) => p.licitConfirmed + p.licitWeighted),
  };
}

function trackProduct(p: SeasonProductPlan, progress: number): ProductTracking {
  const h = hashString(p.sku + "trk");
  const saleFactor = 0.8 + (h % 6) * 0.07; // 0.8 .. 1.15 (venta moderada vs plan)
  const ventaReal = round(p.needTotal * progress * saleFactor);
  const emitido = p.suggested;
  const receivedFactor = 0.45 + (h % 5) * 0.11; // 0.45 .. 0.89 (buena parte ya recibida)
  const recibido = round(emitido * receivedFactor);
  const stockActual = Math.max(0, p.available + recibido - ventaReal);
  const pronosticoActual = progress > 0 ? round(ventaReal / progress) : p.needTotal;

  const remainingWeeks = Math.max(1, round((1 - progress) * 16));
  const weeklyDemand = (pronosticoActual * (1 - progress)) / remainingWeeks;
  const pendingReceipt = Math.max(0, emitido - recibido);
  // Cobertura considerando lo que aún llegará en tránsito: solo hay quiebre si
  // ni el stock ni lo pendiente alcanzan a cubrir lo que resta de temporada.
  const coverageUnits = stockActual + pendingReceipt;
  const stockoutWeek =
    weeklyDemand > 0 && coverageUnits / weeklyDemand < remainingWeeks
      ? Math.max(1, round(coverageUnits / weeklyDemand))
      : null;
  const invFinalProyectado = Math.max(
    0,
    round(stockActual + pendingReceipt - pronosticoActual * (1 - progress))
  );
  const delayDays = h % 4 === 0 ? 7 : 0;

  return {
    sku: p.sku,
    name: p.name,
    category: p.category,
    supplierName: p.supplierName,
    plan: p.needTotal,
    emitido,
    recibido,
    ventaReal,
    stockActual,
    pronosticoActual,
    stockoutWeek,
    invFinalProyectado,
    maxStock: p.maxStock,
    overMax: invFinalProyectado > p.maxStock,
    delayDays,
  };
}

export function trackSeason(plan: SeasonPlan): SeasonTracking {
  const progress = SEASON_PROGRESS;
  const planned = channelPlanned(plan);

  const channels: ChannelTracking[] = (Object.keys(planned) as DemandChannel[]).map((ch) => {
    const plannedSeason = planned[ch];
    const expectedToDate = round(plannedSeason * progress);
    const actualToDate = round(expectedToDate * CHANNEL_ACTUAL_FACTOR[ch]);
    const variancePct = expectedToDate > 0 ? (actualToDate / expectedToDate - 1) * 100 : 0;
    const status = variancePct > 8 ? "over" : variancePct < -8 ? "under" : "on";
    return {
      channel: ch,
      label: CHANNEL_META[ch].label,
      color: CHANNEL_META[ch].color,
      plannedSeason,
      expectedToDate,
      actualToDate,
      variancePct,
      status,
    };
  });

  const products = plan.products
    .map((p) => trackProduct(p, progress))
    .sort((a, b) => b.plan - a.plan);

  // -- Alertas derivadas + narrativas ----------------------------------------
  const alerts: TrackingAlert[] = [];

  const ecom = channels.find((c) => c.channel === "ecommerce");
  if (ecom && ecom.status === "over") {
    alerts.push({
      id: "ecom-over",
      tone: "high",
      message: `eCommerce vende ${round(ecom.variancePct)}% sobre el plan.`,
      action: "Reforzar stock del canal digital y adelantar reposición.",
    });
  }
  const mkt = channels.find((c) => c.channel === "marketplace");
  if (mkt && mkt.status === "under") {
    alerts.push({
      id: "mkt-under",
      tone: "medium",
      message: `Marketplace va ${round(Math.abs(mkt.variancePct))}% bajo el plan.`,
      action: "Revisar publicación/Buy Box o reasignar stock a otro canal.",
    });
  }
  const empresa = channels.find((c) => c.channel === "empresa");
  if (empresa && empresa.status === "over") {
    alerts.push({
      id: "empresa-extra",
      tone: "medium",
      message: "Venta empresa incorporó un pedido extraordinario sobre el plan.",
      action: "Confirmar disponibilidad y priorizar el pedido del cliente.",
    });
  }
  const licit = channels.find((c) => c.channel === "licitaciones");
  if (licit && licit.status === "under") {
    alerts.push({
      id: "licit-lost",
      tone: "medium",
      message: "Una licitación esperada no fue adjudicada.",
      action: "Disminuir la compra pendiente asociada o cancelar saldos.",
    });
  }

  const delayed = products.find((p) => p.delayDays > 0 && p.emitido > 0);
  if (delayed) {
    alerts.push({
      id: `delay-${delayed.sku}`,
      tone: "high",
      message: `El proveedor de ${delayed.name} retrasó la llegada ${delayed.delayDays} días.`,
      action: "Adelantar entrega o transferir stock desde otra sucursal.",
    });
  }
  const willStockout = products.find((p) => p.stockoutWeek !== null && p.stockActual >= 0);
  if (willStockout) {
    alerts.push({
      id: `stockout-${willStockout.sku}`,
      tone: "high",
      message: `${willStockout.name} agotará stock en ~${willStockout.stockoutWeek} semanas, antes de la próxima recepción.`,
      action: "Aumentar la compra o priorizar su despacho.",
    });
  }
  const overMax = products.find((p) => p.overMax);
  if (overMax) {
    alerts.push({
      id: `overmax-${overMax.sku}`,
      tone: "medium",
      message: `El inventario final proyectado de ${overMax.name} supera el máximo permitido.`,
      action: "Reducir la compra pendiente o planificar liquidación.",
    });
  }
  const transferable = plan.products.find((p) => p.transfer > 0);
  if (transferable) {
    alerts.push({
      id: `transfer-${transferable.sku}`,
      tone: "low",
      message: `Hay stock disponible de ${transferable.name} en otra sucursal.`,
      action: "Transferir en vez de comprar y ahorrar capital.",
    });
  }

  const replanActions = [
    "Aumentar compra",
    "Disminuir compra pendiente",
    "Cancelar saldos",
    "Adelantar entregas",
    "Transferir stock",
    "Redistribuir por sucursal",
    "Priorizar canal o cliente",
    "Liquidar productos atrasados",
  ];

  return { progressPct: round(progress * 100), channels, products, alerts, replanActions };
}

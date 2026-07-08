import type { ChannelMargin, MarginChannelKey, MarginStatus } from "../types/purchasing";
import { products } from "./mockProducts";
import { categories } from "./mockCategories";

// ============================================================================
//  Margen por canal de venta.
//  Un mismo SKU se vende en marketplace, web y tienda con precios, comisiones y
//  descuentos distintos → márgenes distintos. Se deriva del catálogo para
//  mantener coherencia, con reglas realistas por canal.
// ============================================================================

export const CHANNEL_LABELS: Record<MarginChannelKey, string> = {
  marketplace: "Marketplace",
  web: "Web / Ecommerce",
  store: "Tienda física",
};

export const MARGIN_STATUS: Record<
  MarginStatus,
  { label: string; tone: "red" | "amber" | "green" | "violet" }
> = {
  negative: { label: "Margen negativo", tone: "red" },
  low: { label: "Bajo margen", tone: "amber" },
  normal: { label: "Margen normal", tone: "green" },
  over: { label: "Sobre marginado", tone: "violet" },
};

function buyerForCategory(category: string): string {
  return categories.find((c) => c.name === category)?.buyer ?? "—";
}

function statusFor(marginPct: number, target: number): MarginStatus {
  if (marginPct < 0) return "negative";
  if (marginPct < target - 3) return "low";
  if (marginPct > target + 6) return "over";
  return "normal";
}

function causeFor(
  channel: MarginChannelKey,
  status: MarginStatus,
  commission: number,
  discount: number
): string {
  if (status === "negative")
    return "El costo más comisión supera el precio final. Pérdida por venta.";
  if (status === "over") return "Precio alto frente al costo. Puede estar poco competitivo.";
  if (status === "low") {
    if (channel === "marketplace" && commission > 0)
      return "La comisión del marketplace reduce el margen.";
    if (discount > 0) return "El descuento activo deja el margen bajo el objetivo.";
    return "El precio de venta es bajo frente al costo.";
  }
  return "Margen dentro del rango objetivo.";
}

function actionFor(channel: MarginChannelKey, status: MarginStatus): string {
  if (status === "negative") return "Subir precio o frenar la venta en este canal.";
  if (status === "low")
    return channel === "marketplace"
      ? "Revisar precio o comisión en marketplace."
      : "Revisar precio o descuento.";
  if (status === "over") return "Revisar competitividad: precio sobre el objetivo.";
  return "Mantener.";
}

function build(
  sku: string,
  channel: MarginChannelKey,
  listPrice: number,
  cost: number,
  target: number,
  commission: number,
  discount: number,
  sales30: number,
  stock: number,
  product: (typeof products)[number]
): ChannelMargin {
  const finalPrice = Math.round(listPrice - discount);
  const marginPct = Math.round(((finalPrice - cost - commission) / finalPrice) * 1000) / 10;
  const suggestedPrice = Math.round((cost + commission) / (1 - target / 100));
  const status = statusFor(marginPct, target);
  return {
    sku,
    productName: product.name,
    category: product.category,
    supplierName: product.supplierName,
    buyer: buyerForCategory(product.category),
    channel,
    listPrice,
    finalPrice,
    cost,
    commission,
    discount,
    marginPct,
    targetMarginPct: target,
    sales30,
    stock,
    suggestedPrice,
    status,
    cause: causeFor(channel, status, commission, discount),
    action: actionFor(channel, status),
  };
}

// SKUs representativos del catálogo
const SELECTED = [
  "HER-001",
  "HER-002",
  "HER-003",
  "CON-001",
  "MAD-001",
  "ELE-001",
  "ELE-002",
  "GAS-002",
  "FER-003",
  "PIN-001",
  "PIN-002",
  "JAR-003",
  "SEG-001",
  "ELE-003",
  // Nuevos SKUs del catálogo ampliado
  "CON-003",
  "MAD-003",
  "FER-005",
  "FER-006",
  "GAS-006",
  "HER-004",
  "HER-005",
  "HER-006",
  "PIN-003",
  "PIN-004",
  "ELE-005",
  "ELE-006",
  "JAR-006",
  "SEG-002",
  "AGR-002",
];

const TARGET_BY_CATEGORY: Record<string, number> = {
  "Herramientas eléctricas": 32,
  Ferretería: 28,
  Construcción: 22,
  Pinturas: 25,
  Electricidad: 30,
  Gasfitería: 28,
  Jardín: 30,
  "Seguridad industrial": 30,
  Maderas: 25,
  Agrícola: 27,
};

export const channelMargins: ChannelMargin[] = SELECTED.flatMap((sku) => {
  const p = products.find((x) => x.sku === sku);
  if (!p) return [];
  const target = TARGET_BY_CATEGORY[p.category] ?? 25;
  const webPrice = p.price;
  const mktPrice = Math.round(p.price * 0.96); // marketplace suele ser más barato
  const storePrice = Math.round(p.price * 1.08); // tienda algo más cara

  // Reparto de venta y descuentos por canal (variando por SKU)
  const mktCommission = Math.round(mktPrice * 0.13);
  const mktDiscount = p.salesLast30Days > 50 ? Math.round(mktPrice * 0.04) : 0;
  const webDiscount = p.purchaseStatus === "overstock" ? Math.round(webPrice * 0.05) : 0;

  const splitMkt = Math.round(p.salesLast30Days * 0.45);
  const splitWeb = Math.round(p.salesLast30Days * 0.35);
  const splitStore = p.salesLast30Days - splitMkt - splitWeb;

  const stockMkt = Math.round(p.availableStock * 0.4);
  const stockWeb = Math.round(p.availableStock * 0.3);
  const stockStore = p.availableStock - stockMkt - stockWeb;

  return [
    build(
      sku,
      "marketplace",
      mktPrice,
      p.cost,
      target,
      mktCommission,
      mktDiscount,
      splitMkt,
      stockMkt,
      p
    ),
    build(sku, "web", webPrice, p.cost, target, 0, webDiscount, splitWeb, stockWeb, p),
    build(sku, "store", storePrice, p.cost, target, 0, 0, splitStore, stockStore, p),
  ];
});

/** Margen por canal de un SKU específico (marketplace, web, tienda). */
export function channelMarginsForSku(sku: string): ChannelMargin[] {
  return channelMargins.filter((c) => c.sku === sku);
}

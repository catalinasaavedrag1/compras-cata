import { products } from "../../data/mockProducts";
import { suppliers, getSupplierByName } from "../../data/mockSuppliers";
import { supplierFulfillment } from "../../utils/supplierPerf";
import { productNegotiation } from "../../utils/negotiation";
import { purchaseRules, resolveRuleForProduct } from "../../data/mockRules";
import { receptions } from "../../data/mockReceptions";
import { formatCurrency, formatDays, formatPercent } from "../../utils/formatters";
import type { Product, PurchaseRecommendation, Supplier } from "../../types/purchasing";

/** Datos derivados que alimentan el Panel de negociación (todo cálculo, sin JSX). */
export interface NegotiationData {
  sales30: number;
  sales90: number;
  tendencia: number;
  ranking: number;
  objetivo: number;
  brecha: number;
  costoObjetivo: number;
  bajaCosto: number;
  enTransito: number;
  enQuiebre: boolean;
  ventaPerdida: number;
  master: Supplier | undefined;
  perf: ReturnType<typeof supplierFulfillment> | null;
  compraAnual: number;
  alternativas: Supplier[];
  neg: ReturnType<typeof productNegotiation>;
  locations: Product["stockByLocation"];
  maxLocStock: number;
  objetivos: string[];
  decisiones: { label: string; on: boolean }[];
}

/** Calcula todos los datos derivados del panel de negociación de un producto. */
export function buildNegotiationData(
  product: Product,
  rec?: PurchaseRecommendation
): NegotiationData {
  const sales30 = product.salesLast30Days;
  const sales90 = product.salesLast90Days;
  const tendencia = sales90 > 0 ? (sales30 / (sales90 / 3) - 1) * 100 : 0;
  const ranking =
    [...products]
      .sort((a, b) => b.salesLast30Days - a.salesLast30Days)
      .findIndex((p) => p.sku === product.sku) + 1;

  const rule = resolveRuleForProduct(product, purchaseRules);
  const objetivo = rule.minMargin;
  const brecha = objetivo - product.margin;
  const costoObjetivo = Math.round(product.price * (1 - objetivo / 100));
  const bajaCosto =
    product.cost > costoObjetivo ? ((product.cost - costoObjetivo) / product.cost) * 100 : 0;

  const enTransito = receptions
    .filter((r) => ["in_transit", "scheduled"].includes(r.status))
    .flatMap((r) => r.items ?? [])
    .filter((it) => it.sku === product.sku)
    .reduce((a, it) => a + Math.max(0, it.expected - it.received), 0);
  const enQuiebre = product.availableStock <= 0 && sales30 > 0;
  const ventaPerdida = enQuiebre ? sales30 * product.price : 0;

  const master = product.supplierName ? getSupplierByName(product.supplierName) : undefined;
  const perf = product.supplierName ? supplierFulfillment(product.supplierName) : null;
  const compraAnual = master ? master.purchasedAmountLast90Days * 4 : 0;

  const alternativas = suppliers.filter(
    (s) =>
      s.name !== product.supplierName &&
      s.status !== "inactive" &&
      s.categories.includes(product.category)
  );

  const neg = productNegotiation(product);
  const locations = [...product.stockByLocation].sort((a, b) => b.stock - a.stock);
  const maxLocStock = Math.max(1, ...locations.map((l) => l.stock));

  // Objetivos de negociación sugeridos
  const objetivos: string[] = [];
  if (brecha > 0 && bajaCosto > 0)
    objetivos.push(
      `Bajar el costo ~${formatPercent(bajaCosto, 0)} (a ${formatCurrency(costoObjetivo)}) para alcanzar el margen objetivo de ${formatPercent(objetivo, 0)}`
    );
  if (perf && perf.fillRate < 95)
    objetivos.push(`Mejorar el fill rate de ${perf.fillRate}% a 95% (despacho completo)`);
  if (master && master.deliveryCompliance < 90)
    objetivos.push(
      `Subir cumplimiento de entrega de ${formatPercent(master.deliveryCompliance, 0)} a 95%`
    );
  if (master && master.averageLeadTimeDays >= 12)
    objetivos.push(
      `Reducir lead time (${formatDays(master.averageLeadTimeDays)}) o acordar despacho semanal`
    );
  if (enQuiebre)
    objetivos.push("Stock de seguridad o despacho parcial para frenar la venta perdida");
  if (sales30 >= 50) objetivos.push("Bonificación por volumen o rebate por crecimiento");
  objetivos.push("Plazo de pago 60 días o descuento por pronto pago");

  // Próxima decisión sugerida
  const decisiones: { label: string; on: boolean }[] = [
    { label: "Comprar", on: !!rec && rec.suggestedQuantity > 0 && rec.status !== "overstock" },
    { label: "Renegociar costo", on: brecha > 0 },
    { label: "Liquidar", on: product.purchaseStatus === "overstock" },
    {
      label: "Cambiar proveedor",
      on: (perf?.fillRate ?? 100) < 80 || (master?.deliveryCompliance ?? 100) < 70,
    },
    { label: "Pedir campaña", on: tendencia > 15 },
    { label: "Mantener", on: true },
  ];

  return {
    sales30,
    sales90,
    tendencia,
    ranking,
    objetivo,
    brecha,
    costoObjetivo,
    bajaCosto,
    enTransito,
    enQuiebre,
    ventaPerdida,
    master,
    perf,
    compraAnual,
    alternativas,
    neg,
    locations,
    maxLocStock,
    objetivos,
    decisiones,
  };
}

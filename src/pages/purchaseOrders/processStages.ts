import type { PurchaseProcessStage } from "../../components/business/PurchaseProcessBar";
import type { PickupPlan } from "../../utils/logistics";
import type { PurchaseOrder } from "../../types/purchasing";

/**
 * Construye las 8 etapas del "Proceso de compra" (necesidad → por recibir) para
 * la PurchaseProcessBar de Órdenes. (Extraído de PurchaseOrdersPage.)
 */
export function buildOrderProcessStages({
  necesidadCount,
  rfqCount,
  draftCount,
  pathname,
  pickupPlan,
  pendingCount,
  ordersCount,
  emittedCount,
  receivingOrders,
}: {
  necesidadCount: number;
  rfqCount: number;
  draftCount: number;
  pathname: string;
  pickupPlan: PickupPlan;
  pendingCount: number;
  ordersCount: number;
  emittedCount: number;
  receivingOrders: PurchaseOrder[];
}): PurchaseProcessStage[] {
  return [
    {
      label: "Necesidad",
      detail: "Decidir qué comprar",
      count: necesidadCount,
      to: "/comprar/decisiones",
      tone: "red",
    },
    {
      label: "Preparación",
      detail: "Cotizar y negociar",
      count: rfqCount,
      to: "/comprar/cotizaciones",
      tone: rfqCount > 0 ? "amber" : "neutral",
    },
    {
      label: "Borrador",
      detail: "Construir OC",
      count: draftCount,
      to: "/comprar/borradores",
      active: pathname.includes("/comprar/borradores"),
      tone: draftCount > 0 ? "blue" : "neutral",
    },
    {
      label: "Retiro",
      detail: "Planificar transporte",
      count: pickupPlan.truckCount,
      to: "/comprar/plan-retiro",
      active: pathname.includes("/comprar/plan-retiro"),
      tone: pickupPlan.alerts.some((a) => a.level === "warning")
        ? "amber"
        : pickupPlan.truckCount > 0
          ? "blue"
          : "neutral",
    },
    {
      label: "Aprobación",
      detail: "Validar desvíos",
      count: pendingCount,
      to: "/comprar/aprobaciones",
      tone: pendingCount > 0 ? "amber" : "green",
    },
    {
      label: "Órdenes",
      detail: "Emitidas",
      count: ordersCount,
      to: "/comprar/ordenes",
      active: pathname.includes("/comprar/ordenes"),
      tone: ordersCount > 0 ? "blue" : "neutral",
    },
    {
      label: "Emitidas",
      detail: "OC en curso",
      count: emittedCount,
      to: "/comprar/seguimiento",
      active: pathname.includes("/comprar/seguimiento"),
      tone: emittedCount > 0 ? "blue" : "neutral",
    },
    {
      label: "Por recibir",
      detail: "Recepción",
      count: receivingOrders.length,
      to: "/comprar/recepciones",
      tone: receivingOrders.some((o) => o.status === "delayed") ? "red" : "blue",
    },
  ];
}

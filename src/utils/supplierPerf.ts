import { receptions, ARRIVED_STATUSES } from "../data/mockReceptions";
import { getSupplierByName } from "../data/mockSuppliers";

// ============================================================================
//  Rendimiento de despacho del proveedor, calculado desde las recepciones.
//  Distingue dos cosas: "cumplimiento" (entrega a tiempo, del maestro) y
//  "fill / despacho" (qué % de lo pedido realmente envió). Deja en evidencia
//  cuando un proveedor no cumple siempre.
// ============================================================================

export interface SupplierFulfillment {
  arrivedOrders: number;
  partialOrders: number; // recepciones que no llegaron completas
  unitsExpected: number;
  unitsReceived: number;
  fillRate: number; // % de unidades despachadas vs pedidas
  undeliveredSkus: number; // líneas con recibido < pedido
  compliance: number | null; // entrega a tiempo (maestro)
  leadTimeDays: number | null;
  ratingLabel: string;
  tone: "green" | "amber" | "red";
}

export function supplierFulfillment(name: string): SupplierFulfillment {
  const rs = receptions.filter((r) => r.supplierName === name && ARRIVED_STATUSES.includes(r.status));
  let unitsExpected = 0;
  let unitsReceived = 0;
  let undeliveredSkus = 0;
  let partialOrders = 0;

  rs.forEach((r) => {
    const items = r.items ?? [];
    let missing = false;
    if (items.length > 0) {
      items.forEach((it) => {
        unitsExpected += it.expected;
        unitsReceived += it.received;
        if (it.received < it.expected) {
          undeliveredSkus++;
          missing = true;
        }
      });
    } else {
      unitsExpected += r.unitsExpected;
      unitsReceived += r.unitsReceived;
      if (r.unitsReceived < r.unitsExpected) missing = true;
    }
    if (missing || r.status === "partial" || r.status === "with_issues") partialOrders++;
  });

  const fillRate = unitsExpected > 0 ? Math.round((unitsReceived / unitsExpected) * 100) : 100;
  const master = getSupplierByName(name);
  const compliance = master ? master.deliveryCompliance : null;
  const comp = compliance ?? 100;

  let ratingLabel: string;
  let tone: "green" | "amber" | "red";
  if (fillRate >= 98 && comp >= 85) {
    ratingLabel = "Cumple bien";
    tone = "green";
  } else if (fillRate >= 90 && comp >= 70) {
    ratingLabel = "Irregular";
    tone = "amber";
  } else {
    ratingLabel = "No cumple siempre";
    tone = "red";
  }

  return {
    arrivedOrders: rs.length,
    partialOrders,
    unitsExpected,
    unitsReceived,
    fillRate,
    undeliveredSkus,
    compliance,
    leadTimeDays: master ? master.averageLeadTimeDays : null,
    ratingLabel,
    tone,
  };
}

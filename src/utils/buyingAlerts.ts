// ============================================================================
//  Alertas inteligentes de compra.
//
//  Antes de agregar una cantidad a la orden, cruza la decisión con el resto del
//  negocio y avisa lo que un comprador experto revisaría de memoria:
//
//    · "Estás comprando X meses de inventario."
//    · "Ya existe una OC abierta para este SKU."
//    · "Este proveedor acumula entregas atrasadas."
//    · "Con esta compra superarás la capacidad de la bodega."
//
//  Cada alerta es accionable y explica su motivo con números, no solo un color.
// ============================================================================

import { getProductBySku } from "../data/mockProducts";
import { getSupplierByName } from "../data/mockSuppliers";
import { productLogistics } from "../data/logistics";
import { getWarehouseCapacity, warehouseHeadroomM3 } from "../data/mockWarehouses";
import { formatNumber } from "./formatters";

export type BuyingAlertTone = "bad" | "warn" | "info";

export interface BuyingAlert {
  id: string;
  tone: BuyingAlertTone;
  title: string;
  detail?: string;
}

export interface BuyingAlertInput {
  sku: string;
  supplierName: string;
  /** Cantidad que se planea comprar. */
  quantity: number;
  /** Stock disponible actual. */
  availableStock: number;
  /** Unidades en tránsito consideradas. */
  incoming?: number;
  salesLast30Days: number;
  /** OC abierta para el SKU, si existe. */
  openPo?: { number: string; quantity: number; expectedDate: string; status: string };
}

function fmtM3(n: number): string {
  return `${n.toLocaleString("es-CL", { maximumFractionDigits: 1 })} m³`;
}


/** Bodega principal del SKU = ubicación con más stock. */
function primaryLocation(sku: string): string | null {
  const p = getProductBySku(sku);
  if (!p || p.stockByLocation.length === 0) return null;
  return [...p.stockByLocation].sort((a, b) => b.stock - a.stock)[0].locationName;
}

export function buildBuyingAlerts(input: BuyingAlertInput): BuyingAlert[] {
  const { sku, supplierName, quantity, availableStock, salesLast30Days } = input;
  const incoming = input.incoming ?? 0;
  const alerts: BuyingAlert[] = [];

  if (quantity <= 0) return alerts;

  // 1 · Meses de inventario que deja la compra ---------------------------------
  const dailyDemand = salesLast30Days > 0 ? salesLast30Days / 30 : 0;
  if (dailyDemand > 0) {
    const months = (availableStock + quantity + incoming) / (dailyDemand * 30);
    if (months >= 4) {
      alerts.push({
        id: "months-of-inventory",
        tone: months >= 6 ? "bad" : "warn",
        title: `Estás comprando ${months.toLocaleString("es-CL", { maximumFractionDigits: 1 })} meses de inventario`,
        detail:
          months >= 6
            ? "Muy por sobre una cobertura sana (2-3 meses): inmoviliza capital y baja el retorno de inventario."
            : "Sobre una cobertura sana (2-3 meses). Revisa si conviene fraccionar la compra.",
      });
    }
  }

  // 2 · Ya existe una OC abierta para el SKU -----------------------------------
  if (input.openPo) {
    const delayed = input.openPo.status === "delayed";
    alerts.push({
      id: "open-po",
      tone: delayed ? "warn" : "info",
      title: `Ya existe una OC abierta para este SKU (${input.openPo.number})`,
      detail: `${formatNumber(input.openPo.quantity)} u. con entrega esperada ${input.openPo.expectedDate}${
        delayed ? " · actualmente atrasada" : ""
      }. Evita duplicar la compra.`,
    });
  }

  // 3 · Proveedor con entregas atrasadas ---------------------------------------
  const supplier = getSupplierByName(supplierName);
  if (supplier && (supplier.status === "delayed" || supplier.deliveryCompliance < 80)) {
    alerts.push({
      id: "supplier-delay",
      tone: supplier.status === "delayed" || supplier.deliveryCompliance < 70 ? "warn" : "info",
      title: `${supplierName} viene con entregas atrasadas`,
      detail: `Cumplimiento de entrega ${Math.round(supplier.deliveryCompliance)}%. Considera un colchón mayor o un proveedor alternativo.`,
    });
  }

  // 4 · Capacidad de bodega ----------------------------------------------------
  const location = primaryLocation(sku);
  const product = getProductBySku(sku);
  if (location && product) {
    const volPerUnit = product.logistica?.volumenM3 ?? productLogistics(product).volumenM3;
    const purchaseVol = quantity * volPerUnit;
    const headroom = warehouseHeadroomM3(location);
    const cap = getWarehouseCapacity(location);
    if (headroom != null && cap != null && purchaseVol > 0) {
      if (purchaseVol > headroom) {
        alerts.push({
          id: "warehouse-capacity",
          tone: "bad",
          title: `Con esta compra superarás la capacidad de ${location}`,
          detail: `Requiere ${fmtM3(purchaseVol)} y quedan ${fmtM3(headroom)} libres (ocupación ${Math.round(
            (cap.usedM3 / cap.capacityM3) * 100
          )}%). Fracciona la entrega o deriva a otra bodega.`,
        });
      } else if (purchaseVol > headroom * 0.7) {
        alerts.push({
          id: "warehouse-capacity",
          tone: "warn",
          title: `Esta compra usará gran parte del espacio de ${location}`,
          detail: `Requiere ${fmtM3(purchaseVol)} de los ${fmtM3(headroom)} libres. Coordina recepción y ubicación.`,
        });
      }
    }
  }

  return alerts;
}

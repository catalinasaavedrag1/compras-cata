// ============================================================================
//  Historial y auditoría de Órdenes de Compra (demo, determinista).
//  Reconstruye la traza de una OC a partir de su estado y fechas: quién creó,
//  editó cantidad/costo, aprobó, envió a SAP, el proveedor confirmó y bodega
//  recibió. También sintetiza la factura asociada (conciliación vs OC).
//  No usa Math.random ni Date.now.
// ============================================================================
import type { PurchaseOrder } from "../types/purchasing";
import { formatCurrency, formatNumber } from "../utils/formatters";
import { hashString as hash } from "../utils/hash";

export interface OcChangeEntry {
  fecha: string;
  usuario: string;
  accion: string;
  detalle?: string;
}

export interface OcInvoice {
  numero: string;
  fecha: string;
  monto: number;
  estado: "pendiente" | "conciliada" | "con_diferencia";
  diferencia: number;
}

export interface OcAudit {
  changelog: OcChangeEntry[];
  invoice?: OcInvoice;
}

const APPROVER = "Jefatura de Compras";

// Qué hitos ya ocurrieron según el estado de la OC.
const RANK: Record<string, number> = {
  draft: 0,
  pending_approval: 1,
  approved: 2,
  sent: 3,
  delayed: 3,
  confirmed: 4,
  partially_received: 5,
  with_difference: 5,
  received: 6,
  closed: 7,
  cancelled: 1,
};

/** Reconstruye la traza de auditoría y la factura asociada de una OC. */
export function buildOcAudit(o: PurchaseOrder): OcAudit {
  const rank = RANK[o.status] ?? 0;
  const key = o.number ?? o.id;
  const log: OcChangeEntry[] = [];
  const firstLine = o.lines?.[0];

  log.push({
    fecha: o.createdAt,
    usuario: o.buyerName,
    accion: "Creó la orden de compra",
    detalle: `${o.lines?.length ?? o.skuCount} líneas · ${formatCurrency(o.totalAmount)}`,
  });

  // Edición manual destacada (cantidad o costo), determinista por OC.
  const variant = hash(key) % 3;
  if (firstLine && variant === 0) {
    log.push({
      fecha: o.createdAt,
      usuario: o.buyerName,
      accion: "Editó cantidad",
      detalle: `${firstLine.productName}: ${formatNumber(Math.round(firstLine.quantity * 0.85))} → ${formatNumber(firstLine.quantity)} u.`,
    });
  } else if (firstLine && variant === 1) {
    log.push({
      fecha: o.createdAt,
      usuario: o.buyerName,
      accion: "Ajustó costo unitario",
      detalle: `${firstLine.productName}: ${formatCurrency(Math.round(firstLine.unitCost * 0.95))} → ${formatCurrency(firstLine.unitCost)} c/u`,
    });
  }

  if (rank >= 2) log.push({ fecha: o.createdAt, usuario: APPROVER, accion: "Aprobó la OC" });
  if (rank >= 3)
    log.push({
      fecha: o.createdAt,
      usuario: "Integración SAP B1",
      accion: "Sincronizó con SAP",
      detalle: `OC ${key} creada en SAP`,
    });
  if (rank >= 3)
    log.push({ fecha: o.createdAt, usuario: o.buyerName, accion: "Envió la OC al proveedor" });
  if (o.confirmedDate)
    log.push({
      fecha: o.confirmedDate,
      usuario: o.supplierName,
      accion: "El proveedor confirmó la OC",
    });
  if (rank >= 5)
    log.push({
      fecha: o.confirmedDate ?? o.expectedDate,
      usuario: "Bodega / Recepción",
      accion: "Registró la recepción de mercadería",
    });

  let invoice: OcInvoice | undefined;
  if (rank >= 5) {
    const diferencia = o.status === "with_difference" ? Math.round(o.totalAmount * 0.04) : 0;
    const digits = key.replace(/\D/g, "").slice(-6) || "000000";
    invoice = {
      numero: `F-${digits}`,
      fecha: o.confirmedDate ?? o.expectedDate,
      monto: o.totalAmount - diferencia,
      estado: diferencia > 0 ? "con_diferencia" : "conciliada",
      diferencia,
    };
  }

  return { changelog: log, invoice };
}

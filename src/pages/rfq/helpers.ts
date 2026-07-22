import type { BadgeTone } from "../../components/ui/Badge";
import {
  describePurchaseBffError,
  type PurchaseBffError,
  type RfqDetailView,
  type RfqResponseView,
  type RfqStatusBff,
} from "../../services/purchaseBff";

// ============================================================================
//  Cotizaciones (F8): mapeo de la máquina de estados real del dominio a las
//  etiquetas/badges y pestañas que ya usaba la pantalla con el mock.
//
//  Máquina real (purchase-service, C20):
//    draft → sent → partially_responded | responded → awarded | cancelled
//    (`expired` existe pero v1 no lo auto-setea: sin batch de vencimiento).
//
//  Mapeo elegido (estado real → vista existente del front):
//    draft               → "Borrador"          → tab "Borrador"
//    sent                → "Enviada"           → tab "Enviadas"
//    partially_responded → "Respuesta parcial" → tab "Respondidas"
//    responded           → "Respondida"        → tab "Respondidas"
//    awarded             → "Adjudicada"        → tab "Adjudicadas"
//                          (reemplaza a la antigua "Aprobadas": en el contrato
//                          real la adjudicación C20 ya crea la propuesta)
//    cancelled           → "Cancelada"         → tab "Vencidas / canceladas"
//    expired             → "Vencida"           → tab "Vencidas / canceladas"
//
//  "Vencida" DERIVADA: una RFQ en sent | partially_responded con dueDate < hoy
//  se muestra como "Vencida" y cae en la tab "Vencidas / canceladas" (el
//  backend no auto-expira en v1). La tab "En negociación" del mock no existe
//  en la máquina real y se reemplaza por "Vencidas / canceladas".
// ============================================================================

export const RFQ_STATUS_UI: Record<RfqStatusBff, { label: string; tone: BadgeTone }> = {
  draft: { label: "Borrador", tone: "slate" },
  sent: { label: "Enviada", tone: "blue" },
  partially_responded: { label: "Respuesta parcial", tone: "amber" },
  responded: { label: "Respondida", tone: "blue" },
  awarded: { label: "Adjudicada", tone: "green" },
  cancelled: { label: "Cancelada", tone: "neutral" },
  expired: { label: "Vencida", tone: "red" },
};

/** Adjudicar (C20) exige este permiso en el dominio (matriz 06). */
export const RFQ_AWARD_PERMISSION = "purchase:rfq:award";

/** Estados en que la RFQ sigue "en juego" (señal para las barras de proceso). */
export const OPEN_RFQ_STATUSES: RfqStatusBff[] = [
  "draft",
  "sent",
  "partially_responded",
  "responded",
];

/** Estados desde los que el dominio admite `cancel`. */
export const CANCELLABLE_RFQ_STATUSES: RfqStatusBff[] = [
  "draft",
  "sent",
  "partially_responded",
  "responded",
];

/** Estados desde los que el dominio admite registrar respuestas. */
export const RESPONDABLE_RFQ_STATUSES: RfqStatusBff[] = ["sent", "partially_responded"];

/** Estados desde los que el dominio admite adjudicar (C20). */
export const AWARDABLE_RFQ_STATUSES: RfqStatusBff[] = ["responded", "partially_responded"];

/**
 * "Vencida" derivada: v1 no auto-expira, así que una RFQ esperando respuestas
 * (sent | partially_responded) con dueDate anterior a hoy se muestra vencida.
 */
export function isRfqOverdue(
  rfq: { status: RfqStatusBff; dueDate: string | null },
  todayIso: string
): boolean {
  if (rfq.status !== "sent" && rfq.status !== "partially_responded") return false;
  if (!rfq.dueDate) return false;
  return rfq.dueDate.slice(0, 10) < todayIso;
}

/** Badge a mostrar: el estado real, salvo vencida derivada de dueDate. */
export function rfqStatusUi(
  rfq: { status: RfqStatusBff; dueDate: string | null },
  todayIso: string
): { label: string; tone: BadgeTone } {
  if (isRfqOverdue(rfq, todayIso)) return RFQ_STATUS_UI.expired;
  return RFQ_STATUS_UI[rfq.status];
}

function isRfqStatus(value: string): value is RfqStatusBff {
  return value in RFQ_STATUS_UI;
}

/**
 * 409 de estado inválido del dominio ({ current, allowed }) → mensaje legible.
 * Devuelve null si el error no trae ese detalle (usar el describe genérico).
 */
export function describeRfqConflict(info: PurchaseBffError): string | null {
  if (info.code !== "CONFLICT") return null;
  const d =
    typeof info.details === "object" && info.details !== null
      ? (info.details as Record<string, unknown>)
      : {};
  const current = typeof d.current === "string" ? d.current : null;
  const allowed = Array.isArray(d.allowed)
    ? d.allowed.filter((s): s is string => typeof s === "string")
    : [];
  if (!current) return null;
  const label = (s: string) => (isRfqStatus(s) ? RFQ_STATUS_UI[s].label : s);
  const allowedTxt = allowed.map(label).join(" o ");
  return allowedTxt.length > 0
    ? `La cotización está en "${label(current)}" y esta acción requiere estado ${allowedTxt}.`
    : `La cotización está en "${label(current)}" y no admite esta acción.`;
}

/**
 * Mensaje de error para toasts de RFQ: 409 legible si trae {current, allowed};
 * los VALIDATION_ERROR del dominio llegan con prefijo técnico
 * ("SUPPLIER_INACTIVE: …", "SUPPLIER_NOT_INVITED: …") que aquí se limpia.
 */
export function describeRfqError(info: PurchaseBffError): string {
  const conflict = describeRfqConflict(info);
  if (conflict) return conflict;
  const base = describePurchaseBffError(info);
  const match = /^[A-Z0-9_]+:\s*(.+)$/.exec(base);
  return match ? match[1] : base;
}

/** Formato canónico del supplierRef (SupplierRelationship): SUP-xxx. */
export function isValidSupplierRef(value: string): boolean {
  return /^SUP-[A-Za-z0-9-]{2,}$/i.test(value.trim());
}

/** Total ofertado de una respuesta: Σ costo unitario × cantidad solicitada. */
export function responseTotalClp(detail: RfqDetailView, response: RfqResponseView): number | null {
  const qtyByLineId = new Map(detail.lines.map((line) => [line.id, line.qty]));
  let total = 0;
  let known = false;
  for (const line of response.lines) {
    const qty = qtyByLineId.get(line.rfqLineId);
    if (line.unitCostClp === null || qty === null || qty === undefined) continue;
    total += line.unitCostClp * qty;
    known = true;
  }
  return known ? Math.round(total) : null;
}

/** Nombre de exhibición del proveedor de una respuesta (nameSnap o su ref). */
export function responseSupplierLabel(detail: RfqDetailView, response: RfqResponseView): string {
  const supplier = detail.suppliers.find((s) => s.id === response.rfqSupplierId);
  return supplier?.supplierName ?? supplier?.supplierRef ?? response.supplierRef ?? "Proveedor";
}

import type {
  PurchaseBffError,
  ReceptionBffStatus,
  ReceptionItemView,
  ReceptionTransitionAction,
} from "../../services/purchaseBff";

// ============================================================================
//  Recepciones (F4): mapeo de la máquina de estados real del dominio a las
//  etiquetas/badges que ya usaba la pantalla con el mock.
//
//  Máquina real (purchase-service, 01-modelo-dominio §2):
//    expected → in_transit → arrived → checking → completed|discrepancy|rejected
//
//  Mapeo elegido (estado real → etiqueta existente del mock):
//    expected    → "Programada"      (mock `scheduled`, tono neutral)
//    in_transit  → "En tránsito"     (mock `in_transit`, tono blue)
//    arrived     → "Arribada"        (sin análogo mock; tono violet)
//    checking    → "En revisión"     (sin análogo mock; tono amber)
//    completed   → "Recibida"        (mock `received`, tono green)
//    discrepancy → "Con diferencias" (mock `with_issues`/`partial`, tono red)
//    rejected    → "Rechazada"       (sin análogo mock; tono red)
//
//  "Atrasada" (mock `delayed`) deja de ser un estado persistido: se deriva
//  client-side de expectedDate < hoy con estado aún previo a la llegada.
// ============================================================================

export type BadgeToneUi = "blue" | "amber" | "green" | "red" | "violet" | "neutral";

export const RECEPTION_STATUS_UI: Record<
  ReceptionBffStatus,
  { label: string; tone: BadgeToneUi }
> = {
  expected: { label: "Programada", tone: "neutral" },
  in_transit: { label: "En tránsito", tone: "blue" },
  arrived: { label: "Arribada", tone: "violet" },
  checking: { label: "En revisión", tone: "amber" },
  completed: { label: "Recibida", tone: "green" },
  discrepancy: { label: "Con diferencias", tone: "red" },
  rejected: { label: "Rechazada", tone: "red" },
};

/** Estados en que la mercadería aún no llega físicamente. */
export const PRE_ARRIVAL_STATUSES: ReceptionBffStatus[] = ["expected", "in_transit"];

/** Recepciones "en curso" (pestaña Por llegar): camino + revisión en bodega. */
export const IN_PROGRESS_STATUSES: ReceptionBffStatus[] = [
  "expected",
  "in_transit",
  "arrived",
  "checking",
];

/** Estados con problemas (pestaña Con problemas). */
export const ISSUE_STATUSES: ReceptionBffStatus[] = ["discrepancy", "rejected"];

/** Estados terminales de la máquina. */
export const TERMINAL_STATUSES: ReceptionBffStatus[] = ["completed", "discrepancy", "rejected"];

/** ¿La recepción está atrasada? (derivado: aún no llega y venció su fecha). */
export function isDelayed(
  status: ReceptionBffStatus,
  expectedDate: string | null,
  todayIso: string
): boolean {
  if (!expectedDate) return false;
  return PRE_ARRIVAL_STATUSES.includes(status) && expectedDate.slice(0, 10) < todayIso;
}

/** Etiquetas en español de la condición de una línea recibida. */
export const CONDITION_LABEL_ES: Record<string, string> = {
  ok: "Conforme",
  damaged: "Dañado",
  wrong_item: "Producto equivocado",
};

export function conditionLabelEs(condition: string): string {
  return CONDITION_LABEL_ES[condition] ?? condition;
}

/** Estado visual de una línea pedido-vs-recibido del detalle real. */
export function lineStatus(it: ReceptionItemView): {
  label: string;
  tone: "green" | "amber" | "red";
} {
  if (it.condition !== "ok") return { label: conditionLabelEs(it.condition), tone: "red" };
  const expected = it.qtyExpected ?? 0;
  const received = it.qtyReceived ?? 0;
  if (received >= expected) return { label: "Completo", tone: "green" };
  if (received === 0) return { label: "No despachado", tone: "red" };
  return { label: "Parcial", tone: "amber" };
}

/** Faltante de una línea (esperado − recibido, nunca negativo). */
export function lineMissing(it: ReceptionItemView): number {
  return Math.max(0, (it.qtyExpected ?? 0) - (it.qtyReceived ?? 0));
}

/** Acciones de transición disponibles según el estado actual. */
export const RECEPTION_NEXT_ACTIONS: Partial<
  Record<ReceptionBffStatus, { action: ReceptionTransitionAction; label: string }[]>
> = {
  expected: [{ action: "mark_in_transit", label: "Marcar en tránsito" }],
  in_transit: [{ action: "mark_arrived", label: "Marcar arribada" }],
  arrived: [{ action: "start_checking", label: "Iniciar revisión" }],
  checking: [
    { action: "complete", label: "Completar" },
    { action: "reject", label: "Rechazar" },
  ],
};

/** Etiquetas de los estados de la OC que acompaña al detalle. */
export const PO_STATUS_LABEL_ES: Record<string, string> = {
  approved: "Aprobada",
  sent: "Enviada",
  confirmed: "Confirmada",
  partially_received: "Parcialmente recibida",
  received: "Recibida",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

function isReceptionStatus(value: string): value is ReceptionBffStatus {
  return value in RECEPTION_STATUS_UI;
}

/**
 * 409 de estado inválido del dominio ({ current, allowed }) → mensaje legible.
 * Devuelve null si el error no trae ese detalle (usar el describe genérico).
 */
export function describeReceptionConflict(info: PurchaseBffError): string | null {
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
  const label = (s: string) => (isReceptionStatus(s) ? RECEPTION_STATUS_UI[s].label : s);
  const allowedTxt = allowed.map(label).join(" o ");
  return allowedTxt.length > 0
    ? `La recepción está en "${label(current)}" y esta acción requiere estado ${allowedTxt}.`
    : `La recepción está en "${label(current)}" y no admite esta acción.`;
}

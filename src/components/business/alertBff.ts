import type { BadgeTone } from "../ui/Badge";
import type { AlertSeverity } from "../../types/purchasing";
import type {
  AlertSeverityBff,
  AlertStatusBff,
  PurchaseBffError,
} from "../../services/purchaseBff";

// ============================================================================
//  Alertas (F7): mapeos del contrato real del purchase-bff-service a los
//  badges/etiquetas que ya usaba la pantalla con el mock. Compartidos por la
//  página /alertas, la campanita (NotificationContext) y los badges del menú.
//
//  Severidad real → SeverityBadge existente (high/medium/low):
//    critical → "high"   (badge "Alta", rojo)
//    warning  → "medium" (badge "Media", ámbar)
//    info     → "low"    (badge "Baja", neutro)
//
//  Máquina de estados real (C17: active → acknowledged → resolved | dismissed)
//  → etiquetas propias (los estados del mock new/in_review/resolved/ignored
//  no calzan semánticamente):
//    active       → "Activa"     (blue)
//    acknowledged → "Atendida"   (amber)
//    resolved     → "Resuelta"   (green)
//    dismissed    → "Descartada" (neutral)
// ============================================================================

/** Severidad del contrato → nivel del SeverityBadge existente. */
export const ALERT_SEVERITY_TO_UI: Record<AlertSeverityBff, AlertSeverity> = {
  critical: "high",
  warning: "medium",
  info: "low",
};

export const ALERT_STATUS_UI: Record<AlertStatusBff, { label: string; tone: BadgeTone }> = {
  active: { label: "Activa", tone: "blue" },
  acknowledged: { label: "Atendida", tone: "amber" },
  resolved: { label: "Resuelta", tone: "green" },
  dismissed: { label: "Descartada", tone: "neutral" },
};

/** ¿La alerta sigue viva? (active | acknowledged; resolved/dismissed cierran). */
export function isLiveAlert(status: AlertStatusBff): boolean {
  return status === "active" || status === "acknowledged";
}

interface AlertTypeUi {
  label: string;
  /** Agrupador corto para el badge de la fila (Stock, OC, …). */
  group: string;
  tone: BadgeTone;
}

/** Tipos que emite el motor E10 del dominio (alert-rules.service). */
export const ALERT_BFF_TYPE_UI: Record<string, AlertTypeUi> = {
  stockout_imminent: { label: "Quiebre inminente", group: "Stock", tone: "red" },
  sap_failed: { label: "Integración SAP fallida", group: "OC", tone: "red" },
  reception_overdue: { label: "Recepción atrasada", group: "Recepción", tone: "amber" },
  claim_stale: { label: "Reclamo sin gestión", group: "Reclamo", tone: "amber" },
  otb_depleted: { label: "OTB agotado", group: "Presupuesto", tone: "violet" },
};

/** Etiqueta de un tipo de alerta (tolerante a tipos nuevos del motor). */
export function alertTypeUi(type: string | null): AlertTypeUi {
  return (type !== null ? ALERT_BFF_TYPE_UI[type] : undefined) ?? {
    label: type ?? "Alerta comercial",
    group: "Alerta",
    tone: "neutral",
  };
}

export const ALERT_REF_ENTITY_LABEL: Record<string, string> = {
  recommendation: "Recomendación",
  purchase_order: "Orden de compra",
  reception: "Recepción",
  claim: "Reclamo",
  budget: "Presupuesto",
};

/**
 * Link contextual según la entidad referida por la alerta:
 *  - recommendation: refId es el id interno de la recomendación (no un SKU),
 *    así que se enlaza a Decisiones sin prellenar la búsqueda y el refId se
 *    muestra solo como texto.
 *  - purchase_order: refId es el número legible de la OC (OC-…) → deep-link.
 *  - reception: refId es el displayId (REC-…) y /recepciones?rid= lo acepta.
 *  - claim / budget: vista general (sin deep-link por id en esas páginas).
 */
export function alertRefLink(
  refEntity: string | null,
  refId: string | null
): { to: string; label: string } | null {
  switch (refEntity) {
    case "recommendation":
      return { to: "/comprar/decisiones", label: "Ver en Decisiones" };
    case "purchase_order":
      return {
        to: refId ? `/comprar/seguimiento?oc=${encodeURIComponent(refId)}` : "/comprar/seguimiento",
        label: "Ver seguimiento de la OC",
      };
    case "reception":
      return {
        to: refId ? `/recepciones?rid=${encodeURIComponent(refId)}` : "/recepciones",
        label: "Ver recepción",
      };
    case "claim":
      return { to: "/reclamos", label: "Ver reclamos" };
    case "budget":
      return { to: "/presupuesto", label: "Ver presupuesto" };
    default:
      return null;
  }
}

function isAlertStatus(value: string): value is AlertStatusBff {
  return value in ALERT_STATUS_UI;
}

/**
 * 409 de transición inválida del dominio ({ current, allowed }) → mensaje
 * legible. Devuelve null si el error no trae ese detalle (usar el genérico).
 */
export function describeAlertConflict(info: PurchaseBffError): string | null {
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
  const label = (s: string) => (isAlertStatus(s) ? ALERT_STATUS_UI[s].label : s);
  const allowedTxt = allowed.map(label).join(" o ");
  return allowedTxt.length > 0
    ? `La alerta está en "${label(current)}" y esta acción requiere estado ${allowedTxt}.`
    : `La alerta está en "${label(current)}" y no admite esta acción.`;
}

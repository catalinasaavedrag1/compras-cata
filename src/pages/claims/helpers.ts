import type { BadgeTone } from "../../components/ui/Badge";
import type {
  ClaimResolution,
  ClaimStatusBff,
  ClaimType,
  PurchaseBffError,
} from "../../services/purchaseBff";

// ============================================================================
//  Reclamos (F5): mapeo de la máquina de estados real del dominio a las
//  etiquetas/badges que ya usaba la pantalla con el mock.
//
//  Máquina real (purchase-service, C22):
//    open → in_review → resolved | rejected (terminales)
//
//  Mapeo elegido (estado real → vista existente del front):
//    open      → "Abierto"     (mock `abierto`, tono red)      → chip "Abiertos"
//    in_review → "En revisión" (mock `en_gestion`, tono amber) → chip "Abiertos"
//    resolved  → "Resuelto"    (mock `resuelto`, tono green)   → chip "Resueltos"
//    rejected  → "Rechazado"   (mock `rechazado`, tono neutral)→ chip "Resueltos"
//
//  Los tipos del mock (faltante/dano/calidad/…) colapsan a los 4 del contrato:
//  quantity (faltante/sobrante), quality (calidad/dano/vencimiento/empaque),
//  price (costo) y other. El valor reclamado en CLP no existe en el contrato.
// ============================================================================

export const CLAIM_STATUS_UI: Record<ClaimStatusBff, { label: string; tone: BadgeTone }> = {
  open: { label: "Abierto", tone: "red" },
  in_review: { label: "En revisión", tone: "amber" },
  resolved: { label: "Resuelto", tone: "green" },
  rejected: { label: "Rechazado", tone: "neutral" },
};

export const CLAIM_TYPE_UI: Record<ClaimType, { label: string; tone: BadgeTone }> = {
  quantity: { label: "Cantidad", tone: "red" },
  quality: { label: "Calidad", tone: "amber" },
  price: { label: "Precio", tone: "violet" },
  other: { label: "Otro", tone: "slate" },
};

export const CLAIM_RESOLUTION_LABEL: Record<ClaimResolution, string> = {
  credit_note: "Nota de crédito",
  replacement: "Reposición",
  return: "Devolución",
  none: "Sin ajuste",
};

/** Resolver/rechazar exigen este permiso en el dominio (matriz 06: solo líder). */
export const CLAIM_RESOLVE_PERMISSION = "purchase:claim:resolve";

function isClaimStatus(value: string): value is ClaimStatusBff {
  return value in CLAIM_STATUS_UI;
}

/**
 * 409 de estado inválido del dominio ({ current, allowed }) → mensaje legible.
 * Devuelve null si el error no trae ese detalle (usar el describe genérico).
 */
export function describeClaimConflict(info: PurchaseBffError): string | null {
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
  const label = (s: string) => (isClaimStatus(s) ? CLAIM_STATUS_UI[s].label : s);
  const allowedTxt = allowed.map(label).join(" o ");
  return allowedTxt.length > 0
    ? `El reclamo está en "${label(current)}" y esta acción requiere estado ${allowedTxt}.`
    : `El reclamo está en "${label(current)}" y no admite esta acción.`;
}

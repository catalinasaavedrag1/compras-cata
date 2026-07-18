import type { BadgeTone } from "../components/ui/Badge";
import type {
  CampaignOpportunityStatus,
  CampaignOpportunityView,
  CampaignStatus,
  CampaignType,
} from "../services/purchaseBff";
import { OPPORTUNITY_TYPE_LABELS } from "../components/business/campaignLabels";

// ============================================================================
//  Helpers de las pantallas de campañas conectadas al purchase-bff-service.
//  El pipeline visual de 9 etapas del mock se colapsa a la máquina real de
//  5 estados de oportunidad y 4 de campaña; aquí viven las etiquetas.
// ============================================================================

export const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function dateShort(iso: string): string {
  if (!iso) return "—";
  const p = iso.slice(0, 10).split("-");
  return `${parseInt(p[2], 10)} ${MONTHS[parseInt(p[1], 10) - 1]}`;
}

export function rangeText(from: string, to: string): string {
  if (!from || !to) return "—";
  const pf = from.slice(0, 10).split("-"),
    pt = to.slice(0, 10).split("-");
  if (pf[0] === pt[0] && pf[1] === pt[1])
    return `${parseInt(pf[2], 10)} – ${parseInt(pt[2], 10)} ${MONTHS[parseInt(pt[1], 10) - 1]}`;
  return `${dateShort(from)} – ${dateShort(to)}`;
}

/** Días que faltan para una fecha (0 si ya pasó), contra la fecha real de hoy. */
export function daysUntil(iso: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(d)) return 0;
  return Math.max(0, Math.round((d - today) / 86400000));
}

// ----------------------------------------------------------------------------
//  Máquina real de oportunidades: detected → planned → active → closed|dismissed
// ----------------------------------------------------------------------------

export const OPPORTUNITY_STATUS_UI: Record<
  CampaignOpportunityStatus,
  { label: string; tone: BadgeTone; description: string }
> = {
  detected: {
    label: "Detectada",
    tone: "amber",
    description: "Oportunidad registrada, pendiente de decidir si se planifica.",
  },
  planned: {
    label: "Planificada",
    tone: "blue",
    description: "Se decidió trabajarla: lista para crear campañas.",
  },
  active: {
    label: "En campaña",
    tone: "green",
    description: "La ventana está en curso con campañas asociadas.",
  },
  closed: {
    label: "Cerrada",
    tone: "neutral",
    description: "La ventana terminó; queda como historia.",
  },
  dismissed: {
    label: "Descartada",
    tone: "red",
    description: "Se descartó con motivo auditable.",
  },
};

// ----------------------------------------------------------------------------
//  Máquina real de campañas: planned → active → closed | cancelled
// ----------------------------------------------------------------------------

export const CAMPAIGN_STATUS_UI: Record<CampaignStatus, { label: string; tone: BadgeTone }> = {
  planned: { label: "Planificada", tone: "amber" },
  active: { label: "Activa", tone: "green" },
  closed: { label: "Cerrada", tone: "neutral" },
  cancelled: { label: "Cancelada", tone: "red" },
};

export const CAMPAIGN_TYPE_UI: Record<CampaignType, { label: string; tone: BadgeTone }> = {
  ad_space: { label: "Espacio publicitario", tone: "violet" },
  opportunity: { label: "Desde oportunidad", tone: "blue" },
};

/** Transiciones que ofrece la UI según la máquina real planned→active→closed|cancelled. */
export function nextCampaignActions(
  status: CampaignStatus
): { status: Exclude<CampaignStatus, "planned">; label: string; primary?: boolean }[] {
  if (status === "planned")
    return [
      { status: "active", label: "Activar", primary: true },
      { status: "cancelled", label: "Cancelar" },
    ];
  if (status === "active")
    return [
      { status: "closed", label: "Cerrar", primary: true },
      { status: "cancelled", label: "Cancelar" },
    ];
  return [];
}

/** Tono visual determinístico por canal (solo estética; el canal es un string libre). */
const CHANNEL_TONES = ["blue", "violet", "green", "amber", "neutral"] as const;
export function channelTone(channelRef: string | null): string {
  if (!channelRef) return "neutral";
  let h = 0;
  for (let i = 0; i < channelRef.length; i++) h = (h * 31 + channelRef.charCodeAt(i)) % 997;
  return CHANNEL_TONES[h % CHANNEL_TONES.length];
}

// ----------------------------------------------------------------------------
//  Kind de oportunidad: string libre en el contrato; se reutilizan las
//  etiquetas visuales existentes cuando calzan y se muestra el kind crudo si no.
// ----------------------------------------------------------------------------

const KIND_LABELS: Record<string, string> = OPPORTUNITY_TYPE_LABELS;

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

/** Referencia legible de la oportunidad: SKU, categoría o canal (al menos uno existe). */
export function opportunityRefText(o: CampaignOpportunityView): string {
  if (o.sku) return o.sku;
  if (o.categoryId) return `Categoría ${o.categoryId}`;
  if (o.channelRef) return `Canal ${o.channelRef}`;
  return "—";
}

/** Resumen compacto de la evidencia (objeto libre) sin inventar métricas. */
export function evidenceSummary(evidence: Record<string, unknown> | null): string {
  if (!evidence) return "—";
  const note = evidence.note ?? evidence.nota;
  if (typeof note === "string" && note.trim()) return note.trim();
  const keys = Object.keys(evidence);
  if (keys.length === 0) return "—";
  return keys
    .slice(0, 3)
    .map((k) => {
      const v = evidence[k];
      return typeof v === "string" || typeof v === "number" ? `${k}: ${v}` : k;
    })
    .join(" · ");
}

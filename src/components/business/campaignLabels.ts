import type { BadgeTone } from "../ui/Badge";
import type {
  CampaignChannel,
  CampaignOpportunityStatus,
  CampaignOpportunityType,
  PromoChannel,
  CreatedCampaignStatus,
} from "../../types/purchasing";

export const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  web: "Web",
  marketplace: "Marketplace",
  store: "Tienda física",
  omnichannel: "Omnicanal",
  b2b: "Venta empresa",
  social: "Redes sociales",
  email: "Email marketing",
};

export const OPPORTUNITY_TYPE_LABELS: Record<CampaignOpportunityType, string> = {
  planned_campaign: "Campaña planificada",
  liquidation_suggested: "Liquidación sugerida",
  accelerated_growth: "Crecimiento acelerado",
  stockout_risk: "Riesgo de quiebre",
  star_product: "Producto estrella",
  review_before_campaign: "Revisar antes de campaña",
  not_recommended: "No recomendado",
};

interface StatusConfig {
  label: string;
  tone: BadgeTone;
  description: string;
}

export const CAMPAIGN_STATUS: Record<CampaignOpportunityStatus, StatusConfig> = {
  ready_for_campaign: {
    label: "Listo para campaña",
    tone: "green",
    description: "Tiene stock suficiente y buen margen. Puede ir a campaña sin comprar.",
  },
  buy_before_campaign: {
    label: "Comprar antes de campaña",
    tone: "amber",
    description: "Hay campaña próxima pero falta stock. Comprar para no perder la venta.",
  },
  stockout_risk: {
    label: "Riesgo de quiebre",
    tone: "red",
    description: "Demanda alta o campaña cercana con poco stock. Riesgo de quedar sin inventario.",
  },
  liquidate: {
    label: "Liquidar",
    tone: "violet",
    description:
      "Sobrestock o baja rotación. Conviene empujar comercialmente para liberar capital.",
  },
  boost: {
    label: "Potenciar",
    tone: "blue",
    description: "Buen producto con stock disponible. Vale la pena impulsarlo en el canal.",
  },
  review_margin: {
    label: "Revisar margen",
    tone: "amber",
    description: "Margen bajo el mínimo. Revisar precio o costo antes de promocionar.",
  },
  review_supplier: {
    label: "Revisar proveedor",
    tone: "amber",
    description: "Proveedor con atraso o bajo cumplimiento. Confirmar entrega antes de la campaña.",
  },
  not_recommended: {
    label: "No recomendado",
    tone: "neutral",
    description: "Sin stock, sin proveedor o datos incompletos. No debería entrar a campaña.",
  },
};

export const TYPE_TONE: Record<CampaignOpportunityType, BadgeTone> = {
  planned_campaign: "blue",
  liquidation_suggested: "violet",
  accelerated_growth: "green",
  stockout_risk: "red",
  star_product: "blue",
  review_before_campaign: "amber",
  not_recommended: "neutral",
};

// Canales promocionales para campañas creadas (incluye plataformas de ads).
export const PROMO_CHANNEL_LABELS: Record<PromoChannel, string> = {
  web: "Web",
  marketplace: "Marketplace",
  store: "Tienda física",
  omnichannel: "Omnicanal",
  b2b: "Venta empresa",
  social: "Redes sociales",
  email: "Email marketing",
  google_ads: "Google Ads",
  meta: "Meta (Facebook/Instagram)",
  tiktok: "TikTok Ads",
};

export const PROMO_CHANNELS = Object.entries(PROMO_CHANNEL_LABELS).map(([value, label]) => ({
  value: value as PromoChannel,
  label,
}));

export const CREATED_CAMPAIGN_STATUS: Record<
  CreatedCampaignStatus,
  { label: string; tone: BadgeTone }
> = {
  draft: { label: "Borrador", tone: "neutral" },
  scheduled: { label: "Programada", tone: "amber" },
  active: { label: "Activa", tone: "green" },
};

/** Orden de urgencia para la tabla (menor = más urgente). */
export const STATUS_URGENCY: Record<CampaignOpportunityStatus, number> = {
  stockout_risk: 0,
  buy_before_campaign: 1,
  review_supplier: 2,
  review_margin: 3,
  liquidate: 4,
  boost: 5,
  ready_for_campaign: 6,
  not_recommended: 7,
};

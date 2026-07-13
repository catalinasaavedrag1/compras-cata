import { TODAY_ISO } from "../utils/constants";
import type { CampaignProduct, PlacementKey, PromoChannelKey } from "../data/mockCampaignPlans";

export const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function dateShort(iso: string): string {
  if (!iso) return "—";
  const p = iso.split("-");
  return `${parseInt(p[2], 10)} ${MONTHS[parseInt(p[1], 10) - 1]}`;
}
export function rangeText(from: string, to: string): string {
  if (!from || !to) return "—";
  const pf = from.split("-"),
    pt = to.split("-");
  if (pf[1] === pt[1])
    return `${parseInt(pf[2], 10)} – ${parseInt(pt[2], 10)} ${MONTHS[parseInt(pt[1], 10) - 1]}`;
  return `${dateShort(from)} – ${dateShort(to)}`;
}
export function daysUntil(iso: string): number {
  const today = new Date(`${TODAY_ISO}T00:00:00`).getTime();
  const d = new Date(`${iso}T00:00:00`).getTime();
  return Math.max(0, Math.round((d - today) / 86400000));
}
export function discountPct(normal: number, promo: number): number {
  return normal > 0 && promo > 0 && promo < normal ? Math.round((1 - promo / normal) * 100) : 0;
}

export const STATUS_CFG: Record<
  CampaignProduct["status"],
  { label: string; tone: "green" | "amber" | "red" }
> = {
  ready: { label: "Listo", tone: "green" },
  pending: { label: "Falta creativo", tone: "amber" },
  stock_risk: { label: "Riesgo de stock", tone: "red" },
};

export interface ProductForm {
  mode: "add" | "edit";
  index: number;
  sku: string;
  name: string;
  category: string;
  from: string;
  to: string;
  normal: string;
  promo: string;
  channel: PromoChannelKey;
  placement: PlacementKey;
  budget: string;
  status?: CampaignProduct["status"];
  isNew?: boolean;
}


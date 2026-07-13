

import { Card, CardBody, CardHeader } from "../../components/ui/Card";

import { HelpNote } from "../../components/business/HelpNote";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

import { EmptyState } from "../../components/ui/EmptyState";

import { formatCurrency, formatDate, formatNumber } from "../../utils/formatters";

import { PROMO_CHANNEL_LABELS, CREATED_CAMPAIGN_STATUS } from "../../components/business/campaignLabels";
import { IconPlus, IconCampaign, IconClose } from "../../components/ui/icons";
import type { CreatedCampaign } from "../../types/purchasing";

export function CreatedCampaignsView({
  campaigns,
  onCreate,
  onDelete,
  onAddToOc,
}: {
  campaigns: CreatedCampaign[];
  onCreate: () => void;
  onDelete: (id: string) => void;
  onAddToOc: (sku: string) => void;
}) {
  if (campaigns.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={<IconCampaign className="w-6 h-6" />}
            title="Aún no has creado campañas"
            description="Crea una campaña (ej. Cyber), elige los canales (web, marketplace, Google Ads, Meta…) y sube los productos que estarán con descuento."
            action={
              <Button onClick={onCreate} icon={<IconPlus className="w-4 h-4" />}>
                Crear campaña
              </Button>
            }
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <HelpNote variant="tip">
        Estas son tus campañas. Revisa los productos con <b>stock bajo</b> antes de lanzarlas y
        agrégalos a una orden de compra para no quebrar durante el evento.
      </HelpNote>
      {campaigns.map((c) => {
        const lowStock = c.products.filter((p) => p.availableStock <= 5).length;
        const avgDiscount = Math.round(
          c.products.reduce((a, p) => a + p.discountPct, 0) / Math.max(1, c.products.length)
        );
        return (
          <Card key={c.id}>
            <CardHeader
              title={c.name}
              description={`${formatDate(c.startDate)} → ${formatDate(c.endDate)} · ${c.products.length} producto${c.products.length === 1 ? "" : "s"} · ${avgDiscount}% dcto promedio`}
              action={
                <div className="flex items-center gap-2">
                  <Badge tone={CREATED_CAMPAIGN_STATUS[c.status].tone} dot>
                    {CREATED_CAMPAIGN_STATUS[c.status].label}
                  </Badge>
                  <button
                    onClick={() => onDelete(c.id)}
                    className="text-slate-400 hover:text-rose-600"
                    aria-label="Eliminar campaña"
                  >
                    <IconClose className="w-4 h-4" />
                  </button>
                </div>
              }
            />
            <CardBody>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {c.channels.map((ch) => (
                  <Badge key={ch} tone="blue">
                    {PROMO_CHANNEL_LABELS[ch]}
                  </Badge>
                ))}
                {lowStock > 0 && (
                  <Badge tone="red">{lowStock} con stock bajo — revisa compra</Badge>
                )}
              </div>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {c.products.map((p) => (
                  <div key={p.sku} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                      <p className="text-sm font-medium text-slate-800 truncate">{p.productName}</p>
                      <p className="text-xs text-slate-500">
                        Stock {formatNumber(p.availableStock)}
                        {p.availableStock <= 5 && (
                          <span className="text-rose-500 font-medium"> · stock bajo</span>
                        )}
                      </p>
                    </div>
                    <Badge tone="amber">-{p.discountPct}%</Badge>
                    <div className="text-right w-28">
                      <p className="text-xs text-slate-400 line-through">
                        {formatCurrency(p.basePrice)}
                      </p>
                      <p className="text-sm font-semibold text-emerald-600">
                        {formatCurrency(p.campaignPrice)}
                      </p>
                    </div>
                    <button
                      onClick={() => onAddToOc(p.sku)}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Ver producto
                    </button>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

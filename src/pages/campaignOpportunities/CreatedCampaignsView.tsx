import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { HelpNote } from "../../components/business/HelpNote";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { IconPlus, IconCampaign } from "../../components/ui/icons";
import type { CampaignStatus, CampaignView } from "../../services/purchaseBff";
import { CAMPAIGN_STATUS_UI, CAMPAIGN_TYPE_UI, nextCampaignActions } from "../campaignsHelpers";

// ============================================================================
//  "Campañas creadas" reales (GET /campaigns): título, tipo, canal,
//  presupuesto, vigencia y estado, con la relación opportunityId hacia la
//  oportunidad que las originó. Los productos con descuento por campaña del
//  mock no existen en el contrato y se degradaron honestamente.
// ============================================================================

const fmtDate = (iso: string) => (iso ? formatDate(iso.slice(0, 10)) : "—");

export function CreatedCampaignsView({
  campaigns,
  opportunityRef,
  busy,
  onCreate,
  onTransition,
}: {
  campaigns: CampaignView[];
  /** Referencia legible de la oportunidad ligada (null si no se conoce). */
  opportunityRef: (opportunityId: string | null) => string | null;
  busy: boolean;
  onCreate: () => void;
  onTransition: (camp: CampaignView, status: Exclude<CampaignStatus, "planned">) => void;
}) {
  if (campaigns.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={<IconCampaign className="w-6 h-6" />}
            title="Aún no hay campañas creadas"
            description="Planifica una oportunidad y crea desde ella una campaña con título, presupuesto y vigencia. También puedes crear espacios publicitarios en Campañas y descuentos."
            action={
              <Button onClick={onCreate} icon={<IconPlus className="w-4 h-4" />}>
                Registrar oportunidad
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
        Estas son las campañas reales del servicio de compras. El detalle de productos con
        descuento por campaña estará disponible cuando exista esa fuente.
      </HelpNote>
      {campaigns.map((c) => {
        const st = CAMPAIGN_STATUS_UI[c.status];
        const ty = CAMPAIGN_TYPE_UI[c.type];
        const ref = opportunityRef(c.opportunityId);
        const actions = nextCampaignActions(c.status);
        return (
          <Card key={c.id}>
            <CardHeader
              title={c.title}
              description={`${fmtDate(c.startsAt)} → ${fmtDate(c.endsAt)}${c.userCreated ? ` · creada por ${c.userCreated}` : ""}`}
              action={
                <div className="flex items-center gap-2">
                  <Badge tone={st.tone} dot>
                    {st.label}
                  </Badge>
                </div>
              }
            />
            <CardBody>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <Badge tone={ty.tone}>{ty.label}</Badge>
                {c.channelRef && <Badge tone="blue">{c.channelRef}</Badge>}
                {c.opportunityId && (
                  <Badge tone="amber">Oportunidad: {ref ?? c.opportunityId}</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs text-slate-400">Presupuesto</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {c.budgetClp !== null ? formatCurrency(c.budgetClp) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Venta atribuida</p>
                  <p className="text-sm font-semibold text-slate-400">—</p>
                  <p className="text-[11px] text-slate-400">
                    Disponible cuando exista la fuente de venta por campaña
                  </p>
                </div>
                {actions.length > 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    {actions.map((a) => (
                      <Button
                        key={a.status}
                        size="sm"
                        variant={a.primary ? "primary" : "secondary"}
                        disabled={busy}
                        onClick={() => onTransition(c, a.status)}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

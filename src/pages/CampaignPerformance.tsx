import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { formatCurrency, formatDate } from "../utils/formatters";
import { CAMPAIGN_STATUS_UI, CAMPAIGN_TYPE_UI } from "./campaignsHelpers";
import type { CampaignView } from "../services/purchaseBff";

// ============================================================================
//  Rendimiento de una campaña real. El contrato del purchase-bff-service no
//  expone venta, inversión ejecutada ni atribución por campaña, así que aquí
//  se muestran solo los datos reales de la campaña y TODA métrica de
//  desempeño degrada a "—" sin inventar números.
// ============================================================================

const NO_SOURCE = "Disponible cuando exista la fuente de venta por campaña";

const fmtDate = (iso: string) => (iso ? formatDate(iso.slice(0, 10)) : "—");

/** Vista de rendimiento de una campaña: ficha real + métricas sin fuente en "—". */
export function CampaignPerformance({ camp }: { camp: CampaignView }) {
  const st = CAMPAIGN_STATUS_UI[camp.status];
  const ty = CAMPAIGN_TYPE_UI[camp.type];

  return (
    <>
      <HelpNote title="Métricas de desempeño sin fuente todavía." className="mb-4">
        La analítica de venta, conversión y ROAS por campaña aún no está conectada al servicio de
        compras. Se muestran los datos reales de la campaña; las métricas aparecerán cuando exista
        la fuente de venta por campaña.
      </HelpNote>

      {/* Ficha real de la campaña */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-7">
          <div className="min-w-[200px]">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900">{camp.title}</span>
              <Badge tone={st.tone} dot>
                {st.label}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {fmtDate(camp.startsAt)} → {fmtDate(camp.endsAt)}
            </p>
          </div>
          <div className="flex gap-6 flex-wrap">
            <div>
              <p className="text-xs text-slate-400">Tipo</p>
              <Badge tone={ty.tone} className="mt-1">
                {ty.label}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-400">Canal</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{camp.channelRef ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Presupuesto</p>
              <p className="text-lg font-semibold text-slate-900">
                {camp.budgetClp !== null ? formatCurrency(camp.budgetClp) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Creada por</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{camp.userCreated || "—"}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* KPIs de desempeño: sin fuente real, todos degradan a "—" */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard title="Inversión ejecutada" value="—" tone="neutral" description={NO_SOURCE} />
        <KpiCard title="Ingresos" value="—" tone="neutral" description={NO_SOURCE} />
        <KpiCard title="ROAS" value="—" tone="neutral" description={NO_SOURCE} />
        <KpiCard title="Conversiones" value="—" tone="neutral" description={NO_SOURCE} />
        <KpiCard title="CTR promedio" value="—" tone="neutral" description={NO_SOURCE} />
        <KpiCard title="Impresiones" value="—" tone="neutral" description={NO_SOURCE} />
      </div>
    </>
  );
}

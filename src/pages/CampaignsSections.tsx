import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { IconPlus, IconCampaign } from "../components/ui/icons";
import { Svg } from "./campaignsShared";
import { CHANNEL_BG } from "../utils/tone";
import { formatCurrency, formatCurrencyCompact } from "../utils/formatters";
import {
  channelTone,
  daysUntil,
  nextCampaignActions,
  rangeText,
  CAMPAIGN_STATUS_UI,
  CAMPAIGN_TYPE_UI,
} from "./campaignsHelpers";
import type { CampaignStatus, CampaignView } from "../services/purchaseBff";

// ============================================================================
//  Secciones de la página de campañas, conectadas al purchase-bff-service.
//  Los "espacios publicitarios" son campañas reales type 'ad_space' con
//  channelRef; los cupos, placements y productos por espacio del mock no
//  existen en el contrato y se degradaron honestamente.
// ============================================================================

const CHANNEL_ICON = "M3 11l18-8-8 18-2-8-8-2z";

/**
 * Tarjeta de resumen de la campaña seleccionada: título, estado, vigencia,
 * tipo, canal y presupuesto reales, con las acciones del ciclo de vida.
 * El descuento promedio y la venta estimada del mock no tienen fuente real.
 */
export function CampaignSummaryCard({
  camp,
  busy,
  onTransition,
  onEdit,
}: {
  camp: CampaignView;
  busy: boolean;
  onTransition: (status: Exclude<CampaignStatus, "planned">) => void;
  onEdit: () => void;
}) {
  const st = CAMPAIGN_STATUS_UI[camp.status];
  const du = daysUntil(camp.startsAt);
  return (
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
            {rangeText(camp.startsAt, camp.endsAt)} {camp.startsAt.slice(0, 4)}
            {camp.status === "planned" && du > 0 ? ` · en ${du} d` : ""}
          </p>
        </div>
        <div className="flex gap-6 flex-wrap">
          <div>
            <p className="text-xs text-slate-400">Tipo</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">
              {CAMPAIGN_TYPE_UI[camp.type].label}
            </p>
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
            <p className="text-xs text-slate-400">Venta estimada</p>
            <p className="text-lg font-semibold text-slate-400">—</p>
            <p className="text-[11px] text-slate-400">Sin fuente de venta por campaña</p>
          </div>
        </div>
        <div className="flex-1 min-w-[200px] flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onEdit} disabled={busy}>
            Editar
          </Button>
          {nextCampaignActions(camp.status).map((a) => (
            <Button
              key={a.status}
              size="sm"
              variant={a.primary ? "primary" : "secondary"}
              disabled={busy}
              onClick={() => onTransition(a.status)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Cabecera de espacios publicitarios: cuántos hay y cuántos están activos
 * (los "cupos" del mock no existen en el contrato), más el selector de vista.
 */
export function AdSpacesHeader({
  total,
  active,
  spaceView,
  onSpaceViewChange,
}: {
  total: number;
  active: number;
  spaceView: "grid" | "list";
  onSpaceViewChange: (view: "grid" | "list") => void;
}) {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  return (
    <Card className="mb-3.5">
      <CardBody className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Svg path="M3 3h18v18H3zM3 9h18M9 21V9" className="w-6 h-6" />
          </span>
          <div>
            <p className="text-xl font-bold text-slate-900">
              {total} espacio{total === 1 ? "" : "s"}{" "}
              <span className="text-sm font-medium text-slate-400">publicitario{total === 1 ? "" : "s"}</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              <b className="text-emerald-700">{active} activo{active === 1 ? "" : "s"}</b> · campañas
              type ad_space por canal
            </p>
          </div>
        </div>
        <div className="flex-1 min-w-[140px] max-w-[280px]">
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">{pct}% de los espacios activos</p>
        </div>
        <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => onSpaceViewChange(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${spaceView === v ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}
            >
              {v === "grid" ? "Tarjetas" : "Lista"}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Chips de filtro por canal (channelRef real) con conteo de espacios por canal.
 */
export function ChannelFilterChips({
  chips,
  chFilter,
  onChange,
  countByKey,
}: {
  chips: { id: string; label: string }[];
  chFilter: string;
  onChange: (id: string) => void;
  countByKey: (key: string) => number;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((ch) => {
        const active = chFilter === ch.id;
        return (
          <button
            key={ch.id}
            onClick={() => onChange(ch.id)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium border ${active ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-600"}`}
          >
            {ch.label}
            <span
              className={`rounded-full px-1.5 text-[11px] ${active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-400"}`}
            >
              {countByKey(ch.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Espacios publicitarios (campañas type 'ad_space') en dos vistas: tarjetas y
 * lista compacta. Cada tarjeta muestra canal, vigencia, presupuesto y estado
 * reales, con las transiciones del ciclo de vida.
 */
export function AdSpacesView({
  spaces,
  spaceView,
  busy,
  onTransition,
  onCreate,
}: {
  spaces: CampaignView[];
  spaceView: "grid" | "list";
  busy: boolean;
  onTransition: (camp: CampaignView, status: Exclude<CampaignStatus, "planned">) => void;
  onCreate: () => void;
}) {
  if (spaces.length === 0) {
    return (
      <Card className="mb-6">
        <CardBody className="py-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 inline-flex items-center justify-center mb-3.5">
            <IconCampaign className="w-6 h-6" />
          </div>
          <p className="text-base font-semibold text-slate-800">Sin espacios publicitarios</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Crea una campaña de tipo espacio publicitario para reservar un canal con su vigencia y
            presupuesto.
          </p>
          <Button icon={<IconPlus className="w-4 h-4" />} onClick={onCreate}>
            Crear espacio
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (spaceView === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 mb-6">
        {spaces.map((s) => {
          const st = CAMPAIGN_STATUS_UI[s.status];
          return (
            <Card key={s.id}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[channelTone(s.channelRef)]}`}
                    >
                      <Svg path={CHANNEL_ICON} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{s.title}</p>
                      <p className="text-xs text-slate-400">{s.channelRef ?? "Sin canal"}</p>
                    </div>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <div className="flex flex-col gap-1 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Svg
                      path="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18"
                      className="w-3.5 h-3.5 text-slate-400"
                    />{" "}
                    {rangeText(s.startsAt, s.endsAt)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Svg
                      path="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                      className="w-3.5 h-3.5 text-slate-400"
                    />{" "}
                    {s.budgetClp !== null ? formatCurrencyCompact(s.budgetClp) : "Sin presupuesto"}
                  </span>
                </div>
                {nextCampaignActions(s.status).length > 0 ? (
                  <div className="flex gap-2">
                    {nextCampaignActions(s.status).map((a) => (
                      <Button
                        key={a.status}
                        variant={a.primary ? "primary" : "secondary"}
                        size="sm"
                        className="flex-1"
                        disabled={busy}
                        onClick={() => onTransition(s, a.status)}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    {s.status === "closed" ? "Campaña cerrada" : "Campaña cancelada"}
                  </p>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="mb-6">
      {spaces.map((s) => {
        const st = CAMPAIGN_STATUS_UI[s.status];
        return (
          <div
            key={s.id}
            className="flex items-center gap-3.5 px-4 py-3 border-b border-slate-100 last:border-0"
          >
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[channelTone(s.channelRef)]}`}
            >
              <Svg path={CHANNEL_ICON} className="w-4 h-4" />
            </span>
            <div className="w-44 flex-shrink-0 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{s.title}</p>
              <p className="text-[11px] text-slate-400">{s.channelRef ?? "Sin canal"}</p>
            </div>
            <div className="flex-1 min-w-0 text-xs text-slate-500 truncate">
              {rangeText(s.startsAt, s.endsAt)} ·{" "}
              {s.budgetClp !== null ? formatCurrencyCompact(s.budgetClp) : "sin presupuesto"}
            </div>
            <Badge tone={st.tone}>{st.label}</Badge>
            {nextCampaignActions(s.status).map((a) => (
              <button
                key={a.status}
                onClick={() => onTransition(s, a.status)}
                disabled={busy}
                className="text-xs font-semibold text-brand-600 whitespace-nowrap disabled:opacity-40"
              >
                {a.label}
              </button>
            ))}
          </div>
        );
      })}
    </Card>
  );
}

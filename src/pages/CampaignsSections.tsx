import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Svg } from "./campaignsShared";
import { CHANNEL_BG } from "../utils/tone";
import { formatCurrency, formatCurrencyCompact } from "../utils/formatters";
import { daysUntil, rangeText } from "./campaignsHelpers";
import { CHANNEL_META, type CampaignPlan, type PromoChannelKey } from "../data/mockCampaignPlans";

/**
 * Tarjeta de resumen de la campaña seleccionada: nombre, rango, número de
 * productos, descuento promedio, venta estimada y barra de presupuesto asignado.
 * (Extraído de CampaignsPage.)
 */
export function CampaignSummaryCard({
  camp,
  allocated,
  estSaleTotal,
  avgDiscount,
  budgetPct,
  overBudget,
}: {
  camp: CampaignPlan;
  allocated: number;
  estSaleTotal: number;
  avgDiscount: number;
  budgetPct: number;
  overBudget: boolean;
}) {
  return (
    <Card className="mb-4">
      <CardBody className="flex flex-wrap items-center gap-7">
        <div className="min-w-[200px]">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900">{camp.name}</span>
            <Badge tone="red">en {daysUntil(camp.from)} días</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {rangeText(camp.from, camp.to)} {camp.from.slice(0, 4)}
          </p>
        </div>
        <div className="flex gap-6 flex-wrap">
          <div>
            <p className="text-xs text-slate-400">Productos</p>
            <p className="text-lg font-semibold text-slate-800">{camp.products.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Descuento prom.</p>
            <p className="text-lg font-semibold text-rose-600">
              {camp.products.length ? `-${avgDiscount}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Venta estimada</p>
            <p className="text-lg font-semibold text-emerald-600">
              {formatCurrencyCompact(estSaleTotal)}
            </p>
          </div>
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-slate-500">
              Presupuesto asignado <b className="text-slate-700">{formatCurrency(allocated)}</b> de{" "}
              {formatCurrencyCompact(camp.totalBudget)}
            </span>
            <span className="text-xs font-semibold text-slate-600">{budgetPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, budgetPct)}%`,
                background: overBudget ? "#f43f5e" : budgetPct > 90 ? "#f59e0b" : "#10b981",
              }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {overBudget
              ? `Excede en ${formatCurrency(allocated - camp.totalBudget)}`
              : `Disponible ${formatCurrency(camp.totalBudget - allocated)}`}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Grilla de presupuesto por canal (redes/ML/web/tienda): monto, % del total y
 * barra de uso asignado. (Extraído de CampaignsPage.)
 */
export function ChannelBudgetGrid({
  camp,
  channelOrder,
}: {
  camp: CampaignPlan;
  channelOrder: PromoChannelKey[];
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {channelOrder.map((ch) => {
        const meta = CHANNEL_META[ch];
        const budget = camp.channelBudget[ch] || 0;
        const used = camp.products
          .filter((p) => p.channel === ch)
          .reduce((a, p) => a + p.budget, 0);
        const n = camp.products.filter((p) => p.channel === ch).length;
        const usePct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
        return (
          <Card key={ch}>
            <CardBody>
              <div className="flex items-center gap-2.5 mb-2.5">
                <span
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[meta.tone]}`}
                >
                  <Svg path={meta.icon} className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{meta.label}</p>
                  <p className="text-[11px] text-slate-400">
                    {n} {n === 1 ? "producto" : "productos"}
                  </p>
                </div>
              </div>
              <p className="text-xl font-semibold text-slate-900">
                {formatCurrencyCompact(budget)}
              </p>
              <p className="text-[11px] text-slate-400 mb-2">
                {camp.totalBudget > 0
                  ? `${Math.round((budget / camp.totalBudget) * 100)}% del total`
                  : "—"}
              </p>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${usePct}%`, background: "var(--bar)" }}
                  data-tone={meta.tone}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {formatCurrencyCompact(used)} asignado
              </p>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Cabecera de espacios publicitarios: cupos libres/ocupados, barra de
 * disponibilidad y selector de vista (tarjetas/calendario). (Extraído de CampaignsPage.)
 */
export function AdSpacesHeader({
  spacesFree,
  spacesTotal,
  spacesUsed,
  spaceView,
  onSpaceViewChange,
}: {
  spacesFree: number;
  spacesTotal: number;
  spacesUsed: number;
  spaceView: "grid" | "calendar";
  onSpaceViewChange: (view: "grid" | "calendar") => void;
}) {
  return (
    <Card className="mb-3.5">
      <CardBody className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Svg path="M3 3h18v18H3zM3 9h18M9 21V9" className="w-6 h-6" />
          </span>
          <div>
            <p className="text-xl font-bold text-slate-900">
              {spacesFree} libres{" "}
              <span className="text-sm font-medium text-slate-400">de {spacesTotal} cupos</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              <b className="text-amber-700">{spacesUsed} ocupados</b> · Espacios publicitarios de
              esta campaña
            </p>
          </div>
        </div>
        <div className="flex-1 min-w-[140px] max-w-[280px]">
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.round((spacesFree / spacesTotal) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {Math.round((spacesFree / spacesTotal) * 100)}% de cupos disponibles
          </p>
        </div>
        <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
          {(["grid", "calendar"] as const).map((v) => (
            <button
              key={v}
              onClick={() => onSpaceViewChange(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${spaceView === v ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}
            >
              {v === "grid" ? "Tarjetas" : "Calendario"}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Chips de filtro por canal con el conteo de cupos libres por canal.
 * (Extraído de CampaignsPage.)
 */
export function ChannelFilterChips({
  chips,
  chFilter,
  onChange,
  freeByKey,
}: {
  chips: { id: string; label: string }[];
  chFilter: string;
  onChange: (id: string) => void;
  freeByKey: (key: string) => number;
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
              {freeByKey(ch.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

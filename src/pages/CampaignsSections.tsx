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

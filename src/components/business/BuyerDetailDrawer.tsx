import { useNavigate } from "react-router-dom";
import { Drawer } from "../ui/Drawer";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import type { Buyer, BuyerGoal } from "../../types/team";
import {
  leagueOf,
  scoreColor,
  WORKLOAD_CFG,
  trendText,
  trendColor,
} from "../../utils/teamScore";
import { formatCurrencyCompact, formatNumber, formatPercent } from "../../utils/formatters";

const TONE_AV: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700",
  blue: "bg-brand-100 text-brand-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-rose-100 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
};

const GOAL_STATUS: Record<BuyerGoal["status"], { label: string; tone: "green" | "blue" | "red" }> = {
  done: { label: "Cumplida", tone: "green" },
  on_track: { label: "En curso", tone: "blue" },
  risk: { label: "En riesgo", tone: "red" },
};

function goalBar(pct: number): string {
  if (pct >= 80) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#f43f5e";
}

export function GoalRow({ goal, showWeight }: { goal: BuyerGoal; showWeight?: boolean }) {
  const st = GOAL_STATUS[goal.status];
  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug">{goal.name}</p>
          <p className="text-xs text-slate-400">
            {goal.indicator}
            {showWeight && ` · peso ${goal.weight}%`}
          </p>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${goal.pct}%`, background: goalBar(goal.pct) }} />
        </div>
        <span className="text-xs font-semibold text-slate-600 w-24 text-right">
          {goal.current} / {goal.target}
        </span>
      </div>
    </div>
  );
}

/** Mini-sparkline SVG sin librerías. */
export function Sparkline({ data, color = "#1f49d6", width = 280, height = 56 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((v, i) => `${((i / (data.length - 1)) * width).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function BuyerDetailDrawer({ buyer, onClose }: { buyer: Buyer | null; onClose: () => void }) {
  const navigate = useNavigate();
  if (!buyer) return null;
  const wl = WORKLOAD_CFG[buyer.workload];

  const kpis: { label: string; value: string; tone?: "good" | "warn" | "bad" }[] = [
    { label: "Fill Rate", value: formatPercent(buyer.fillRate, 0), tone: buyer.fillRate >= 90 ? "good" : "warn" },
    { label: "Nivel de servicio", value: formatPercent(buyer.sla, 0), tone: buyer.sla >= 90 ? "good" : "warn" },
    { label: "Quiebres", value: String(buyer.stockouts), tone: buyer.stockouts > 6 ? "bad" : "warn" },
    { label: "Quiebres críticos", value: String(buyer.critical), tone: buyer.critical > 2 ? "bad" : "good" },
    { label: "Sobrestock", value: String(buyer.overstock) },
    { label: "Compras pendientes", value: String(buyer.pending), tone: "warn" },
    { label: "OC abiertas", value: String(buyer.openPO) },
    { label: "T. reposición", value: `${buyer.replenDays} d`, tone: buyer.replenDays > 14 ? "bad" : undefined },
    { label: "Rotación", value: `${buyer.rotation.toLocaleString("es-CL", { maximumFractionDigits: 1 })}x` },
    { label: "Ventas categorías", value: formatCurrencyCompact(buyer.sales), tone: "good" },
    { label: "Ahorro negociación", value: formatCurrencyCompact(buyer.savings), tone: "good" },
    { label: "Crecimiento", value: `${buyer.growth >= 0 ? "+" : ""}${formatPercent(buyer.growth, 1)}`, tone: buyer.growth >= 0 ? "good" : "bad" },
  ];
  const kpiColor = { good: "text-emerald-700", warn: "text-amber-700", bad: "text-rose-700" } as const;

  return (
    <Drawer
      open={!!buyer}
      onClose={onClose}
      title={buyer.name}
      description={buyer.categories.join(" · ")}
      footer={
        <Button onClick={() => navigate("/equipo/carga")}>Equilibrar carga de este comprador</Button>
      }
    >
      <div className="space-y-5">
        {/* Score + chips */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold ${TONE_AV[buyer.tone]}`}>
              {buyer.initials}
            </span>
            <div>
              <p className="text-3xl font-bold leading-none" style={{ color: scoreColor(buyer.score) }}>{buyer.score}</p>
              <p className="text-xs font-semibold" style={{ color: scoreColor(buyer.score) }}>Nivel {leagueOf(buyer.score).league.name}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge tone={wl.tone}>Carga {wl.label} · {buyer.workloadPct}%</Badge>
            <span className="text-xs font-semibold" style={{ color: trendColor(buyer.trend) }}>{trendText(buyer.trend)} vs sem. anterior</span>
          </div>
        </div>

        {/* Asignaciones */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Productos", value: formatNumber(buyer.products) },
            { label: "Proveedores", value: String(buyer.suppliers) },
            { label: "Marcas", value: String(buyer.brands) },
            { label: "Metas", value: `${buyer.goalComp}%` },
          ].map((x) => (
            <div key={x.label} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-lg font-semibold text-slate-800">{x.value}</p>
              <p className="text-[11px] text-slate-400">{x.label}</p>
            </div>
          ))}
        </div>

        {/* Indicadores */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Indicadores</p>
          <div className="grid grid-cols-3 gap-2">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className={`text-base font-semibold ${k.tone ? kpiColor[k.tone] : "text-slate-800"}`}>{k.value}</p>
                <p className="text-[10.5px] text-slate-400 leading-tight">{k.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Desglose del score */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Desglose del score</p>
          <div className="space-y-2.5">
            {buyer.breakdown.map((x) => (
              <div key={x.label} className="flex items-center gap-3">
                <span className="w-36 flex-shrink-0 text-xs text-slate-600">{x.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${x.value}%`, background: goalBar(x.value) }} />
                </div>
                <span className="w-8 text-right text-xs font-semibold" style={{ color: goalBar(x.value) }}>{x.value}</span>
                <span className="w-8 text-right text-[11px] text-slate-400">{x.weight}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Evolución */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-1">Evolución del score (6 semanas)</p>
          <Sparkline data={buyer.scoreHist} />
          <div className="flex justify-between mt-1">
            {buyer.scoreHist.map((v, i) => (
              <span key={i} className="text-[10.5px] text-slate-400">{v}</span>
            ))}
          </div>
        </div>

        {/* Metas */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Metas individuales</p>
          <div className="space-y-3">
            {buyer.goals.map((g) => (
              <GoalRow key={g.name} goal={g} />
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

export const BUYER_TONE_AV = TONE_AV;

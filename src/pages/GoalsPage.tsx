import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Select } from "../components/ui/Select";
import { BUYER_TONE_AV } from "../components/business/BuyerDetailDrawer";
import { buyers } from "../data/mockBuyers";
import type { Buyer, BuyerGoal } from "../types/team";
import {
  okrScore,
  okrLevel,
  okrState,
  goalImpact,
  GOAL_ORDER,
  stockoutRate,
  trendText,
  trendColor,
} from "../utils/teamScore";

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

export function GoalsPage() {
  const [periodo, setPeriodo] = useState("mes");
  const [categoria, setCategoria] = useState("all");
  const [comprador, setComprador] = useState("all");
  const [estado, setEstado] = useState("all");

  // Ranking OKR (siempre completo)
  const ranking = [...buyers]
    .map((b) => ({ b, okr: okrScore(b) }))
    .sort((a, b) => b.okr - a.okr);
  const posOf = (id: string) => ranking.findIndex((r) => r.b.id === id);

  // Resumen del equipo
  const all = buyers.flatMap((b) => b.goals);
  const teamAvg = Math.round(ranking.reduce((s, r) => s + r.okr, 0) / ranking.length);
  const riskN = all.filter((g) => g.status === "risk").length;
  const doneN = all.filter((g) => g.status === "done").length;

  // Reconocimientos positivos (distintos ganadores por métrica)
  const top = (fn: (b: Buyer) => number, asc = false) =>
    [...buyers].sort((a, b) => (asc ? fn(a) - fn(b) : fn(b) - fn(a)))[0];
  const recognitions = [
    { label: "Mejor score OKR", w: top((b) => okrScore(b)), v: (b: Buyer) => `${okrScore(b)} pts` },
    { label: "Mayor mejora", w: top((b) => b.trend), v: (b: Buyer) => `${b.trend > 0 ? "+" : ""}${b.trend} pts` },
    { label: "Menos quiebres", w: top((b) => stockoutRate(b), true), v: (b: Buyer) => `${stockoutRate(b).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` },
    { label: "Mejor Fill Rate", w: top((b) => b.fillRate), v: (b: Buyer) => `${b.fillRate}%` },
    { label: "Mejor margen", w: top((b) => b.margin), v: (b: Buyer) => `${b.margin.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` },
  ];

  // Filtros
  const metricOptions = Array.from(new Set(all.map((g) => g.indicator))).sort();
  const matchGoal = (g: BuyerGoal) =>
    (categoria === "all" || g.indicator === categoria) && (estado === "all" || g.status === estado);

  const cards = ranking.filter(({ b }) => comprador === "all" || b.id === comprador);

  return (
    <div>
      <PageHeader
        title="Metas del equipo (OKRs)"
        description="Dashboard competitivo: quién va ganando, quién está en riesgo, qué metas pesan más y qué hacer para subir. El score OKR es el avance ponderado por el peso de cada meta."
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} options={[{ value: "mes", label: "Este mes" }, { value: "trimestre", label: "Trimestre" }]} />
        <Select value={comprador} onChange={(e) => setComprador(e.target.value)} options={[{ value: "all", label: "Todos los compradores" }, ...buyers.map((b) => ({ value: b.id, label: b.name }))]} />
        <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} options={[{ value: "all", label: "Todas las métricas" }, ...metricOptions.map((m) => ({ value: m, label: m }))]} />
        <Select value={estado} onChange={(e) => setEstado(e.target.value)} options={[{ value: "all", label: "Todos los estados" }, { value: "risk", label: "En riesgo" }, { value: "on_track", label: "En curso" }, { value: "done", label: "Cumplidas" }]} />
      </div>

      {/* Ranking compacto + resumen */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Ranking OKR del equipo</p>
          <span className="flex-1" />
          <span className="text-xs text-slate-500">Promedio <b className="text-slate-800">{teamAvg} pts</b></span>
          <span className="text-xs text-slate-500"><b className="text-rose-700">{riskN}</b> en riesgo</span>
          <span className="text-xs text-slate-500"><b className="text-emerald-700">{doneN}</b> cumplidas</span>
        </div>
        <div className="divide-y divide-slate-50">
          {ranking.map(({ b, okr }, i) => {
            const lvl = okrLevel(okr);
            return (
              <div key={b.id} className="flex items-center gap-3 px-4 py-2">
                <span className="w-6 text-center text-sm font-bold text-slate-500 flex-shrink-0">{i + 1}</span>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>
                <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 truncate">{b.name}</span>
                <Badge tone={lvl.tone}>{lvl.label}</Badge>
                <span className="text-xs font-semibold w-14 text-right" style={{ color: trendColor(b.trend) }}>{trendText(b.trend)}</span>
                <span className="text-base font-bold text-slate-900 w-16 text-right">{okr}<span className="text-[11px] font-normal text-slate-400"> pts</span></span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Reconocimientos */}
      <div className="flex flex-wrap gap-2 mb-5">
        {recognitions.map((r) => (
          <span key={r.label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs">
            <span>🏅</span>
            <span className="text-slate-400">{r.label}:</span>
            <span className="font-semibold text-slate-700">{r.w.name.split(" ")[0]}</span>
            <span className="text-slate-400">{r.v(r.w)}</span>
          </span>
        ))}
      </div>

      {/* Tarjetas por comprador */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
        {cards.map(({ b, okr }) => {
          const i = posOf(b.id);
          const lvl = okrLevel(okr);
          const st = okrState(b);
          const distance = i > 0 ? ranking[i - 1].okr - okr : 0;
          const visible = b.goals.filter(matchGoal).sort((x, y) => {
            const o = GOAL_ORDER[x.status] - GOAL_ORDER[y.status];
            return o !== 0 ? o : goalImpact(y.weight, y.pct) - goalImpact(x.weight, x.pct);
          });
          const topGoal = b.goals
            .filter((g) => g.status !== "done")
            .sort((x, y) => goalImpact(y.weight, y.pct) - goalImpact(x.weight, x.pct))[0];
          if (visible.length === 0) return null;
          return (
            <Card key={b.id}>
              <CardBody className="space-y-3">
                {/* header */}
                <div className="flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{b.name}</p>
                    <p className="text-[11px] text-slate-400">#{i + 1} de {ranking.length} · {b.goals.length} metas</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-slate-900 leading-none">{okr}<span className="text-[11px] font-normal text-slate-400"> pts</span></p>
                    <div className="flex items-center gap-1.5 justify-end mt-1">
                      <Badge tone={lvl.tone}>{lvl.label}</Badge>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                  </div>
                </div>

                {/* mensajes accionables */}
                <div className="rounded-lg bg-slate-50 px-3 py-2 space-y-1">
                  {topGoal && (
                    <p className="text-xs text-slate-600">⬆ Mayor impacto: <b className="text-slate-800">{topGoal.name}</b> <span className="text-emerald-700 font-semibold">(+{goalImpact(topGoal.weight, topGoal.pct)} pts)</span></p>
                  )}
                  {i > 0 && (
                    <p className="text-xs text-slate-600">🎯 Te faltan <b className="text-slate-800">{distance} pts</b> para el #{i}</p>
                  )}
                  {i === 0 && <p className="text-xs text-emerald-700 font-medium">🥇 Lidera el ranking OKR del equipo</p>}
                </div>

                {/* metas */}
                <div className="space-y-2">
                  {visible.map((g) => {
                    const gs = GOAL_STATUS[g.status];
                    const impact = goalImpact(g.weight, g.pct);
                    if (g.status === "done") {
                      return (
                        <div key={g.name} className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="text-emerald-500">✓</span>
                          <span className="flex-1 min-w-0 truncate line-through">{g.name}</span>
                          <span>peso {g.weight}%</span>
                        </div>
                      );
                    }
                    return (
                      <div key={g.name} className="border border-slate-100 rounded-lg px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 leading-snug">{g.name}</p>
                            <p className="text-[11px] text-slate-400">{g.indicator} · peso {g.weight}% del score</p>
                          </div>
                          <Badge tone={gs.tone}>{gs.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2.5 mt-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${g.pct}%`, background: goalBar(g.pct) }} />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-600 w-20 text-right">{g.current} / {g.target}</span>
                        </div>
                        {impact > 0 && (
                          <p className="text-[11px] text-emerald-700 mt-1">Puede recuperar +{impact} pts del score OKR</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

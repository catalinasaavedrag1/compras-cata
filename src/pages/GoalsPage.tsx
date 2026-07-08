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

const LEVEL_COLOR: Record<string, string> = {
  Elite: "#7c3aed",
  Oro: "#d97706",
  "En curso": "#1f49d6",
  Riesgo: "#e11d48",
};

const GOAL_STATUS: Record<BuyerGoal["status"], { label: string; tone: "green" | "blue" | "red" }> =
  {
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
  const [comprador, setComprador] = useState("all");
  const [estado, setEstado] = useState("all");

  const ranking = [...buyers].map((b) => ({ b, okr: okrScore(b) })).sort((a, b) => b.okr - a.okr);
  const posOf = (id: string) => ranking.findIndex((r) => r.b.id === id);

  const all = buyers.flatMap((b) => b.goals);
  const teamAvg = Math.round(ranking.reduce((s, r) => s + r.okr, 0) / ranking.length);
  const riskN = all.filter((g) => g.status === "risk").length;

  // Reconocimientos repartidos: cada métrica tiene un líder distinto
  const winnerId = (fn: (b: Buyer) => number, asc = false) =>
    [...buyers].sort((a, b) => (asc ? fn(a) - fn(b) : fn(b) - fn(a)))[0].id;
  const recognitions = [
    { label: "Mejor OKR", id: winnerId(okrScore) },
    { label: "Mayor mejora", id: winnerId((b) => b.trend) },
    { label: "Menos quiebres", id: winnerId((b) => stockoutRate(b), true) },
    { label: "Mejor Fill Rate", id: winnerId((b) => b.fillRate) },
    { label: "Mejor margen", id: winnerId((b) => b.margin) },
  ];
  const recogOf = (id: string) => recognitions.filter((r) => r.id === id).map((r) => r.label);

  const matchGoal = (g: BuyerGoal) => estado === "all" || g.status === estado;
  const cards = ranking.filter(({ b }) => comprador === "all" || b.id === comprador);

  return (
    <div>
      <PageHeader
        title="Metas del equipo (OKRs)"
        description="Quién va ganando, quién está en riesgo y qué hacer para subir. El score OKR es el avance ponderado por el peso de cada meta."
        action={
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">
              Promedio <b className="text-slate-800">{teamAvg}</b>
            </span>
            <span className="text-slate-500">
              <b className="text-rose-600">{riskN}</b> en riesgo
            </span>
          </div>
        }
      />

      {/* Leaderboard visual */}
      <Card className="mb-5">
        <CardBody className="space-y-2.5">
          {ranking.map(({ b, okr }, i) => {
            const lvl = okrLevel(okr);
            const color = LEVEL_COLOR[lvl.label];
            return (
              <div key={b.id} className="flex items-center gap-3">
                <span className="w-6 text-center text-sm font-bold text-slate-400 flex-shrink-0">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </span>
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}
                >
                  {b.initials}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{b.name}</span>
                    <span className="text-xs font-medium px-1.5 rounded" style={{ color }}>
                      {lvl.label}
                    </span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: trendColor(b.trend) }}
                    >
                      {trendText(b.trend)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${okr}%`, background: color }}
                    />
                  </div>
                </div>
                <span className="text-xl font-bold text-slate-900 w-12 text-right flex-shrink-0">
                  {okr}
                </span>
              </div>
            );
          })}
        </CardBody>
      </Card>

      {/* Filtros (sobrios) */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-slate-500 mr-1">Ver:</span>
        <Select
          value={comprador}
          onChange={(e) => setComprador(e.target.value)}
          options={[
            { value: "all", label: "Todos los compradores" },
            ...buyers.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
        <Select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          options={[
            { value: "all", label: "Todas las metas" },
            { value: "risk", label: "Solo en riesgo" },
            { value: "on_track", label: "Solo en curso" },
            { value: "done", label: "Solo cumplidas" },
          ]}
        />
      </div>

      {/* Tarjetas por comprador */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
        {cards.map(({ b, okr }) => {
          const i = posOf(b.id);
          const lvl = okrLevel(okr);
          const color = LEVEL_COLOR[lvl.label];
          const st = okrState(b);
          const distance = i > 0 ? ranking[i - 1].okr - okr : 0;
          const myRecog = recogOf(b.id);
          const visible = b.goals.filter(matchGoal).sort((x, y) => {
            const o = GOAL_ORDER[x.status] - GOAL_ORDER[y.status];
            return o !== 0 ? o : goalImpact(y.weight, y.pct) - goalImpact(x.weight, x.pct);
          });
          const active = visible.filter((g) => g.status !== "done");
          const doneCount = visible.filter((g) => g.status === "done").length;
          const topGoal = b.goals
            .filter((g) => g.status !== "done")
            .sort((x, y) => goalImpact(y.weight, y.pct) - goalImpact(x.weight, x.pct))[0];
          if (visible.length === 0) return null;
          return (
            <Card key={b.id}>
              <CardBody className="space-y-3">
                {/* header con medidor */}
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `conic-gradient(${color} ${okr * 3.6}deg, #eef2f7 0)` }}
                  >
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                      <span className="text-lg font-bold" style={{ color }}>
                        {okr}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}
                      >
                        {b.initials}
                      </span>
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {b.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      #{i + 1} de {ranking.length} ·{" "}
                      {i > 0 ? `a ${distance} pts del #${i}` : "lidera el equipo"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <Badge tone={lvl.tone}>{lvl.label}</Badge>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {myRecog.map((r) => (
                        <span
                          key={r}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700"
                        >
                          🏅 {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* acción de mayor impacto */}
                {topGoal && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    ⬆ Mayor impacto: <b className="text-slate-800">{topGoal.name}</b>{" "}
                    <span className="text-emerald-700 font-semibold">
                      +{goalImpact(topGoal.weight, topGoal.pct)} pts
                    </span>
                  </p>
                )}

                {/* metas activas */}
                <div className="space-y-2">
                  {active.map((g) => {
                    const gs = GOAL_STATUS[g.status];
                    const impact = goalImpact(g.weight, g.pct);
                    return (
                      <div key={g.name}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {g.name}
                          </span>
                          <Badge tone={gs.tone}>{gs.label}</Badge>
                        </div>
                        <div className="flex items-center gap-2.5 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${g.pct}%`, background: goalBar(g.pct) }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-600 w-16 text-right">
                            {g.current}/{g.target}
                          </span>
                          <span className="text-[11px] text-slate-400 w-20 text-right">
                            peso {g.weight}%{impact > 0 ? ` · +${impact}` : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {doneCount > 0 && (
                    <p className="text-[11px] text-slate-400 pt-0.5">
                      ✓ {doneCount} cumplida{doneCount === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

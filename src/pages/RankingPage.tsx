import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Badge } from "../components/ui/Badge";
import { BuyerDetailDrawer, BUYER_TONE_AV } from "../components/business/BuyerDetailDrawer";
import { buyers } from "../data/mockBuyers";
import type { Buyer } from "../types/team";
import {
  teamAggregate,
  scoreColor,
  trendText,
  trendColor,
  leagueOf,
  stockoutRate,
  RANKING_DEFS,
  badgesOf,
  daysToClose,
  seasonStatus,
  SEASON_MOVE_CFG,
} from "../utils/teamScore";
import { ChallengeList } from "../components/business/ChallengeList";
import { SEASON, PREV_SEASON_NAME, challenges } from "../data/mockChallenges";
import { IconInfo, IconSales, IconAlerts } from "../components/ui/icons";

const MEDALS = ["🥇", "🥈", "🥉"];

export function RankingPage() {
  const [sel, setSel] = useState<Buyer | null>(null);
  const sorted = [...buyers].sort((a, b) => b.score - a.score);
  const agg = teamAggregate(buyers);
  const avgStockoutRate = Math.round((buyers.reduce((a, b) => a + stockoutRate(b), 0) / buyers.length) * 10) / 10;
  const avgMargin = Math.round((buyers.reduce((a, b) => a + b.margin, 0) / buyers.length) * 10) / 10;
  const badges = badgesOf(buyers);

  return (
    <div>
      <PageHeader
        title="Competencia del equipo"
        description="Posición según el score global (0–100). No es solo quién vende más: el score pondera venta, margen, quiebres, rotación, OC y sobrestock para que la comparación sea justa."
      />

      <div className="flex items-start gap-2 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 mb-4">
        <IconInfo className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
        <span className="text-xs text-brand-900 leading-snug">
          <b className="font-semibold">Score</b> = 30% cumplimiento de venta · 20% margen · 20% reducción de quiebres · 15% rotación · 10% cumplimiento de OC · 5% gestión de sobrestock. Hay rankings por dimensión para que cada quien pueda destacar en lo suyo.
        </span>
      </div>

      {/* Temporada en curso */}
      <div className="rounded-2xl p-5 mb-5 text-white flex flex-wrap items-center gap-5" style={{ background: "linear-gradient(135deg,#1f2a5a,#3b2f7a)" }}>
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs text-indigo-200 font-medium">🏆 {SEASON.name}</p>
          <p className="text-2xl font-bold mt-0.5">Cierra en {daysToClose(SEASON.to)} días</p>
          <p className="text-xs text-indigo-200 mt-1">Al cierre se confirman ascensos y descensos de liga. Los 3 primeros reciben reconocimiento del mes.</p>
        </div>
        <div className="flex gap-2">
          {sorted.slice(0, 3).map((b, i) => (
            <div key={b.id} className="bg-white/10 rounded-xl px-3 py-2 text-center min-w-[78px]">
              <p className="text-lg">{MEDALS[i]}</p>
              <p className="text-xs font-semibold truncate max-w-[70px]">{b.name.split(" ")[0]}</p>
              <p className="text-[11px] text-indigo-200">{b.score} pts</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs del equipo */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard title="Score promedio" value={`${agg.avgScore} pts`} tone="info" icon={<IconSales className="w-4 h-4" />} />
        <KpiCard title="Tasa de quiebres" value={`${avgStockoutRate.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`} tone="bad" icon={<IconAlerts className="w-4 h-4" />} />
        <KpiCard title="Margen promedio" value={`${avgMargin.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`} tone="good" icon={<IconSales className="w-4 h-4" />} />
      </div>

      {/* Ranking general */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Ranking general</p>
      <div className="space-y-2.5 mb-6">
        {sorted.map((b, i) => {
          const { league } = leagueOf(b.score);
          const gap = i > 0 ? sorted[i - 1].score - b.score : 0;
          return (
            <button
              key={b.id}
              onClick={() => setSel(b)}
              className="flex items-center gap-4 w-full text-left bg-white border border-slate-200 rounded-xl shadow-card px-4 py-3.5 transition-colors hover:border-brand-300"
              style={i === 0 ? { background: "#fffdf5" } : undefined}
            >
              <span className="w-8 text-center text-lg font-bold text-slate-700 flex-shrink-0">{i < 3 ? MEDALS[i] : i + 1}</span>
              <span className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[15px] font-semibold text-slate-800">{b.name}</span>
                  <Badge tone={league.tone}>{league.name}</Badge>
                  <span className="text-[11px] font-semibold" style={{ color: trendColor(b.trend) }}>{trendText(b.trend)}</span>
                </span>
                <span className="block text-[11px] text-slate-400 mt-1">{i === 0 ? "Líder del equipo" : `A ${gap} pts del #${i}`}</span>
              </span>
              <span className="text-right w-20 flex-shrink-0">
                <span className="block text-2xl font-bold leading-none" style={{ color: scoreColor(b.score) }}>{b.score}</span>
                <span className="block text-[10.5px] text-slate-400 mt-0.5">pts</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Rankings destacados */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Rankings destacados</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-6">
        {RANKING_DEFS.map((def) => {
          const top = [...buyers].sort((a, b) => (def.asc ? def.sortValue(a) - def.sortValue(b) : def.sortValue(b) - def.sortValue(a))).slice(0, 3);
          return (
            <Card key={def.key}>
              <CardHeader title={def.title} />
              <CardBody className="py-2">
                {top.map((b, i) => (
                  <button key={b.id} onClick={() => setSel(b)} className="flex items-center gap-3 w-full text-left rounded-lg px-2 py-2 hover:bg-slate-50">
                    <span className="w-5 text-center text-sm font-bold text-slate-500 flex-shrink-0">{i + 1}</span>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>
                    <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 truncate">{b.name}</span>
                    <span className="text-sm font-semibold text-slate-900">{def.valueText(b)}</span>
                  </button>
                ))}
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Reconocimientos del mes */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Reconocimientos del mes</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {badges.map((bg) => (
          <button key={bg.key} onClick={() => setSel(bg.winner)} className="flex items-center gap-3 text-left bg-white border border-slate-200 rounded-xl shadow-card px-4 py-3 hover:border-brand-300">
            <span className="text-2xl flex-shrink-0">🏅</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{bg.label}</span>
              <span className="block text-sm font-semibold text-slate-800 truncate">{bg.winner.name}</span>
              <span className="block text-xs text-slate-500">{bg.valueText}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Movimientos de liga */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5 mt-6">Movimientos de liga <span className="font-normal text-slate-400">vs {PREV_SEASON_NAME}</span></p>
      <Card className="mb-6">
        <CardBody className="space-y-2.5">
          {[...buyers].sort((a, b) => b.score - a.score).map((b) => {
            const st = seasonStatus(b);
            const cfg = SEASON_MOVE_CFG[st.move];
            return (
              <button key={b.id} onClick={() => setSel(b)} className="flex items-center gap-3 w-full text-left rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>
                <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 truncate">{b.name}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <Badge tone={st.from.tone}>{st.from.name}</Badge>
                  <span className="text-slate-300">→</span>
                  <Badge tone={st.to.tone}>{st.to.name}</Badge>
                </span>
                <Badge tone={cfg.tone} className="w-24 justify-center">{cfg.arrow} {cfg.label}</Badge>
              </button>
            );
          })}
        </CardBody>
      </Card>

      {/* Retos de la semana */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Retos de la semana</p>
      <ChallengeList items={challenges} />

      <BuyerDetailDrawer buyer={sel} onClose={() => setSel(null)} />
    </div>
  );
}

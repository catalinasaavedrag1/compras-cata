import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { GoalRow, Sparkline } from "../components/business/BuyerDetailDrawer";
import { buyers, getBuyer, CURRENT_BUYER_ID } from "../data/mockBuyers";
import { useBuyer } from "../context/BuyerContext";
import {
  teamAggregate,
  scoreColor,
  trendText,
  trendColor,
  leagueOf,
  percentileSimilarLoad,
  RANKING_DEFS,
  badgesOf,
  SCORE_ADVICE,
  daysToClose,
  seasonStatus,
  SEASON_MOVE_CFG,
  winnerByCriterion,
} from "../utils/teamScore";
import { ChallengeList } from "../components/business/ChallengeList";
import { CompetitionFeed } from "../components/business/CompetitionFeed";
import { SEASON, challenges } from "../data/mockChallenges";
import { competitionFeed } from "../data/mockCompetitionFeed";
import { defaultRewards, type Reward } from "../data/mockRewards";
import { useLocalStorage } from "../utils/useLocalStorage";
import { buyerAttribution } from "../utils/buyerAttribution";

const RANK_PHRASE: Record<string, string> = {
  margen: "margen bruto",
  quiebres: "reducción de quiebres",
  rotacion: "rotación saludable",
  recuperacion: "recuperación del mes",
};

export function MyPerformancePage() {
  const { buyer: buyerName } = useBuyer();
  const me = buyers.find((b) => b.name === buyerName) ?? getBuyer(CURRENT_BUYER_ID)!;
  const sorted = [...buyers].sort((a, b) => b.score - a.score);
  const pos = sorted.findIndex((b) => b.id === me.id) + 1;
  const agg = teamAggregate(buyers);
  const { league, next, ptsToNext } = leagueOf(me.score);
  const percentile = percentileSimilarLoad(me, buyers);

  const kpis = [
    { label: "Fill Rate", value: `${me.fillRate}%`, avg: `${agg.fillRate}%`, good: me.fillRate >= agg.fillRate },
    { label: "Nivel de servicio", value: `${me.sla}%`, avg: `${agg.sla}%`, good: me.sla >= agg.sla },
    { label: "Tiempo reposición", value: `${me.replenDays} d`, avg: `${agg.replen} d`, good: me.replenDays <= agg.replen },
    { label: "Quiebres", value: String(me.stockouts), avg: String(Math.round(agg.stockouts / agg.n)), good: me.stockouts <= agg.stockouts / agg.n },
  ];

  // Mejor posición en rankings específicos (encuadre positivo)
  const myRanks = RANKING_DEFS.map((def) => {
    const order = [...buyers].sort((a, b) => (def.asc ? def.sortValue(a) - def.sortValue(b) : def.sortValue(b) - def.sortValue(a)));
    return { key: def.key, rank: order.findIndex((x) => x.id === me.id) + 1 };
  }).sort((a, b) => a.rank - b.rank);
  const bestRank = myRanks[0];

  // Cómo subir mi score: dimensiones más débiles ponderadas por su peso
  const improvements = [...me.breakdown]
    .map((f) => {
      const target = Math.min(95, f.value + 15);
      const pts = Math.round(((target - f.value) * f.weight) / 100);
      return { label: f.label, pts, advice: SCORE_ADVICE[f.label] ?? "" };
    })
    .filter((x) => x.pts >= 1)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 3);

  const myBadges = badgesOf(buyers).filter((b) => b.winner.id === me.id);

  const season = seasonStatus(me);
  const seasonCfg = SEASON_MOVE_CFG[season.move];
  const myChallenges = challenges.filter(
    (c) =>
      c.kind === "team" ||
      (c.kind === "duel" && (c.aId === me.id || c.bId === me.id)) ||
      (c.kind === "streak" && c.buyerId === me.id)
  );

  const myFeed = competitionFeed.filter((f) => f.buyerId === me.id);
  const [rewards] = useLocalStorage<Reward[]>("compras:rewards", defaultRewards);
  const rewardsInPlay = rewards.map((r) => {
    const w = winnerByCriterion(r.criterion, buyers);
    return { reward: r, winner: w, iWin: w?.id === me.id };
  });

  const deg = me.score * 3.6;

  return (
    <div>
      <PageHeader
        title="Mi desempeño"
        description="Tu score, tu nivel y tu posición frente al equipo. No solo el problema: también cómo subir. El ranking de los demás está anonimizado."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 mb-4">
        {/* Score gauge + nivel */}
        <Card>
          <CardBody className="flex flex-col items-center justify-center text-center py-6">
            <div className="w-32 h-32 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(${scoreColor(me.score)} ${deg}deg, #eef2f7 0)` }}>
              <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center">
                <span className="text-3xl font-bold leading-none" style={{ color: scoreColor(me.score) }}>{me.score}</span>
                <span className="text-[11px] text-slate-400">/ 100</span>
              </div>
            </div>
            <Badge tone={league.tone} className="mt-3">Nivel {league.name}</Badge>
            <p className="text-xs font-semibold mt-1.5" style={{ color: trendColor(me.trend) }}>{trendText(me.trend)} vs semana anterior</p>
            {next && (
              <div className="w-full mt-3">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1"><span>{league.name}</span><span>{next.name}</span></div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(6, ((me.score - league.min) / (next.min - league.min)) * 100))}%`, background: league.color }} />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">Faltan <b className="text-slate-700">{ptsToNext} pts</b> para {next.name}</p>
              </div>
            )}
            <div className="w-full mt-4"><Sparkline data={me.scoreHist} /></div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <Card><CardBody className="text-center py-4"><p className="text-xs text-slate-500">Tu posición</p><p className="text-3xl font-bold text-brand-700 mt-1">#{pos}</p><p className="text-[11px] text-slate-400">de {agg.n} compradores</p></CardBody></Card>
            <Card><CardBody className="text-center py-4"><p className="text-xs text-slate-500">Percentil</p><p className="text-3xl font-bold text-slate-700 mt-1">{percentile}</p><p className="text-[11px] text-slate-400">vs carga similar</p></CardBody></Card>
            <Card><CardBody className="text-center py-4"><p className="text-xs text-slate-500">Cumpl. metas</p><p className="text-3xl font-bold text-emerald-700 mt-1">{me.goalComp}%</p><p className="text-[11px] text-slate-400">objetivos del mes</p></CardBody></Card>
          </div>
          {/* Encuadre positivo */}
          <Card>
            <CardBody className="flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">💪</span>
              <p className="text-sm text-slate-700 leading-snug">
                Vas <b className="text-slate-900">#{pos} de {agg.n}</b> en general
                {bestRank && bestRank.rank <= 3 && (
                  <> — y eres <b style={{ color: scoreColor(90) }}>{bestRank.rank === 1 ? "#1 del equipo" : `#${bestRank.rank}`}</b> en {RANK_PHRASE[bestRank.key]}.</>
                )}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm font-semibold text-slate-800 mb-3">Tus indicadores vs promedio del equipo</p>
              <div className="grid grid-cols-2 gap-2.5">
                {kpis.map((k) => (
                  <div key={k.label} className="flex items-center justify-between gap-2 border border-slate-100 rounded-lg px-3 py-2.5">
                    <span className="text-xs text-slate-500">{k.label}</span>
                    <span className="flex items-baseline gap-1.5">
                      <span className={`text-sm font-semibold ${k.good ? "text-emerald-700" : "text-rose-700"}`}>{k.value}</span>
                      <span className="text-[11px] text-slate-300">eq. {k.avg}</span>
                    </span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Tu temporada */}
      <div className="rounded-2xl p-5 mb-4 text-white flex flex-wrap items-center gap-5" style={{ background: "linear-gradient(135deg,#1f2a5a,#3b2f7a)" }}>
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs text-indigo-200 font-medium">🏆 {SEASON.name}</p>
          <p className="text-2xl font-bold mt-0.5">Cierra en {daysToClose(SEASON.to)} días</p>
          <p className="text-xs text-indigo-200 mt-1">Estás en nivel <b className="text-white">{league.name}</b>. {next ? `Te faltan ${ptsToNext} pts para ${next.name}.` : "Estás en la cima."}</p>
        </div>
        <div className="bg-white/10 rounded-xl px-4 py-3 text-center">
          <p className="text-[11px] text-indigo-200">Si cerrara hoy</p>
          <p className="text-sm font-bold mt-0.5">{seasonCfg.arrow} {seasonCfg.label}</p>
          <p className="text-[11px] text-indigo-200 mt-0.5">{season.from.name} → {season.to.name}</p>
        </div>
      </div>

      {/* Causa de los quiebres: evaluación justa */}
      {(() => {
        const attr = buyerAttribution(me);
        return (
          <Card className="mb-4">
            <CardBody>
              <p className="text-sm font-semibold text-slate-800 mb-1">Causa de tus quiebres</p>
              <p className="text-xs text-slate-400 mb-3">No todo quiebre es culpa del comprador. Se separa la causa para una evaluación justa.</p>
              <div className="flex h-2.5 rounded-full overflow-hidden mb-3 bg-slate-100">
                {attr.slices.map((s) => s.count > 0 && (
                  <div key={s.key} className={s.tone === "red" ? "bg-rose-400" : s.tone === "amber" ? "bg-amber-400" : "bg-brand-400"} style={{ width: `${s.pct}%` }} title={`${s.label}: ${s.count}`} />
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
                {attr.slices.map((s) => (
                  <div key={s.key} className="rounded-lg border border-slate-100 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{s.label}</span>
                      <Badge tone={s.tone}>{s.count} · {s.pct}%</Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{s.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">{attr.fairNote}{attr.scoreAdjust > 0 && <> <b>Estos quiebres no deberían penalizar tu score.</b></>}</p>
            </CardBody>
          </Card>
        );
      })()}

      {/* Cómo subir mi score + reconocimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mb-4">
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-slate-800 mb-1">Cómo subir mi score</p>
            <p className="text-xs text-slate-400 mb-3">Foco en tus dimensiones más débiles, ordenadas por impacto.</p>
            <div className="space-y-2.5">
              {improvements.map((imp) => (
                <div key={imp.label} className="flex items-start gap-3 border border-slate-100 rounded-lg px-3 py-2.5">
                  <span className="inline-flex items-center justify-center rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1 flex-shrink-0">+{imp.pts} pts</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{imp.label}</p>
                    <p className="text-xs text-slate-500 leading-snug">{imp.advice}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-slate-800 mb-1">Tus reconocimientos</p>
            <p className="text-xs text-slate-400 mb-3">Insignias que lideras este mes.</p>
            {myBadges.length === 0 ? (
              <p className="text-sm text-slate-400">Aún no lideras ninguna insignia. Revisa "Cómo subir mi score" para acercarte.</p>
            ) : (
              <div className="space-y-2">
                {myBadges.map((bg) => (
                  <div key={bg.key} className="flex items-center gap-3 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2">
                    <span className="text-xl flex-shrink-0">🏅</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800">{bg.label}</span>
                      <span className="block text-xs text-slate-500">{bg.valueText}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Tus retos de la semana */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Tus retos de la semana</p>
      <div className="mb-4"><ChallengeList items={myChallenges} meId={me.id} /></div>

      {/* Novedades + premios en juego */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mb-4">
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-slate-800 mb-3">Tus novedades</p>
            <CompetitionFeed items={myFeed} meId={me.id} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-slate-800 mb-1">Premios en juego</p>
            <p className="text-xs text-slate-400 mb-3">Definidos por tu líder este mes.</p>
            <div className="space-y-2">
              {rewardsInPlay.map(({ reward, winner, iWin }) => (
                <div key={reward.id} className={`rounded-lg border px-3 py-2 ${iWin ? "border-emerald-200 bg-emerald-50/60" : "border-slate-100"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎁</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-slate-800 truncate">{reward.title}</span>
                      <span className="block text-xs text-slate-500">{reward.reward}</span>
                    </span>
                  </div>
                  <p className={`text-[11px] mt-1 ${iWin ? "text-emerald-700 font-semibold" : "text-slate-400"}`}>
                    {iWin ? "¡Lo vas ganando tú!" : `Va ganando: ${winner?.name ?? "—"}`}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-slate-800 mb-3">Mis metas del mes</p>
            <div className="space-y-3.5">
              {me.goals.map((g) => (
                <GoalRow key={g.name} goal={g} />
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-slate-800">Ranking del equipo</p>
            <p className="text-[11px] text-slate-400 mb-3">Anonimizado — solo ves tu posición y el resto resumido.</p>
            <div className="space-y-1.5">
              {sorted.map((b, i) => {
                const isMe = b.id === me.id;
                return (
                  <div key={b.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${isMe ? "bg-brand-50" : ""}`}>
                    <span className="w-6 text-center text-sm font-bold">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
                    <span className="flex-1 text-sm font-medium text-slate-700">{isMe ? "Tú" : `Comprador ${String.fromCharCode(65 + i)}`}</span>
                    <span className="text-sm font-bold" style={{ color: scoreColor(b.score) }}>{b.score}</span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

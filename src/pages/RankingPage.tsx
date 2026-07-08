import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { useLocalStorage } from "../utils/useLocalStorage";
import { useToast } from "../context/ToastContext";
import { BuyerDetailDrawer, BUYER_TONE_AV } from "../components/business/BuyerDetailDrawer";
import { CompetitionFeed } from "../components/business/CompetitionFeed";
import { buyers, getBuyer } from "../data/mockBuyers";
import { seasonHistory } from "../data/mockSeasonHistory";
import { competitionFeed } from "../data/mockCompetitionFeed";
import { defaultRewards, REWARD_CRITERIA, type Reward } from "../data/mockRewards";
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
  winnerByCriterion,
} from "../utils/teamScore";
import { ChallengeList } from "../components/business/ChallengeList";
import { SEASON, PREV_SEASON_NAME, challenges } from "../data/mockChallenges";
import { IconInfo, IconSales, IconAlerts } from "../components/ui/icons";

const MEDALS = ["🥇", "🥈", "🥉"];

export function RankingPage() {
  const toast = useToast();
  const [sel, setSel] = useState<Buyer | null>(null);
  const [rewards, setRewards] = useLocalStorage<Reward[]>("compras:rewards", defaultRewards);
  const [rewardForm, setRewardForm] = useState<Reward | null>(null);
  const sorted = [...buyers].sort((a, b) => b.score - a.score);

  const critLabel = (c: Reward["criterion"]) =>
    REWARD_CRITERIA.find((x) => x.value === c)?.label ?? c;
  const saveReward = () => {
    if (!rewardForm || !rewardForm.title.trim() || !rewardForm.reward.trim()) {
      toast.warning("Completa el título y el premio");
      return;
    }
    setRewards((prev) =>
      prev.some((r) => r.id === rewardForm.id)
        ? prev.map((r) => (r.id === rewardForm.id ? rewardForm : r))
        : [...prev, rewardForm]
    );
    toast.success("Premio guardado");
    setRewardForm(null);
  };
  const agg = teamAggregate(buyers);
  const avgStockoutRate =
    Math.round((buyers.reduce((a, b) => a + stockoutRate(b), 0) / buyers.length) * 10) / 10;
  const avgMargin =
    Math.round((buyers.reduce((a, b) => a + b.margin, 0) / buyers.length) * 10) / 10;
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
          <b className="font-semibold">Score</b> = 30% cumplimiento de venta · 20% margen · 20%
          reducción de quiebres · 15% rotación · 10% cumplimiento de OC · 5% gestión de sobrestock.
          Hay rankings por dimensión para que cada quien pueda destacar en lo suyo.
        </span>
      </div>

      {/* Temporada en curso */}
      <div
        className="rounded-2xl p-5 mb-5 text-white flex flex-wrap items-center gap-5"
        style={{ background: "linear-gradient(135deg,#1f2a5a,#3b2f7a)" }}
      >
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs text-indigo-200 font-medium">🏆 {SEASON.name}</p>
          <p className="text-2xl font-bold mt-0.5">Cierra en {daysToClose(SEASON.to)} días</p>
          <p className="text-xs text-indigo-200 mt-1">
            Al cierre se confirman ascensos y descensos de liga. Los 3 primeros reciben
            reconocimiento del mes.
          </p>
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
        <KpiCard
          title="Score promedio"
          value={`${agg.avgScore} pts`}
          tone="info"
          icon={<IconSales className="w-4 h-4" />}
        />
        <KpiCard
          title="Tasa de quiebres"
          value={`${avgStockoutRate.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Margen promedio"
          value={`${avgMargin.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
          tone="good"
          icon={<IconSales className="w-4 h-4" />}
        />
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
              <span className="w-8 text-center text-lg font-bold text-slate-700 flex-shrink-0">
                {i < 3 ? MEDALS[i] : i + 1}
              </span>
              <span
                className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}
              >
                {b.initials}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[15px] font-semibold text-slate-800">{b.name}</span>
                  <Badge tone={league.tone}>{league.name}</Badge>
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: trendColor(b.trend) }}
                  >
                    {trendText(b.trend)}
                  </span>
                </span>
                <span className="block text-[11px] text-slate-400 mt-1">
                  {i === 0 ? "Líder del equipo" : `A ${gap} pts del #${i}`}
                </span>
              </span>
              <span className="text-right w-20 flex-shrink-0">
                <span
                  className="block text-2xl font-bold leading-none"
                  style={{ color: scoreColor(b.score) }}
                >
                  {b.score}
                </span>
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
          const top = [...buyers]
            .sort((a, b) =>
              def.asc ? def.sortValue(a) - def.sortValue(b) : def.sortValue(b) - def.sortValue(a)
            )
            .slice(0, 3);
          return (
            <Card key={def.key}>
              <CardHeader title={def.title} />
              <CardBody className="py-2">
                {top.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={() => setSel(b)}
                    className="flex items-center gap-3 w-full text-left rounded-lg px-2 py-2 hover:bg-slate-50"
                  >
                    <span className="w-5 text-center text-sm font-bold text-slate-500 flex-shrink-0">
                      {i + 1}
                    </span>
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}
                    >
                      {b.initials}
                    </span>
                    <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 truncate">
                      {b.name}
                    </span>
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
          <button
            key={bg.key}
            onClick={() => setSel(bg.winner)}
            className="flex items-center gap-3 text-left bg-white border border-slate-200 rounded-xl shadow-card px-4 py-3 hover:border-brand-300"
          >
            <span className="text-2xl flex-shrink-0">🏅</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {bg.label}
              </span>
              <span className="block text-sm font-semibold text-slate-800 truncate">
                {bg.winner.name}
              </span>
              <span className="block text-xs text-slate-500">{bg.valueText}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Movimientos de liga */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5 mt-6">
        Movimientos de liga{" "}
        <span className="font-normal text-slate-400">vs {PREV_SEASON_NAME}</span>
      </p>
      <Card className="mb-6">
        <CardBody className="space-y-2.5">
          {[...buyers]
            .sort((a, b) => b.score - a.score)
            .map((b) => {
              const st = seasonStatus(b);
              const cfg = SEASON_MOVE_CFG[st.move];
              return (
                <button
                  key={b.id}
                  onClick={() => setSel(b)}
                  className="flex items-center gap-3 w-full text-left rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}
                  >
                    {b.initials}
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-medium text-slate-700 truncate">
                    {b.name}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <Badge tone={st.from.tone}>{st.from.name}</Badge>
                    <span className="text-slate-300">→</span>
                    <Badge tone={st.to.tone}>{st.to.name}</Badge>
                  </span>
                  <Badge tone={cfg.tone} className="w-24 justify-center">
                    {cfg.arrow} {cfg.label}
                  </Badge>
                </button>
              );
            })}
        </CardBody>
      </Card>

      {/* Retos de la semana */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Retos de la semana</p>
      <div className="mb-6">
        <ChallengeList items={challenges} />
      </div>

      {/* Premios de la temporada (configurables por el líder) */}
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-sm font-semibold text-slate-700">Premios de la temporada</p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setRewardForm({ id: `r${Date.now()}`, criterion: "general", title: "", reward: "" })
          }
        >
          + Agregar premio
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {rewards.map((r) => {
          const w = winnerByCriterion(r.criterion, buyers);
          return (
            <Card key={r.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xl">🎁</span>
                  <button
                    onClick={() => setRewardForm(r)}
                    className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
                  >
                    Editar
                  </button>
                </div>
                <p className="text-sm font-semibold text-slate-800 mt-1.5">{r.title}</p>
                <p className="text-xs text-slate-500">{r.reward}</p>
                <p className="text-[11px] text-slate-400 mt-1">{critLabel(r.criterion)}</p>
                {w && (
                  <button
                    onClick={() => setSel(w)}
                    className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 w-full text-left"
                  >
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${BUYER_TONE_AV[w.tone]}`}
                    >
                      {w.initials}
                    </span>
                    <span className="text-xs text-slate-600">
                      Va ganando: <b className="text-slate-800">{w.name}</b>
                    </span>
                  </button>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Temporadas anteriores */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Temporadas anteriores</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {seasonHistory.map((s) => {
          const champ = getBuyer(s.championId);
          return (
            <Card key={s.id}>
              <CardBody>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {s.name}
                </p>
                <div className="flex items-center gap-2.5 mt-2">
                  <span className="text-xl">🥇</span>
                  {champ && (
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${BUYER_TONE_AV[champ.tone]}`}
                    >
                      {champ.initials}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{champ?.name}</p>
                    <p className="text-[11px] text-slate-400">Campeón · {s.championScore} pts</p>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3">
                  {s.podium.map((id, i) => {
                    const b = getBuyer(id);
                    return (
                      <span key={id} className="text-[11px] text-slate-500">
                        {["🥇", "🥈", "🥉"][i]} {b?.name.split(" ")[0]}
                      </span>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Novedades del equipo */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Novedades del equipo</p>
      <Card className="mb-2">
        <CardBody>
          <CompetitionFeed items={competitionFeed} />
        </CardBody>
      </Card>

      {/* Modal premio */}
      <Modal
        open={!!rewardForm}
        onClose={() => setRewardForm(null)}
        title={
          rewardForm && rewards.some((r) => r.id === rewardForm.id)
            ? "Editar premio"
            : "Nuevo premio"
        }
        description="Define el criterio y la recompensa. El ganador se calcula solo según el desempeño."
        footer={
          <>
            {rewardForm && rewards.some((r) => r.id === rewardForm.id) && (
              <Button
                variant="danger"
                onClick={() => {
                  setRewards((prev) => prev.filter((r) => r.id !== rewardForm.id));
                  setRewardForm(null);
                  toast.success("Premio eliminado");
                }}
              >
                Eliminar
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="secondary" onClick={() => setRewardForm(null)}>
              Cancelar
            </Button>
            <Button onClick={saveReward}>Guardar</Button>
          </>
        }
      >
        {rewardForm && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Criterio</label>
              <Select
                value={rewardForm.criterion}
                onChange={(e) =>
                  setRewardForm({ ...rewardForm, criterion: e.target.value as Reward["criterion"] })
                }
                options={REWARD_CRITERIA}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Título</label>
              <Input
                value={rewardForm.title}
                onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })}
                placeholder="Ej: Campeón de la temporada"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Premio / recompensa
              </label>
              <Input
                value={rewardForm.reward}
                onChange={(e) => setRewardForm({ ...rewardForm, reward: e.target.value })}
                placeholder="Ej: Bono $150.000 + día libre"
              />
            </div>
          </div>
        )}
      </Modal>

      <BuyerDetailDrawer buyer={sel} onClose={() => setSel(null)} />
    </div>
  );
}

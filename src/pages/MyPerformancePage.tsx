import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { GoalRow, Sparkline } from "../components/business/BuyerDetailDrawer";
import { buyers, getBuyer, CURRENT_BUYER_ID } from "../data/mockBuyers";
import { useBuyer } from "../context/BuyerContext";
import { teamAggregate, scoreLabel, scoreColor, trendText, trendColor } from "../utils/teamScore";

export function MyPerformancePage() {
  const { buyer: buyerName } = useBuyer();
  const me = buyers.find((b) => b.name === buyerName) ?? getBuyer(CURRENT_BUYER_ID)!;
  const sorted = [...buyers].sort((a, b) => b.score - a.score);
  const pos = sorted.findIndex((b) => b.id === me.id) + 1;
  const agg = teamAggregate(buyers);

  const kpis = [
    { label: "Fill Rate", value: `${me.fillRate}%`, avg: `${agg.fillRate}%`, good: me.fillRate >= agg.fillRate },
    { label: "Nivel de servicio", value: `${me.sla}%`, avg: `${agg.sla}%`, good: me.sla >= agg.sla },
    { label: "Tiempo reposición", value: `${me.replenDays} d`, avg: `${agg.replen} d`, good: me.replenDays <= agg.replen },
    { label: "Quiebres", value: String(me.stockouts), avg: String(Math.round(agg.stockouts / agg.n)), good: me.stockouts <= agg.stockouts / agg.n },
  ];

  const deg = me.score * 3.6;

  return (
    <div>
      <PageHeader
        title="Mi desempeño"
        description="Tu score, tus metas y tu posición frente al equipo. Una referencia para mejorar, sin ver el detalle de los demás."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 mb-4">
        {/* Score gauge */}
        <Card>
          <CardBody className="flex flex-col items-center justify-center text-center py-6">
            <div
              className="w-32 h-32 rounded-full flex items-center justify-center"
              style={{ background: `conic-gradient(${scoreColor(me.score)} ${deg}deg, #eef2f7 0)` }}
            >
              <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center">
                <span className="text-3xl font-bold leading-none" style={{ color: scoreColor(me.score) }}>{me.score}</span>
                <span className="text-[11px] text-slate-400">/ 100</span>
              </div>
            </div>
            <p className="mt-3 text-base font-semibold" style={{ color: scoreColor(me.score) }}>{scoreLabel(me.score)}</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: trendColor(me.trend) }}>{trendText(me.trend)} vs semana anterior</p>
            <div className="w-full mt-4">
              <Sparkline data={me.scoreHist} />
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <Card><CardBody className="text-center py-4"><p className="text-xs text-slate-500">Tu posición</p><p className="text-3xl font-bold text-brand-700 mt-1">#{pos}</p><p className="text-[11px] text-slate-400">de {agg.n} compradores</p></CardBody></Card>
            <Card><CardBody className="text-center py-4"><p className="text-xs text-slate-500">Promedio equipo</p><p className="text-3xl font-bold text-slate-700 mt-1">{agg.avgScore}</p><p className="text-[11px] text-slate-400">tu score: {me.score}</p></CardBody></Card>
            <Card><CardBody className="text-center py-4"><p className="text-xs text-slate-500">Cumpl. metas</p><p className="text-3xl font-bold text-emerald-700 mt-1">{me.goalComp}%</p><p className="text-[11px] text-slate-400">objetivos del mes</p></CardBody></Card>
          </div>
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

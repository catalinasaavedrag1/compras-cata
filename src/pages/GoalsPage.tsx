import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { GoalRow, BUYER_TONE_AV } from "../components/business/BuyerDetailDrawer";
import { buyers } from "../data/mockBuyers";

export function GoalsPage() {
  const allGoals = buyers.flatMap((b) => b.goals);
  const total = allGoals.length;
  const done = allGoals.filter((g) => g.status === "done").length;
  const risk = allGoals.filter((g) => g.status === "risk").length;
  const onTrack = total - done - risk;

  const summary = [
    { label: "Total de metas", value: total, color: "text-slate-900", border: "border-slate-200" },
    { label: "En riesgo", value: risk, color: "text-rose-700", border: "border-rose-200" },
    { label: "En curso", value: onTrack, color: "text-brand-700", border: "border-slate-200" },
    { label: "Cumplidas", value: done, color: "text-emerald-700", border: "border-emerald-200" },
  ];

  const statusOrder = { risk: 0, on_track: 1, done: 2 } as const;

  return (
    <div>
      <PageHeader
        title="Metas del equipo (OKRs)"
        description="Objetivos de cada comprador para el período. El avance compara el valor actual con la meta; el peso indica cuánto influye en su evaluación."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {summary.map((s) => (
          <div key={s.label} className={`bg-white border rounded-xl shadow-card p-4 ${s.border}`}>
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {buyers.map((b) => {
          const avg = Math.round(b.goals.reduce((s, g) => s + g.pct, 0) / b.goals.length);
          const riskN = b.goals.filter((g) => g.status === "risk").length;
          const goals = [...b.goals].sort((x, y) => statusOrder[x.status] - statusOrder[y.status]);
          return (
            <Card key={b.id}>
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-slate-800">{b.name}</p>
                  <p className="text-xs text-slate-400">{b.goals.length} metas</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${avg >= 80 ? "text-emerald-700" : avg >= 50 ? "text-amber-700" : "text-rose-700"}`}>{avg}% avance prom.</p>
                  <p className={`text-[11px] font-medium ${riskN > 0 ? "text-rose-600" : "text-slate-400"}`}>{riskN > 0 ? `${riskN} en riesgo` : "sin metas en riesgo"}</p>
                </div>
              </div>
              <CardBody className="space-y-3.5">
                {goals.map((g) => (
                  <GoalRow key={g.name} goal={g} showWeight />
                ))}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

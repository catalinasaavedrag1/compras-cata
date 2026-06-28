import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Badge } from "../components/ui/Badge";
import { BuyerDetailDrawer, BUYER_TONE_AV } from "../components/business/BuyerDetailDrawer";
import { buyers } from "../data/mockBuyers";
import { leaderAlerts } from "../data/mockLeaderAlerts";
import type { Buyer } from "../types/team";
import {
  teamAggregate,
  scoreLabel,
  scoreColor,
  trendText,
  trendColor,
  WORKLOAD_CFG,
  workloadBarColor,
  byWorkloadDesc,
} from "../utils/teamScore";
import { formatCurrencyCompact, formatNumber } from "../utils/formatters";
import { IconAlerts, IconChevronRight } from "../components/ui/icons";

const SEV: Record<string, { label: string; tone: "red" | "amber" | "slate" }> = {
  high: { label: "Alta", tone: "red" },
  medium: { label: "Media", tone: "amber" },
  low: { label: "Baja", tone: "slate" },
};

export function TeamDashboardPage() {
  const navigate = useNavigate();
  const [sel, setSel] = useState<Buyer | null>(null);
  const a = teamAggregate(buyers);

  const kpis: { title: string; value: string; sub: string; tone: "neutral" | "good" | "warn" | "bad" | "info" }[] = [
    { title: "Cumplimiento de metas", value: `${a.goalArea}%`, sub: "Meta del área: 85%", tone: a.goalArea >= 85 ? "good" : "warn" },
    { title: "Fill Rate del área", value: `${a.fillRate}%`, sub: "Pedidos completos", tone: a.fillRate >= 90 ? "good" : "warn" },
    { title: "Nivel de servicio", value: `${a.sla}%`, sub: "Cumplimiento SLA", tone: a.sla >= 90 ? "good" : "warn" },
    { title: "Quiebres totales", value: formatNumber(a.stockouts), sub: `${a.critical} críticos`, tone: "bad" },
    { title: "Compras pendientes", value: formatNumber(a.pending), sub: `${a.openPO} OC abiertas`, tone: "warn" },
    { title: "Tiempo de reposición", value: `${a.replen} d`, sub: "Promedio del equipo", tone: "info" },
    { title: "Sobrestock", value: formatNumber(a.overstock), sub: "SKUs sobre el máximo", tone: "neutral" },
    { title: "Productos gestionados", value: formatNumber(a.products), sub: `${a.categories} categorías · ${a.suppliers} prov.`, tone: "neutral" },
  ];

  const byScore = [...buyers].sort((x, y) => y.score - x.score);
  const top = byScore.slice(0, 2);
  const bottom = byScore.slice(-2).reverse();
  const workload = [...buyers].sort(byWorkloadDesc);

  const exceptions = [...leaderAlerts]
    .sort((x, y) => ({ high: 0, medium: 1, low: 2 }[x.severity] - { high: 0, medium: 1, low: 2 }[y.severity]))
    .slice(0, 4);

  const openByName = (name: string | null) => {
    const b = name ? buyers.find((z) => z.name === name) : null;
    if (b) setSel(b);
    else navigate("/equipo/carga");
  };

  const PerfRow = ({ b, sub }: { b: Buyer; sub: string }) => (
    <button onClick={() => setSel(b)} className="flex items-center gap-3 w-full text-left rounded-lg px-2 py-2.5 hover:bg-slate-50">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{b.name}</span>
        <span className="block text-xs text-slate-500 truncate">{sub}</span>
      </span>
      <span className="text-right">
        <span className="block text-lg font-bold" style={{ color: scoreColor(b.score) }}>{b.score}</span>
        <span className="block text-[11px] font-semibold" style={{ color: trendColor(b.trend) }}>{trendText(b.trend)}</span>
      </span>
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Panel del equipo"
        description="Cómo está funcionando el área de compras hoy. Primero las excepciones, luego los indicadores."
      />

      {/* Hero score + excepciones */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 mb-4">
        <div className="rounded-2xl p-5 text-white flex flex-col justify-between" style={{ background: "linear-gradient(135deg,#1f2a5a,#3b2f7a)" }}>
          <div>
            <p className="text-sm text-indigo-200 font-medium">Score promedio del equipo</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-5xl font-bold tracking-tight">{a.avgScore}</span>
              <span className="text-base text-indigo-200">/100</span>
            </div>
            <span className="inline-block mt-1 text-sm font-semibold text-emerald-300">{scoreLabel(a.avgScore)}</span>
          </div>
          <div className="flex gap-5 mt-5">
            <div><p className="text-[11px] text-indigo-300">Compradores</p><p className="text-base font-semibold">{a.n}</p></div>
            <div><p className="text-[11px] text-indigo-300">Venta del equipo</p><p className="text-base font-semibold">{formatCurrencyCompact(a.sales)}</p></div>
            <div><p className="text-[11px] text-indigo-300">Ahorro negociado</p><p className="text-base font-semibold">{formatCurrencyCompact(a.savings)}</p></div>
          </div>
        </div>

        <Card>
          <CardHeader
            title="Requiere tu atención"
            action={<button onClick={() => navigate("/equipo/alertas")} className="text-xs font-medium text-brand-600 hover:text-brand-700">Ver todas ({leaderAlerts.filter((x) => x.severity === "high").length})</button>}
          />
          <CardBody className="space-y-2">
            {exceptions.map((e) => {
              const sev = SEV[e.severity];
              return (
                <button key={e.id} onClick={() => openByName(e.buyer)} className="flex items-center gap-3 w-full text-left rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50" style={{ borderLeftWidth: 3, borderLeftColor: sev.tone === "red" ? "#f43f5e" : sev.tone === "amber" ? "#f59e0b" : "#94a3b8" }}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">{e.title}</span>
                    <span className="block text-xs text-slate-500 truncate">{e.buyer ?? "Área"} · {e.action}</span>
                  </span>
                  <Badge tone={sev.tone}>{sev.label}</Badge>
                </button>
              );
            })}
          </CardBody>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {kpis.map((k) => (
          <KpiCard key={k.title} title={k.title} value={k.value} description={k.sub} tone={k.tone} icon={<IconAlerts className="w-4 h-4" />} />
        ))}
      </div>

      {/* Top / bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader title="Mejor desempeño" />
          <CardBody className="py-2">{top.map((b) => <PerfRow key={b.id} b={b} sub={b.categories.join(" · ")} />)}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Necesita apoyo" />
          <CardBody className="py-2">{bottom.map((b) => <PerfRow key={b.id} b={b} sub={`${b.stockouts} quiebres · carga ${WORKLOAD_CFG[b.workload].label}`} />)}</CardBody>
        </Card>
      </div>

      {/* Carga */}
      <Card>
        <CardHeader
          title="Carga del equipo"
          action={<button onClick={() => navigate("/equipo/carga")} className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">Equilibrar carga <IconChevronRight className="w-3 h-3" /></button>}
        />
        <CardBody className="space-y-3">
          {workload.map((b) => {
            const wl = WORKLOAD_CFG[b.workload];
            return (
              <div key={b.id} className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>
                <span className="w-32 flex-shrink-0 text-sm font-medium text-slate-700 truncate">{b.name}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${b.workloadPct}%`, background: workloadBarColor(b.workloadPct) }} />
                </div>
                <span className="w-28 flex-shrink-0 text-right text-xs font-semibold text-slate-600">{wl.label} {b.workloadPct}%</span>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <BuyerDetailDrawer buyer={sel} onClose={() => setSel(null)} />
    </div>
  );
}

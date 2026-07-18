import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { scoreColor, trendColor, trendText } from "../utils/teamScore";
import { formatCurrencyCompact, formatNumber } from "../utils/formatters";
import {
  GOAL_KIND_LABEL,
  GOAL_STATUS_UI,
  goalProgressPct,
  periodLabel,
  useMyPerformance,
  useRewards,
} from "../hooks/usePerformance";
import type { GoalView, RewardView, ScoreMetricsView } from "../services/purchaseBff";

// ============================================================================
//  Mi desempeño (F19) conectado al purchase-bff-service:
//  - GET /performance/me: score del mes (fórmula v1), delta vs mes anterior y
//    metas propias con avance real.
//  - GET /performance/rewards: recompensas activas con criterios explícitos.
//  Los retos, ligas y el feed de competencia del prototipo no tienen fuente en
//  el contrato y se eliminaron: solo se muestra lo que el motor calcula.
// ============================================================================

/** Desglose de actividad de la fórmula v1 (puntos por componente, con tope). */
function activityBreakdown(m: ScoreMetricsView) {
  const c = m.components;
  return [
    {
      label: "OC emitidas",
      count: c.ordersIssued,
      pts: Math.min(30, c.ordersIssued * 3),
      max: 30,
      rule: "3 pts c/u · tope 30",
    },
    {
      label: "Recepciones completadas",
      count: c.receptionsCompleted,
      pts: Math.min(10, c.receptionsCompleted),
      max: 10,
      rule: "1 pt c/u · tope 10",
    },
    {
      label: "Reclamos resueltos",
      count: c.claimsResolved,
      pts: Math.min(10, c.claimsResolved * 2),
      max: 10,
      rule: "2 pts c/u · tope 10",
    },
    {
      label: "Señales accionadas",
      count: c.signalsActioned,
      pts: Math.min(10, c.signalsActioned * 2),
      max: 10,
      rule: "2 pts c/u · tope 10",
    },
  ];
}

function GoalCard({ goal }: { goal: GoalView }) {
  const st = GOAL_STATUS_UI[goal.status];
  const pct = goalProgressPct(goal);
  const suffix = goal.kind === "hit_rate" ? "%" : "";
  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug">
            {GOAL_KIND_LABEL[goal.kind]}
          </p>
          <p className="text-xs text-slate-400">{periodLabel(goal.period)}</p>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: st.tone === "red" ? "#f43f5e" : st.tone === "amber" ? "#f59e0b" : "#10b981",
            }}
          />
        </div>
        <span className="text-xs font-semibold text-slate-600 w-24 text-right">
          {goal.progress?.value != null ? formatNumber(goal.progress.value) : "—"}
          {suffix} / {goal.target?.value != null ? formatNumber(goal.target.value) : "—"}
          {suffix}
        </span>
      </div>
    </div>
  );
}

/** Criterios de una recompensa como chips "clave: valor" (contrato abierto). */
function RewardCriteria({ criteria }: { criteria: RewardView["criteria"] }) {
  if (!criteria) return null;
  const entries = Object.entries(criteria).filter(
    ([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean"
  );
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
        >
          {key.replace(/_/g, " ")}: <b className="ml-1 text-slate-700">{String(value)}</b>
        </span>
      ))}
    </div>
  );
}

export function MyPerformancePage() {
  const { data, loading, error, configured, refetch } = useMyPerformance();
  const rewardsState = useRewards();

  const pageTitle = "Mi desempeño";
  const pageDescription =
    "Tu score del mes según la fórmula v1: actividad (OC, recepciones, reclamos y señales, hasta 60 pts) más calidad de decisiones (hit rate, hasta 40 pts).";

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando y error (patrón flujo 1).
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver tu score y metas reales del servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4" aria-busy="true">
          <Card>
            <div className="flex flex-col items-center p-6 gap-4">
              <Skeleton className="h-32 w-32 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          </Card>
          <Card>
            <div className="space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar tu desempeño
            </p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const metrics = data.current?.metrics ?? null;
  const previousScore = data.previous?.metrics?.score ?? null;
  const delta = metrics && previousScore != null ? metrics.score - previousScore : null;
  const deg = (metrics?.score ?? 0) * 3.6;
  const activity = metrics ? activityBreakdown(metrics) : [];
  const hitRate = metrics?.components.hitRatePct ?? null;

  return (
    <div>
      <PageHeader title={pageTitle} description={pageDescription} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 mb-4">
        {/* Score del mes */}
        <Card>
          <CardBody className="flex flex-col items-center justify-center text-center py-6">
            {metrics ? (
              <>
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center"
                  style={{
                    background: `conic-gradient(${scoreColor(metrics.score)} ${deg}deg, #eef2f7 0)`,
                  }}
                >
                  <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center">
                    <span
                      className="text-3xl font-bold leading-none"
                      style={{ color: scoreColor(metrics.score) }}
                    >
                      {Math.round(metrics.score)}
                    </span>
                    <span className="text-[11px] text-slate-400">/ 100</span>
                  </div>
                </div>
                <Badge tone="blue" className="mt-3">
                  {periodLabel(data.period)}
                </Badge>
                {delta != null ? (
                  <p
                    className="text-xs font-semibold mt-1.5"
                    style={{ color: trendColor(Math.round(delta)) }}
                  >
                    {trendText(Math.round(delta))} vs mes anterior
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1.5">
                    Sin score del mes anterior para comparar
                  </p>
                )}
                <div className="w-full mt-4 grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-lg font-semibold text-slate-800">
                      {Math.round(metrics.activityPoints)}
                      <span className="text-xs text-slate-400"> / 60</span>
                    </p>
                    <p className="text-[11px] text-slate-400">Actividad</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-lg font-semibold text-slate-800">
                      {Math.round(metrics.qualityPoints)}
                      <span className="text-xs text-slate-400"> / 40</span>
                    </p>
                    <p className="text-[11px] text-slate-400">Calidad</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-32 h-32 rounded-full bg-slate-50 flex items-center justify-center">
                  <span className="text-sm font-semibold text-slate-400">Sin score</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 mt-4">
                  Aún sin score calculado
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs leading-snug">
                  El motor de desempeño todavía no publica el snapshot de{" "}
                  {periodLabel(data.period)}. Tu actividad del mes se reflejará aquí cuando
                  corra el cálculo.
                </p>
              </>
            )}
          </CardBody>
        </Card>

        {/* Desglose de la fórmula v1 con sus fuentes */}
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-slate-800 mb-1">
              Cómo se compone tu score
            </p>
            <p className="text-xs text-slate-400 mb-3">
              Fórmula {metrics?.formulaVersion ?? "v1"}: cada punto sale de tu actividad real del
              mes.
            </p>
            {metrics ? (
              <>
                <div className="space-y-2.5">
                  {activity.map((row) => (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="w-44 flex-shrink-0 text-xs text-slate-600">
                        {row.label}
                        <span className="block text-[10.5px] text-slate-400">{row.rule}</span>
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${(row.pts / row.max) * 100}%` }}
                        />
                      </div>
                      <span className="w-14 text-right text-xs text-slate-500">
                        {formatNumber(row.count)}
                      </span>
                      <span className="w-14 text-right text-xs font-semibold text-slate-700">
                        {row.pts} pts
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
                    <span className="w-44 flex-shrink-0 text-xs text-slate-600">
                      Calidad de decisiones
                      <span className="block text-[10.5px] text-slate-400">
                        hit rate × 40 pts
                      </span>
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${(metrics.qualityPoints / 40) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 text-right text-xs text-slate-500">
                      {hitRate != null ? `${formatNumber(hitRate)}%` : "—"}
                    </span>
                    <span className="w-14 text-right text-xs font-semibold text-slate-700">
                      {Math.round(metrics.qualityPoints)} pts
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
                  <div className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatCurrencyCompact(metrics.components.orderValueClp)}
                    </p>
                    <p className="text-[11px] text-slate-400">Valor comprado (no puntúa)</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatNumber(metrics.components.decisionHits)} /{" "}
                      {formatNumber(metrics.components.decisionsEvaluated)}
                    </p>
                    <p className="text-[11px] text-slate-400">Decisiones acertadas</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {formatNumber(metrics.components.decisionMixed)}
                    </p>
                    <p className="text-[11px] text-slate-400">Con resultado mixto</p>
                  </div>
                </div>
                {hitRate == null && (
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mt-3">
                    Este mes no tienes decisiones evaluadas, así que la calidad aún no puntúa.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">
                El desglose aparecerá cuando el motor calcule tu score del mes.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Mis metas */}
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-slate-800 mb-1">Mis metas</p>
            <p className="text-xs text-slate-400 mb-3">
              Definidas por tu líder, con avance calculado por el servicio.
            </p>
            {data.goals.length === 0 ? (
              <p className="text-sm text-slate-400">
                Aún no tienes metas asignadas para este período.
              </p>
            ) : (
              <div className="space-y-3.5">
                {data.goals.map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Recompensas activas */}
        <Card>
          <CardBody>
            <p className="text-sm font-semibold text-slate-800 mb-1">Recompensas activas</p>
            <p className="text-xs text-slate-400 mb-3">
              Con sus criterios explícitos, tal como los publica el servicio.
            </p>
            {rewardsState.error ? (
              <div className="text-center py-2">
                <p className="text-sm text-slate-500">{rewardsState.error.message}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={rewardsState.refetch}>
                  Reintentar
                </Button>
              </div>
            ) : rewardsState.loading ? (
              <div className="space-y-2.5" aria-busy="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : rewardsState.rewards.length === 0 ? (
              <p className="text-sm text-slate-400">No hay recompensas activas este mes.</p>
            ) : (
              <div className="space-y-2">
                {rewardsState.rewards.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🎁</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 truncate">
                          {r.title}
                        </span>
                        <span className="block text-xs text-slate-500">{r.description}</span>
                      </span>
                    </div>
                    <RewardCriteria criteria={r.criteria} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <p className="text-[11px] text-slate-400 mt-4">
        Los retos semanales y el feed de competencia del prototipo no tienen fuente en el
        servicio de desempeño, por lo que ya no se muestran.
      </p>
    </div>
  );
}

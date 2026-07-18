import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { scoreColor, trendColor, trendText } from "../utils/teamScore";
import { PILL_TONE } from "../utils/tone";
import { formatNumber } from "../utils/formatters";
import { periodLabel, usePerformanceRanking, useRewards } from "../hooks/usePerformance";
import type { RankingRowView, RewardView } from "../services/purchaseBff";
import { IconInfo, IconSales, IconSuppliers } from "../components/ui/icons";

// ============================================================================
//  Ranking del equipo (F19) conectado al purchase-bff-service:
//  - GET /performance/ranking: posición, score (fórmula v1) y delta vs el
//    snapshot del mes anterior por comprador.
//  - GET /performance/rewards: recompensas activas con criterios explícitos.
//  Las ligas, temporadas pasadas, retos y el feed de competencia del prototipo
//  no existen en el contrato: el servicio publica solo el mes en curso.
// ============================================================================

const MEDALS = ["🥇", "🥈", "🥉"];
const AVATAR_TONES = ["blue", "violet", "green", "amber", "red", "neutral"];

function rowLabel(row: RankingRowView): string {
  return row.displayName ?? row.buyerId;
}

function rowInitials(row: RankingRowView): string {
  const words = rowLabel(row).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const second = words.length > 1 ? (words[words.length - 1][0] ?? "") : (words[0][1] ?? "");
  return (first + second).toUpperCase();
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

export function RankingPage() {
  const { period, items, loading, error, configured, refetch } = usePerformanceRanking();
  const rewardsState = useRewards();

  const pageTitle = "Competencia del equipo";
  const pageDescription =
    "Ranking del mes según el score real (0–100) de la fórmula v1: actividad (OC emitidas, recepciones, reclamos y señales, hasta 60 pts) más calidad de decisiones (hit rate, hasta 40 pts).";

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
              ver el ranking real del equipo.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando ranking">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-full flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar el ranking
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

  const avgScore =
    items.length > 0
      ? Math.round(items.reduce((sum, r) => sum + r.score, 0) / items.length)
      : 0;

  return (
    <div>
      <PageHeader title={pageTitle} description={pageDescription} />

      <div className="flex items-start gap-2 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 mb-4">
        <IconInfo className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
        <span className="text-xs text-brand-900 leading-snug">
          <b className="font-semibold">Score v1</b> = actividad (OC emitidas 3 pts c/u tope 30 ·
          recepciones 1 pt tope 10 · reclamos resueltos 2 pts tope 10 · señales accionadas 2 pts
          tope 10) + calidad (hit rate de decisiones × 40 pts). El delta compara con el snapshot
          del mes anterior.
        </span>
      </div>

      {/* KPIs del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <KpiCard
          title="Período"
          value={period ? periodLabel(period) : "—"}
          tone="info"
          icon={<IconSales className="w-4 h-4" />}
        />
        <KpiCard
          title="Score promedio"
          value={`${avgScore} pts`}
          tone="info"
          icon={<IconSales className="w-4 h-4" />}
        />
        <KpiCard
          title="Compradores rankeados"
          value={formatNumber(items.length)}
          tone="neutral"
          icon={<IconSuppliers className="w-4 h-4" />}
        />
      </div>

      {/* Ranking general */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Ranking del mes</p>
      {items.length === 0 ? (
        <Card className="mb-6">
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Aún sin scores calculados</p>
            <p className="mt-1 text-sm text-slate-500">
              El motor de desempeño todavía no publica snapshots para este período. El ranking
              aparecerá cuando corra el cálculo mensual.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5 mb-6">
          {items.map((row, i) => {
            const delta =
              row.previousScore != null ? Math.round(row.score - row.previousScore) : null;
            const tone = AVATAR_TONES[i % AVATAR_TONES.length];
            const gap = i > 0 ? Math.round(items[i - 1].score - row.score) : 0;
            return (
              <div
                key={row.buyerId}
                className="flex items-center gap-4 w-full bg-white border border-slate-200 rounded-xl shadow-card px-4 py-3.5"
                style={i === 0 ? { background: "#fffdf5" } : undefined}
              >
                <span className="w-8 text-center text-lg font-bold text-slate-700 flex-shrink-0">
                  {row.position <= 3 ? MEDALS[row.position - 1] : row.position}
                </span>
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${PILL_TONE[tone]}`}
                >
                  {rowInitials(row)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[15px] font-semibold text-slate-800">
                      {rowLabel(row)}
                    </span>
                    {delta != null ? (
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: trendColor(delta) }}
                      >
                        {trendText(delta)} vs mes anterior
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Sin mes anterior</span>
                    )}
                  </span>
                  <span className="block text-[11px] text-slate-400 mt-1">
                    {i === 0 ? "Lidera el equipo" : `A ${gap} pts del #${items[i - 1].position}`}
                    {row.metrics &&
                      ` · actividad ${Math.round(row.metrics.activityPoints)}/60 · calidad ${Math.round(row.metrics.qualityPoints)}/40`}
                  </span>
                </span>
                <span className="text-right w-20 flex-shrink-0">
                  <span
                    className="block text-2xl font-bold leading-none"
                    style={{ color: scoreColor(row.score) }}
                  >
                    {Math.round(row.score)}
                  </span>
                  <span className="block text-[10.5px] text-slate-400 mt-0.5">pts</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Recompensas activas */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Recompensas activas</p>
      {rewardsState.error ? (
        <Card className="mb-6">
          <div className="p-6 text-center">
            <p className="text-sm text-slate-500">{rewardsState.error.message}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={rewardsState.refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : rewardsState.loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <div className="p-4">
                <Skeleton className="h-4 w-2/3 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : rewardsState.rewards.length === 0 ? (
        <Card className="mb-6">
          <div className="p-6 text-center">
            <p className="text-sm text-slate-500">
              No hay recompensas activas publicadas por el servicio para este período.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {rewardsState.rewards.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div className="flex items-start gap-2">
                  <span className="text-xl">🎁</span>
                  <Badge tone="green">Activa</Badge>
                </div>
                <p className="text-sm font-semibold text-slate-800 mt-1.5">{r.title}</p>
                <p className="text-xs text-slate-500">{r.description}</p>
                <RewardCriteria criteria={r.criteria} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Las ligas, temporadas anteriores, retos y el feed de competencia del prototipo no tienen
        fuente en el servicio de desempeño (solo publica el ranking del mes en curso), por lo que
        ya no se muestran.
      </p>
    </div>
  );
}

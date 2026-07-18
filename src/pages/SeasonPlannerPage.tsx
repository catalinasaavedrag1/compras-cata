import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { DataTable, type Column } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Tabs } from "../components/ui/Tabs";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { HelpNote } from "../components/business/HelpNote";
import { useToast } from "../context/ToastContext";
import { useSeason, useSeasons, useForecastAdjustments } from "../hooks/useSeasons";
import { useCategoriesPanel } from "../hooks/useCategoriesPanel";
import {
  describePurchaseBffError,
  type ForecastAdjustmentView,
  type SeasonScenario,
} from "../services/purchaseBff";
import {
  committedPct,
  hasPlanContent,
  planForScenario,
  planTotalClp,
  plannedCategoryCount,
} from "../utils/seasonPlan";
import {
  formatCurrencyCompact,
  formatDate,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import { IconCalendar, IconCart, IconClock, IconInfo, IconPlus } from "../components/ui/icons";
import { SEASON_STATUS_META } from "./seasonPlanner/constants";
import {
  ForecastAdjustmentModal,
  HeaderField,
  PlanCategoryTable,
  PlanEditorModal,
  ScenarioComparator,
  SeasonTrackingView,
  SectionTitle,
} from "./seasonPlanner/components";

// ============================================================================
//  Planificador de temporada conectado al purchase-bff-service (F18).
//  - Plan por escenario (base / optimista / conservador): presupuesto CLP por
//    categoría + notas, editable con PUT (If-Match; reintento único ante 409).
//  - Comprometido real: tracking calculado desde las OC dentro de la ventana
//    de compra (totalCommittedClp / byCategory); si es null, "Aún sin tracking".
//  - Ajustes de pronóstico auditados por SKU (GET/POST reales).
//  El plan mock por producto (demanda por canal, riesgo, evolución semanal,
//  propuestas de OC) se eliminó: no existe fuente en el contrato.
// ============================================================================

const fmtDay = (iso: string) => formatDate(iso.slice(0, 10));

export function SeasonPlannerPage() {
  const toast = useToast();
  const { seasons, loading, error, configured, refetch } = useSeasons();
  const [selectedId, setSelectedId] = useState("");
  const seasonId = selectedId || seasons[0]?.id || null;

  const detail = useSeason(seasonId);
  const adjustments = useForecastAdjustments(seasonId);
  const categoriesPanel = useCategoriesPanel();

  const [scenario, setScenario] = useState<SeasonScenario>("base");
  const [tab, setTab] = useState("plan");
  const [editingPlan, setEditingPlan] = useState(false);
  const [creatingAdjustment, setCreatingAdjustment] = useState(false);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of categoriesPanel.rows) map.set(row.categoryId, row.name);
    return map;
  }, [categoriesPanel.rows]);
  const categoryName = (id: string) => categoryNameById.get(id) ?? id;
  const categoryOptions = useMemo(
    () =>
      categoriesPanel.rows
        .map((r) => ({ value: r.categoryId, label: r.name }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    [categoriesPanel.rows]
  );

  const pageTitle = "Planificador de temporada";
  const pageDescription =
    "Planifica el presupuesto de compra por temporada y escenario, y sigue el comprometido real de las OC dentro de la ventana de compra.";

  // --------------------------------------------------------------------------
  //  Estados de conexión (patrón ClaimsPage)
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
              planificar sobre las temporadas reales del servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && seasons.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando temporadas">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error && seasons.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las temporadas
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

  if (seasons.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <EmptyState
            icon={<IconCalendar className="h-6 w-6" />}
            title="Sin temporadas registradas"
            description="Cuando existan temporadas en el servicio de compras (código, ventanas de venta y compra), podrás planificarlas aquí por escenario."
          />
        </Card>
      </div>
    );
  }

  const season = detail.season;
  const planView = planForScenario(season, scenario);
  const planTotal = planTotalClp(planView);
  const tracking = planView?.tracking ?? null;
  const advancePct = committedPct(planView);

  const savePlan = async (plan: Parameters<typeof detail.savePlan>[1]) => {
    const result = await detail.savePlan(scenario, plan);
    if (result.ok) {
      toast.success("Plan de temporada guardado");
      return true;
    }
    toast.error(describePurchaseBffError(result.error));
    return false;
  };

  const saveAdjustment = async (body: {
    sku: string;
    adjustmentPct: number;
    reason: string;
  }) => {
    const result = await adjustments.create(body);
    if (result.ok) {
      toast.success(`Ajuste de pronóstico registrado para ${result.adjustment.sku}`);
      return true;
    }
    toast.error(describePurchaseBffError(result.error));
    return false;
  };

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Temporada"
              value={seasonId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              options={seasons.map((s) => ({ value: s.id, label: s.name }))}
              className="sm:w-52"
            />
            <Button
              icon={<IconPlus className="w-4 h-4" />}
              onClick={() => setEditingPlan(true)}
              disabled={!season}
            >
              Editar plan
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { value: "plan", label: "Planificación" },
            { value: "track", label: "Seguimiento" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* Encabezado de la temporada (común a ambas pestañas) */}
      {detail.loading || !season ? (
        <Card className="mb-4">
          <div className="p-4" aria-busy="true" aria-label="Cargando temporada">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mb-4">
          <CardBody>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <HeaderField label="Código" value={season.code} />
              <HeaderField
                label="Ventana de venta"
                value={`${fmtDay(season.salesFrom)} → ${fmtDay(season.salesTo)}`}
              />
              <HeaderField
                label="Ventana de compra"
                value={`${fmtDay(season.buyFrom)} → ${fmtDay(season.buyTo)}`}
              />
              <HeaderField
                label="Estado del ciclo"
                value={
                  <Badge tone={SEASON_STATUS_META[season.status].tone}>
                    {SEASON_STATUS_META[season.status].label}
                  </Badge>
                }
              />
            </div>
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
              {SEASON_STATUS_META[season.status].description} El ciclo avanza planificada → en
              compra → en venta → cerrada.
            </p>
          </CardBody>
        </Card>
      )}

      {detail.error && !detail.loading && !season && (
        <Card className="mb-4">
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar el detalle de la temporada
            </p>
            <p className="mt-1 text-sm text-slate-500">{detail.error.message}</p>
            <Button className="mt-4" onClick={detail.refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      )}

      {season && tab === "track" && (
        <SeasonTrackingView view={planView} categoryName={categoryName} />
      )}

      {season && tab === "plan" && (
        <>
          {/* Nivel 1 · Resumen del escenario activo */}
          <SectionTitle n={1} title="Resumen del escenario" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <KpiCard
              title="Plan del escenario"
              value={planTotal > 0 ? formatCurrencyCompact(planTotal) : "—"}
              tone="info"
              icon={<IconCalendar className="w-4 h-4" />}
              description={
                planTotal > 0
                  ? `${formatNumber(plannedCategoryCount(planView))} categoría(s)`
                  : "Sin plan todavía"
              }
            />
            <KpiCard
              title="Comprometido real"
              value={tracking ? formatCurrencyCompact(tracking.totalCommittedClp) : "—"}
              tone="neutral"
              icon={<IconCart className="w-4 h-4" />}
              description={
                tracking
                  ? `${formatNumber(tracking.orderCount)} OC en la ventana de compra`
                  : "Aún sin tracking"
              }
            />
            <KpiCard
              title="Avance sobre el plan"
              value={advancePct !== null ? formatPercent(advancePct, 0) : "—"}
              tone={advancePct !== null && advancePct > 100 ? "bad" : "info"}
              icon={<IconInfo className="w-4 h-4" />}
              description={
                advancePct !== null ? "comprometido / plan" : "Requiere plan y tracking"
              }
            />
            <KpiCard
              title="Última edición del plan"
              value={planView ? fmtDay(planView.dateModified) : "—"}
              tone="neutral"
              icon={<IconClock className="w-4 h-4" />}
              description={planView ? `versión ${planView.version}` : "Sin plan todavía"}
            />
          </div>

          {/* Nivel 2 · Escenarios */}
          <SectionTitle n={2} title="Escenarios de compra" />
          <ScenarioComparator season={season} active={scenario} onSelect={setScenario} />

          {/* Nivel 3 · Plan por categoría */}
          <SectionTitle n={3} title="Plan por categoría" />
          {hasPlanContent(planView) ? (
            <Card className="mb-5">
              <CardHeader
                title="Presupuesto planificado vs comprometido"
                description="Plan CLP por categoría del escenario activo; el comprometido viene de las OC reales dentro de la ventana de compra"
                action={
                  <Button size="sm" variant="secondary" onClick={() => setEditingPlan(true)}>
                    Editar plan
                  </Button>
                }
              />
              <PlanCategoryTable view={planView} categoryName={categoryName} />
              {planView?.plan?.notes && (
                <CardBody className="border-t border-slate-100">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    Notas del plan
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                    {planView.plan.notes}
                  </p>
                </CardBody>
              )}
            </Card>
          ) : (
            <Card className="mb-5">
              <EmptyState
                icon={<IconCalendar className="h-6 w-6" />}
                title="Este escenario aún no tiene plan"
                description="Define el presupuesto CLP por categoría (y notas si quieres) para empezar a planificar la temporada en este escenario."
                action={<Button onClick={() => setEditingPlan(true)}>Planificar escenario</Button>}
              />
            </Card>
          )}

          {/* Nivel 4 · Ajustes de pronóstico */}
          <SectionTitle n={4} title="Ajustes de pronóstico" />
          <ForecastAdjustmentsCard
            adjustments={adjustments.adjustments}
            loading={adjustments.loading}
            errorMessage={adjustments.error?.message ?? null}
            onRetry={adjustments.refetch}
            onCreate={() => setCreatingAdjustment(true)}
          />

          <HelpNote className="mt-4">
            El plan se guarda por escenario en el servicio de compras con control de versión: si
            otra persona lo edita a la vez, se reintenta con la versión vigente y, de persistir el
            conflicto, se avisa sin pisar sus cambios.
          </HelpNote>
        </>
      )}

      <PlanEditorModal
        open={editingPlan}
        onClose={() => setEditingPlan(false)}
        scenario={scenario}
        view={planView}
        categoryOptions={categoryOptions}
        categoryName={categoryName}
        onSave={savePlan}
      />

      <ForecastAdjustmentModal
        open={creatingAdjustment}
        onClose={() => setCreatingAdjustment(false)}
        onSave={saveAdjustment}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Ajustes de pronóstico de la temporada (lista real + alta)
// ----------------------------------------------------------------------------

function ForecastAdjustmentsCard({
  adjustments,
  loading,
  errorMessage,
  onRetry,
  onCreate,
}: {
  adjustments: ForecastAdjustmentView[];
  loading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onCreate: () => void;
}) {
  const columns: Column<ForecastAdjustmentView>[] = [
    {
      key: "sku",
      header: "SKU",
      render: (a) => <span className="font-medium text-slate-800">{a.sku}</span>,
    },
    {
      key: "pct",
      header: "Ajuste",
      align: "right",
      render: (a) =>
        a.adjustmentPct !== null ? (
          <Badge tone={a.adjustmentPct >= 0 ? "violet" : "amber"}>
            {a.adjustmentPct > 0 ? "+" : ""}
            {formatPercent(a.adjustmentPct, 0)}
          </Badge>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "reason",
      header: "Motivo",
      render: (a) => <span className="text-sm text-slate-600">{a.reason}</span>,
    },
    {
      key: "author",
      header: "Autor",
      hideOnMobile: true,
      render: (a) => <span className="text-xs text-slate-500">{a.authorUserId}</span>,
    },
    {
      key: "date",
      header: "Fecha",
      align: "right",
      hideOnMobile: true,
      render: (a) => formatDate(a.dateCreated.slice(0, 10)),
    },
  ];

  return (
    <Card>
      <CardHeader
        title="Ajustes registrados"
        description="Ajustes porcentuales por SKU con motivo auditado, asociados a esta temporada"
        action={
          <Button size="sm" onClick={onCreate}>
            Nuevo ajuste
          </Button>
        }
      />
      {loading && adjustments.length === 0 ? (
        <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando ajustes">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : errorMessage && adjustments.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-slate-500">{errorMessage}</p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry}>
            Reintentar
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={adjustments}
          rowKey={(a) => a.id}
          emptyMessage="Sin ajustes de pronóstico para esta temporada."
          mobileCard={(a) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-slate-800">{a.sku}</p>
                {a.adjustmentPct !== null && (
                  <Badge tone={a.adjustmentPct >= 0 ? "violet" : "amber"}>
                    {a.adjustmentPct > 0 ? "+" : ""}
                    {formatPercent(a.adjustmentPct, 0)}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">{a.reason}</p>
            </div>
          )}
        />
      )}
    </Card>
  );
}

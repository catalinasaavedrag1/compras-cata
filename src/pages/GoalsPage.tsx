import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { IconLock } from "../components/ui/icons";
import { useToast } from "../context/ToastContext";
import { usePurchaseContext } from "../hooks/usePurchaseContext";
import { useTeamWorkload, buyerLabel } from "../hooks/useTeam";
import {
  GOAL_ADMIN_PERMISSION,
  GOAL_KIND_LABEL,
  GOAL_KIND_OPTIONS,
  GOAL_STATUS_UI,
  currentMonthPeriod,
  goalProgressPct,
  isValidGoalPeriod,
  periodLabel,
  useGoals,
} from "../hooks/usePerformance";
import {
  describePurchaseBffError,
  type GoalKind,
  type GoalView,
} from "../services/purchaseBff";
import { PILL_TONE } from "../utils/tone";
import { formatDate, formatNumber } from "../utils/formatters";

// ============================================================================
//  Metas del equipo (F19) conectadas al purchase-bff-service:
//  - GET /performance/goals: metas reales con avance y estado del motor.
//  - POST /performance/goals (líder, purchase:goal:admin): alta; una meta
//    duplicada (mismo comprador + período + tipo) responde 409.
//  - PATCH /performance/goals/:id (If-Match): ajuste del objetivo con el
//    reintento único por 409 (details.currentVersion) del patrón useTeam.
//  Los compradores elegibles salen del workload real (F15), no de mocks.
// ============================================================================

const AVATAR_TONES = ["blue", "violet", "green", "amber", "red", "neutral"];

/** Iniciales para el avatar (mismo criterio que buyerInitials de useTeam). */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const second = words.length > 1 ? (words[words.length - 1][0] ?? "") : (words[0][1] ?? "");
  return (first + second).toUpperCase();
}

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Todas las metas" },
  { value: "at_risk", label: "Solo en riesgo" },
  { value: "off_track", label: "Solo fuera de curso" },
  { value: "on_track", label: "Solo en curso" },
  { value: "achieved", label: "Solo cumplidas" },
];

const BAR_COLOR: Record<string, string> = {
  green: "#10b981",
  blue: "#1f49d6",
  amber: "#f59e0b",
  red: "#f43f5e",
};

interface CreateForm {
  buyerId: string;
  period: string;
  kind: GoalKind;
  targetValue: string;
}

export function GoalsPage() {
  const toast = useToast();
  const { hasPermission } = usePurchaseContext();
  const canAdmin = hasPermission(GOAL_ADMIN_PERMISSION);

  const [comprador, setComprador] = useState("all");
  const [estado, setEstado] = useState("all");

  const { goals, loading, error, configured, refetch, create, adjust } = useGoals({
    buyerId: comprador === "all" ? "" : comprador,
  });
  const workload = useTeamWorkload();

  const [createForm, setCreateForm] = useState<CreateForm | null>(null);
  const [adjusting, setAdjusting] = useState<{ goal: GoalView; value: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Nombre visible por comprador a partir del workload real (F15).
  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of workload.rows) map.set(row.buyerId, buyerLabel(row));
    return (buyerId: string) => map.get(buyerId) ?? buyerId;
  }, [workload.rows]);

  const buyerOptions = useMemo(
    () => workload.rows.map((row) => ({ value: row.buyerId, label: buyerLabel(row) })),
    [workload.rows]
  );

  // Metas agrupadas por comprador (con el filtro de estado aplicado).
  const groups = useMemo(() => {
    const visible = goals.filter((g) => estado === "all" || g.status === estado);
    const byBuyer = new Map<string, GoalView[]>();
    for (const g of visible) {
      const list = byBuyer.get(g.buyerId) ?? [];
      list.push(g);
      byBuyer.set(g.buyerId, list);
    }
    return [...byBuyer.entries()]
      .map(([buyerId, items]) => ({
        buyerId,
        name: nameOf(buyerId),
        items: [...items].sort((a, b) => a.period.localeCompare(b.period)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [goals, estado, nameOf]);

  const riskN = goals.filter((g) => g.status === "at_risk" || g.status === "off_track").length;
  const achievedN = goals.filter((g) => g.status === "achieved").length;

  const openCreate = () =>
    setCreateForm({
      buyerId: buyerOptions[0]?.value ?? "",
      period: currentMonthPeriod(),
      kind: "order_count",
      targetValue: "",
    });

  const submitCreate = async () => {
    if (!createForm) return;
    const target = Number(createForm.targetValue);
    if (!createForm.buyerId) {
      toast.warning("Elige un comprador");
      return;
    }
    if (!isValidGoalPeriod(createForm.period)) {
      toast.warning("Período inválido: usa el formato 2026-07 (mes) o 2026-Q3 (trimestre)");
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      toast.warning("Ingresa un objetivo mayor a 0");
      return;
    }
    setSaving(true);
    const result = await create({
      buyerId: createForm.buyerId,
      period: createForm.period,
      kind: createForm.kind,
      targetValue: target,
    });
    setSaving(false);
    if (result.ok) {
      toast.success("Meta creada");
      setCreateForm(null);
    } else if (result.error.statusCode === 409) {
      toast.error(
        "Ya existe una meta de ese tipo para ese comprador y período. Ajusta la existente en su tarjeta."
      );
    } else {
      toast.error(describePurchaseBffError(result.error));
    }
  };

  const submitAdjust = async () => {
    if (!adjusting) return;
    const target = Number(adjusting.value);
    if (!Number.isFinite(target) || target <= 0) {
      toast.warning("Ingresa un objetivo mayor a 0");
      return;
    }
    setSaving(true);
    const result = await adjust(adjusting.goal, target);
    setSaving(false);
    if (result.ok) {
      toast.success("Objetivo ajustado");
      setAdjusting(null);
    } else {
      toast.error(describePurchaseBffError(result.error));
    }
  };

  const pageTitle = "Metas del equipo";
  const pageDescription =
    "Metas reales por comprador (OC emitidas, hit rate, reclamos resueltos y señales accionadas) con avance y estado calculados por el servicio.";

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
              ver y gestionar las metas reales del equipo.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && goals.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando metas">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error && goals.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">No se pudieron cargar las metas</p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">
              <b className="text-rose-600">{riskN}</b> en riesgo
            </span>
            <span className="text-slate-500">
              <b className="text-emerald-600">{achievedN}</b> cumplida{achievedN === 1 ? "" : "s"}
            </span>
          </div>
        }
      />

      {/* Filtros + alta */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-semibold text-slate-500 mr-1">Ver:</span>
        <div className="w-56">
          <Select
            value={comprador}
            onChange={(e) => setComprador(e.target.value)}
            options={[{ value: "all", label: "Todos los compradores" }, ...buyerOptions]}
          />
        </div>
        <div className="w-48">
          <Select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            options={STATUS_FILTER_OPTIONS}
          />
        </div>
        <span className="flex-1" />
        {canAdmin ? (
          <Button size="sm" onClick={openCreate}>
            + Nueva meta
          </Button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <IconLock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            <span>
              Crear o ajustar metas requiere el permiso{" "}
              <b className="text-slate-700">{GOAL_ADMIN_PERMISSION}</b> en tu sesión.
            </span>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              {goals.length === 0 ? "Aún no hay metas definidas" : "Sin metas con ese filtro"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {goals.length === 0
                ? "Crea la primera meta del período para que el motor empiece a medir el avance."
                : "Prueba con otro comprador u otro estado."}
            </p>
            {canAdmin && goals.length === 0 && (
              <Button className="mt-4" onClick={openCreate}>
                + Nueva meta
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
          {groups.map((group, gi) => (
            <Card key={group.buyerId}>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${PILL_TONE[AVATAR_TONES[gi % AVATAR_TONES.length]]}`}
                  >
                    {initialsOf(group.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{group.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {group.items.length} meta{group.items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {group.items.map((g) => {
                    const st = GOAL_STATUS_UI[g.status];
                    const pct = goalProgressPct(g);
                    const suffix = g.kind === "hit_rate" ? "%" : "";
                    return (
                      <div key={g.id}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {GOAL_KIND_LABEL[g.kind]}
                            <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                              {periodLabel(g.period)}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 flex-shrink-0">
                            <Badge tone={st.tone}>{st.label}</Badge>
                            {canAdmin && (
                              <button
                                onClick={() =>
                                  setAdjusting({
                                    goal: g,
                                    value: String(g.target?.value ?? ""),
                                  })
                                }
                                className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
                              >
                                Ajustar
                              </button>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: BAR_COLOR[st.tone] }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-600 w-24 text-right">
                            {g.progress?.value != null ? formatNumber(g.progress.value) : "—"}
                            {suffix} / {g.target?.value != null ? formatNumber(g.target.value) : "—"}
                            {suffix}
                          </span>
                        </div>
                        {g.progress?.updatedAt && (
                          <p className="text-[10.5px] text-slate-400 mt-0.5 text-right">
                            Avance al {formatDate(g.progress.updatedAt.slice(0, 10))}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: nueva meta */}
      <Modal
        open={!!createForm}
        onClose={() => setCreateForm(null)}
        title="Nueva meta"
        description="Una meta por comprador, período y tipo. El avance lo calcula el motor de desempeño."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateForm(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void submitCreate()} disabled={saving}>
              {saving ? "Guardando…" : "Crear meta"}
            </Button>
          </>
        }
      >
        {createForm && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Comprador
              </label>
              {buyerOptions.length > 0 ? (
                <Select
                  value={createForm.buyerId}
                  onChange={(e) => setCreateForm({ ...createForm, buyerId: e.target.value })}
                  options={buyerOptions}
                />
              ) : (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                  {workload.loading
                    ? "Cargando compradores del equipo…"
                    : "No se pudo cargar la lista de compradores del workload del equipo."}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Período (mes o trimestre)
              </label>
              <Input
                value={createForm.period}
                onChange={(e) => setCreateForm({ ...createForm, period: e.target.value })}
                placeholder="2026-07 o 2026-Q3"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Tipo de meta
              </label>
              <Select
                value={createForm.kind}
                onChange={(e) =>
                  setCreateForm({ ...createForm, kind: e.target.value as GoalKind })
                }
                options={GOAL_KIND_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Objetivo{createForm.kind === "hit_rate" ? " (%)" : ""}
              </label>
              <Input
                type="number"
                min={1}
                value={createForm.targetValue}
                onChange={(e) => setCreateForm({ ...createForm, targetValue: e.target.value })}
                placeholder={createForm.kind === "hit_rate" ? "Ej: 70" : "Ej: 10"}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: ajustar objetivo */}
      <Modal
        open={!!adjusting}
        onClose={() => setAdjusting(null)}
        title="Ajustar objetivo"
        description={
          adjusting
            ? `${GOAL_KIND_LABEL[adjusting.goal.kind]} · ${nameOf(adjusting.goal.buyerId)} · ${periodLabel(adjusting.goal.period)}`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjusting(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void submitAdjust()} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        {adjusting && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Nuevo objetivo{adjusting.goal.kind === "hit_rate" ? " (%)" : ""}
            </label>
            <Input
              type="number"
              min={1}
              value={adjusting.value}
              onChange={(e) => setAdjusting({ ...adjusting, value: e.target.value })}
            />
            <p className="text-[11px] text-slate-400 mt-2">
              Avance actual:{" "}
              {adjusting.goal.progress?.value != null
                ? formatNumber(adjusting.goal.progress.value)
                : "—"}
              {adjusting.goal.kind === "hit_rate" ? "%" : ""} — el estado se recalcula con el
              nuevo objetivo.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

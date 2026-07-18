import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createGoal,
  getMyPerformance,
  getPerformanceRanking,
  isPurchaseBffConfigured,
  listGoals,
  listRewards,
  patchGoal,
  toPurchaseBffError,
  type GoalKind,
  type GoalStatus,
  type GoalView,
  type MyPerformanceView,
  type PurchaseBffError,
  type RankingRowView,
  type RewardView,
} from "../services/purchaseBff";

// ============================================================================
//  Desempeño y gamificación (F19) conectados al purchase-bff-service.
//  - useMyPerformance(): GET /performance/me — score del mes (fórmula v1),
//    snapshot del mes anterior para el delta y metas propias.
//  - usePerformanceRanking(): GET /performance/ranking — ranking del mes.
//  - useRewards(): GET /performance/rewards — recompensas activas.
//  - useGoals(): GET /performance/goals + alta (POST, duplicada ⇒ 409) y
//    ajuste (PATCH If-Match; 409 con details.currentVersion ⇒ reintento único,
//    patrón useReassignCategory de useTeam.ts).
//  Todos con guardia de carrera (requestSeq) y logout ante UNAUTHENTICATED,
//  como useImports/useBudget.
// ============================================================================

/** Permiso que exige el BFF para crear/ajustar metas (solo líder). */
export const GOAL_ADMIN_PERMISSION = "purchase:goal:admin";

/** Etiquetas en español de los tipos de meta del contrato. */
export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  order_count: "OC emitidas",
  hit_rate: "Tasa de acierto (hit rate)",
  claims_resolved: "Reclamos resueltos",
  signals_actioned: "Señales accionadas",
};

export const GOAL_KIND_OPTIONS: { value: GoalKind; label: string }[] = (
  Object.keys(GOAL_KIND_LABEL) as GoalKind[]
).map((kind) => ({ value: kind, label: GOAL_KIND_LABEL[kind] }));

/** Estado de una meta según el backend, con el chip visual de la app. */
export const GOAL_STATUS_UI: Record<
  GoalStatus,
  { label: string; tone: "green" | "blue" | "amber" | "red" }
> = {
  achieved: { label: "Cumplida", tone: "green" },
  on_track: { label: "En curso", tone: "blue" },
  at_risk: { label: "En riesgo", tone: "amber" },
  off_track: { label: "Fuera de curso", tone: "red" },
};

const MONTH_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** "2026-07" → "julio 2026"; "2026-Q3" → "3er trimestre 2026". */
export function periodLabel(period: string): string {
  const month = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (month) return `${MONTH_ES[Number(month[2]) - 1]} ${month[1]}`;
  const quarter = /^(\d{4})-Q([1-4])$/.exec(period);
  if (quarter) {
    const ord = ["1er", "2do", "3er", "4to"][Number(quarter[2]) - 1];
    return `${ord} trimestre ${quarter[1]}`;
  }
  return period;
}

/** Período mensual en curso, en el formato del contrato ("YYYY-MM"). */
export function currentMonthPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** ¿Período válido para una meta? Mes "YYYY-MM" o trimestre "YYYY-Q1..4". */
export function isValidGoalPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period) || /^\d{4}-Q[1-4]$/.test(period);
}

/** Avance 0–100 de una meta (para la barra de progreso). */
export function goalProgressPct(goal: GoalView): number {
  const target = goal.target?.value ?? 0;
  const progress = goal.progress?.value ?? 0;
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
}

function useUnauthenticatedHandler(): () => void {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);
}

// ----------------------------------------------------------------------------
//  useMyPerformance — GET /performance/me
// ----------------------------------------------------------------------------

export interface UseMyPerformanceResult {
  data: MyPerformanceView | null;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useMyPerformance(): UseMyPerformanceResult {
  const configured = isPurchaseBffConfigured();
  const handleUnauthenticated = useUnauthenticatedHandler();

  const [data, setData] = useState<MyPerformanceView | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!configured) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const view = await getMyPerformance();
      if (seq !== requestSeq.current) return;
      setData(view);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const info = toPurchaseBffError(err);
      if (info.code === "UNAUTHENTICATED") {
        handleUnauthenticated();
        return;
      }
      setError(info);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [configured, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ data, loading, error, configured, refetch: () => void load() }),
    [data, loading, error, configured, load]
  );
}

// ----------------------------------------------------------------------------
//  usePerformanceRanking — GET /performance/ranking
// ----------------------------------------------------------------------------

export interface UsePerformanceRankingResult {
  period: string | null;
  items: RankingRowView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function usePerformanceRanking(): UsePerformanceRankingResult {
  const configured = isPurchaseBffConfigured();
  const handleUnauthenticated = useUnauthenticatedHandler();

  const [period, setPeriod] = useState<string | null>(null);
  const [items, setItems] = useState<RankingRowView[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!configured) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getPerformanceRanking();
      if (seq !== requestSeq.current) return;
      setPeriod(result.period);
      setItems(result.items);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const info = toPurchaseBffError(err);
      if (info.code === "UNAUTHENTICATED") {
        handleUnauthenticated();
        return;
      }
      setError(info);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [configured, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ period, items, loading, error, configured, refetch: () => void load() }),
    [period, items, loading, error, configured, load]
  );
}

// ----------------------------------------------------------------------------
//  useRewards — GET /performance/rewards
// ----------------------------------------------------------------------------

export interface UseRewardsResult {
  rewards: RewardView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useRewards(): UseRewardsResult {
  const configured = isPurchaseBffConfigured();
  const handleUnauthenticated = useUnauthenticatedHandler();

  const [rewards, setRewards] = useState<RewardView[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!configured) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listRewards();
      if (seq !== requestSeq.current) return;
      setRewards(page.items);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const info = toPurchaseBffError(err);
      if (info.code === "UNAUTHENTICATED") {
        handleUnauthenticated();
        return;
      }
      setError(info);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [configured, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ rewards, loading, error, configured, refetch: () => void load() }),
    [rewards, loading, error, configured, load]
  );
}

// ----------------------------------------------------------------------------
//  useGoals — GET /performance/goals + mutaciones del líder
// ----------------------------------------------------------------------------

export interface GoalFilters {
  /** Solo las metas de un comprador ("" = todas las visibles). */
  buyerId?: string;
  /** Solo un período ("" = todos). */
  period?: string;
}

export type GoalActionResult =
  | { ok: true; goal: GoalView }
  | { ok: false; error: PurchaseBffError };

export interface UseGoalsResult {
  goals: GoalView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  /** POST /performance/goals — alta (líder). Meta duplicada ⇒ 409 sin retry. */
  create: (body: {
    buyerId: string;
    period: string;
    kind: GoalKind;
    targetValue: number;
  }) => Promise<GoalActionResult>;
  /** PATCH /performance/goals/:id — ajustar el objetivo (líder, If-Match). */
  adjust: (goal: GoalView, targetValue: number) => Promise<GoalActionResult>;
}

/** ¿El 409 trae la versión vigente (patrón assertVersion del BFF)? */
function conflictCurrentVersion(info: PurchaseBffError): number | null {
  if (info.statusCode !== 409) return null;
  const details =
    typeof info.details === "object" && info.details !== null
      ? (info.details as Record<string, unknown>)
      : {};
  return typeof details.currentVersion === "number" ? details.currentVersion : null;
}

export function useGoals(filters: GoalFilters = {}): UseGoalsResult {
  const configured = isPurchaseBffConfigured();
  const handleUnauthenticated = useUnauthenticatedHandler();

  const buyerId = filters.buyerId ?? "";
  const period = filters.period ?? "";

  const [goals, setGoals] = useState<GoalView[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!configured) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listGoals({
        buyerId: buyerId || undefined,
        period: period || undefined,
      });
      if (seq !== requestSeq.current) return;
      setGoals(page.items);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const info = toPurchaseBffError(err);
      if (info.code === "UNAUTHENTICATED") {
        handleUnauthenticated();
        return;
      }
      setError(info);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [configured, buyerId, period, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (body: {
      buyerId: string;
      period: string;
      kind: GoalKind;
      targetValue: number;
    }): Promise<GoalActionResult> => {
      try {
        const goal = await createGoal(body);
        void load();
        return { ok: true, goal };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
        return { ok: false, error: info };
      }
    },
    [handleUnauthenticated, load]
  );

  const adjust = useCallback(
    async (goal: GoalView, targetValue: number): Promise<GoalActionResult> => {
      try {
        const updated = await patchGoal(goal.id, goal.version, { targetValue });
        setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        return { ok: true, goal: updated };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        const currentVersion = conflictCurrentVersion(info);
        if (currentVersion === null) return { ok: false, error: info };
        // Reintento único con la versión vigente que informó el 409.
        try {
          const updated = await patchGoal(goal.id, currentVersion, { targetValue });
          setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
          return { ok: true, goal: updated };
        } catch (retryErr) {
          const retryInfo = toPurchaseBffError(retryErr);
          if (retryInfo.code === "UNAUTHENTICATED") handleUnauthenticated();
          // La meta cambió por debajo: recargar para alinear versiones.
          if (retryInfo.statusCode === 409) void load();
          return { ok: false, error: retryInfo };
        }
      }
    },
    [handleUnauthenticated, load]
  );

  return useMemo(
    () => ({
      goals,
      loading,
      error,
      configured,
      refetch: () => void load(),
      create,
      adjust,
    }),
    [goals, loading, error, configured, load, create, adjust]
  );
}

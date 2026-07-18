import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createForecastAdjustment,
  getSeason,
  isPurchaseBffConfigured,
  listForecastAdjustments,
  listSeasons,
  putSeasonPlan,
  toPurchaseBffError,
  type ForecastAdjustmentView,
  type PurchaseBffError,
  type SeasonPlanView,
  type SeasonScenario,
  type SeasonView,
} from "../services/purchaseBff";

// ============================================================================
//  Temporadas reales del purchase-bff-service (F18).
//  - useSeasons: GET /seasons — calendario comercial y selector del planner.
//  - useSeason: GET /seasons/:id + PUT /seasons/:id/plans/:scenario. El PUT
//    exige If-Match cuando el plan ya existe: se envía la versión conocida y,
//    ante 409 con details.currentVersion, se reintenta UNA sola vez con esa
//    versión (patrón useReassignCategory de useTeam).
//  - useForecastAdjustments: GET/POST /seasons/forecast-adjustments (ajustes
//    auditados por SKU; el motivo es obligatorio en el contrato).
//  Guardia de carrera (requestSeq) y logout ante UNAUTHENTICATED, como
//  useBudget / useImports.
// ============================================================================

export type SeasonPlanSaveResult =
  | { ok: true; plan: SeasonPlanView }
  | { ok: false; error: PurchaseBffError };

export type ForecastAdjustmentResult =
  | { ok: true; adjustment: ForecastAdjustmentView }
  | { ok: false; error: PurchaseBffError };

/** ¿El 409 trae la versión vigente del plan (patrón assertVersion)? */
function conflictCurrentVersion(info: PurchaseBffError): number | null {
  if (info.statusCode !== 409) return null;
  const details =
    typeof info.details === "object" && info.details !== null
      ? (info.details as Record<string, unknown>)
      : {};
  return typeof details.currentVersion === "number" ? details.currentVersion : null;
}

// ----------------------------------------------------------------------------
//  Lista de temporadas (calendario comercial)
// ----------------------------------------------------------------------------

export interface UseSeasonsResult {
  seasons: SeasonView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useSeasons(): UseSeasonsResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [seasons, setSeasons] = useState<SeasonView[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const load = useCallback(async () => {
    if (!configured) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listSeasons();
      if (seq !== requestSeq.current) return;
      setSeasons(page.items);
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
    () => ({ seasons, loading, error, configured, refetch: () => void load() }),
    [seasons, loading, error, configured, load]
  );
}

// ----------------------------------------------------------------------------
//  Detalle de una temporada + upsert del plan por escenario
// ----------------------------------------------------------------------------

export interface UseSeasonResult {
  season: SeasonView | null;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  /**
   * PUT del plan del escenario. Usa la versión conocida como If-Match; si el
   * backend responde 409 con details.currentVersion, reintenta una única vez.
   */
  savePlan: (
    scenario: SeasonScenario,
    plan: NonNullable<SeasonPlanView["plan"]>
  ) => Promise<SeasonPlanSaveResult>;
}

export function useSeason(id: string | null): UseSeasonResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [season, setSeason] = useState<SeasonView | null>(null);
  const [loading, setLoading] = useState(Boolean(configured && id));
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const load = useCallback(async () => {
    if (!configured || !id) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const view = await getSeason(id);
      if (seq !== requestSeq.current) return;
      setSeason(view);
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
  }, [configured, id, handleUnauthenticated]);

  useEffect(() => {
    setSeason(null);
    void load();
  }, [load]);

  /** Refleja en el detalle la vista fresca del plan que devuelve el PUT. */
  const applyPlanView = useCallback((view: SeasonPlanView) => {
    setSeason((prev) => {
      if (!prev) return prev;
      const exists = prev.plans.some((p) => p.scenario === view.scenario);
      return {
        ...prev,
        plans: exists
          ? prev.plans.map((p) => (p.scenario === view.scenario ? view : p))
          : [...prev.plans, view],
      };
    });
  }, []);

  const savePlan = useCallback(
    async (
      scenario: SeasonScenario,
      plan: NonNullable<SeasonPlanView["plan"]>
    ): Promise<SeasonPlanSaveResult> => {
      if (!id) {
        return {
          ok: false,
          error: {
            code: "NO_SEASON",
            message: "No hay una temporada seleccionada.",
            statusCode: 0,
            retryable: false,
          },
        };
      }
      const version = season?.plans.find((p) => p.scenario === scenario)?.version;
      try {
        const view = await putSeasonPlan(id, scenario, plan, version);
        applyPlanView(view);
        return { ok: true, plan: view };
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
          const view = await putSeasonPlan(id, scenario, plan, currentVersion);
          applyPlanView(view);
          return { ok: true, plan: view };
        } catch (retryErr) {
          const retryInfo = toPurchaseBffError(retryErr);
          if (retryInfo.code === "UNAUTHENTICATED") handleUnauthenticated();
          return { ok: false, error: retryInfo };
        }
      }
    },
    [id, season, applyPlanView, handleUnauthenticated]
  );

  return useMemo(
    () => ({ season, loading, error, configured, refetch: () => void load(), savePlan }),
    [season, loading, error, configured, load, savePlan]
  );
}

// ----------------------------------------------------------------------------
//  Ajustes de pronóstico auditados (por SKU, opcionalmente por temporada)
// ----------------------------------------------------------------------------

export interface UseForecastAdjustmentsResult {
  adjustments: ForecastAdjustmentView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  /** POST del ajuste (motivo ≥ 5 caracteres; pct entre -100 y 500). */
  create: (body: {
    sku: string;
    adjustmentPct: number;
    reason: string;
  }) => Promise<ForecastAdjustmentResult>;
}

export function useForecastAdjustments(seasonId: string | null): UseForecastAdjustmentsResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [adjustments, setAdjustments] = useState<ForecastAdjustmentView[]>([]);
  const [loading, setLoading] = useState(Boolean(configured && seasonId));
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const load = useCallback(async () => {
    if (!configured || !seasonId) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listForecastAdjustments({ seasonId });
      if (seq !== requestSeq.current) return;
      setAdjustments(page.items);
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
  }, [configured, seasonId, handleUnauthenticated]);

  useEffect(() => {
    setAdjustments([]);
    void load();
  }, [load]);

  const create = useCallback(
    async (body: {
      sku: string;
      adjustmentPct: number;
      reason: string;
    }): Promise<ForecastAdjustmentResult> => {
      try {
        const adjustment = await createForecastAdjustment(
          seasonId ? { ...body, seasonId } : body
        );
        void load();
        return { ok: true, adjustment };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
        return { ok: false, error: info };
      }
    },
    [seasonId, load, handleUnauthenticated]
  );

  return useMemo(
    () => ({ adjustments, loading, error, configured, refetch: () => void load(), create }),
    [adjustments, loading, error, configured, load, create]
  );
}

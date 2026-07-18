import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getTeamWorkload,
  isPurchaseBffConfigured,
  listAlerts,
  reassignCategory,
  toPurchaseBffError,
  type AlertView,
  type BuyerWorkloadCounts,
  type BuyerWorkloadRow,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Equipo del líder (F15) conectado al purchase-bff-service.
//  - useTeamWorkload(): GET /team/workload — carga viva por comprador (patrón
//    useBudget: guardia de carrera con requestSeq y logout ante UNAUTHENTICATED).
//  - useBuyerAlerts(buyerId): GET /alerts?status=active&buyerId=… — alertas
//    activas filtradas por comprador para la vista del líder.
//  - useReassignCategory(): PUT /team/assignments/:categoryId (C18) con el
//    reintento por 409 documentado más abajo.
// ============================================================================

const ALERTS_PAGE_SIZE = 100;

/** Nombre visible de un comprador del workload (cae al id si no hay nombre). */
export function buyerLabel(row: BuyerWorkloadRow): string {
  return row.displayName ?? row.buyerId;
}

/** Iniciales para el avatar (mismo lenguaje visual que las vistas previas). */
export function buyerInitials(row: BuyerWorkloadRow): string {
  const words = buyerLabel(row).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const second = words.length > 1 ? (words[words.length - 1][0] ?? "") : (words[0][1] ?? "");
  return (first + second).toUpperCase();
}

/**
 * Carga total real de un comprador = suma de sus ítems abiertos/pendientes.
 * No es un "score": solo agrega los contadores que sí entrega el backend.
 */
export function totalOpenItems(counts: BuyerWorkloadCounts): number {
  return (
    counts.recommendationsPending +
    counts.proposalsOpen +
    counts.ordersOpen +
    counts.receptionsPending +
    counts.claimsOpen +
    counts.alertsActive +
    counts.signalsOpen +
    counts.decisionsPending
  );
}

// ----------------------------------------------------------------------------
//  useTeamWorkload — GET /team/workload
// ----------------------------------------------------------------------------

export interface UseTeamWorkloadResult {
  rows: BuyerWorkloadRow[];
  /** Momento del cálculo que reporta el backend (null hasta la primera carga). */
  asOf: string | null;
  loading: boolean;
  error: PurchaseBffError | null;
  /** ¿Hay VITE_PURCHASE_BFF_URL configurada? */
  configured: boolean;
  refetch: () => void;
}

export function useTeamWorkload(): UseTeamWorkloadResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [rows, setRows] = useState<BuyerWorkloadRow[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
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
      const result = await getTeamWorkload();
      if (seq !== requestSeq.current) return;
      setRows(result.items);
      setAsOf(result.asOf);
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
    () => ({ rows, asOf, loading, error, configured, refetch: () => void load() }),
    [rows, asOf, loading, error, configured, load]
  );
}

// ----------------------------------------------------------------------------
//  useBuyerAlerts — GET /alerts?status=active&buyerId=… (F7 filtrado por líder)
// ----------------------------------------------------------------------------

export interface UseBuyerAlertsResult {
  alerts: AlertView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

/** Alertas activas por comprador; sin `buyerId` trae las de toda la mesa. */
export function useBuyerAlerts(buyerId: string | null): UseBuyerAlertsResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [alerts, setAlerts] = useState<AlertView[]>([]);
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
      const page = await listAlerts({
        status: "active",
        buyerId: buyerId ?? undefined,
        page: 1,
        pageSize: ALERTS_PAGE_SIZE,
      });
      if (seq !== requestSeq.current) return;
      setAlerts(page.items);
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
  }, [configured, buyerId, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ alerts, loading, error, configured, refetch: () => void load() }),
    [alerts, loading, error, configured, load]
  );
}

// ----------------------------------------------------------------------------
//  Reasignación de cartera (C18) con reintento por 409
// ----------------------------------------------------------------------------

export interface ReassignmentView {
  categoryId: string;
  buyerId: string;
  since: string;
  version: number;
}

export type ReassignResult =
  | { ok: true; assignment: ReassignmentView }
  | { ok: false; error: PurchaseBffError };

/** ¿El 409 trae la versión vigente de la asignación (patrón assertVersion)? */
function conflictCurrentVersion(info: PurchaseBffError): number | null {
  if (info.statusCode !== 409) return null;
  const details =
    typeof info.details === "object" && info.details !== null
      ? (info.details as Record<string, unknown>)
      : {};
  return typeof details.currentVersion === "number" ? details.currentVersion : null;
}

/**
 * Hook de reasignación de categoría (C18, PUT /team/assignments/:categoryId).
 *
 * Por qué el reintento por 409: el PUT exige If-Match con la versión de la
 * asignación vigente, pero esa versión NO viaja en ninguna lectura del BFF
 * (ni getCategoriesPanel ni la ficha de categoría la exponen). Entonces:
 *  1. Primer PUT sin If-Match — válido cuando la categoría aún no estaba
 *     asignada (no hay versión que proteger).
 *  2. Si la asignación ya existía, el backend responde 409 (patrón
 *     assertVersion) incluyendo `details.currentVersion`: se reintenta UNA
 *     sola vez con esa versión como If-Match.
 *  3. Un segundo 409 (carrera real con otra sesión entre ambos PUT) se
 *     devuelve al caller como error, sin más reintentos.
 */
export function useReassignCategory(): (
  categoryId: string,
  body: { buyerId: string; reason?: string }
) => Promise<ReassignResult> {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  return useCallback(
    async (categoryId, body): Promise<ReassignResult> => {
      try {
        const assignment = await reassignCategory(categoryId, body);
        return { ok: true, assignment };
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
          const assignment = await reassignCategory(categoryId, body, currentVersion);
          return { ok: true, assignment };
        } catch (retryErr) {
          const retryInfo = toPurchaseBffError(retryErr);
          if (retryInfo.code === "UNAUTHENTICATED") {
            handleUnauthenticated();
          }
          return { ok: false, error: retryInfo };
        }
      }
    },
    [handleUnauthenticated]
  );
}

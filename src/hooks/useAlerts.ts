import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  alertAction,
  isPurchaseBffConfigured,
  listAlerts,
  toPurchaseBffError,
  type AlertActionBff,
  type AlertView,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Alertas comerciales reales del purchase-bff-service (flujo 7).
//  - Inbox completo en una página grande (mismo criterio que OC/reclamos); los
//    filtros por pestaña, severidad, tipo y texto siguen siendo client-side.
//  - Transiciones C17 (acknowledge / resolve / dismiss) idempotentes: sin
//    If-Match. Un 409 de estado obsoleto (CONFLICT) recarga la lista para
//    reflejar la realidad; UNAUTHENTICATED cierra la sesión.
// ============================================================================

const PAGE_SIZE = 100;

export type AlertActionResult =
  | { ok: true; alert: AlertView }
  | { ok: false; error: PurchaseBffError };

export interface UseAlertsResult {
  alerts: AlertView[];
  loading: boolean;
  error: PurchaseBffError | null;
  /** ¿Hay VITE_PURCHASE_BFF_URL configurada? */
  configured: boolean;
  refetch: () => void;
  /** POST /alerts/:id/<acción> — dismiss exige `reason` (lo valida el dominio). */
  applyAction: (id: string, action: AlertActionBff, reason?: string) => Promise<AlertActionResult>;
}

export function useAlerts(): UseAlertsResult {
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
      const page = await listAlerts({ page: 1, pageSize: PAGE_SIZE });
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
  }, [configured, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyAction = useCallback(
    async (id: string, action: AlertActionBff, reason?: string): Promise<AlertActionResult> => {
      try {
        const alert = await alertAction(id, action, reason);
        setAlerts((prev) => prev.map((a) => (a.id === alert.id ? alert : a)));
        return { ok: true, alert };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        // Estado obsoleto (otra sesión o auto-resolve del motor): recargar.
        if (info.code === "CONFLICT" || info.code === "VERSION_CONFLICT") {
          void load();
        }
        return { ok: false, error: info };
      }
    },
    [handleUnauthenticated, load]
  );

  return useMemo(
    () => ({ alerts, loading, error, configured, refetch: () => void load(), applyAction }),
    [alerts, loading, error, configured, load, applyAction]
  );
}

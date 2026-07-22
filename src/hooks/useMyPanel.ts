import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getMyPerformance,
  isPurchaseBffConfigured,
  toPurchaseBffError,
  type MyPerformanceView,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Datos propios de "Mi panel" que no cubre otro hook reutilizable:
//  el desempeño del comprador (F19: GET /performance/me) alimenta el puntaje
//  del mes y los objetivos reales de la vista "Mi cartera".
//  Patrón useBudget/useImports: guardia de carrera (requestSeq), `configured`
//  explícito y logout + redirect ante UNAUTHENTICATED.
// ============================================================================

export interface UseMyPanelResult {
  /** Score del mes, delta vs mes anterior y metas del período (F19). */
  performance: MyPerformanceView | null;
  loading: boolean;
  error: PurchaseBffError | null;
  /** ¿Hay VITE_PURCHASE_BFF_URL configurada? */
  configured: boolean;
  refetch: () => void;
}

export function useMyPanel(): UseMyPanelResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [performance, setPerformance] = useState<MyPerformanceView | null>(null);
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
      const result = await getMyPerformance();
      if (seq !== requestSeq.current) return;
      setPerformance(result);
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
    () => ({ performance, loading, error, configured, refetch: () => void load() }),
    [performance, loading, error, configured, load]
  );
}

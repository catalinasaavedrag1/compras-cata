import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCategoryScope } from "../components/business/ScopeToggle";
import {
  getDashboard,
  isPurchaseBffConfigured,
  toPurchaseBffError,
  type DashboardData,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Dashboard real de Inicio (flujo 6): GET /dashboard del purchase-bff-service.
//  - Se carga al montar la portada y cuando cambia el alcance compartido
//    ("compras:scope" vía useCategoryScope). Sin polling: la portada se
//    refresca sola al volver a la ruta (el componente se vuelve a montar).
//  - La sección de reposición es indispensable: si el motor cae, el BFF
//    responde 502 y aquí queda `error` (la vista ofrece Reintentar).
//  - Las demás secciones degradan por separado (status "degraded") y la
//    portada decide cómo avisar sin inventar datos.
// ============================================================================

export interface UseDashboardResult {
  data: DashboardData | null;
  loading: boolean;
  error: PurchaseBffError | null;
  /** ¿Hay VITE_PURCHASE_BFF_URL configurada? */
  configured: boolean;
  refetch: () => void;
}

export function useDashboard(): UseDashboardResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { scope } = useCategoryScope();

  const [data, setData] = useState<DashboardData | null>(null);
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
      const result = await getDashboard(scope);
      if (seq !== requestSeq.current) return;
      setData(result);
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
  }, [configured, scope, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ data, loading, error, configured, refetch: () => void load() }),
    [data, loading, error, configured, load]
  );
}

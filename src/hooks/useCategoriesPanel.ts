import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getCategoriesPanel,
  isPurchaseBffConfigured,
  toPurchaseBffError,
  type BffWarning,
  type CategoryPanelRow,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Panel de categorías real (flujo 12): GET /categories del purchase-bff
//  (motor + OTB + cartera). En las filas, null = sub-lectura degradada
//  (venta/margen/presupuesto pueden faltar sin romper el panel); las
//  degradaciones llegan en `warnings`. Patrón useBudget: guardia de carrera
//  (requestSeq) y logout ante UNAUTHENTICATED.
// ============================================================================

export interface UseCategoriesPanelResult {
  rows: CategoryPanelRow[];
  warnings: BffWarning[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useCategoriesPanel(): UseCategoriesPanelResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [rows, setRows] = useState<CategoryPanelRow[]>([]);
  const [warnings, setWarnings] = useState<BffWarning[]>([]);
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
      const result = await getCategoriesPanel();
      if (seq !== requestSeq.current) return;
      setRows(result.items);
      setWarnings(result.warnings ?? []);
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
    () => ({ rows, warnings, loading, error, configured, refetch: () => void load() }),
    [rows, warnings, loading, error, configured, load]
  );
}

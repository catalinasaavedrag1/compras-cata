import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getSuppliersPanel,
  isPurchaseBffConfigured,
  toPurchaseBffError,
  type PurchaseBffError,
  type ReplenishmentMeta,
  type SupplierPanelRow,
} from "../services/purchaseBff";

// ============================================================================
//  Panel de proveedores real (flujo 12): GET /suppliers del purchase-bff.
//  - La búsqueda `q` (nombre / RUT / cardCode) y el filtro `status` se resuelven
//    en el backend; `q` lleva un pequeño debounce para no pedir por tecla.
//  - En las filas, null = sub-lectura degradada (distinto de 0 real).
//  Guardia de carrera (requestSeq) y logout ante UNAUTHENTICATED, como useBudget.
// ============================================================================

const SEARCH_DEBOUNCE_MS = 300;

export interface UseSuppliersPanelResult {
  rows: SupplierPanelRow[];
  meta: ReplenishmentMeta | null;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useSuppliersPanel(q: string, status: string): UseSuppliersPanelResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  // q viene de la URL (cambia por tecla): la petición espera al valor estable.
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  const [rows, setRows] = useState<SupplierPanelRow[]>([]);
  const [meta, setMeta] = useState<ReplenishmentMeta | null>(null);
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
      const result = await getSuppliersPanel({
        q: debouncedQ.trim() || undefined,
        status: status || undefined,
        pageSize: 100,
      });
      if (seq !== requestSeq.current) return;
      setRows(result.items);
      setMeta(result.meta);
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
  }, [configured, debouncedQ, status, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ rows, meta, loading, error, configured, refetch: () => void load() }),
    [rows, meta, loading, error, configured, load]
  );
}

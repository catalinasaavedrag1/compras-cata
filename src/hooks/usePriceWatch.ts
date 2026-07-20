import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  isPurchaseBffConfigured,
  listPriceChanges,
  toPurchaseBffError,
  type PriceChangeView,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Vigilancia de precios de compra (F26): GET /price-watch/changes. Las "alzas"
//  reales son los cambios de costo detectados desde las OC emitidas (no precios
//  de venta). Solo lectura (permiso purchase:cost:read, de toda la mesa). Los
//  filtros ventana (windowDays) y umbral (minPct) se resuelven en el backend.
//  Guardia de carrera (requestSeq) y logout ante UNAUTHENTICATED, como useImports.
// ============================================================================

export interface PriceWatchFilters {
  windowDays?: number;
  minPct?: number;
}

export interface UsePriceWatchResult {
  items: PriceChangeView[];
  /** Ventana efectiva devuelta por el backend (días). */
  windowDays: number | null;
  total: number;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function usePriceWatch(filters: PriceWatchFilters = {}): UsePriceWatchResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const { windowDays, minPct } = filters;

  const [items, setItems] = useState<PriceChangeView[]>([]);
  const [effectiveWindow, setEffectiveWindow] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
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
      const data = await listPriceChanges({
        ...(windowDays ? { windowDays } : {}),
        ...(minPct !== undefined ? { minPct } : {}),
      });
      if (seq !== requestSeq.current) return;
      setItems(data.items);
      setEffectiveWindow(data.windowDays);
      setTotal(data.total);
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
  }, [configured, windowDays, minPct, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({
      items,
      windowDays: effectiveWindow,
      total,
      loading,
      error,
      configured,
      refetch: () => void load(),
    }),
    [items, effectiveWindow, total, loading, error, configured, load]
  );
}

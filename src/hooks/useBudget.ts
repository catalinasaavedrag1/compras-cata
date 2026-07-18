import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getBudgetOverview,
  getSupplierSpend,
  isPurchaseBffConfigured,
  toPurchaseBffError,
  type BudgetOverviewData,
  type PurchaseBffError,
  type SupplierSpendData,
} from "../services/purchaseBff";

// ============================================================================
//  Presupuesto / Open-to-Buy real (flujo 9): GET /budget del purchase-bff.
//  - useBudget(month): buckets del mes + selector de meses + totales. Sin mes
//    pedido, el BFF resuelve el más reciente configurado.
//  - useSupplierSpend(days): compra agregada por proveedor (ventana móvil),
//    degradable a referencia interna cuando comerce no responde (warnings).
//  Ambos con guardia de carrera (requestSeq) y logout ante UNAUTHENTICATED.
// ============================================================================

export interface UseBudgetResult {
  data: BudgetOverviewData | null;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useBudget(month?: string): UseBudgetResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [data, setData] = useState<BudgetOverviewData | null>(null);
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
      const result = await getBudgetOverview(month);
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
  }, [configured, month, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ data, loading, error, configured, refetch: () => void load() }),
    [data, loading, error, configured, load]
  );
}

export interface UseSupplierSpendResult {
  data: SupplierSpendData | null;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useSupplierSpend(days = 90): UseSupplierSpendResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [data, setData] = useState<SupplierSpendData | null>(null);
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
      const result = await getSupplierSpend(days);
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
  }, [configured, days, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ data, loading, error, configured, refetch: () => void load() }),
    [data, loading, error, configured, load]
  );
}

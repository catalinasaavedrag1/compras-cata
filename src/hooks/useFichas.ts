import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getCategoryFicha,
  getProductFicha,
  getSupplierFicha,
  isPurchaseBffConfigured,
  toPurchaseBffError,
  type CategoryFichaData,
  type ProductFichaData,
  type PurchaseBffError,
  type SupplierFichaData,
} from "../services/purchaseBff";

// ============================================================================
//  Fichas reales (flujo 11): GET /suppliers/:id, /products/:sku,
//  /categories/:id del purchase-bff. Un solo hook genérico con guardia de
//  carrera, logout ante UNAUTHENTICATED y distinción explícita del 404
//  (notFound: la ficha muestra "no encontrado", no un error de conexión).
// ============================================================================

export interface UseFichaResult<T> {
  data: T | null;
  loading: boolean;
  error: PurchaseBffError | null;
  /** true cuando el backend respondió 404 (entidad desconocida). */
  notFound: boolean;
  configured: boolean;
  refetch: () => void;
}

function useFicha<T>(key: string | undefined, fetcher: (key: string) => Promise<T>): UseFichaResult<T> {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(configured && Boolean(key));
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const [notFound, setNotFound] = useState(false);
  const requestSeq = useRef(0);

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const load = useCallback(async () => {
    if (!configured || !key) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const result = await fetcher(key);
      if (seq !== requestSeq.current) return;
      setData(result);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const info = toPurchaseBffError(err);
      if (info.code === "UNAUTHENTICATED") {
        handleUnauthenticated();
        return;
      }
      if (info.statusCode === 404) {
        setNotFound(true);
        setData(null);
      } else {
        setError(info);
      }
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, key, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ data, loading, error, notFound, configured, refetch: () => void load() }),
    [data, loading, error, notFound, configured, load]
  );
}

export function useSupplierFicha(supplierId: string | undefined): UseFichaResult<SupplierFichaData> {
  return useFicha(supplierId, getSupplierFicha);
}

export function useProductFicha(sku: string | undefined): UseFichaResult<ProductFichaData> {
  return useFicha(sku, getProductFicha);
}

export function useCategoryFicha(categoryId: string | undefined): UseFichaResult<CategoryFichaData> {
  return useFicha(categoryId, getCategoryFicha);
}

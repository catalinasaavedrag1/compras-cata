import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCategoryScope } from "../components/business/ScopeToggle";
import {
  isPurchaseBffConfigured,
  searchReplenishment,
  toPurchaseBffError,
  type BffPriority,
  type BffRecommendationStatus,
  type PurchaseBffError,
  type ReplenishmentMeta,
  type ReplenishmentRow,
} from "../services/purchaseBff";

// ============================================================================
//  Catálogo de productos real: mismo POST /replenishment/search del flujo 1
//  pero SIN filters.status, para traer el universo completo que conoce el
//  motor (pendientes, en carro, ordenadas, ignoradas y pospuestas). El alcance
//  "mi cartera / todas" se resuelve en el backend (scope), igual que en
//  useReplenishment; el filtrado fino (q, categoría, proveedor, toggles) queda
//  client-side sobre la página cargada.
// ============================================================================

/** Fila del catálogo aplanada para la tabla de Productos. null = dato no disponible. */
export interface ProductCatalogRow {
  sku: string;
  name: string;
  brand: string | null;
  categoryId: string | null;
  categoryName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  stockAvailable: number | null;
  unitCost: number | null;
  marginPct: number | null;
  sales30Units: number | null;
  priority: BffPriority;
  engineStatus: BffRecommendationStatus;
  coverageDays: number | null;
}

/** Mapeo puro Fila BFF → fila de catálogo (conserva null = sin dato). */
export function mapRowToCatalog(row: ReplenishmentRow): ProductCatalogRow {
  return {
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    categoryId: row.category.id,
    categoryName: row.category.name,
    supplierId: row.supplier.id,
    supplierName: row.supplier.name,
    stockAvailable: row.stock?.available ?? null,
    unitCost: row.cost?.unitCost ?? null,
    marginPct: row.marginPct,
    sales30Units: row.salesLast30d,
    priority: row.priority,
    engineStatus: row.status,
    coverageDays: row.coverageDays,
  };
}

export interface UseProductsCatalogResult {
  rows: ProductCatalogRow[];
  meta: ReplenishmentMeta | null;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useProductsCatalog(): UseProductsCatalogResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { scope } = useCategoryScope();

  const [rows, setRows] = useState<ProductCatalogRow[]>([]);
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
      const data = await searchReplenishment({
        filters: {},
        scope,
        page: 1,
        pageSize: 100,
        sort: [],
      });
      if (seq !== requestSeq.current) return;
      setRows(data.items.map(mapRowToCatalog));
      setMeta(data.meta);
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
    () => ({ rows, meta, loading, error, configured, refetch: () => void load() }),
    [rows, meta, loading, error, configured, load]
  );
}

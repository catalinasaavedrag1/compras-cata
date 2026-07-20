import { useMemo } from "react";
import { useProductsCatalog } from "./useProductsCatalog";
import { useRules } from "./useRules";
import type { PurchaseBffError } from "../services/purchaseBff";
import {
  classifyCoverage,
  targetRange,
  DEFAULT_TARGET_COVERAGE,
  type PurchaseQualityLine,
} from "../utils/purchaseQuality";

const TARGET_KEY = "replenishment.target_coverage_days";

export interface UsePurchaseQualityResult {
  lines: PurchaseQualityLine[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

/**
 * Calidad de compra REAL: clasifica cada SKU del catálogo del motor por su
 * cobertura actual (dato real) frente a la cobertura objetivo de la regla de
 * compra aplicable (global o por categoría, F20). Sin fuentes inventadas: los
 * SKU sin venta o sin dato caen a "sin_venta".
 */
export function usePurchaseQuality(): UsePurchaseQualityResult {
  const catalog = useProductsCatalog();
  const { rules, configured: rulesConfigured } = useRules();

  // Objetivo global + overrides por categoría desde las reglas reales activas.
  const { globalTarget, byCategory } = useMemo(() => {
    let g = DEFAULT_TARGET_COVERAGE;
    const cat = new Map<string, number>();
    for (const r of rules) {
      if (r.key !== TARGET_KEY || !r.active) continue;
      const value = typeof r.value === "number" ? r.value : Number(r.value);
      if (!Number.isFinite(value)) continue;
      if (r.scopeType === "global") g = value;
      else if (r.scopeType === "category" && r.scopeRef) cat.set(r.scopeRef, value);
    }
    return { globalTarget: g, byCategory: cat };
  }, [rules]);

  const lines = useMemo<PurchaseQualityLine[]>(() => {
    return catalog.rows.map((row) => {
      const target =
        (row.categoryId ? byCategory.get(row.categoryId) : undefined) ?? globalTarget;
      const { objMin, objMax } = targetRange(target);
      const dailyDemand = row.sales30Units != null ? row.sales30Units / 30 : null;
      const klass = classifyCoverage(row.coverageDays, dailyDemand, objMin, objMax);
      const stockValueClp =
        row.stockAvailable != null && row.unitCost != null
          ? row.stockAvailable * row.unitCost
          : null;
      return {
        sku: row.sku,
        productName: row.name,
        supplierName: row.supplierName ?? "Sin proveedor",
        categoryName: row.categoryName ?? "—",
        stockUnits: row.stockAvailable,
        stockValueClp,
        dailyDemand,
        coverageDays: row.coverageDays,
        objMin,
        objMax,
        klass,
      };
    });
  }, [catalog.rows, byCategory, globalTarget]);

  return {
    lines,
    loading: catalog.loading,
    error: catalog.error,
    configured: catalog.configured && rulesConfigured,
    refetch: catalog.refetch,
  };
}

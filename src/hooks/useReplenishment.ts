import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCategoryScope } from "../components/business/ScopeToggle";
import {
  isPurchaseBffConfigured,
  patchRecommendation,
  searchReplenishment,
  toPurchaseBffError,
  type BffPriority,
  type BffRecommendationStatus,
  type BffWarning,
  type PatchedRecommendation,
  type PurchaseBffError,
  type RecommendationPatchBody,
  type ReplenishmentMeta,
  type ReplenishmentRow,
} from "../services/purchaseBff";
import type { Priority, PurchaseRecommendation, RecommendationStatus } from "../types/purchasing";

// ============================================================================
//  Hook de recomendaciones reales (purchase-bff-service) para la vista de
//  Decisiones de compra / Reposición. Trae la primera página completa (100)
//  y deja el filtrado fino al cliente, igual que con los mocks.
//
//  MAPEO BFF → tipos del frontend (decisión documentada):
//  ---------------------------------------------------------------------------
//  Prioridad (backend priority → Priority del front):
//    stockout_imminent → "high"    (quiebre inminente = máxima urgencia)
//    low_stock         → "medium"
//    opportunity       → "low"
//  Estado (backend status + priority → RecommendationStatus del front):
//    Los mocks correlacionan prioridad y estado (high+critical, high/medium+
//    buy_now, medium/low+review, low+overstock), así que "pending" se traduce
//    según la prioridad del motor:
//    pending + stockout_imminent → "critical"  (comprar ya, riesgo de quiebre)
//    pending + low_stock         → "buy_now"   (comprar pronto)
//    pending + opportunity       → "review"    (oportunidad: revisar antes)
//    in_cart / ordered           → "normal"    (no existe "en proceso" en el
//                                  front; "normal" = sin acción urgente y así
//                                  no vuelve a empujarse una compra ya iniciada)
//    ignored / snoozed           → "normal" como estado visual, pero quedan
//                                  FUERA del conjunto visible por defecto,
//                                  exactamente como el antiguo rec-ignored.
// ============================================================================

export function mapPriority(priority: BffPriority): Priority {
  if (priority === "stockout_imminent") return "high";
  if (priority === "low_stock") return "medium";
  return "low";
}

export function mapStatus(
  status: BffRecommendationStatus,
  priority: BffPriority
): RecommendationStatus {
  if (status === "pending") {
    if (priority === "stockout_imminent") return "critical";
    if (priority === "low_stock") return "buy_now";
    return "review";
  }
  // in_cart / ordered / ignored / snoozed: sin acción urgente pendiente.
  return "normal";
}

/** Recomendación del front + estado original del backend (para excluir ignoradas). */
export interface ReplenishmentRecommendation extends PurchaseRecommendation {
  sourceStatus: BffRecommendationStatus;
}

/** ¿La fila queda fuera de la vista por defecto (como el antiguo rec-ignored)? */
export function isHiddenByDefault(rec: ReplenishmentRecommendation): boolean {
  return rec.sourceStatus === "ignored" || rec.sourceStatus === "snoozed";
}

/** Mapeo puro Fila BFF → PurchaseRecommendation del front (todos los null cubiertos). */
export function mapRowToRecommendation(row: ReplenishmentRow): ReplenishmentRecommendation {
  const unitCost = row.cost?.unitCost ?? 0;
  const salesLast30Days =
    row.salesLast30d ??
    (row.sales.dailyVelocity !== null ? Math.round(row.sales.dailyVelocity * 30) : 0);
  return {
    id: row.recommendationId,
    sku: row.sku,
    productName: row.name,
    category: row.category.name ?? "—",
    brand: row.brand ?? "—",
    supplierName: row.supplier.name ?? row.supplier.id ?? "—",
    currentStock: row.stockOnHand ?? row.stock?.available ?? 0,
    committedStock: row.stockReserved ?? 0,
    availableStock: row.stock?.available ?? 0,
    salesLast30Days,
    salesLast90Days: row.salesLast90d ?? 0,
    rotation: row.rotation ?? 0,
    inventoryDays: row.coverageDays ?? 0,
    minStock: row.minStock ?? 0,
    maxStock: row.maxStock ?? 0,
    reorderPoint: row.reorderPoint ?? 0,
    supplierLeadTimeDays: row.leadTimeDays ?? 0,
    suggestedQuantity: row.suggestedQty,
    unitCost,
    suggestedPurchaseAmount: row.suggestedAmountClp ?? row.suggestedQty * unitCost,
    margin: row.marginPct ?? 0,
    priority: mapPriority(row.priority),
    status: mapStatus(row.status, row.priority),
    reason: row.reason ?? "",
    risk: row.risk ?? "",
    sourceStatus: row.status,
  };
}

/**
 * Actualiza la fila cruda con la respuesta del PATCH (puro, testeable).
 * Tras un override el monto del motor queda obsoleto: se anula para que el
 * mapeo lo recalcule con cantidad × costo.
 */
export function mergePatchedRow(
  row: ReplenishmentRow,
  patched: PatchedRecommendation
): ReplenishmentRow {
  const suggestedQtyOriginal = patched.suggestedQty ?? row.suggestedQtyOriginal;
  const overrideQty = patched.overrideQty !== undefined ? patched.overrideQty : row.overrideQty;
  const suggestedQty = overrideQty ?? suggestedQtyOriginal;
  return {
    ...row,
    status: patched.status ?? row.status,
    version: patched.version ?? row.version,
    overrideQty,
    suggestedQtyOriginal,
    suggestedQty,
    suggestedAmountClp: suggestedQty === row.suggestedQty ? row.suggestedAmountClp : null,
  };
}

export type ApplyActionResult = { ok: true } | { ok: false; error: PurchaseBffError };

export interface UseReplenishmentResult {
  /** Todas las filas mapeadas (incluye ignoradas/pospuestas; ver sourceStatus). */
  rows: ReplenishmentRecommendation[];
  meta: ReplenishmentMeta | null;
  warnings: BffWarning[];
  loading: boolean;
  error: PurchaseBffError | null;
  /** ¿Hay VITE_PURCHASE_BFF_URL configurada? */
  configured: boolean;
  refetch: () => void;
  /** PATCH de una recomendación (override/ignore/snooze) con If-Match. */
  applyAction: (id: string, body: RecommendationPatchBody) => Promise<ApplyActionResult>;
}

export function useReplenishment(): UseReplenishmentResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { scope } = useCategoryScope();

  const [rawRows, setRawRows] = useState<ReplenishmentRow[]>([]);
  const [meta, setMeta] = useState<ReplenishmentMeta | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);

  // Refs para evitar cierres obsoletos (carreras entre cargas y acciones).
  const rawRowsRef = useRef<ReplenishmentRow[]>([]);
  rawRowsRef.current = rawRows;
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
        sort: [
          { field: "priority", order: "desc" },
          { field: "coverageDays", order: "asc" },
        ],
      });
      if (seq !== requestSeq.current) return;
      setRawRows(data.items);
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

  const applyAction = useCallback(
    async (id: string, body: RecommendationPatchBody): Promise<ApplyActionResult> => {
      const row = rawRowsRef.current.find((r) => r.recommendationId === id);
      if (!row) {
        return {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "La recomendación ya no está en la vista.",
            statusCode: 404,
            retryable: false,
          },
        };
      }
      try {
        const patched = await patchRecommendation(id, row.version, body);
        setRawRows((prev) =>
          prev.map((r) => (r.recommendationId === id ? mergePatchedRow(r, patched) : r))
        );
        return { ok: true };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        // Edición concurrente: la fila cambió en el servidor → recargar la lista.
        if (info.code === "VERSION_CONFLICT") void load();
        return { ok: false, error: info };
      }
    },
    [handleUnauthenticated, load]
  );

  const rows = useMemo(() => rawRows.map(mapRowToRecommendation), [rawRows]);
  const warnings = useMemo(() => meta?.warnings ?? [], [meta]);

  return {
    rows,
    meta,
    warnings,
    loading,
    error,
    configured,
    refetch: () => void load(),
    applyAction,
  };
}

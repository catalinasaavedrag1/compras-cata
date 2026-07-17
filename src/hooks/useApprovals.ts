import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  decideApproval,
  isPurchaseBffConfigured,
  listApprovals,
  toPurchaseBffError,
  type ApprovalAction,
  type ApprovalItem,
  type ApprovalState,
  type BffPageMeta,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Bandeja real de aprobaciones (purchase-bff-service):
//  - useApprovals(state): lista por estado (chips) + decidir con If-Match.
//  - usePendingApprovalsCount(): conteo liviano para badges/KPIs
//    (GET /approvals?state=pending&pageSize=1 → meta.total), con degradación
//    silenciosa a 0 si el servicio no responde.
// ============================================================================

/** Estados de la UI (chips en español) ↔ estados del contrato. */
export type UiApprovalState = "pendiente" | "observada" | "aprobada" | "rechazada";

export const UI_TO_API_STATE: Record<UiApprovalState, ApprovalState> = {
  pendiente: "pending",
  observada: "observed",
  aprobada: "approved",
  rechazada: "rejected",
};

export type DecideResult = { ok: true; approval: ApprovalItem } | { ok: false; error: PurchaseBffError };

export interface UseApprovalsResult {
  items: ApprovalItem[];
  meta: BffPageMeta | null;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  /** Decide con If-Match (versión de la aprobación). reason va en reject/observar. */
  decide: (
    id: string,
    action: ApprovalAction,
    version: number,
    body: { reason?: string; note?: string }
  ) => Promise<DecideResult>;
}

export function useApprovals(state: UiApprovalState): UseApprovalsResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [meta, setMeta] = useState<BffPageMeta | null>(null);
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
      const data = await listApprovals({ state: UI_TO_API_STATE[state], page: 1, pageSize: 50 });
      if (seq !== requestSeq.current) return;
      setItems(data.items);
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
  }, [configured, state, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (
      id: string,
      action: ApprovalAction,
      version: number,
      body: { reason?: string; note?: string }
    ): Promise<DecideResult> => {
      try {
        const approval = await decideApproval(id, action, version, body);
        invalidatePendingApprovalsCount();
        await load();
        return { ok: true, approval };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        // Decisión concurrente: la bandeja cambió en el servidor → recargar.
        if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") void load();
        return { ok: false, error: info };
      }
    },
    [load, handleUnauthenticated]
  );

  return useMemo(
    () => ({ items, meta, loading, error, configured, refetch: () => void load(), decide }),
    [items, meta, loading, error, configured, load, decide]
  );
}

// ----------------------------------------------------------------------------
//  Conteo liviano de pendientes (badges de navegación / barra de proceso)
// ----------------------------------------------------------------------------

let cachedPendingCount: number | null = null;
let pendingInflight: Promise<number> | null = null;

function fetchPendingCount(): Promise<number> {
  pendingInflight ??= listApprovals({ state: "pending", page: 1, pageSize: 1 })
    .then((data) => {
      cachedPendingCount = data.meta.total;
      return data.meta.total;
    })
    .catch(() => cachedPendingCount ?? 0)
    .finally(() => {
      pendingInflight = null;
    });
  return pendingInflight;
}

/** Invalida el conteo cacheado (tras decidir o enviar a revisión). */
export function invalidatePendingApprovalsCount(): void {
  cachedPendingCount = null;
}

/**
 * Conteo de aprobaciones pendientes con degradación silenciosa a 0 cuando el
 * BFF no está configurado o falla la llamada.
 */
export function usePendingApprovalsCount(): number {
  const [count, setCount] = useState(cachedPendingCount ?? 0);

  useEffect(() => {
    if (!isPurchaseBffConfigured()) return;
    let active = true;
    void fetchPendingCount().then((n) => {
      if (active) setCount(n);
    });
    return () => {
      active = false;
    };
  }, []);

  return count;
}

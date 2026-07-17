import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createReception,
  getReception,
  isPurchaseBffConfigured,
  listReceptions,
  patchReception,
  toPurchaseBffError,
  type CreateReceptionBody,
  type PurchaseBffError,
  type ReceptionDetailView,
  type ReceptionItemView,
  type ReceptionSummaryView,
  type ReceptionTransitionAction,
} from "../services/purchaseBff";

// ============================================================================
//  Recepciones reales del purchase-bff-service (flujo 4).
//  - Lista completa en una página grande (pageSize 100); los filtros de la
//    pantalla (pestañas, texto, proveedor, fechas) siguen siendo client-side,
//    igual que en los flujos previos.
//  - Las recepciones con diferencias traen además sus items (detalle bajo
//    demanda acotado) para alimentar la pestaña "No despachado".
//  - Transiciones C21 con If-Match; VERSION_CONFLICT / CONFLICT recargan la
//    lista para reflejar la realidad. UNAUTHENTICATED cierra la sesión.
// ============================================================================

const PAGE_SIZE = 100;
/** Tope de detalles a traer para las recepciones con diferencias. */
const MAX_DETAIL_FETCHES = 30;

/** Fila del listado; `items` solo presente si se trajo el detalle (diferencias). */
export interface ReceptionListRow extends ReceptionSummaryView {
  items?: ReceptionItemView[];
}

export type ReceptionActionResult =
  | { ok: true; reception: ReceptionDetailView }
  | { ok: false; error: PurchaseBffError };

export interface UseReceptionsResult {
  receptions: ReceptionListRow[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  /** Detalle bajo demanda (fila de la tabla → drawer). */
  fetchDetail: (id: string) => Promise<ReceptionActionResult>;
  /** Deep-link ?rid= (id interno o displayId): resuelve vía la API y trae el detalle. */
  fetchByRid: (rid: string) => Promise<ReceptionActionResult>;
  /** PATCH C21: transición de la máquina de estados (If-Match). */
  applyTransition: (
    id: string,
    version: number,
    action: ReceptionTransitionAction,
    reason?: string
  ) => Promise<ReceptionActionResult>;
  /** POST C21: registra una recepción contra una OC emitida (nace en checking). */
  register: (body: CreateReceptionBody) => Promise<ReceptionActionResult>;
}

const NOT_FOUND_BY_RID: PurchaseBffError = {
  code: "NOT_FOUND",
  message: "No se encontró la recepción indicada.",
  statusCode: 404,
  retryable: false,
};

export function useReceptions(): UseReceptionsResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [rows, setRows] = useState<ReceptionListRow[]>([]);
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
      const page = await listReceptions({ page: 1, pageSize: PAGE_SIZE });
      let items: ReceptionListRow[] = page.items;
      // La lista viene sin items: para "No despachado" (líneas con faltante)
      // se traen los detalles de las recepciones con diferencias, acotado.
      const withDiscrepancy = items
        .filter((r) => r.status === "discrepancy")
        .slice(0, MAX_DETAIL_FETCHES);
      if (withDiscrepancy.length > 0) {
        const details = await Promise.allSettled(
          withDiscrepancy.map((r) => getReception(r.id))
        );
        const byId = new Map<string, ReceptionDetailView>();
        details.forEach((result) => {
          if (result.status === "fulfilled" && result.value?.id) {
            byId.set(result.value.id, result.value);
          }
        });
        items = items.map((r) => {
          const detail = byId.get(r.id);
          return detail?.items ? { ...r, items: detail.items } : r;
        });
      }
      if (seq !== requestSeq.current) return;
      setRows(items);
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

  /** Refleja en la lista el estado fresco que devuelve un comando o detalle. */
  const applyDetailToRows = useCallback((detail: ReceptionDetailView) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === detail.id
          ? {
              ...r,
              status: detail.status,
              hasDiscrepancy: detail.hasDiscrepancy,
              expectedDate: detail.expectedDate,
              version: detail.version,
              itemCount: detail.items?.length ?? r.itemCount,
              items: detail.items ?? r.items,
            }
          : r
      )
    );
  }, []);

  const runQuery = useCallback(
    async (query: () => Promise<ReceptionDetailView>): Promise<ReceptionActionResult> => {
      try {
        const reception = await query();
        applyDetailToRows(reception);
        return { ok: true, reception };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        return { ok: false, error: info };
      }
    },
    [applyDetailToRows, handleUnauthenticated]
  );

  const fetchDetail = useCallback(
    (id: string) => runQuery(() => getReception(id)),
    [runQuery]
  );

  const fetchByRid = useCallback(
    async (rid: string): Promise<ReceptionActionResult> => {
      try {
        // El rid puede ser id interno o displayId: el dominio lo resuelve.
        const page = await listReceptions({ rid, page: 1, pageSize: 1 });
        const match = page.items[0];
        if (!match) return { ok: false, error: NOT_FOUND_BY_RID };
        const reception = await getReception(match.id);
        applyDetailToRows(reception);
        return { ok: true, reception };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
        return { ok: false, error: info };
      }
    },
    [applyDetailToRows, handleUnauthenticated]
  );

  const applyTransition = useCallback(
    async (
      id: string,
      version: number,
      action: ReceptionTransitionAction,
      reason?: string
    ): Promise<ReceptionActionResult> => {
      try {
        const reception = await patchReception(
          id,
          version,
          action === "reject" ? { action, reason: reason ?? "" } : { action }
        );
        applyDetailToRows(reception);
        return { ok: true, reception };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        // Versión o estado obsoletos: recargar para reflejar la realidad.
        if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") {
          void load();
        }
        return { ok: false, error: info };
      }
    },
    [applyDetailToRows, handleUnauthenticated, load]
  );

  const register = useCallback(
    async (body: CreateReceptionBody): Promise<ReceptionActionResult> => {
      try {
        const reception = await createReception(body);
        void load();
        return { ok: true, reception };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        return { ok: false, error: info };
      }
    },
    [handleUnauthenticated, load]
  );

  return useMemo(
    () => ({
      receptions: rows,
      loading,
      error,
      configured,
      refetch: () => void load(),
      fetchDetail,
      fetchByRid,
      applyTransition,
      register,
    }),
    [rows, loading, error, configured, load, fetchDetail, fetchByRid, applyTransition, register]
  );
}

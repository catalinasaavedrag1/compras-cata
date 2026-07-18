import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createDocument,
  isPurchaseBffConfigured,
  listDocuments,
  toPurchaseBffError,
  type ProcurementDocView,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Repositorio documental real (F16): GET /documents del purchase-bff.
//  - Los filtros (`kind`, `refEntity`/`refId`, `supplierId`, `q`) se resuelven
//    en el backend; `q` lleva un pequeño debounce para no pedir por tecla.
//  - `register` (POST 🔑) crea la referencia al DMS y recarga la lista: aquí
//    solo viven metadatos + dmsRef, el binario permanece en el DMS.
//  Guardia de carrera (requestSeq) y logout ante UNAUTHENTICATED, como useBudget.
// ============================================================================

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 100;

export interface DocumentFilters {
  /** Tipo de documento ("" = todos). */
  kind?: string;
  /** Entidad referida (purchase_order, supplier, …). */
  refEntity?: string;
  refId?: string;
  supplierId?: string;
  /** Búsqueda libre (título / referencia); se envía al backend con debounce. */
  q?: string;
}

export type DocumentActionResult =
  | { ok: true; document: ProcurementDocView }
  | { ok: false; error: PurchaseBffError };

export interface UseDocumentsResult {
  documents: ProcurementDocView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  /** POST /documents — registrar la referencia DMS de un documento. */
  register: (body: {
    kind: string;
    title: string;
    refEntity?: string;
    refId?: string;
    supplierId?: string;
    dmsRef: string;
  }) => Promise<DocumentActionResult>;
}

export function useDocuments(filters: DocumentFilters = {}): UseDocumentsResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const kind = filters.kind ?? "";
  const refEntity = filters.refEntity ?? "";
  const refId = filters.refId ?? "";
  const supplierId = filters.supplierId ?? "";
  const q = filters.q ?? "";

  // q cambia por tecla: la petición espera al valor estable.
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  const [rows, setRows] = useState<ProcurementDocView[]>([]);
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
      const page = await listDocuments({
        kind: kind || undefined,
        refEntity: refEntity || undefined,
        refId: refId || undefined,
        supplierId: supplierId || undefined,
        q: debouncedQ.trim() || undefined,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      if (seq !== requestSeq.current) return;
      setRows(page.items);
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
  }, [configured, kind, refEntity, refId, supplierId, debouncedQ, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  const register = useCallback(
    async (body: {
      kind: string;
      title: string;
      refEntity?: string;
      refId?: string;
      supplierId?: string;
      dmsRef: string;
    }): Promise<DocumentActionResult> => {
      try {
        const document = await createDocument(body);
        void load();
        return { ok: true, document };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
        return { ok: false, error: info };
      }
    },
    [handleUnauthenticated, load]
  );

  return useMemo(
    () => ({ documents: rows, loading, error, configured, refetch: () => void load(), register }),
    [rows, loading, error, configured, load, register]
  );
}

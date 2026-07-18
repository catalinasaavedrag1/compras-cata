import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  addImportDoc,
  createImport,
  getImport,
  isPurchaseBffConfigured,
  listImports,
  patchImport,
  toPurchaseBffError,
  type ImportStage,
  type ImportView,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Importaciones reales del purchase-bff-service (F16): GET /imports + comandos.
//  - Los filtros `stage` y `q` se resuelven en el backend; `q` lleva un pequeño
//    debounce para no pedir por tecla (patrón useSuppliersPanel).
//  - Comandos: abrir seguimiento (POST 🔑), avanzar etapa / editar ETA-forwarder
//    (PATCH con If-Match; el pipeline solo avanza — retroceder da 409) y
//    registrar documento (POST 🔑). Cada comando devuelve la vista fresca y la
//    refleja en la lista; VERSION_CONFLICT / CONFLICT recargan para alinear.
//  Guardia de carrera (requestSeq) y logout ante UNAUTHENTICATED, como useBudget.
// ============================================================================

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 100;

export interface ImportFilters {
  /** Etapa del pipeline ("" = todas). */
  stage?: ImportStage | "";
  /** Búsqueda libre (OC / forwarder); se envía al backend con debounce. */
  q?: string;
}

export type ImportActionResult =
  | { ok: true; import: ImportView }
  | { ok: false; error: PurchaseBffError };

export interface UseImportsResult {
  imports: ImportView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  /** Detalle fresco (historia de etapas + documentos) bajo demanda. */
  fetchDetail: (id: string) => Promise<ImportActionResult>;
  /** POST /imports — abrir seguimiento (OC opcional). */
  create: (body: {
    purchaseOrderId?: string;
    etaDate?: string;
    forwarderRef?: string;
  }) => Promise<ImportActionResult>;
  /** PATCH /imports/:id — avanzar a la etapa siguiente (If-Match). */
  advance: (
    id: string,
    version: number,
    nextStage: Exclude<ImportStage, "po">
  ) => Promise<ImportActionResult>;
  /** POST /imports/:id/docs — registrar referencia documental del DMS. */
  addDoc: (id: string, body: { kind: string; dmsRef: string }) => Promise<ImportActionResult>;
}

export function useImports(filters: ImportFilters = {}): UseImportsResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const stage = filters.stage ?? "";
  const q = filters.q ?? "";

  // q cambia por tecla: la petición espera al valor estable.
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  const [rows, setRows] = useState<ImportView[]>([]);
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
      const page = await listImports({
        stage: stage || undefined,
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
  }, [configured, stage, debouncedQ, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Refleja en la lista la vista fresca que devuelve un comando o detalle. */
  const applyToRows = useCallback((view: ImportView) => {
    setRows((prev) => prev.map((r) => (r.id === view.id ? view : r)));
  }, []);

  const fetchDetail = useCallback(
    async (id: string): Promise<ImportActionResult> => {
      try {
        const view = await getImport(id);
        applyToRows(view);
        return { ok: true, import: view };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
        return { ok: false, error: info };
      }
    },
    [applyToRows, handleUnauthenticated]
  );

  const create = useCallback(
    async (body: {
      purchaseOrderId?: string;
      etaDate?: string;
      forwarderRef?: string;
    }): Promise<ImportActionResult> => {
      try {
        const view = await createImport(body);
        void load();
        return { ok: true, import: view };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
        return { ok: false, error: info };
      }
    },
    [handleUnauthenticated, load]
  );

  const advance = useCallback(
    async (
      id: string,
      version: number,
      nextStage: Exclude<ImportStage, "po">
    ): Promise<ImportActionResult> => {
      try {
        const view = await patchImport(id, version, { stage: nextStage });
        applyToRows(view);
        return { ok: true, import: view };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        // Versión o etapa obsoletas (el pipeline solo avanza): recargar.
        if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") {
          void load();
        }
        return { ok: false, error: info };
      }
    },
    [applyToRows, handleUnauthenticated, load]
  );

  const addDoc = useCallback(
    async (id: string, body: { kind: string; dmsRef: string }): Promise<ImportActionResult> => {
      try {
        const view = await addImportDoc(id, body);
        applyToRows(view);
        return { ok: true, import: view };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
        return { ok: false, error: info };
      }
    },
    [applyToRows, handleUnauthenticated]
  );

  return useMemo(
    () => ({
      imports: rows,
      loading,
      error,
      configured,
      refetch: () => void load(),
      fetchDetail,
      create,
      advance,
      addDoc,
    }),
    [rows, loading, error, configured, load, fetchDetail, create, advance, addDoc]
  );
}

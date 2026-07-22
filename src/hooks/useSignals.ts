import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  addSignalComment,
  createSignal,
  getSignal,
  isPurchaseBffConfigured,
  listSignals,
  patchSignal,
  toPurchaseBffError,
  type PurchaseBffError,
  type ReplenishmentMeta,
  type SignalBffPriority,
  type SignalBffStatus,
  type SignalDetailData,
  type SignalDetails,
  type SignalMessageView,
  type SignalView,
} from "../services/purchaseBff";

// ============================================================================
//  Señales de venta reales (F13): GET /signals, GET /signals/:id y comandos.
//  - useSignalsList(filters): bandeja con filtros que resuelve el backend
//    (status/kind/sku/q). Guardia de carrera + logout ante UNAUTHENTICATED.
//  - useSignalDetail(id): detalle con hilo de mensajes y bloque de apoyo.
//  - useSignalCommands: envuelve POST /signals, PATCH /signals/:id (If-Match)
//    y POST /signals/:id/comments con el manejo de errores estándar
//    (UNAUTHENTICATED ⇒ logout; VERSION_CONFLICT/CONFLICT ⇒ onConflict).
// ============================================================================

const PAGE_SIZE = 100;

export interface SignalListFilters {
  status?: SignalBffStatus;
  kind?: string;
  sku?: string;
  q?: string;
}

export interface UseSignalsListResult {
  signals: SignalView[];
  meta: ReplenishmentMeta | null;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useSignalsList(
  filters: SignalListFilters = {},
  options: { enabled?: boolean } = {}
): UseSignalsListResult {
  const configured = isPurchaseBffConfigured();
  const enabled = options.enabled ?? true;
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { status, kind, sku, q } = filters;

  const [signals, setSignals] = useState<SignalView[]>([]);
  const [meta, setMeta] = useState<ReplenishmentMeta | null>(null);
  const [loading, setLoading] = useState(configured && enabled);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const load = useCallback(async () => {
    if (!configured || !enabled) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const page = await listSignals({ status, kind, sku, q, page: 1, pageSize: PAGE_SIZE });
      if (seq !== requestSeq.current) return;
      setSignals(page.items);
      setMeta(page.meta);
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
  }, [configured, enabled, status, kind, sku, q, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ signals, meta, loading, error, configured, refetch: () => void load() }),
    [signals, meta, loading, error, configured, load]
  );
}

export interface UseSignalDetailResult {
  detail: SignalDetailData | null;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useSignalDetail(id: string | null): UseSignalDetailResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [detail, setDetail] = useState<SignalDetailData | null>(null);
  const [loading, setLoading] = useState(configured && !!id);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const load = useCallback(async () => {
    if (!configured || !id) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getSignal(id);
      if (seq !== requestSeq.current) return;
      setDetail(data);
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
  }, [configured, id, handleUnauthenticated]);

  // Al cambiar de señal se limpia el detalle anterior para no mostrarlo stale.
  useEffect(() => {
    setDetail(null);
    setError(null);
    void load();
  }, [load]);

  return useMemo(
    () => ({ detail, loading, error, configured, refetch: () => void load() }),
    [detail, loading, error, configured, load]
  );
}

// ----------------------------------------------------------------------------
//  Comandos (POST 🔑 / PATCH If-Match / comentarios)
// ----------------------------------------------------------------------------

/** Estados alcanzables desde la UI (la máquina real: new → in_review → actioned | dismissed). */
export type SignalTargetStatus = "in_review" | "actioned" | "dismissed";

export interface CreateSignalInput {
  kind: string;
  body: string;
  sku?: string;
  storeRef?: string;
  priority?: SignalBffPriority;
  details?: SignalDetails;
}

export type SignalCommandResult =
  | { ok: true; signal: SignalView }
  | { ok: false; error: PurchaseBffError };

export type SignalCommentResult =
  | { ok: true; message: SignalMessageView }
  | { ok: false; error: PurchaseBffError };

export interface SignalCommands {
  /** POST /signals — reportar una señal desde el terreno. */
  report: (input: CreateSignalInput) => Promise<SignalCommandResult>;
  /** PATCH /signals/:id — transición de estado (dismissed exige reason). */
  transition: (
    id: string,
    version: number,
    status: SignalTargetStatus,
    reason?: string
  ) => Promise<SignalCommandResult>;
  /** PATCH /signals/:id — cambio de prioridad. */
  setPriority: (
    id: string,
    version: number,
    priority: SignalBffPriority
  ) => Promise<SignalCommandResult>;
  /** POST /signals/:id/comments — comentario del hilo vendedor ↔ comprador. */
  comment: (id: string, body: string) => Promise<SignalCommentResult>;
}

export function useSignalCommands(options: { onConflict?: () => void } = {}): SignalCommands {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { onConflict } = options;

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const handleError = useCallback(
    (err: unknown): { ok: false; error: PurchaseBffError } => {
      const info = toPurchaseBffError(err);
      if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
      // Versión o estado obsoletos: el caller recarga para reflejar la realidad.
      else if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") onConflict?.();
      return { ok: false, error: info };
    },
    [handleUnauthenticated, onConflict]
  );

  return useMemo<SignalCommands>(
    () => ({
      report: async (input) => {
        try {
          return { ok: true, signal: await createSignal(input) };
        } catch (err) {
          return handleError(err);
        }
      },
      transition: async (id, version, status, reason) => {
        try {
          return { ok: true, signal: await patchSignal(id, version, { status, reason }) };
        } catch (err) {
          return handleError(err);
        }
      },
      setPriority: async (id, version, priority) => {
        try {
          return { ok: true, signal: await patchSignal(id, version, { priority }) };
        } catch (err) {
          return handleError(err);
        }
      },
      comment: async (id, body) => {
        try {
          return { ok: true, message: await addSignalComment(id, { body }) };
        } catch (err) {
          return handleError(err);
        }
      },
    }),
    [handleError]
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createExport,
  describePurchaseBffError,
  getExport,
  getExportCatalog,
  isPurchaseBffConfigured,
  listExports,
  toPurchaseBffError,
  type ExportCatalogItem,
  type ExportJobView,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Exportaciones E13 (F17) del purchase-bff:
//  - useExportCatalog(): catálogo de reportes disponibles (GET /exports/catalog).
//  - useExportJobs(): mis jobs recientes con refetch manual (GET /exports).
//  - useLaunchExport(): encapsula el ciclo crear (202) → pollear → descargar,
//    con estado por reportId. El runner del backend procesa en segundo plano:
//    si tras ~60 s el job sigue "pending" (runner apagado en dev, cola larga),
//    se corta el polling y se reporta "stalled" en vez de fingir progreso.
//  Guardia de carrera (requestSeq) y logout ante UNAUTHENTICATED, como useBudget.
// ============================================================================

const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_ATTEMPTS = 20; // ~60 s en total.

/** Fase visible del lanzamiento de un reporte (por reportId). */
export type ExportLaunchPhase = "idle" | "queued" | "running" | "done" | "failed" | "stalled";

export interface ExportLaunchState {
  phase: ExportLaunchPhase;
  /** Id del job encolado (para seguirlo en la lista de recientes). */
  jobId: string | null;
  /** Filas exportadas (solo con phase === "done"). */
  rowCount: number | null;
  /** Mensaje de error legible (solo con phase === "failed"). */
  error: string | null;
}

const IDLE_STATE: ExportLaunchState = { phase: "idle", jobId: null, rowCount: null, error: null };

// ----------------------------------------------------------------------------
//  Descarga del CSV ya generado (viaja en GET /exports/:id cuando done).
// ----------------------------------------------------------------------------

/** Nombre de archivo: reportId + fecha de término (o creación) del job. */
export function exportFilename(job: ExportJobView): string {
  const date = (job.finishedAt ?? job.dateCreated ?? "").slice(0, 10);
  return date ? `${job.reportId}-${date}.csv` : `${job.reportId}.csv`;
}

/** Baja el CSV del job como archivo. Devuelve false si el job no trae CSV. */
export function downloadExportCsv(job: ExportJobView): boolean {
  if (typeof job.resultCsv !== "string") return false;
  const blob = new Blob([job.resultCsv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFilename(job);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

// ----------------------------------------------------------------------------
//  Hook interno: logout + redirección ante sesión vencida (patrón useBudget).
// ----------------------------------------------------------------------------

function useHandleUnauthenticated() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);
}

// ----------------------------------------------------------------------------
//  useExportCatalog — reportes disponibles.
// ----------------------------------------------------------------------------

export interface UseExportCatalogResult {
  items: ExportCatalogItem[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useExportCatalog(): UseExportCatalogResult {
  const configured = isPurchaseBffConfigured();
  const handleUnauthenticated = useHandleUnauthenticated();

  const [items, setItems] = useState<ExportCatalogItem[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!configured) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getExportCatalog();
      if (seq !== requestSeq.current) return;
      setItems(result.items);
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

  return useMemo(
    () => ({ items, loading, error, configured, refetch: () => void load() }),
    [items, loading, error, configured, load]
  );
}

// ----------------------------------------------------------------------------
//  useExportJobs — jobs recientes, con refetch manual (botón "Refrescar").
// ----------------------------------------------------------------------------

export interface UseExportJobsResult {
  items: ExportJobView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useExportJobs(): UseExportJobsResult {
  const configured = isPurchaseBffConfigured();
  const handleUnauthenticated = useHandleUnauthenticated();

  const [items, setItems] = useState<ExportJobView[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!configured) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listExports();
      if (seq !== requestSeq.current) return;
      setItems(result.items);
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

  return useMemo(
    () => ({ items, loading, error, configured, refetch: () => void load() }),
    [items, loading, error, configured, load]
  );
}

// ----------------------------------------------------------------------------
//  useLaunchExport — crear (202) → pollear cada 3 s → descargar en done.
// ----------------------------------------------------------------------------

export interface UseLaunchExportResult {
  /** Estado por reportId; sin entrada = idle. */
  states: Record<string, ExportLaunchState>;
  /** Encola el reporte y sigue el job hasta done/failed/stalled. */
  launch: (reportId: string) => void;
}

export function useLaunchExport(options?: {
  /** Se llama cuando cambia el conjunto de jobs (encolado o terminado): útil para refrescar la lista. */
  onJobsChanged?: () => void;
}): UseLaunchExportResult {
  const handleUnauthenticated = useHandleUnauthenticated();

  const [states, setStates] = useState<Record<string, ExportLaunchState>>({});
  // Timers de polling activos por reportId, para limpiarlos al desmontar.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const mountedRef = useRef(true);
  // El callback vive en un ref para no re-crear launch cuando cambia.
  const onJobsChangedRef = useRef(options?.onJobsChanged);
  onJobsChangedRef.current = options?.onJobsChanged;

  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    return () => {
      mountedRef.current = false;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const patchState = useCallback((reportId: string, patch: Partial<ExportLaunchState>) => {
    if (!mountedRef.current) return;
    setStates((prev) => ({ ...prev, [reportId]: { ...(prev[reportId] ?? IDLE_STATE), ...patch } }));
  }, []);

  const launch = useCallback(
    (reportId: string) => {
      const current = states[reportId]?.phase;
      // No relanzar mientras hay un job en curso para el mismo reporte.
      if (current === "queued" || current === "running") return;

      const finish = (patch: Partial<ExportLaunchState>) => {
        timersRef.current.delete(reportId);
        patchState(reportId, patch);
        onJobsChangedRef.current?.();
      };

      const poll = (jobId: string, attempt: number) => {
        const timer = setTimeout(async () => {
          timersRef.current.delete(reportId);
          try {
            const job = await getExport(jobId);
            if (!mountedRef.current) return;
            if (job.status === "done") {
              // Descarga inmediata: el CSV viaja en el GET por id.
              downloadExportCsv(job);
              finish({ phase: "done", rowCount: job.rowCount, error: null });
              return;
            }
            if (job.status === "failed") {
              finish({ phase: "failed", error: job.error ?? "El backend no informó el motivo." });
              return;
            }
            // pending | running: honesto sobre en qué está el runner.
            patchState(reportId, { phase: job.status === "running" ? "running" : "queued" });
            if (attempt + 1 >= POLL_MAX_ATTEMPTS) {
              // Tope ~60 s: dejamos de pollear; el job sigue en la lista y se
              // puede refrescar manualmente desde "Exportaciones recientes".
              finish({ phase: "stalled" });
              return;
            }
            poll(jobId, attempt + 1);
          } catch (err) {
            if (!mountedRef.current) return;
            const info = toPurchaseBffError(err);
            if (info.code === "UNAUTHENTICATED") {
              handleUnauthenticated();
              return;
            }
            finish({ phase: "failed", error: describePurchaseBffError(info) });
          }
        }, POLL_INTERVAL_MS);
        timersRef.current.set(reportId, timer);
      };

      patchState(reportId, { phase: "queued", jobId: null, rowCount: null, error: null });
      void (async () => {
        try {
          const job = await createExport(reportId); // 202: encolado.
          if (!mountedRef.current) return;
          patchState(reportId, { jobId: job.id });
          onJobsChangedRef.current?.(); // El job ya aparece en la lista.
          poll(job.id, 0);
        } catch (err) {
          if (!mountedRef.current) return;
          const info = toPurchaseBffError(err);
          if (info.code === "UNAUTHENTICATED") {
            handleUnauthenticated();
            return;
          }
          patchState(reportId, { phase: "failed", error: describePurchaseBffError(info) });
        }
      })();
    },
    [states, patchState, handleUnauthenticated]
  );

  return useMemo(() => ({ states, launch }), [states, launch]);
}

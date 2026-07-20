import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createNpi,
  isPurchaseBffConfigured,
  listNpi,
  patchNpi,
  toPurchaseBffError,
  type NpiCandidateView,
  type NpiRisk,
  type NpiStage,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Candidatos NPI (nuevos productos, F25) del purchase-bff-service: GET /npi +
//  comandos POST/PATCH. Máquina de etapas real proposed → approved → pilot →
//  evaluation → scaled | rejected (aprobar/escalar/rechazar exigen
//  purchase:npi:approve; rechazar exige motivo ≥5). El PATCH viaja con If-Match:
//  versión/transición obsoleta ⇒ 409 (VERSION_CONFLICT/CONFLICT) y se recarga.
//  Guardia de carrera (requestSeq) y logout ante UNAUTHENTICATED, como useImports.
// ============================================================================

const PAGE_SIZE = 100;

export type NpiActionResult =
  | { ok: true; candidate: NpiCandidateView }
  | { ok: false; error: PurchaseBffError };

export interface CreateNpiBody {
  name: string;
  categoryId?: string;
  categoryName?: string;
  supplierRef?: string;
  supplierName?: string;
  costClp?: number;
  suggestedPriceClp?: number;
  comparableSku?: string;
  targetMarket?: string;
  initialBuyQty?: number;
  pilotStores?: number;
  initialForecastMonthly?: number;
  risk: NpiRisk;
}

export interface PatchNpiBody {
  stage?: Exclude<NpiStage, "proposed">;
  reason?: string;
  pilotResult?: string;
  costClp?: number;
  suggestedPriceClp?: number;
  initialBuyQty?: number;
  pilotStores?: number;
  initialForecastMonthly?: number;
  risk?: NpiRisk;
}

export interface UseNpiResult {
  candidates: NpiCandidateView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  /** POST /npi — proponer un nuevo candidato (nace en `proposed`). */
  create: (body: CreateNpiBody) => Promise<NpiActionResult>;
  /** PATCH /npi/:id — avanzar etapa y/o editar (If-Match). */
  patch: (id: string, version: number, body: PatchNpiBody) => Promise<NpiActionResult>;
}

export function useNpi(): UseNpiResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [rows, setRows] = useState<NpiCandidateView[]>([]);
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
      const page = await listNpi({ page: 1, pageSize: PAGE_SIZE });
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
  }, [configured, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Refleja en la lista la vista fresca que devuelve un comando. */
  const applyToRows = useCallback((view: NpiCandidateView) => {
    setRows((prev) => prev.map((r) => (r.id === view.id ? view : r)));
  }, []);

  const create = useCallback(
    async (body: CreateNpiBody): Promise<NpiActionResult> => {
      try {
        const view = await createNpi(body);
        void load();
        return { ok: true, candidate: view };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
        return { ok: false, error: info };
      }
    },
    [handleUnauthenticated, load]
  );

  const patch = useCallback(
    async (id: string, version: number, body: PatchNpiBody): Promise<NpiActionResult> => {
      try {
        const view = await patchNpi(id, version, body);
        applyToRows(view);
        return { ok: true, candidate: view };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        // Versión o transición obsoletas: recargar para alinear.
        if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") {
          void load();
        }
        return { ok: false, error: info };
      }
    },
    [applyToRows, handleUnauthenticated, load]
  );

  return useMemo(
    () => ({
      candidates: rows,
      loading,
      error,
      configured,
      refetch: () => void load(),
      create,
      patch,
    }),
    [rows, loading, error, configured, load, create, patch]
  );
}

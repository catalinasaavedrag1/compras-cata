import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  isPurchaseBffConfigured,
  listDecisions,
  toPurchaseBffError,
  type DecisionBffOutcome,
  type DecisionView,
  type PurchaseBffError,
  type ReplenishmentMeta,
} from "../services/purchaseBff";

// ============================================================================
//  Historial de decisiones real (flujo 14): GET /decisions del purchase-bff.
//  - Filtros `outcome`, `q` y `scope` se resuelven en el backend; `q` lleva un
//    debounce de 350 ms para no pedir por tecla.
//  - scope "mine" = decisiones del comprador de la sesión; "all" = todo el
//    equipo (vista del líder).
//  Guardia de carrera (requestSeq) y logout ante UNAUTHENTICATED, como useBudget.
// ============================================================================

const SEARCH_DEBOUNCE_MS = 350;

export interface UseDecisionsParams {
  /** Filtro por resultado del evaluador ("" = todos). */
  outcome?: DecisionBffOutcome | "";
  /** Búsqueda libre (resumen / SKU); se envía al backend con debounce. */
  q?: string;
  /** "mine" = mis decisiones; "all" = todo el equipo (líder). */
  scope: "mine" | "all";
}

export interface UseDecisionsResult {
  decisions: DecisionView[];
  meta: ReplenishmentMeta | null;
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
}

export function useDecisions({ outcome, q = "", scope }: UseDecisionsParams): UseDecisionsResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  // q viene de la URL (cambia por tecla): la petición espera al valor estable.
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  const [decisions, setDecisions] = useState<DecisionView[]>([]);
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
      const result = await listDecisions({
        outcome: outcome || undefined,
        q: debouncedQ.trim() || undefined,
        scope,
        pageSize: 100,
      });
      if (seq !== requestSeq.current) return;
      setDecisions(result.items);
      setMeta(result.meta);
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
  }, [configured, outcome, debouncedQ, scope, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ decisions, meta, loading, error, configured, refetch: () => void load() }),
    [decisions, meta, loading, error, configured, load]
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createRule,
  isPurchaseBffConfigured,
  listRules,
  patchRule,
  toPurchaseBffError,
  type PurchaseBffError,
  type RuleScopeType,
  type RuleView,
} from "../services/purchaseBff";

// ============================================================================
//  Reglas de compra reales (F20): GET /rules + comandos.
//  - Modelo genérico clave-valor por alcance (global/categoría/proveedor/
//    comprador): la vista agrupa/filtra en el cliente, así los tabs muestran
//    conteos por alcance sin pedir de nuevo.
//  - create (POST 🔑, solo purchase:rule:admin; regla activa duplicada por
//    alcance+clave ⇒ 409 CONFLICT_ERROR con details.existingId) y patch
//    (valor y/o activar-desactivar; el motivo SIEMPRE es obligatorio, auditado).
//  Guardia de carrera (requestSeq) y logout ante UNAUTHENTICATED, como useBudget.
// ============================================================================

const PAGE_SIZE = 200;

/** Gate visual de edición (mismo patrón candado que GoalsPage/Aprobaciones). */
export const RULE_ADMIN_PERMISSION = "purchase:rule:admin";

/** Clave namespaced en minúsculas con puntos (ej. replenishment.target_coverage_days). */
export const RULE_KEY_REGEX = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

export type RuleActionResult =
  | { ok: true; rule: RuleView }
  | { ok: false; error: PurchaseBffError };

export interface UseRulesResult {
  rules: RuleView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  /** POST /rules — alta (líder). Recarga la lista al crear. */
  create: (body: {
    scopeType: RuleScopeType;
    scopeRef?: string;
    key: string;
    value: unknown;
    reason: string;
  }) => Promise<RuleActionResult>;
  /** PATCH /rules/:id — cambiar valor y/o activar-desactivar (motivo obligatorio). */
  patch: (
    id: string,
    body: { value?: unknown; active?: boolean; reason: string }
  ) => Promise<RuleActionResult>;
}

export function useRules(): UseRulesResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [rules, setRules] = useState<RuleView[]>([]);
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
      const page = await listRules({ page: 1, pageSize: PAGE_SIZE });
      if (seq !== requestSeq.current) return;
      setRules(page.items);
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
  const applyToRules = useCallback((view: RuleView) => {
    setRules((prev) => prev.map((r) => (r.id === view.id ? view : r)));
  }, []);

  const create = useCallback(
    async (body: {
      scopeType: RuleScopeType;
      scopeRef?: string;
      key: string;
      value: unknown;
      reason: string;
    }): Promise<RuleActionResult> => {
      try {
        const view = await createRule(body);
        void load();
        return { ok: true, rule: view };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
        return { ok: false, error: info };
      }
    },
    [handleUnauthenticated, load]
  );

  const patch = useCallback(
    async (
      id: string,
      body: { value?: unknown; active?: boolean; reason: string }
    ): Promise<RuleActionResult> => {
      try {
        const view = await patchRule(id, body);
        applyToRules(view);
        return { ok: true, rule: view };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") handleUnauthenticated();
        return { ok: false, error: info };
      }
    },
    [applyToRules, handleUnauthenticated]
  );

  return useMemo(
    () => ({
      rules,
      loading,
      error,
      configured,
      refetch: () => void load(),
      create,
      patch,
    }),
    [rules, loading, error, configured, load, create, patch]
  );
}

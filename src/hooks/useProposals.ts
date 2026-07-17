import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  cancelProposal,
  isPurchaseBffConfigured,
  listProposals,
  submitProposal,
  toPurchaseBffError,
  type ProposalStatus,
  type ProposalView,
  type PurchaseBffError,
} from "../services/purchaseBff";
import { invalidatePendingApprovalsCount } from "./useApprovals";

// ============================================================================
//  Propuestas "en trabajo" para la pestaña Borradores de Órdenes de compra:
//  draft + in_review + changes_requested (el resto del ciclo — OC/SAP — es el
//  flujo siguiente). Acciones: enviar a revisión y cancelar, con If-Match.
// ============================================================================

/** Estados visibles en la pestaña Borradores. */
export const WORKING_STATUSES: ProposalStatus[] = ["draft", "in_review", "changes_requested"];

export type ProposalActionResult =
  | { ok: true; proposal: ProposalView }
  | { ok: false; error: PurchaseBffError };

export interface UseProposalsResult {
  proposals: ProposalView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  submit: (id: string, version: number) => Promise<ProposalActionResult>;
  cancel: (id: string, version: number, reason: string) => Promise<ProposalActionResult>;
}

export function useProposals(): UseProposalsResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [proposals, setProposals] = useState<ProposalView[]>([]);
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
      const pages = await Promise.all(
        WORKING_STATUSES.map((status) => listProposals({ status, page: 1, pageSize: 50 }))
      );
      if (seq !== requestSeq.current) return;
      const merged = pages
        .flatMap((page) => page.items)
        .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
      setProposals(merged);
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

  const runAction = useCallback(
    async (action: () => Promise<ProposalView>): Promise<ProposalActionResult> => {
      try {
        const proposal = await action();
        invalidatePendingApprovalsCount();
        await load();
        return { ok: true, proposal };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        // Edición concurrente o estado obsoleto: recargar la lista.
        if (
          info.code === "VERSION_CONFLICT" ||
          info.code === "CONFLICT" ||
          info.code === "PURCHASE_PROPOSAL_INVALID_STATE"
        ) {
          void load();
        }
        return { ok: false, error: info };
      }
    },
    [load, handleUnauthenticated]
  );

  const submit = useCallback(
    (id: string, version: number) => runAction(() => submitProposal(id, version)),
    [runAction]
  );

  const cancel = useCallback(
    (id: string, version: number, reason: string) =>
      runAction(() => cancelProposal(id, version, reason)),
    [runAction]
  );

  return useMemo(
    () => ({ proposals, loading, error, configured, refetch: () => void load(), submit, cancel }),
    [proposals, loading, error, configured, load, submit, cancel]
  );
}

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";
import { approvalRequests as seedApprovals, type ApprovalRequest } from "../data/mockApprovals";
import { purchaseDecisions as seedDecisions, type PurchaseDecision } from "../data/mockDecisions";

// ============================================================================
//  Flujo de compra: cierra el ciclo sugerir → aprobar → comprar → medir.
//  Mantiene en runtime (persistido) las aprobaciones y decisiones generadas al
//  crear órdenes que se desvían del sugerido, además de las semilla mock.
// ============================================================================

export type ApprovalState =
  | "pendiente"
  | "en_analisis"
  | "observada"
  | "aprobada"
  | "rechazada";

interface PurchaseFlowValue {
  approvals: ApprovalRequest[];
  decisions: PurchaseDecision[];
  approvalState: Record<string, ApprovalState>;
  /** Observación del aprobador cuando devuelve la solicitud (estado "observada"). */
  observations: Record<string, string>;
  pendingApprovalsCount: number;
  addApproval: (a: ApprovalRequest) => void;
  addDecision: (d: PurchaseDecision) => void;
  setApprovalState: (id: string, state: ApprovalState, note?: string) => void;
}

const PurchaseFlowContext = createContext<PurchaseFlowValue | null>(null);

export function PurchaseFlowProvider({ children }: { children: ReactNode }) {
  const [createdApprovals, setCreatedApprovals] = useLocalStorage<ApprovalRequest[]>(
    "compras:approvals-created",
    []
  );
  const [createdDecisions, setCreatedDecisions] = useLocalStorage<PurchaseDecision[]>(
    "compras:decisions-created",
    []
  );
  const [approvalState, setApprovalStateMap] = useLocalStorage<Record<string, ApprovalState>>(
    "compras:approvals",
    {}
  );
  const [observations, setObservations] = useLocalStorage<Record<string, string>>(
    "compras:approval-notes",
    {}
  );

  const value = useMemo<PurchaseFlowValue>(() => {
    const approvals = [...createdApprovals, ...seedApprovals];
    const decisions = [...createdDecisions, ...seedDecisions];
    const stateOf = (id: string): ApprovalState => approvalState[id] ?? "pendiente";
    return {
      approvals,
      decisions,
      approvalState,
      observations,
      pendingApprovalsCount: approvals.filter(
        (a) => stateOf(a.id) === "pendiente" || stateOf(a.id) === "en_analisis"
      ).length,
      addApproval: (a) => setCreatedApprovals((prev) => [a, ...prev]),
      addDecision: (d) => setCreatedDecisions((prev) => [d, ...prev]),
      setApprovalState: (id, state, note) => {
        setApprovalStateMap((prev) => ({ ...prev, [id]: state }));
        if (note !== undefined) setObservations((prev) => ({ ...prev, [id]: note }));
        // Si la aprobación nació de una OC, actualiza su decisión vinculada
        // (mismo sufijo: APR-<num>-<idx> ↔ DEC-<num>-<idx>). Solo estados finales.
        if (id.startsWith("APR-") && (state === "aprobada" || state === "rechazada")) {
          const decId = id.replace(/^APR-/, "DEC-");
          setCreatedDecisions((prev) =>
            prev.map((d) =>
              d.id === decId
                ? {
                    ...d,
                    approvedBy: state === "aprobada" ? "Líder de compras" : "—",
                    reason:
                      state === "aprobada" ? `${d.reason} · aprobada` : `${d.reason} · rechazada`,
                    resultText:
                      state === "aprobada"
                        ? "Desvío aprobado por el líder. Compra autorizada; resultado en medición."
                        : "Desvío rechazado: ajustar la compra al sugerido.",
                  }
                : d
            )
          );
        }
      },
    };
  }, [
    createdApprovals,
    createdDecisions,
    approvalState,
    observations,
    setCreatedApprovals,
    setCreatedDecisions,
    setApprovalStateMap,
    setObservations,
  ]);

  return <PurchaseFlowContext.Provider value={value}>{children}</PurchaseFlowContext.Provider>;
}

export function usePurchaseFlow(): PurchaseFlowValue {
  const ctx = useContext(PurchaseFlowContext);
  if (!ctx) throw new Error("usePurchaseFlow must be used within PurchaseFlowProvider");
  return ctx;
}

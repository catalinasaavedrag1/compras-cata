import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useLocalStorage } from "../utils/useLocalStorage";
import { signalService, productService } from "../services";
import type {
  SalesSignal,
  SignalChannel,
  SignalEvent,
  SignalEventKind,
  SignalMessage,
  SignalPriority,
  SignalStatus,
  SignalSupport,
  SignalType,
} from "../types/purchasing";

// ============================================================================
//  Estado central de las Señales de Ventas.
//  Fuente única para la página, el dashboard y las notificaciones.
//  Persiste en localStorage como "parches" sobre la semilla (robusto ante
//  cambios de los datos mock) + señales nuevas creadas + mensajes y eventos.
//  Cada acción deja trazabilidad en el timeline de la señal.
// ============================================================================

interface SignalPatch {
  status?: SignalStatus;
  priority?: SignalPriority;
  assignedBuyer?: string;
  rejectionReason?: string;
  customerName?: string;
  requestedQty?: number;
  requiredDate?: string;
  targetPrice?: number;
  suggestedSupplier?: string;
  quotedCost?: number;
}

export type SignalRequestFields = Pick<
  SignalPatch,
  "customerName" | "requestedQty" | "requiredDate" | "targetPrice" | "suggestedSupplier" | "quotedCost"
>;

interface SignalsState {
  created: SalesSignal[];
  patches: Record<string, SignalPatch>;
  extraMessages: Record<string, SignalMessage[]>;
  extraEvents: Record<string, SignalEvent[]>;
}

const EMPTY_STATE: SignalsState = {
  created: [],
  patches: {},
  extraMessages: {},
  extraEvents: {},
};

export interface NewSignalInput {
  type: SignalType;
  priority: SignalPriority;
  sku?: string;
  productName: string;
  category: string;
  brand?: string;
  channel: SignalChannel;
  store: string;
  reportedBy: string;
  comment: string;
  recommendedAction?: string;
  customersAsking?: number;
  estimatedLostSale?: number;
  evidenceNote?: string;
  support?: SignalSupport;
  customerName?: string;
  requestedQty?: number;
  requiredDate?: string;
  targetPrice?: number;
  suggestedSupplier?: string;
}

interface SignalsContextValue {
  signals: SalesSignal[];
  addSignal: (input: NewSignalInput) => SalesSignal;
  setStatus: (id: string, status: SignalStatus, note?: string) => void;
  assign: (id: string, buyer: string) => void;
  setPriority: (id: string, priority: SignalPriority) => void;
  reject: (id: string, reason: string) => void;
  updateRequest: (id: string, fields: SignalRequestFields) => void;
  addMessage: (
    id: string,
    msg: { role: "seller" | "buyer"; author: string; text: string }
  ) => void;
  markConverted: (id: string, detail: string) => void;
}

const SignalsContext = createContext<SignalsContextValue | null>(null);

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${seq++}`;
const now = () => new Date().toISOString();

function supportFor(sku?: string, given?: SignalSupport): SignalSupport {
  if (given) return given;
  const p = sku ? productService.getBySku(sku) : undefined;
  return {
    stock: p?.availableStock ?? 0,
    sales30: p?.salesLast30Days ?? 0,
    rotation: p?.rotation ?? 0,
    marginPct: p?.margin ?? 0,
    stockoutEvents30: 0,
    affectedStores: [],
  };
}

export function SignalsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<SignalsState>(
    "compras:signals",
    EMPTY_STATE
  );

  const signals = useMemo<SalesSignal[]>(() => {
    const base = [...signalService.list(), ...state.created];
    return base.map((s) => {
      const patch = state.patches[s.id];
      const merged: SalesSignal = patch ? { ...s, ...patch } : { ...s };
      const extraMsgs = state.extraMessages[s.id];
      const extraEvts = state.extraEvents[s.id];
      if (extraMsgs) merged.messages = [...s.messages, ...extraMsgs];
      if (extraEvts) merged.timeline = [...s.timeline, ...extraEvts];
      return merged;
    });
  }, [state]);

  const pushEvent = useCallback(
    (id: string, kind: SignalEventKind, actor: string, text: string) => {
      const ev: SignalEvent = { id: uid("ev"), date: now(), actor, kind, text };
      setState((prev) => ({
        ...prev,
        extraEvents: {
          ...prev.extraEvents,
          [id]: [...(prev.extraEvents[id] ?? []), ev],
        },
      }));
    },
    [setState]
  );

  const patch = useCallback(
    (id: string, p: SignalPatch) =>
      setState((prev) => ({
        ...prev,
        patches: { ...prev.patches, [id]: { ...prev.patches[id], ...p } },
      })),
    [setState]
  );

  const value = useMemo<SignalsContextValue>(() => {
    const STATUS_TEXT: Record<SignalStatus, string> = {
      new: "Marcada como solicitada",
      in_review: "Pasó a En revisión",
      sourcing: "Consultando al proveedor",
      quoted: "Cotización recibida",
      awaiting_customer: "Esperando respuesta del cliente",
      accepted: "Aprobada",
      purchased: "Comprada",
      rejected: "Rechazada",
      resolved: "Resuelta",
    };

    return {
      signals,
      addSignal: (input) => {
        const created = now();
        const signal: SalesSignal = {
          id: uid("SIG"),
          type: input.type,
          priority: input.priority,
          status: "new",
          sku: input.sku,
          productName: input.productName,
          category: input.category,
          brand: input.brand,
          channel: input.channel,
          store: input.store,
          reportedBy: input.reportedBy,
          date: created,
          comment: input.comment,
          recommendedAction: input.recommendedAction ?? "",
          customersAsking: input.customersAsking,
          estimatedLostSale: input.estimatedLostSale,
          evidenceNote: input.evidenceNote,
          customerName: input.customerName,
          requestedQty: input.requestedQty,
          requiredDate: input.requiredDate,
          targetPrice: input.targetPrice,
          suggestedSupplier: input.suggestedSupplier,
          support: supportFor(input.sku, input.support),
          messages: input.comment
            ? [
                {
                  id: uid("m"),
                  role: "seller",
                  author: input.reportedBy,
                  date: created,
                  text: input.comment,
                },
              ]
            : [],
          timeline: [
            {
              id: uid("ev"),
              date: created,
              actor: input.reportedBy,
              kind: "created",
              text: `Señal reportada desde ${input.store}`,
            },
          ],
        };
        setState((prev) => ({ ...prev, created: [signal, ...prev.created] }));
        return signal;
      },
      setStatus: (id, status, note) => {
        patch(id, { status });
        pushEvent(id, "status", "Comprador", note ?? STATUS_TEXT[status]);
      },
      assign: (id, buyer) => {
        patch(id, { assignedBuyer: buyer });
        pushEvent(id, "assigned", buyer, `Asignada a ${buyer}`);
      },
      setPriority: (id, priority) => {
        patch(id, { priority });
        pushEvent(
          id,
          "priority",
          "Comprador",
          `Prioridad cambiada a ${priority === "high" ? "Alta" : priority === "medium" ? "Media" : "Baja"}`
        );
      },
      reject: (id, reason) => {
        patch(id, { status: "rejected", rejectionReason: reason });
        pushEvent(id, "status", "Comprador", `Rechazada — ${reason}`);
      },
      updateRequest: (id, fields) => {
        patch(id, fields);
        pushEvent(id, "comment", "Comprador", "Datos de la solicitud actualizados");
      },
      addMessage: (id, msg) => {
        const m: SignalMessage = {
          id: uid("m"),
          role: msg.role,
          author: msg.author,
          date: now(),
          text: msg.text,
        };
        setState((prev) => ({
          ...prev,
          extraMessages: {
            ...prev.extraMessages,
            [id]: [...(prev.extraMessages[id] ?? []), m],
          },
        }));
        pushEvent(id, "comment", msg.author, `Comentó: "${msg.text}"`);
      },
      markConverted: (id, detail) => {
        patch(id, { status: "accepted" });
        pushEvent(id, "converted", "Comprador", detail);
      },
    };
  }, [signals, patch, pushEvent, setState]);

  return (
    <SignalsContext.Provider value={value}>{children}</SignalsContext.Provider>
  );
}

export function useSignals(): SignalsContextValue {
  const ctx = useContext(SignalsContext);
  if (!ctx) throw new Error("useSignals debe usarse dentro de SignalsProvider");
  return ctx;
}

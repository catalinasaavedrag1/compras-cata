import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import {
  addProposalLine,
  createProposal,
  deleteProposalLine,
  describePurchaseBffError,
  getProposal,
  isPurchaseBffConfigured,
  listProposals,
  toPurchaseBffError,
  updateProposalLine,
  type NewProposalLineBody,
  type ProposalView,
  type PurchaseBffError,
} from "../services/purchaseBff";

// ============================================================================
//  Contexto del "borrador de orden de compra" conectado al purchase-bff-service.
//  El borrador ES la propuesta de compra activa (última con status=draft):
//  - Se carga al iniciar; si no existe, se crea perezosamente al agregar la
//    primera línea (POST /proposals con idempotency-key).
//  - Agregar/editar cantidad/quitar línea son comandos reales con If-Match
//    (versión de propuesta para agregar, versión de LÍNEA para editar/quitar).
//  - Mantiene la misma API pública que la versión mock/localStorage para que
//    todos los consumidores (drawer, páginas con "Agregar a OC") sigan
//    compilando. Los datos de cabecera (bodega/pago/fecha/notas) siguen siendo
//    locales: no forman parte del contrato de la propuesta.
// ============================================================================

export interface OcDraftItem {
  sku: string;
  productName: string;
  supplierName: string;
  quantity: number;
  unitCost: number;
  /** Descuento del proveedor sobre esta línea, en %. (No editable: viene del servicio.) */
  discountPct?: number;
  // ------- extras del contrato real (internos, opcionales para call sites) --
  /** Recomendación de origen: habilita agregar la línea vía el motor (D3). */
  recommendationId?: string;
  /** Proveedor/categoría explícitos para líneas manuales (snapshot D3). */
  supplierId?: string;
  categoryId?: string;
  /** Identidad de la línea en la propuesta (solo ítems ya persistidos). */
  lineId?: string;
  lineVersion?: number;
  moq?: number | null;
  packMultiple?: number | null;
}

/** Datos de cabecera del borrador (locales; no viajan a la propuesta). */
export interface OcDraftMeta {
  destinationWarehouse: string;
  paymentTerms: string;
  expectedDate: string;
  notes: string;
}

export const DEFAULT_OC_META: OcDraftMeta = {
  destinationWarehouse: "Centro de Distribución",
  paymentTerms: "30 días fecha factura",
  expectedDate: "",
  notes: "",
};

/** Total neto de una línea (cantidad × costo − descuento). */
export function lineNet(i: OcDraftItem): number {
  return i.quantity * i.unitCost * (1 - (i.discountPct ?? 0) / 100);
}

interface OcDraftContextValue {
  items: OcDraftItem[];
  count: number;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  meta: OcDraftMeta;
  setMeta: (patch: Partial<OcDraftMeta>) => void;
  /**
   * Agrega una línea al borrador real. Devuelve `false` (y avisa por toast)
   * cuando la fuente no es conectable aún: sin recommendationId ni supplierId.
   */
  addItem: (item: OcDraftItem) => boolean;
  updateItem: (sku: string, patch: Partial<OcDraftItem>) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  clear: () => void;
  hasItem: (sku: string) => boolean;
  // ------- estado del borrador real ----------------------------------------
  /** ¿Hay VITE_PURCHASE_BFF_URL configurada? */
  configured: boolean;
  loading: boolean;
  error: PurchaseBffError | null;
  /** Propuesta activa en borrador (id/version para submit) o null. */
  proposal: ProposalView | null;
  refetch: () => void;
}

const OcDraftContext = createContext<OcDraftContextValue | null>(null);

/** Aplana supplierGroups de la vista a ítems del borrador. */
function viewToItems(
  proposal: ProposalView | null,
  pendingQty: Record<string, number>,
  removed: ReadonlySet<string>
): OcDraftItem[] {
  if (!proposal?.supplierGroups) return [];
  const items: OcDraftItem[] = [];
  for (const group of proposal.supplierGroups) {
    for (const line of group.lines) {
      if (removed.has(line.lineId)) continue;
      items.push({
        sku: line.sku,
        productName: line.skuName ?? line.sku,
        supplierName: group.supplierName ?? group.supplierId,
        quantity: pendingQty[line.lineId] ?? line.qty,
        unitCost: line.unitCostClp ?? 0,
        supplierId: line.supplierId,
        categoryId: line.categoryId ?? undefined,
        recommendationId: line.recommendationId ?? undefined,
        lineId: line.lineId,
        lineVersion: line.version,
        moq: line.moq,
        packMultiple: line.packMultiple,
      });
    }
  }
  return items;
}

/** Busca una línea por id dentro de la vista (para leer su versión vigente). */
function findLine(proposal: ProposalView | null, lineId: string) {
  for (const group of proposal?.supplierGroups ?? []) {
    const line = group.lines.find((l) => l.lineId === lineId);
    if (line) return line;
  }
  return null;
}

const QTY_DEBOUNCE_MS = 450;

export function OcDraftProvider({ children }: { children: ReactNode }) {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { authenticated, logout } = useAuth();
  const toast = useToast();

  const [proposal, setProposal] = useState<ProposalView | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  const [meta, setMetaState] = useState<OcDraftMeta>(DEFAULT_OC_META);

  // Overlays optimistas mientras el comando viaja al servidor.
  const [pendingQty, setPendingQty] = useState<Record<string, number>>({});
  const [removedLines, setRemovedLines] = useState<ReadonlySet<string>>(new Set());

  // Refs para evitar cierres obsoletos dentro de la cola de comandos.
  // proposalRef se actualiza SINCRÓNICAMENTE (via applyView) porque los
  // comandos encadenados leen la versión antes del siguiente render.
  const proposalRef = useRef<ProposalView | null>(null);
  const pendingQtyRef = useRef<Record<string, number>>({});
  pendingQtyRef.current = pendingQty;
  const itemsRef = useRef<OcDraftItem[]>([]);
  // Cola: serializa los comandos para encadenar versiones (If-Match) sin 409.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const qtyTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const costNoticeShownRef = useRef(false);
  const loadSeqRef = useRef(0);

  const handleUnauthenticated = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const applyView = useCallback((view: ProposalView | null) => {
    proposalRef.current = view;
    setProposal(view);
  }, []);

  const load = useCallback(async () => {
    if (!configured || !authenticated) return;
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const list = await listProposals({ status: "draft", page: 1, pageSize: 1 });
      const head = list.items[0];
      const view = head ? await getProposal(head.id) : null;
      if (seq !== loadSeqRef.current) return;
      applyView(view);
      setPendingQty({});
      setRemovedLines(new Set());
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      const info = toPurchaseBffError(err);
      // Sin sesión válida: el borrador queda vacío (sin redirigir desde un provider global).
      if (info.code === "UNAUTHENTICATED") applyView(null);
      else setError(info);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [configured, authenticated, applyView]);

  useEffect(() => {
    void load();
  }, [load]);

  const enqueue = useCallback((op: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(op).catch(() => {});
  }, []);

  const handleActionError = useCallback(
    (err: unknown, fallback: string) => {
      const info = toPurchaseBffError(err);
      if (info.code === "UNAUTHENTICATED") {
        handleUnauthenticated();
        return;
      }
      if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") {
        toast.warning("El borrador cambió en otra sesión; se recargó");
        void load();
        return;
      }
      if (info.code === "PURCHASE_PROPOSAL_INVALID_STATE") {
        toast.warning(describePurchaseBffError(info));
        void load();
        return;
      }
      toast.error(`${fallback}: ${describePurchaseBffError(info)}`);
    },
    [handleUnauthenticated, load, toast]
  );

  const addItem = useCallback(
    (item: OcDraftItem): boolean => {
      if (!configured) {
        toast.info("Conexión no configurada: define VITE_PURCHASE_BFF_URL para usar el borrador.");
        return false;
      }
      if (itemsRef.current.some((i) => i.sku === item.sku)) return false;
      const qty = Math.max(1, Math.round(item.quantity));
      let body: NewProposalLineBody;
      if (item.recommendationId) {
        body = { sku: item.sku, qty, recommendationId: item.recommendationId };
      } else if (item.supplierId && item.categoryId) {
        body = {
          sku: item.sku,
          qty,
          supplierId: item.supplierId,
          categoryId: item.categoryId,
          skuName: item.productName,
        };
      } else {
        // Fuente sin referencia real (mock): no se simula estado local.
        toast.info("Esta pantalla se conecta en un flujo posterior");
        return false;
      }
      enqueue(async () => {
        try {
          let current = proposalRef.current;
          if (!current || current.status !== "draft") {
            current = await createProposal({ title: "Borrador de compra" });
            applyView(current);
          }
          const view = await addProposalLine(current.id, current.version, body);
          applyView(view);
        } catch (err) {
          handleActionError(err, `No se pudo agregar ${item.sku} al borrador`);
        }
      });
      return true;
    },
    [configured, enqueue, applyView, handleActionError, toast]
  );

  const updateQuantity = useCallback(
    (sku: string, quantity: number) => {
      const item = itemsRef.current.find((i) => i.sku === sku);
      const lineId = item?.lineId;
      if (!lineId) return;
      const qty = Math.max(1, Math.round(quantity));
      setPendingQty((prev) => ({ ...prev, [lineId]: qty }));
      const timers = qtyTimersRef.current;
      if (timers[lineId]) clearTimeout(timers[lineId]);
      timers[lineId] = setTimeout(() => {
        delete timers[lineId];
        enqueue(async () => {
          const current = proposalRef.current;
          const line = findLine(current, lineId);
          const desired = pendingQtyRef.current[lineId];
          const clearOverlay = (expected: number) =>
            setPendingQty((prev) => {
              if (prev[lineId] !== expected) return prev;
              const rest = { ...prev };
              delete rest[lineId];
              return rest;
            });
          if (!current || !line || desired === undefined || desired === line.qty) {
            if (desired !== undefined && desired === line?.qty) clearOverlay(desired);
            return;
          }
          try {
            const view = await updateProposalLine(current.id, lineId, line.version, desired);
            applyView(view);
          } catch (err) {
            handleActionError(err, `No se pudo actualizar la cantidad de ${sku}`);
          } finally {
            // Solo se limpia si el usuario no volvió a escribir mientras viajaba.
            clearOverlay(desired);
          }
        });
      }, QTY_DEBOUNCE_MS);
    },
    [enqueue, applyView, handleActionError]
  );

  const updateItem = useCallback(
    (sku: string, patch: Partial<OcDraftItem>) => {
      if (patch.quantity !== undefined) updateQuantity(sku, patch.quantity);
      if (
        (patch.unitCost !== undefined || patch.discountPct !== undefined) &&
        !costNoticeShownRef.current
      ) {
        costNoticeShownRef.current = true;
        toast.info("El costo y el descuento los define el servicio de compras (lista vigente).");
      }
    },
    [updateQuantity, toast]
  );

  const removeItem = useCallback(
    (sku: string) => {
      const item = itemsRef.current.find((i) => i.sku === sku);
      const lineId = item?.lineId;
      if (!lineId) return;
      setRemovedLines((prev) => new Set(prev).add(lineId));
      enqueue(async () => {
        const current = proposalRef.current;
        const line = findLine(current, lineId);
        if (!current || !line) return;
        try {
          const view = await deleteProposalLine(current.id, lineId, line.version);
          applyView(view);
        } catch (err) {
          handleActionError(err, `No se pudo quitar ${sku} del borrador`);
        } finally {
          setRemovedLines((prev) => {
            const next = new Set(prev);
            next.delete(lineId);
            return next;
          });
        }
      });
    },
    [enqueue, applyView, handleActionError]
  );

  const clear = useCallback(() => {
    setMetaState(DEFAULT_OC_META);
    void load();
  }, [load]);

  const setMeta = useCallback((patch: Partial<OcDraftMeta>) => {
    setMetaState((prev) => ({ ...prev, ...patch }));
  }, []);

  const items = useMemo(
    () => viewToItems(proposal, pendingQty, removedLines),
    [proposal, pendingQty, removedLines]
  );
  itemsRef.current = items;

  const value = useMemo<OcDraftContextValue>(() => {
    const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);
    const totalAmount = items.reduce((acc, i) => acc + lineNet(i), 0);
    const discountAmount = subtotal - totalAmount;
    return {
      items,
      count: items.length,
      subtotal,
      discountAmount,
      totalAmount,
      meta,
      setMeta,
      addItem,
      updateItem,
      updateQuantity,
      removeItem,
      clear,
      hasItem: (sku: string) => items.some((i) => i.sku === sku),
      configured,
      loading,
      error,
      proposal,
      refetch: () => void load(),
    };
  }, [
    items,
    meta,
    setMeta,
    addItem,
    updateItem,
    updateQuantity,
    removeItem,
    clear,
    configured,
    loading,
    error,
    proposal,
    load,
  ]);

  return <OcDraftContext.Provider value={value}>{children}</OcDraftContext.Provider>;
}

export function useOcDraft(): OcDraftContextValue {
  const ctx = useContext(OcDraftContext);
  if (!ctx) throw new Error("useOcDraft debe usarse dentro de OcDraftProvider");
  return ctx;
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  cancelPurchaseOrder,
  getPurchaseOrder,
  getSapStatus,
  isPurchaseBffConfigured,
  listPurchaseOrders,
  sendPurchaseOrder,
  toPurchaseBffError,
  type PurchaseOrderBffStatus,
  type PurchaseOrderView,
  type PurchaseBffError,
  type SapSyncView,
} from "../services/purchaseBff";
import { TODAY_ISO } from "../utils/constants";
import type { PurchaseOrder } from "../types/purchasing";

// ============================================================================
//  Órdenes de compra reales del purchase-bff-service (flujo 3: OC + SAP).
//  - Lista completa del comprador (una página grande; los filtros por pestaña
//    y fechas siguen siendo client-side en la página).
//  - Polling de sapSync: mientras una OC tenga estado no terminal (pending /
//    processing) se consulta GET /purchase-orders/:id/sap-status cada 5 s,
//    con un tope de ~2 min por OC (después se detiene y se muestra el estado
//    vigente). posted / rejected / cancelled son terminales; `failed` detiene
//    el polling hasta que el usuario reintenta el envío (send re-encola).
//  - send / cancel con If-Match; los 409 recargan la lista.
// ============================================================================

/** Estados de negocio en que una OC sigue "abierta" (señal para Reposición). */
export const ACTIVE_PO_STATUSES: PurchaseOrderBffStatus[] = [
  "approved",
  "sent",
  "confirmed",
  "partially_received",
];

/** Estados de sapSync que se siguen consultando (no terminales). */
const POLLABLE_SAP_STATUSES = new Set<string>(["pending", "processing"]);
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_MS = 120_000;
/** Tope de detalles a traer cuando se piden líneas de las OC activas. */
const MAX_DETAIL_FETCHES = 30;

/** Estados en que la cantidad recibida es relevante para el detalle. */
const RECEIVING_STATUSES: PurchaseOrderBffStatus[] = ["partially_received", "received", "closed"];

/**
 * Fila de OC para las tablas existentes: shape `PurchaseOrder` (mock) mapeado
 * desde la vista real del BFF + extras del contrato (versión y sapSync).
 */
export interface PurchaseOrderRow extends PurchaseOrder {
  version: number;
  supplierId: string | null;
  sapSync: SapSyncView | null;
  cancelReason: string | null;
}

/** Días de atraso de una OC activa respecto a su fecha esperada. */
function delayedDaysOf(view: PurchaseOrderView, expectedDate: string): number {
  if (expectedDate === "" || !ACTIVE_PO_STATUSES.includes(view.status)) return 0;
  const expected = new Date(`${expectedDate}T00:00:00`).getTime();
  const today = new Date(`${TODAY_ISO}T00:00:00`).getTime();
  if (!Number.isFinite(expected)) return 0;
  return Math.max(0, Math.round((today - expected) / 86_400_000));
}

/**
 * Vista BFF → shape que las tablas de la página ya renderizan. Decisiones:
 * - supplierName/buyerName: el contrato entrega referencias (supplierId /
 *   buyerId); se muestran tal cual mientras el BFF no enriquezca nombres.
 * - destinationWarehouse no existe en el contrato → "—".
 * - skuCount: solo se conoce con las líneas del detalle (0 en la lista).
 */
export function toPurchaseOrderRow(view: PurchaseOrderView): PurchaseOrderRow {
  const createdAt = view.createdAt?.slice(0, 10) ?? "";
  const expectedDate = view.expectedDate?.slice(0, 10) ?? "";
  const withReception = RECEIVING_STATUSES.includes(view.status);
  return {
    id: view.id,
    number: view.number,
    supplierName: view.supplierId ?? view.sapCardCode ?? "—",
    createdAt,
    expectedDate,
    status: view.status,
    totalAmount: view.netTotalClp ?? 0,
    skuCount: view.lines?.length ?? 0,
    destinationWarehouse: "—",
    buyerName: view.buyerId ?? "—",
    delayedDays: delayedDaysOf(view, expectedDate),
    lines: view.lines?.map((line) => ({
      sku: line.sku,
      productName: line.skuName ?? line.sku,
      quantity: line.qty,
      unitCost: line.unitCostClp ?? 0,
      ...(withReception && line.qtyReceivedTotal != null
        ? { receivedQty: line.qtyReceivedTotal }
        : {}),
    })),
    version: view.version,
    supplierId: view.supplierId,
    sapSync: view.sapSync ?? null,
    cancelReason: view.cancelReason,
  };
}

export type PurchaseOrderActionResult =
  | { ok: true; order: PurchaseOrderView }
  | { ok: false; error: PurchaseBffError };

export interface UsePurchaseOrdersOptions {
  /** Activa el polling de sapSync (pestañas Órdenes/Seguimiento). */
  poll?: boolean;
  /** Trae también las líneas de las OC activas (señal "OC abierta" por SKU). */
  withLinesForActive?: boolean;
}

export interface UsePurchaseOrdersResult {
  orders: PurchaseOrderView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  send: (id: string, version: number) => Promise<PurchaseOrderActionResult>;
  cancel: (id: string, version: number, reason: string) => Promise<PurchaseOrderActionResult>;
}

function isPollable(order: PurchaseOrderView): boolean {
  const status = order.sapSync?.status;
  return typeof status === "string" && POLLABLE_SAP_STATUSES.has(status);
}

/** Conserva las líneas ya conocidas cuando la respuesta del comando viene sin ellas. */
function mergeOrder(prev: PurchaseOrderView, next: PurchaseOrderView): PurchaseOrderView {
  return { ...prev, ...next, lines: next.lines ?? prev.lines };
}

export function usePurchaseOrders(
  options: UsePurchaseOrdersOptions = {}
): UsePurchaseOrdersResult {
  const { poll = false, withLinesForActive = false } = options;
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [orders, setOrders] = useState<PurchaseOrderView[]>([]);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<PurchaseBffError | null>(null);
  // OC cuyo polling agotó el tope de ~2 min sin llegar a estado terminal.
  const [pollExpired, setPollExpired] = useState<ReadonlySet<string>>(new Set());
  const requestSeq = useRef(0);
  // Primer instante en que cada OC entró al polling (para el tope por OC).
  const pollStartRef = useRef(new Map<string, number>());

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
      const page = await listPurchaseOrders({ page: 1, pageSize: 100 });
      let items = page.items;
      if (withLinesForActive) {
        // La lista viene sin líneas: para la señal "OC abierta" por SKU se
        // traen los detalles de las OC activas (acotado para no inundar el BFF).
        const active = items
          .filter((o) => ACTIVE_PO_STATUSES.includes(o.status))
          .slice(0, MAX_DETAIL_FETCHES);
        const details = await Promise.allSettled(active.map((o) => getPurchaseOrder(o.id)));
        const byId = new Map<string, PurchaseOrderView>();
        details.forEach((result) => {
          if (result.status === "fulfilled" && result.value?.id) {
            byId.set(result.value.id, result.value);
          }
        });
        items = items.map((o) => {
          const detail = byId.get(o.id);
          return detail ? mergeOrder(o, detail) : o;
        });
      }
      if (seq !== requestSeq.current) return;
      setOrders(items);
      pollStartRef.current.clear();
      setPollExpired(new Set());
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
  }, [configured, withLinesForActive, handleUnauthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  // Clave estable de las OC a las que hay que hacerles polling: el intervalo
  // solo se (re)crea cuando cambia el conjunto, y se limpia siempre al salir.
  const pollKey = useMemo(() => {
    if (!poll || !configured) return "";
    return orders
      .filter((o) => isPollable(o) && !pollExpired.has(o.id))
      .map((o) => o.id)
      .sort()
      .join("|");
  }, [poll, configured, orders, pollExpired]);

  useEffect(() => {
    if (pollKey === "") return;
    const ids = pollKey.split("|");
    const started = pollStartRef.current;
    const now = Date.now();
    ids.forEach((id) => {
      if (!started.has(id)) started.set(id, now);
    });

    let active = true;
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const nowTs = Date.now();
        const stale = ids.filter((id) => nowTs - (started.get(id) ?? nowTs) > POLL_MAX_MS);
        if (stale.length > 0) {
          setPollExpired((prev) => {
            const next = new Set(prev);
            stale.forEach((id) => next.add(id));
            return next;
          });
        }
        const fresh = ids.filter((id) => !stale.includes(id));
        if (fresh.length === 0) return;
        const results = await Promise.allSettled(
          fresh.map(async (id) => ({ id, data: await getSapStatus(id) }))
        );
        if (!active) return;
        const updates = new Map<string, SapSyncView | null>();
        results.forEach((result) => {
          // Errores de polling se ignoran en silencio: se conserva el último estado.
          if (result.status === "fulfilled") updates.set(result.value.id, result.value.data.sapSync);
        });
        if (updates.size === 0) return;
        setOrders((prev) =>
          prev.map((o) => {
            if (!updates.has(o.id)) return o;
            const sapSync = updates.get(o.id);
            return sapSync ? { ...o, sapSync } : o;
          })
        );
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pollKey]);

  const runAction = useCallback(
    async (
      id: string,
      action: () => Promise<PurchaseOrderView>
    ): Promise<PurchaseOrderActionResult> => {
      try {
        const order = await action();
        // La OC vuelve a ser candidata a polling (p. ej. failed → pending tras send).
        pollStartRef.current.delete(id);
        setPollExpired((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setOrders((prev) => prev.map((o) => (o.id === order.id ? mergeOrder(o, order) : o)));
        return { ok: true, order };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        // Estado o versión obsoletos: recargar para reflejar la realidad.
        if (
          info.code === "VERSION_CONFLICT" ||
          info.code === "CONFLICT" ||
          info.code === "PURCHASE_ORDER_INVALID_STATE"
        ) {
          void load();
        }
        return { ok: false, error: info };
      }
    },
    [load, handleUnauthenticated]
  );

  const send = useCallback(
    (id: string, version: number) => runAction(id, () => sendPurchaseOrder(id, version)),
    [runAction]
  );

  const cancel = useCallback(
    (id: string, version: number, reason: string) =>
      runAction(id, () => cancelPurchaseOrder(id, version, reason)),
    [runAction]
  );

  return useMemo(
    () => ({ orders, loading, error, configured, refetch: () => void load(), send, cancel }),
    [orders, loading, error, configured, load, send, cancel]
  );
}

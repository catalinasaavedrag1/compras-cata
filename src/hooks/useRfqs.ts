import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  awardRfq,
  createRfq,
  getRfq,
  isPurchaseBffConfigured,
  listRfqs,
  patchRfq,
  registerRfqResponse,
  searchReplenishment,
  toPurchaseBffError,
  type CreateRfqBody,
  type CreateRfqResponseBody,
  type PurchaseBffError,
  type RfqDetailView,
  type RfqPatchBody,
  type RfqSummaryView,
} from "../services/purchaseBff";
import { OPEN_RFQ_STATUSES } from "../pages/rfq/helpers";

// ============================================================================
//  Cotizaciones / RFQ reales del purchase-bff-service (flujo 8).
//  - Lista completa en una página grande (pageSize 100); las pestañas y la
//    búsqueda de la pantalla siguen siendo client-side, igual que en los
//    flujos previos.
//  - Detalle de comparación bajo demanda (fila → drawer), con la versión para
//    If-Match viajando en el cuerpo.
//  - Comandos: create (🔑), send/cancel (If-Match), respuesta (🔑 + If-Match)
//    y adjudicación C20 (🔑 + If-Match → { rfq, proposalId }).
//  - VERSION_CONFLICT / CONFLICT recargan la lista para reflejar la realidad;
//    UNAUTHENTICATED cierra la sesión (patrón flujos 1–7).
// ============================================================================

const PAGE_SIZE = 100;

export type RfqActionResult =
  | { ok: true; rfq: RfqDetailView }
  | { ok: false; error: PurchaseBffError };

export type RfqAwardActionResult =
  | { ok: true; rfq: RfqDetailView; proposalId: string }
  | { ok: false; error: PurchaseBffError };

export interface UseRfqsResult {
  rfqs: RfqSummaryView[];
  loading: boolean;
  error: PurchaseBffError | null;
  configured: boolean;
  refetch: () => void;
  /** Detalle de comparación bajo demanda (fila de la tabla → drawer). */
  fetchDetail: (id: string) => Promise<RfqActionResult>;
  /** POST /rfqs — crea la RFQ draft y la refleja al inicio de la lista. */
  create: (body: CreateRfqBody) => Promise<RfqActionResult>;
  /** PATCH send | cancel (If-Match). */
  applyPatch: (id: string, version: number, body: RfqPatchBody) => Promise<RfqActionResult>;
  /** POST /rfqs/:id/responses — registra la oferta de un invitado. */
  addResponse: (
    id: string,
    version: number,
    body: CreateRfqResponseBody
  ) => Promise<RfqActionResult>;
  /** C20: adjudicar → RFQ awarded + propuesta draft creada por el dominio. */
  award: (id: string, version: number, responseId: string) => Promise<RfqAwardActionResult>;
}

/** Detalle → fila resumen de la lista (mismos campos que toRfqSummary). */
function toSummary(detail: RfqDetailView): RfqSummaryView {
  return {
    id: detail.id,
    number: detail.number,
    title: detail.title,
    buyerId: detail.buyerId,
    status: detail.status,
    dueDate: detail.dueDate,
    lineCount: detail.lines.length,
    supplierCount: detail.suppliers.length,
    respondedCount: detail.suppliers.filter((s) => s.respondedAt !== null).length,
    awardedResponseId: detail.awardedResponseId,
    version: detail.version,
    dateCreated: detail.dateCreated,
  };
}

export function useRfqs(): UseRfqsResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [rows, setRows] = useState<RfqSummaryView[]>([]);
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
      const page = await listRfqs({ page: 1, pageSize: PAGE_SIZE });
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

  /** Refleja en la lista el estado fresco que devuelve un comando o detalle. */
  const applyDetailToRows = useCallback((detail: RfqDetailView) => {
    const summary = toSummary(detail);
    setRows((prev) => {
      const exists = prev.some((r) => r.id === detail.id);
      return exists ? prev.map((r) => (r.id === detail.id ? summary : r)) : [summary, ...prev];
    });
  }, []);

  /** Ejecuta un comando/consulta con el manejo estándar de errores del flujo. */
  const runCommand = useCallback(
    async (
      query: () => Promise<RfqDetailView>,
      opts: { reloadOnConflict: boolean }
    ): Promise<RfqActionResult> => {
      try {
        const rfq = await query();
        applyDetailToRows(rfq);
        return { ok: true, rfq };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        // Versión o estado obsoletos: recargar para reflejar la realidad.
        if (opts.reloadOnConflict && (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT")) {
          void load();
        }
        return { ok: false, error: info };
      }
    },
    [applyDetailToRows, handleUnauthenticated, load]
  );

  const fetchDetail = useCallback(
    (id: string) => runCommand(() => getRfq(id), { reloadOnConflict: false }),
    [runCommand]
  );

  const create = useCallback(
    (body: CreateRfqBody) => runCommand(() => createRfq(body), { reloadOnConflict: false }),
    [runCommand]
  );

  const applyPatch = useCallback(
    (id: string, version: number, body: RfqPatchBody) =>
      runCommand(() => patchRfq(id, version, body), { reloadOnConflict: true }),
    [runCommand]
  );

  const addResponse = useCallback(
    (id: string, version: number, body: CreateRfqResponseBody) =>
      runCommand(() => registerRfqResponse(id, version, body), { reloadOnConflict: true }),
    [runCommand]
  );

  const award = useCallback(
    async (id: string, version: number, responseId: string): Promise<RfqAwardActionResult> => {
      try {
        const result = await awardRfq(id, version, responseId);
        applyDetailToRows(result.rfq);
        return { ok: true, rfq: result.rfq, proposalId: result.proposalId };
      } catch (err) {
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          handleUnauthenticated();
          return { ok: false, error: info };
        }
        if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") void load();
        return { ok: false, error: info };
      }
    },
    [applyDetailToRows, handleUnauthenticated, load]
  );

  return useMemo(
    () => ({
      rfqs: rows,
      loading,
      error,
      configured,
      refetch: () => void load(),
      fetchDetail,
      create,
      applyPatch,
      addResponse,
      award,
    }),
    [rows, loading, error, configured, load, fetchDetail, create, applyPatch, addResponse, award]
  );
}

// ============================================================================
//  Señal liviana "cotización en curso" para las barras de proceso de
//  Reposición y Órdenes de compra: cuenta las RFQs vivas (draft | sent |
//  partially_responded | responded). Una sola carga por página y degradación
//  silenciosa a 0 (sin conexión, sin permiso o con error, la barra no se cae).
// ============================================================================

export function useOpenRfqCount(): number {
  const configured = isPurchaseBffConfigured();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    listRfqs({ page: 1, pageSize: PAGE_SIZE })
      .then((page) => {
        if (!active) return;
        setCount(page.items.filter((r) => OPEN_RFQ_STATUSES.includes(r.status)).length);
      })
      .catch(() => {
        // Degradación silenciosa: la señal es un hint, no bloquea la vista.
      });
    return () => {
      active = false;
    };
  }, [configured]);

  return count;
}

// ============================================================================
//  Datos para los selectores del modal "Nueva cotización": SKUs y proveedores
//  desde las recomendaciones reales del motor de reposición (una carga
//  perezosa al abrir el modal). Fuente documentada: el front no tiene un
//  catálogo maestro de productos/proveedores del dominio, así que se reutiliza
//  POST /replenishment/search (scope mine) — la misma fuente que usa el
//  dominio para resolver skuName al leer la RFQ. Si el motor degrada, el modal
//  sigue operable con entrada libre (SKU y SUP-xxx validado).
// ============================================================================

export interface RfqSkuOption {
  sku: string;
  name: string;
  suggestedQty: number;
  supplierRef: string | null;
  supplierName: string | null;
}

export interface RfqSupplierOption {
  ref: string;
  name: string;
}

export interface UseRfqPickerDataResult {
  skuOptions: RfqSkuOption[];
  supplierOptions: RfqSupplierOption[];
  loading: boolean;
  /** true si la carga falló: el modal muestra solo entrada libre. */
  degraded: boolean;
  /** Dispara la carga (una sola vez); llamar al abrir el modal. */
  ensure: () => void;
}

export function useRfqPickerData(): UseRfqPickerDataResult {
  const configured = isPurchaseBffConfigured();
  const [skuOptions, setSkuOptions] = useState<RfqSkuOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<RfqSupplierOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const startedRef = useRef(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const ensure = useCallback(() => {
    if (!configured || startedRef.current) return;
    startedRef.current = true;
    setLoading(true);
    searchReplenishment({
      filters: {},
      scope: "mine",
      page: 1,
      pageSize: 100,
      sort: [{ field: "priority", order: "desc" }],
    })
      .then((data) => {
        if (!activeRef.current) return;
        const skus = new Map<string, RfqSkuOption>();
        const suppliers = new Map<string, RfqSupplierOption>();
        for (const row of data.items) {
          if (!skus.has(row.sku)) {
            skus.set(row.sku, {
              sku: row.sku,
              name: row.name,
              suggestedQty: Math.max(1, Math.round(row.suggestedQty)),
              supplierRef: row.supplier.id,
              supplierName: row.supplier.name,
            });
          }
          if (row.supplier.id && !suppliers.has(row.supplier.id)) {
            suppliers.set(row.supplier.id, {
              ref: row.supplier.id,
              name: row.supplier.name ?? row.supplier.id,
            });
          }
        }
        setSkuOptions([...skus.values()]);
        setSupplierOptions(
          [...suppliers.values()].sort((a, b) => a.name.localeCompare(b.name, "es"))
        );
      })
      .catch(() => {
        // Degradación silenciosa: el modal cae a entrada libre.
        if (activeRef.current) setDegraded(true);
      })
      .finally(() => {
        if (activeRef.current) setLoading(false);
      });
  }, [configured]);

  return useMemo(
    () => ({ skuOptions, supplierOptions, loading, degraded, ensure }),
    [skuOptions, supplierOptions, loading, degraded, ensure]
  );
}

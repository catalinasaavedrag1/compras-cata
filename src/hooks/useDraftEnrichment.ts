import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  describePurchaseBffError,
  getSuppliersPanel,
  isPurchaseBffConfigured,
  searchReplenishment,
  toPurchaseBffError,
  type ReplenishmentRow,
  type SupplierPanelRow,
} from "../services/purchaseBff";
import type { OcDraftItem } from "../context/OcDraftContext";
import type { ConsolidationCandidate } from "../utils/orderConsolidation";

// ============================================================================
//  Enriquecimiento REAL del borrador de OC (flujo 22): el contexto de línea,
//  el buscador de productos del drawer y las sugerencias dejan de usar mocks.
//
//  - Fila del motor por SKU: POST /replenishment/search con q=sku (pageSize
//    chico, en paralelo con Promise.allSettled y caché por sesión). Un SKU que
//    no está en el universo del motor queda como `null` y la UI muestra "—":
//    jamás se inventa stock, venta, cobertura ni sugerido.
//  - Proveedor por nombre: GET /suppliers (panel F12) con q=nombre y match
//    exacto por nombre. Reemplaza el Map de mockSuppliers.
//  - Buscador de SKUs para línea manual: mismo POST con q + debounce (patrón
//    useGlobalSearch). Toda fila del motor trae recommendationId real, así que
//    agregar la línea usa el contrato real de propuestas. Un SKU tipeado que
//    no existe en el motor simplemente no aparece: no se fabrica una línea.
//  - Sugerencias/consolidación: recomendaciones reales pendientes y urgentes
//    del motor (una página), reutilizadas para "Sugerencias para agregar" y
//    para los candidatos de consolidación por proveedor del coach.
//  Errores: describePurchaseBffError; UNAUTHENTICATED ⇒ logout + /login
//  (patrón useImports).
// ============================================================================

const normalize = (s: string) => s.trim().toLowerCase();

// Cachés por sesión: el borrador se abre/cierra muchas veces con los mismos SKUs.
const skuRowCache = new Map<string, ReplenishmentRow | null>();
const supplierPanelCache = new Map<string, SupplierPanelRow | null>();

/** Fila exacta del motor para un SKU (null = fuera del universo del motor). */
async function fetchRowForSku(sku: string): Promise<ReplenishmentRow | null> {
  if (skuRowCache.has(sku)) return skuRowCache.get(sku) ?? null;
  const data = await searchReplenishment({
    filters: { q: sku },
    scope: "all",
    page: 1,
    pageSize: 5,
    sort: [],
  });
  return data.items.find((r) => normalize(r.sku) === normalize(sku)) ?? null;
}

/** Fila del panel de proveedores por nombre exacto (null = sin match). */
async function fetchPanelForSupplier(name: string): Promise<SupplierPanelRow | null> {
  if (supplierPanelCache.has(name)) return supplierPanelCache.get(name) ?? null;
  const data = await getSuppliersPanel({ q: name, page: 1, pageSize: 5 });
  return data.items.find((s) => normalize(s.name) === normalize(name)) ?? null;
}

export interface UseDraftEnrichmentResult {
  /** SKU → fila real del motor; null = resuelto sin fila (la UI muestra "—"). */
  rowBySku: Map<string, ReplenishmentRow | null>;
  /** Nombre de proveedor → fila real del panel F12; null = sin match. */
  supplierByName: Map<string, SupplierPanelRow | null>;
  /** true mientras hay SKUs/proveedores del borrador aún sin resolver. */
  loading: boolean;
}

/**
 * Resuelve, con caché por sesión, la fila real del motor de cada SKU del
 * borrador y el panel real de cada proveedor presente en él.
 */
export function useDraftEnrichment(items: OcDraftItem[]): UseDraftEnrichmentResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [rows, setRows] = useState<ReadonlyMap<string, ReplenishmentRow | null>>(new Map());
  const [panels, setPanels] = useState<ReadonlyMap<string, SupplierPanelRow | null>>(new Map());
  const [pending, setPending] = useState(0);
  // Qué claves ya se pidieron en este montaje (una falla puntual no se
  // re-pide en bucle: queda en null hasta el próximo cambio de ítems).
  const attemptedSkus = useRef(new Set<string>());
  const attemptedSuppliers = useRef(new Set<string>());

  const skus = useMemo(() => [...new Set(items.map((i) => i.sku))], [items]);
  const supplierNames = useMemo(
    () => [...new Set(items.map((i) => i.supplierName).filter(Boolean))],
    [items]
  );

  useEffect(() => {
    if (!configured) return;
    const newSkus = skus.filter((s) => !attemptedSkus.current.has(s));
    const newSuppliers = supplierNames.filter((s) => !attemptedSuppliers.current.has(s));
    if (newSkus.length === 0 && newSuppliers.length === 0) return;
    // Se marcan en vuelo para no re-pedir en paralelo; una falla puntual se
    // desmarca abajo para que un próximo montaje pueda reintentarla.
    newSkus.forEach((s) => attemptedSkus.current.add(s));
    newSuppliers.forEach((s) => attemptedSuppliers.current.add(s));
    setPending((p) => p + 1);
    void (async () => {
      try {
        const [skuSettled, supplierSettled] = await Promise.all([
          Promise.allSettled(newSkus.map(fetchRowForSku)),
          Promise.allSettled(newSuppliers.map(fetchPanelForSupplier)),
        ]);
        let unauthenticated = false;
        const nextRows: Array<[string, ReplenishmentRow | null]> = [];
        skuSettled.forEach((res, i) => {
          const sku = newSkus[i];
          if (res.status === "fulfilled") {
            skuRowCache.set(sku, res.value);
            nextRows.push([sku, res.value]);
          } else {
            if (toPurchaseBffError(res.reason).code === "UNAUTHENTICATED") unauthenticated = true;
            // Falla puntual: se desmarca para poder reintentar; la línea queda "—".
            attemptedSkus.current.delete(sku);
            nextRows.push([sku, null]);
          }
        });
        const nextPanels: Array<[string, SupplierPanelRow | null]> = [];
        supplierSettled.forEach((res, i) => {
          const name = newSuppliers[i];
          if (res.status === "fulfilled") {
            supplierPanelCache.set(name, res.value);
            nextPanels.push([name, res.value]);
          } else {
            if (toPurchaseBffError(res.reason).code === "UNAUTHENTICATED") unauthenticated = true;
            attemptedSuppliers.current.delete(name);
            nextPanels.push([name, null]);
          }
        });
        if (unauthenticated) {
          logout();
          navigate("/login");
          return;
        }
        if (nextRows.length > 0) {
          setRows((prev) => new Map([...prev, ...nextRows]));
        }
        if (nextPanels.length > 0) {
          setPanels((prev) => new Map([...prev, ...nextPanels]));
        }
      } finally {
        // Siempre se baja el contador (incluso ante UNAUTHENTICATED): loading no se traba.
        setPending((p) => p - 1);
      }
    })();
  }, [configured, skus, supplierNames, logout, navigate]);

  return useMemo(
    () => ({
      rowBySku: new Map(rows),
      supplierByName: new Map(panels),
      loading: pending > 0,
    }),
    [rows, panels, pending]
  );
}

// ----------------------------------------------------------------------------
//  Buscador de SKUs reales para agregar líneas manuales al borrador
// ----------------------------------------------------------------------------

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_PAGE_SIZE = 8;
const SEARCH_MIN_LENGTH = 2;

export interface UseDraftSkuSearchResult {
  /** Filas reales del motor que matchean la búsqueda (traen recommendationId). */
  results: ReplenishmentRow[];
  loading: boolean;
  /** Mensaje legible si el servicio no pudo buscar. */
  error: string | null;
}

/** Búsqueda de productos del motor por q (debounce, página chica). */
export function useDraftSkuSearch(query: string): UseDraftSkuSearchResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Objeto (no string) para que volver al texto anterior re-dispare la consulta.
  const [debounced, setDebounced] = useState<{ q: string }>({ q: "" });
  const [results, setResults] = useState<ReplenishmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const normalized = query.trim();
  const active = configured && normalized.length >= SEARCH_MIN_LENGTH;

  useEffect(() => {
    if (!active) {
      setDebounced({ q: "" });
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => setDebounced({ q: normalized }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [normalized, active]);

  useEffect(() => {
    const q = debounced.q;
    if (!active || q.length < SEARCH_MIN_LENGTH) {
      requestSeq.current += 1;
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await searchReplenishment({
          filters: { q },
          scope: "all",
          page: 1,
          pageSize: SEARCH_PAGE_SIZE,
          sort: [],
        });
        if (seq !== requestSeq.current) return;
        setResults(data.items);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          logout();
          navigate("/login");
          return;
        }
        setResults([]);
        setError(describePurchaseBffError(info));
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    })();
  }, [debounced, active, logout, navigate]);

  return { results, loading, error };
}

// ----------------------------------------------------------------------------
//  Sugerencias reales pendientes del motor (drawer + barra de proceso)
// ----------------------------------------------------------------------------

const SUGGESTIONS_PAGE_SIZE = 30;

export interface UseDraftSuggestionsResult {
  /** Recomendaciones reales pendientes y urgentes, con cantidad sugerida > 0. */
  suggestions: ReplenishmentRow[];
  /** Total real de pendientes urgentes del motor (null = sin dato). */
  pendingTotal: number | null;
}

/**
 * Página de recomendaciones reales pendientes (prioridad quiebre inminente /
 * stock bajo) para "Sugerencias para agregar" y los candidatos del coach.
 */
export function useDraftSuggestions(): UseDraftSuggestionsResult {
  const configured = isPurchaseBffConfigured();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [suggestions, setSuggestions] = useState<ReplenishmentRow[]>([]);
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!configured) return;
    const seq = ++requestSeq.current;
    void (async () => {
      try {
        const data = await searchReplenishment({
          filters: { status: ["pending"], priority: ["stockout_imminent", "low_stock"] },
          scope: "all",
          page: 1,
          pageSize: SUGGESTIONS_PAGE_SIZE,
          sort: [
            { field: "priority", order: "desc" },
            { field: "coverageDays", order: "asc" },
          ],
        });
        if (seq !== requestSeq.current) return;
        setSuggestions(data.items.filter((r) => r.suggestedQty > 0));
        setPendingTotal(data.meta.total ?? null);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        const info = toPurchaseBffError(err);
        if (info.code === "UNAUTHENTICATED") {
          logout();
          navigate("/login");
          return;
        }
        // Panel auxiliar: sin datos reales se muestra vacío, no se inventa.
        setSuggestions([]);
        setPendingTotal(null);
      }
    })();
  }, [configured, logout, navigate]);

  return { suggestions, pendingTotal };
}

// ----------------------------------------------------------------------------
//  Candidatos de consolidación por proveedor desde sugerencias reales
// ----------------------------------------------------------------------------

/**
 * Deriva los candidatos de consolidación de un proveedor a partir de las
 * recomendaciones reales pendientes del motor (reemplaza el cálculo sobre
 * mockProducts/mockRecommendations). Solo entran filas con costo real; la
 * urgencia sale de la cobertura real del motor (sin cobertura → al final,
 * con motivo honesto "Sugerido por el motor").
 */
export function consolidationCandidatesFromSuggestions(
  suggestions: ReplenishmentRow[],
  supplierName: string,
  draftSkus: ReadonlySet<string>,
  limit = 3
): ConsolidationCandidate[] {
  const out: ConsolidationCandidate[] = [];
  for (const row of suggestions) {
    const name = row.supplier.name ?? row.supplier.id;
    if (!name || name !== supplierName) continue;
    if (draftSkus.has(row.sku)) continue;
    if (row.suggestedQty <= 0 || !row.cost) continue;
    const cover = row.coverageDays;
    const daysToStockout = cover !== null ? Math.max(0, Math.round(cover)) : 999;
    out.push({
      sku: row.sku,
      productName: row.name,
      suggestedQty: row.suggestedQty,
      unitCost: row.cost.unitCost,
      lineValue: row.suggestedAmountClp ?? row.suggestedQty * row.cost.unitCost,
      daysToStockout,
      stockoutDate: null,
      reason:
        row.stock?.available != null && row.stock.available <= 0
          ? "Ya sin stock"
          : cover !== null
            ? `Se queda sin stock en ~${daysToStockout} d`
            : "Sugerido por el motor",
    });
  }
  out.sort((a, b) => a.daysToStockout - b.daysToStockout);
  return out.slice(0, limit);
}

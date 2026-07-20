import { useEffect, useRef, useState } from "react";
import {
  getCategoriesPanel,
  getSuppliersPanel,
  isPurchaseBffConfigured,
  listPurchaseOrders,
  searchReplenishment,
  type CategoryPanelRow,
  type PurchaseOrderBffStatus,
} from "../services/purchaseBff";
import { categoryPath, productPath, supplierPath } from "../utils/entityLinks";
import { formatDate, formatNumber, productLabel } from "../utils/formatters";

// ============================================================================
//  Búsqueda global del Topbar sobre las fuentes reales del purchase-bff:
//  - Productos:   POST /replenishment/search con filters.q (motor, página chica).
//  - Proveedores: GET /suppliers?q= (panel F12).
//  - Categorías:  GET /categories (sin q server-side: la lista es corta, se
//                 cachea una vez por sesión y se filtra por nombre aquí).
//  - Órdenes:     GET /purchase-orders?number= (contención server-side sobre
//                 el número real OC-…).
//  El Topbar es global: cualquier fallo degrada a mensaje corto en el dropdown
//  y las respuestas fuera de orden se descartan con requestSeq.
// ============================================================================

export type GlobalSearchType = "product" | "supplier" | "category" | "order";

export interface GlobalSearchResult {
  type: GlobalSearchType;
  title: string;
  subtitle: string;
  to: string;
}

export interface UseGlobalSearchResult {
  results: GlobalSearchResult[];
  loading: boolean;
  /** Mensaje corto para el dropdown cuando ninguna fuente respondió. */
  error: string | null;
  /** false = sin VITE_PURCHASE_BFF_URL: el buscador se deshabilita. */
  configured: boolean;
}

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 5;
const MIN_QUERY_LENGTH = 2;

const OC_STATUS_LABEL: Record<PurchaseOrderBffStatus, string> = {
  approved: "Aprobada",
  sent: "Enviada",
  confirmed: "Confirmada",
  partially_received: "Recepción parcial",
  received: "Recibida",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

// ----------------------------------------------------------------------------
//  Caché de sesión: categorías (lista corta y estable).
// ----------------------------------------------------------------------------

let categoriesCache: Promise<CategoryPanelRow[]> | null = null;

function loadCategories(): Promise<CategoryPanelRow[]> {
  categoriesCache ??= getCategoriesPanel()
    .then((data) => data.items)
    .catch((err: unknown) => {
      // No dejar cacheado el fallo: el próximo intento vuelve a pedir.
      categoriesCache = null;
      throw err;
    });
  return categoriesCache;
}

// ----------------------------------------------------------------------------
//  Mapeos por fuente → resultado homogéneo del dropdown
// ----------------------------------------------------------------------------

async function searchProducts(q: string): Promise<GlobalSearchResult[]> {
  const data = await searchReplenishment({
    filters: { q },
    scope: "all",
    page: 1,
    pageSize: PAGE_SIZE,
    sort: [],
  });
  return data.items.map((row) => ({
    type: "product" as const,
    title: productLabel(row.name, row.sku),
    subtitle:
      [
        row.brand,
        row.category.name,
        row.stock?.available != null ? `disp. ${formatNumber(row.stock.available)}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Producto",
    to: productPath(row.sku),
  }));
}

async function searchSuppliers(q: string): Promise<GlobalSearchResult[]> {
  const data = await getSuppliersPanel({ q, page: 1, pageSize: PAGE_SIZE });
  return data.items.map((s) => ({
    type: "supplier" as const,
    title: s.name,
    subtitle:
      [s.rut, s.categories.length > 0 ? s.categories.join(", ") : null]
        .filter(Boolean)
        .join(" · ") || "Proveedor",
    to: supplierPath(s.supplierId),
  }));
}

async function searchCategories(q: string): Promise<GlobalSearchResult[]> {
  const items = await loadCategories();
  return items
    .filter((c) => c.name.toLowerCase().includes(q))
    .slice(0, PAGE_SIZE)
    .map((c) => ({
      type: "category" as const,
      title: c.name,
      subtitle: [`Categoría · ${formatNumber(c.skuCount)} SKU`, c.buyerId]
        .filter(Boolean)
        .join(" · "),
      to: categoryPath(c.categoryId),
    }));
}

async function searchOrders(q: string): Promise<GlobalSearchResult[]> {
  const data = await listPurchaseOrders({ number: q, page: 1, pageSize: PAGE_SIZE });
  return data.items.map((o) => ({
    type: "order" as const,
    title: o.number,
    subtitle: [
      OC_STATUS_LABEL[o.status] ?? o.status,
      o.supplierId,
      o.expectedDate ? `espera ${formatDate(o.expectedDate)}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    to: `/comprar/seguimiento?oc=${encodeURIComponent(o.number)}`,
  }));
}

// ----------------------------------------------------------------------------
//  Hook
// ----------------------------------------------------------------------------

export function useGlobalSearch(query: string): UseGlobalSearchResult {
  const configured = isPurchaseBffConfigured();

  // Objeto (no string) para que volver al texto anterior también re-dispare
  // la consulta tras el debounce (si no, `loading` quedaría colgado en true).
  const [debounced, setDebounced] = useState<{ q: string }>({ q: "" });
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const normalized = query.trim().toLowerCase();
  const active = configured && normalized.length >= MIN_QUERY_LENGTH;

  // Debounce ~300ms: solo se consulta cuando el usuario deja de tipear.
  useEffect(() => {
    if (!active) {
      setDebounced({ q: "" });
      return;
    }
    // Loading inmediato para que el dropdown reaccione mientras corre el debounce.
    setLoading(true);
    const timer = setTimeout(() => setDebounced({ q: normalized }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [normalized, active]);

  useEffect(() => {
    const q = debounced.q;
    if (!active || q.length < MIN_QUERY_LENGTH) {
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
      const settled = await Promise.allSettled([
        searchProducts(q),
        searchSuppliers(q),
        searchCategories(q),
        searchOrders(q),
      ]);
      // Respuesta fuera de orden (ya hay otra consulta en vuelo): se descarta.
      if (seq !== requestSeq.current) return;
      const out = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      const allFailed = settled.every((r) => r.status === "rejected");
      setResults(out);
      setError(allFailed ? "No se pudo buscar en el servicio de compras." : null);
      setLoading(false);
    })();
  }, [debounced, active]);

  return { results, loading, error, configured };
}

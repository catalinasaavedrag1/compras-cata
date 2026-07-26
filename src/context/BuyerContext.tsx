import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocalStorage } from "../utils/useLocalStorage";
import {
  getCategoriesPanel,
  isPurchaseBffConfigured,
  type CategoryPanelRow,
} from "../services/purchaseBff";

// ============================================================================
//  Comprador actual de la sesión.
//  Los compradores y su cartera salen del panel REAL de categorías (F12):
//  cada categoría trae su buyerId asignado. Sin BFF configurado (o mientras
//  carga) la cartera queda vacía — nunca se inventa un mapa comprador→categoría.
// ============================================================================

/** "catalina" -> "Catalina" (presentación de un id real, no dato inventado). */
function displayBuyer(id: string): string {
  return id
    .split(/[.\-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

interface BuyerContextValue {
  buyer: string;
  setBuyer: (name: string) => void;
  buyers: string[];
  /** Nombres de categorías asignadas al comprador actual (buyerId). */
  myCategories: string[];
  /** Presentación legible del buyerId actual. */
  buyerLabel: string;
  labelFor: (buyerId: string) => string;
  /** true mientras se carga el panel de categorías: la cartera aún no es fiable. */
  loading: boolean;
}

const BuyerContext = createContext<BuyerContextValue | null>(null);

export function BuyerProvider({ children }: { children: ReactNode }) {
  const [buyer, setBuyer] = useLocalStorage<string>("compras:buyer", "");
  const [rows, setRows] = useState<CategoryPanelRow[]>([]);
  // Sin BFF no hay carga pendiente; con BFF arranca cargando hasta la 1ª respuesta.
  const [loading, setLoading] = useState(isPurchaseBffConfigured());
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!isPurchaseBffConfigured()) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    void getCategoriesPanel()
      .then((data) => {
        if (seq === requestSeq.current) setRows(data.items);
      })
      .catch(() => {
        // Sin categorías reales: la cartera queda vacía (degradación honesta).
        if (seq === requestSeq.current) setRows([]);
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoading(false);
      });
  }, []);

  const buyers = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.buyerId).filter((b): b is string => !!b))
      ).sort((a, b) => a.localeCompare(b, "es")),
    [rows]
  );

  // Comprador efectivo: el guardado si sigue existiendo, si no el primero real.
  const effectiveBuyer = buyer && buyers.includes(buyer) ? buyer : (buyers[0] ?? buyer);

  const value = useMemo<BuyerContextValue>(
    () => ({
      buyer: effectiveBuyer,
      setBuyer,
      buyers,
      myCategories: rows
        .filter((r) => r.buyerId === effectiveBuyer)
        .map((r) => r.name),
      buyerLabel: effectiveBuyer ? displayBuyer(effectiveBuyer) : "—",
      labelFor: (id: string) => (id ? displayBuyer(id) : "—"),
      loading,
    }),
    [effectiveBuyer, setBuyer, buyers, rows, loading]
  );

  return <BuyerContext.Provider value={value}>{children}</BuyerContext.Provider>;
}

export function useBuyer(): BuyerContextValue {
  const ctx = useContext(BuyerContext);
  if (!ctx) throw new Error("useBuyer debe usarse dentro de BuyerProvider");
  return ctx;
}

/** Iniciales para el avatar (ej. "Catalina Saavedra" -> "CS"). */
export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

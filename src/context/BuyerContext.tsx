import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";
import { categories } from "../data/mockCategories";

// ============================================================================
//  Comprador actual de la sesión.
//  Los compradores se obtienen de las categorías (campo "buyer").
//  El comprador define qué categorías y productos son "suyos".
// ============================================================================

const BUYERS = Array.from(new Set(categories.map((c) => c.buyer))).sort((a, b) =>
  a.localeCompare(b, "es")
);

interface BuyerContextValue {
  buyer: string;
  setBuyer: (name: string) => void;
  buyers: string[];
  /** Nombres de categorías asignadas al comprador actual. */
  myCategories: string[];
}

const BuyerContext = createContext<BuyerContextValue | null>(null);

export function BuyerProvider({ children }: { children: ReactNode }) {
  const [buyer, setBuyer] = useLocalStorage<string>("compras:buyer", "Catalina Saavedra");

  const value = useMemo<BuyerContextValue>(
    () => ({
      buyer,
      setBuyer,
      buyers: BUYERS,
      myCategories: categories.filter((c) => c.buyer === buyer).map((c) => c.name),
    }),
    [buyer, setBuyer]
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

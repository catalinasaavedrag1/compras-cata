import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";

// ============================================================================
//  Contexto del "borrador de orden de compra".
//  Permite simular la acción "Agregar a OC" desde reposición/productos,
//  mostrar el contador en el Topbar y armar la OC en la página de órdenes.
// ============================================================================

export interface OcDraftItem {
  sku: string;
  productName: string;
  supplierName: string;
  quantity: number;
  unitCost: number;
}

interface OcDraftContextValue {
  items: OcDraftItem[];
  count: number;
  totalAmount: number;
  addItem: (item: OcDraftItem) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  clear: () => void;
  hasItem: (sku: string) => boolean;
}

const OcDraftContext = createContext<OcDraftContextValue | null>(null);

export function OcDraftProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useLocalStorage<OcDraftItem[]>("compras:oc-draft", []);

  const value = useMemo<OcDraftContextValue>(() => {
    const addItem = (item: OcDraftItem) =>
      setItems((prev) =>
        prev.some((i) => i.sku === item.sku) ? prev : [...prev, item]
      );

    const updateQuantity = (sku: string, quantity: number) =>
      setItems((prev) =>
        prev.map((i) =>
          i.sku === sku ? { ...i, quantity: Math.max(0, quantity) } : i
        )
      );

    const removeItem = (sku: string) =>
      setItems((prev) => prev.filter((i) => i.sku !== sku));

    const clear = () => setItems([]);

    const hasItem = (sku: string) => items.some((i) => i.sku === sku);

    const totalAmount = items.reduce(
      (acc, i) => acc + i.quantity * i.unitCost,
      0
    );

    return {
      items,
      count: items.length,
      totalAmount,
      addItem,
      updateQuantity,
      removeItem,
      clear,
      hasItem,
    };
  }, [items]);

  return <OcDraftContext.Provider value={value}>{children}</OcDraftContext.Provider>;
}

export function useOcDraft(): OcDraftContextValue {
  const ctx = useContext(OcDraftContext);
  if (!ctx) throw new Error("useOcDraft debe usarse dentro de OcDraftProvider");
  return ctx;
}

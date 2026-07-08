import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";

// ============================================================================
//  Contexto del "borrador de orden de compra".
//  Permite simular la acción "Agregar a OC" desde reposición/productos,
//  mostrar el contador en el Topbar y armar la OC en la página de órdenes.
//  El borrador incluye descuento por línea y los datos de cabecera (bodega,
//  condición de pago, fecha esperada y observaciones) para que sea una OC
//  completa.
// ============================================================================

export interface OcDraftItem {
  sku: string;
  productName: string;
  supplierName: string;
  quantity: number;
  unitCost: number;
  /** Descuento del proveedor sobre esta línea, en %. */
  discountPct?: number;
}

/** Datos de cabecera del borrador (comunes a la orden). */
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
  addItem: (item: OcDraftItem) => void;
  updateItem: (sku: string, patch: Partial<OcDraftItem>) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  clear: () => void;
  hasItem: (sku: string) => boolean;
}

const OcDraftContext = createContext<OcDraftContextValue | null>(null);

export function OcDraftProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useLocalStorage<OcDraftItem[]>("compras:oc-draft", []);
  const [meta, setMetaState] = useLocalStorage<OcDraftMeta>(
    "compras:oc-draft-meta",
    DEFAULT_OC_META
  );

  const value = useMemo<OcDraftContextValue>(() => {
    const addItem = (item: OcDraftItem) =>
      setItems((prev) => (prev.some((i) => i.sku === item.sku) ? prev : [...prev, item]));

    const updateItem = (sku: string, patch: Partial<OcDraftItem>) =>
      setItems((prev) => prev.map((i) => (i.sku === sku ? { ...i, ...patch } : i)));

    const updateQuantity = (sku: string, quantity: number) =>
      setItems((prev) =>
        prev.map((i) => (i.sku === sku ? { ...i, quantity: Math.max(0, quantity) } : i))
      );

    const removeItem = (sku: string) => setItems((prev) => prev.filter((i) => i.sku !== sku));

    const clear = () => {
      setItems([]);
      setMetaState(DEFAULT_OC_META);
    };

    const hasItem = (sku: string) => items.some((i) => i.sku === sku);

    const setMeta = (patch: Partial<OcDraftMeta>) =>
      setMetaState((prev) => ({ ...prev, ...patch }));

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
      hasItem,
    };
  }, [items, meta, setItems, setMetaState]);

  return <OcDraftContext.Provider value={value}>{children}</OcDraftContext.Provider>;
}

export function useOcDraft(): OcDraftContextValue {
  const ctx = useContext(OcDraftContext);
  if (!ctx) throw new Error("useOcDraft debe usarse dentro de OcDraftProvider");
  return ctx;
}

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";

// ============================================================================
//  Contexto de "fichas técnicas y manuales" adjuntados por el comprador.
//  El proveedor entrega una ficha técnica / manual que el comprador adjunta y
//  queda MAPEADA al producto por su SKU (y EAN / código de barras si existe).
//  Es solo frontend: el archivo se guarda como data URL en localStorage para
//  poder verlo y descargarlo dentro de la sesión, sin backend.
// ============================================================================

export interface Datasheet {
  id: string;
  /** SKU del producto al que se mapea la ficha. */
  sku: string;
  /** EAN / código de barras del producto (si lo tiene o se ingresó a mano). */
  ean?: string;
  productName: string;
  supplierName: string;
  /** Nombre original del archivo (ej. "ficha-taladro-18v.pdf"). */
  fileName: string;
  /** Tipo MIME del archivo. */
  mime: string;
  /** Tamaño legible (ej. "540 KB"). */
  sizeLabel: string;
  /** Contenido del archivo (base64) para ver/descargar en la sesión. */
  dataUrl?: string;
  /** Nota opcional del comprador. */
  note?: string;
  /** Fecha ISO en que se adjuntó. */
  uploadedAt: string;
  /** Quién la adjuntó (comprador). */
  uploadedBy: string;
}

/** Datos para adjuntar una ficha nueva (el id y la fecha se generan aquí). */
export type NewDatasheet = Omit<Datasheet, "id" | "uploadedAt">;

interface DatasheetsContextValue {
  items: Datasheet[];
  /** Todas las fichas mapeadas a un SKU, de la más reciente a la más antigua. */
  bySku: (sku: string) => Datasheet[];
  add: (input: NewDatasheet) => Datasheet;
  remove: (id: string) => void;
}

const DatasheetsContext = createContext<DatasheetsContextValue | null>(null);

export function DatasheetsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useLocalStorage<Datasheet[]>("compras:datasheets", []);

  const value = useMemo<DatasheetsContextValue>(() => {
    const add = (input: NewDatasheet): Datasheet => {
      const ds: Datasheet = {
        ...input,
        id: `FT-${Date.now().toString(36).toUpperCase()}`,
        uploadedAt: new Date().toISOString(),
      };
      setItems((prev) => [ds, ...prev]);
      return ds;
    };

    const remove = (id: string) => setItems((prev) => prev.filter((d) => d.id !== id));

    const bySku = (sku: string) =>
      items.filter((d) => d.sku === sku).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    return { items, bySku, add, remove };
  }, [items, setItems]);

  return <DatasheetsContext.Provider value={value}>{children}</DatasheetsContext.Provider>;
}

export function useDatasheets(): DatasheetsContextValue {
  const ctx = useContext(DatasheetsContext);
  if (!ctx) throw new Error("useDatasheets debe usarse dentro de DatasheetsProvider");
  return ctx;
}

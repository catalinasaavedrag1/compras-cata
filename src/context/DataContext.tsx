import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiGet, backendEnabled } from "../services/apiClient";

// ============================================================================
//  Capa de datos de la app.
//  Si hay backend (VITE_API_URL), hidrata las colecciones desde la API y las
//  expone a los módulos vía useCollection(). Si no, cada módulo usa su mock
//  como fallback (modo demo), sin romperse. Así se conectan los módulos a la
//  misma fuente de datos cuando el backend está corriendo.
// ============================================================================

export type DataSource = "backend" | "mock" | "loading";

interface DataValue {
  source: DataSource;
  ready: boolean;
  cache: Record<string, unknown[]>;
}

const DataContext = createContext<DataValue>({ source: "mock", ready: true, cache: {} });

// Colecciones que el backend expone (deben coincidir con server/seed.ts).
const COLLECTIONS = [
  "products",
  "suppliers",
  "categories",
  "purchase-orders",
  "recommendations",
  "alerts",
  "campaign-opportunities",
  "signals",
  "approvals",
  "decisions",
  "buyers",
  "rules",
  "receptions",
];

export function DataProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Record<string, unknown[]>>({});
  const [source, setSource] = useState<DataSource>(backendEnabled ? "loading" : "mock");

  useEffect(() => {
    if (!backendEnabled) return;
    let alive = true;
    (async () => {
      try {
        const entries = await Promise.all(
          COLLECTIONS.map(async (c) => [c, await apiGet<unknown[]>(c)] as const)
        );
        if (!alive) return;
        setCache(Object.fromEntries(entries));
        setSource("backend");
      } catch {
        if (alive) setSource("mock"); // backend caído → modo demo
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<DataValue>(
    () => ({ source, ready: source !== "loading", cache }),
    [source, cache]
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/**
 * Devuelve los datos de una colección: del backend si está hidratado, si no el
 * mock que recibe como fallback. Los componentes siguen siendo síncronos.
 */
export function useCollection<T>(collection: string, fallback: T[]): T[] {
  const { cache, source } = useContext(DataContext);
  if (source === "backend" && cache[collection]) return cache[collection] as T[];
  return fallback;
}

export function useDataSource(): DataValue {
  return useContext(DataContext);
}

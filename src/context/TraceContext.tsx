import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";

// ============================================================================
//  Bitácora / trazabilidad. Registra quién cambió qué, valor anterior → nuevo,
//  cuándo y por qué. Evita que las decisiones queden dispersas sin rastro.
// ============================================================================

export interface TraceEntry {
  id: string;
  date: string; // ISO (aaaa-mm-dd)
  actor: string;
  entity: string; // "Regla · Global", "Reclamo · Cable...", "OC-2026-0142"
  action: string; // qué se hizo
  field?: string; // campo cambiado
  before?: string;
  after?: string;
  reason?: string;
}

const seed: TraceEntry[] = [
  {
    id: "TR-seed-3",
    date: "2026-06-22",
    actor: "Catalina Saavedra",
    entity: "Reclamo · Huincha de medir 5 m",
    action: "Creó reclamo por daño",
    field: "estado",
    before: "—",
    after: "abierto",
    reason: "25 unidades con carcasa quebrada",
  },
  {
    id: "TR-seed-2",
    date: "2026-06-15",
    actor: "Catalina Saavedra",
    entity: "Regla · Construcción",
    action: "Ajustó cobertura objetivo",
    field: "targetInventoryDays",
    before: "40",
    after: "30",
    reason: "Alta rotación: reducir capital inmovilizado",
  },
  {
    id: "TR-seed-1",
    date: "2026-06-10",
    actor: "Gerencia comercial",
    entity: "Regla · Global",
    action: "Actualizó margen mínimo",
    field: "minMargin",
    before: "22",
    after: "25",
    reason: "Nueva política de margen",
  },
];

interface TraceContextValue {
  entries: TraceEntry[];
  log: (entry: Omit<TraceEntry, "id" | "date"> & { id?: string; date?: string }) => void;
}

const TraceContext = createContext<TraceContextValue | null>(null);

export function TraceProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useLocalStorage<TraceEntry[]>("compras:trace", seed);

  const value = useMemo<TraceContextValue>(() => {
    const log: TraceContextValue["log"] = (entry) => {
      const id = entry.id ?? `TR-${Date.now()}`;
      const date = entry.date ?? new Date().toISOString().slice(0, 10);
      setEntries((prev) => [{ ...entry, id, date }, ...prev].slice(0, 200));
    };
    return { entries, log };
  }, [entries, setEntries]);

  return <TraceContext.Provider value={value}>{children}</TraceContext.Provider>;
}

export function useTrace(): TraceContextValue {
  const ctx = useContext(TraceContext);
  if (!ctx) throw new Error("useTrace debe usarse dentro de TraceProvider");
  return ctx;
}

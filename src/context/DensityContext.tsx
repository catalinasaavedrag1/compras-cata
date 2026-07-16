import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";

// ============================================================================
//  Densidad de la interfaz.
//  "comodo" (por defecto) o "compacto": aprieta paddings y tipografía en los
//  componentes compartidos (Card, KpiCard, PageHeader) para que la app se
//  sienta más rápida y entre más información sin scroll. Se recuerda por usuario.
// ============================================================================

export type Density = "comodo" | "compacto";

interface DensityValue {
  density: Density;
  compact: boolean;
  toggle: () => void;
  setDensity: (d: Density) => void;
}

const DensityContext = createContext<DensityValue>({
  density: "comodo",
  compact: false,
  toggle: () => {},
  setDensity: () => {},
});

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useLocalStorage<Density>("compras:density", "comodo");
  const value = useMemo<DensityValue>(
    () => ({
      density,
      compact: density === "compacto",
      toggle: () => setDensity(density === "compacto" ? "comodo" : "compacto"),
      setDensity,
    }),
    [density, setDensity]
  );
  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity(): DensityValue {
  return useContext(DensityContext);
}

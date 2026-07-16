import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";
import { genId } from "../utils/genId";
import { claims as seedClaims, CLAIM_OPEN_STATES } from "../data/mockClaims";
import type { ClaimResolution, ClaimStatus, SupplierClaim } from "../types/purchasing";

// ============================================================================
//  Reclamos al proveedor. Persisten en localStorage para que un reclamo creado
//  desde una recepción se vea en el módulo de Reclamos y afecte al proveedor.
// ============================================================================

interface ClaimsContextValue {
  claims: SupplierClaim[];
  addClaim: (claim: Omit<SupplierClaim, "id"> & { id?: string }) => void;
  updateClaim: (
    id: string,
    patch: Partial<Pick<SupplierClaim, "estado" | "resolucion" | "notaCredito" | "fechaLimite">>
  ) => void;
  /** Reclamos abiertos (no resueltos ni rechazados). */
  openClaims: SupplierClaim[];
  /** Reclamos de un proveedor. */
  forSupplier: (name: string) => SupplierClaim[];
  /** ¿Ya existe un reclamo para esta OC + SKU? (evita duplicados). */
  exists: (poNumber: string, sku: string) => boolean;
}

const ClaimsContext = createContext<ClaimsContextValue | null>(null);

export function ClaimsProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useLocalStorage<SupplierClaim[]>("compras:claims", seedClaims);

  const value = useMemo<ClaimsContextValue>(() => {
    const addClaim: ClaimsContextValue["addClaim"] = (claim) => {
      const id = claim.id ?? genId("CLM-");
      setClaims((prev) =>
        prev.some((c) => c.id === id) ? prev : [{ ...claim, id }, ...prev]
      );
    };

    const updateClaim: ClaimsContextValue["updateClaim"] = (id, patch) =>
      setClaims((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

    const openStates = new Set<ClaimStatus>(CLAIM_OPEN_STATES);

    return {
      claims,
      addClaim,
      updateClaim,
      openClaims: claims.filter((c) => openStates.has(c.estado)),
      forSupplier: (name) => claims.filter((c) => c.supplierName === name),
      exists: (poNumber, sku) =>
        claims.some((c) => c.poNumber === poNumber && c.sku === sku),
    };
  }, [claims, setClaims]);

  return <ClaimsContext.Provider value={value}>{children}</ClaimsContext.Provider>;
}

export function useClaims(): ClaimsContextValue {
  const ctx = useContext(ClaimsContext);
  if (!ctx) throw new Error("useClaims debe usarse dentro de ClaimsProvider");
  return ctx;
}

/** Resolución por defecto sugerida según el tipo de reclamo. */
export function suggestedResolution(tipo: SupplierClaim["tipo"]): ClaimResolution {
  switch (tipo) {
    case "faltante":
      return "reposicion";
    case "costo":
      return "nota_credito";
    case "dano":
    case "calidad":
    case "vencimiento":
      return "nota_credito";
    default:
      return "pendiente";
  }
}

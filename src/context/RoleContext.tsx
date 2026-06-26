import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";

// ============================================================================
//  Rol de la sesión: Comprador o Líder de Compras.
//  Define qué menú y qué páginas se muestran.
// ============================================================================

export type Role = "comprador" | "lider";

interface Persona {
  name: string;
  role: string;
  initials: string;
}

const PERSONAS: Record<Role, Persona> = {
  comprador: { name: "Catalina Saavedra", role: "Comprador", initials: "CS" },
  lider: { name: "Tania Reyes", role: "Líder de Compras", initials: "TR" },
};

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  persona: Persona;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useLocalStorage<Role>("compras:role", "comprador");

  const value = useMemo<RoleContextValue>(
    () => ({ role, setRole, persona: PERSONAS[role] }),
    [role, setRole]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole debe usarse dentro de RoleProvider");
  return ctx;
}

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";

// ============================================================================
//  Sesión de la app (SOLO frontend, sin backend).
//  Simula login/logout: guarda en localStorage si hay sesión y el email.
//  No valida credenciales reales — cualquier email + contraseña inicia sesión
//  (es una demo). El objetivo es la experiencia: pantalla de login con ojito
//  para ver la contraseña y opción de cerrar sesión.
// ============================================================================

interface AuthState {
  authenticated: boolean;
  email: string;
}

interface AuthValue {
  authenticated: boolean;
  email: string;
  login: (email: string) => void;
  logout: () => void;
}

const EMPTY: AuthState = { authenticated: false, email: "" };

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<AuthState>("compras:auth", EMPTY);

  const value = useMemo<AuthValue>(
    () => ({
      authenticated: state.authenticated,
      email: state.email,
      login: (email: string) => setState({ authenticated: true, email }),
      logout: () => setState(EMPTY),
    }),
    [state, setState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

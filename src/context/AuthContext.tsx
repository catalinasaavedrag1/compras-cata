import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";

// ============================================================================
//  Sesión de la app.
//  Login REAL contra el servicio de identidad cuando `VITE_AUTH_URL` está
//  configurado: hace POST { email, password } y espera un JWT en la respuesta
//  ({ token } | { accessToken } | { jwt }). El token se guarda en la sesión y
//  el cliente del BFF (resolveToken) lo adjunta como Bearer en cada request.
//
//  Punto de integración: define VITE_AUTH_URL con el endpoint del id-service.
//  Sin esa variable (desarrollo) el login no valida credenciales y usa el
//  token de dev VITE_PURCHASE_BFF_TOKEN — así el entorno local sigue andando.
// ============================================================================

interface AuthState {
  authenticated: boolean;
  email: string;
  /** JWT emitido por el id-service (Bearer hacia el BFF). Vacío en dev. */
  token?: string;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

interface AuthValue {
  authenticated: boolean;
  email: string;
  /** Valida credenciales contra el id-service (o modo dev si no hay URL). */
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

const EMPTY: AuthState = { authenticated: false, email: "" };

const AUTH_URL = import.meta.env.VITE_AUTH_URL as string | undefined;

/** Extrae el JWT de las formas de respuesta más comunes del id-service. */
function extractToken(payload: unknown): string | null {
  if (payload && typeof payload === "object") {
    for (const key of ["token", "accessToken", "access_token", "jwt"]) {
      const value = (payload as Record<string, unknown>)[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return null;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<AuthState>("compras:auth", EMPTY);

  const value = useMemo<AuthValue>(
    () => ({
      authenticated: state.authenticated,
      email: state.email,
      login: async (email: string, password: string): Promise<LoginResult> => {
        // Modo desarrollo: sin id-service configurado no se validan credenciales.
        if (!AUTH_URL) {
          setState({ authenticated: true, email });
          return { ok: true };
        }
        try {
          const res = await fetch(AUTH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) {
            return {
              ok: false,
              error:
                res.status === 401
                  ? "Correo o contraseña incorrectos."
                  : `No se pudo iniciar sesión (${res.status}).`,
            };
          }
          const token = extractToken(await res.json().catch(() => null));
          if (!token) {
            return { ok: false, error: "El servicio de identidad no devolvió un token." };
          }
          setState({ authenticated: true, email, token });
          return { ok: true };
        } catch {
          return { ok: false, error: "No se pudo contactar el servicio de identidad." };
        }
      },
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

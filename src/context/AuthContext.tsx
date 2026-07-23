import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "../utils/useLocalStorage";

// ============================================================================
//  Sesión de la app.
//  Login REAL a través del BFF (mismo origen que el resto de la API): el BFF
//  hace de proxy hacia id-service y devuelve el JWT, que el cliente adjunta
//  como Bearer. El frontend no conoce la URL de id-service ni el plataformaId.
//
//  Endpoint de login (en orden de preferencia):
//    1. VITE_AUTH_URL            (override explícito)
//    2. {VITE_PURCHASE_BFF_URL}/auth/login   (por defecto: proxy del BFF)
//    3. modo desarrollo          (sin backend: no valida credenciales)
//  Respuesta esperada: el JWT en `token`/`accessToken`/`jwt`, ya sea al tope o
//  bajo `data` (envelope del BFF { success, data }).
// ============================================================================

interface AuthState {
  authenticated: boolean;
  email: string;
  token?: string;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  /** id-service reporta una sesión activa: reintentar con force=true la cierra. */
  sessionExists?: boolean;
}

interface AuthValue {
  authenticated: boolean;
  email: string;
  login: (email: string, password: string, force?: boolean) => Promise<LoginResult>;
  logout: () => void;
}

const EMPTY: AuthState = { authenticated: false, email: "" };

const AUTH_URL = import.meta.env.VITE_AUTH_URL as string | undefined;
const BFF_URL = import.meta.env.VITE_PURCHASE_BFF_URL as string | undefined;

/** Endpoint de login efectivo (o null en modo desarrollo sin backend). */
function loginEndpoint(): string | null {
  if (AUTH_URL) return AUTH_URL;
  if (BFF_URL) return `${BFF_URL.replace(/\/$/, "")}/auth/login`;
  return null;
}

/** Extrae el JWT del cuerpo, ya sea al tope o dentro de `data` (envelope BFF). */
function extractToken(payload: unknown): string | null {
  const pick = (obj: unknown): string | null => {
    if (obj && typeof obj === "object") {
      for (const key of ["token", "accessToken", "access_token", "jwt"]) {
        const value = (obj as Record<string, unknown>)[key];
        if (typeof value === "string" && value.length > 0) return value;
      }
    }
    return null;
  };
  if (payload && typeof payload === "object" && "data" in payload) {
    const fromData = pick((payload as { data: unknown }).data);
    if (fromData) return fromData;
  }
  return pick(payload);
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const msg = (body as Record<string, unknown>).message;
    if (typeof msg === "string" && msg) return msg;
  }
  if (status === 401) return "Correo o contraseña incorrectos.";
  if (status === 403) return "No tienes acceso a esta plataforma.";
  return `No se pudo iniciar sesión (${status}).`;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useLocalStorage<AuthState>("compras:auth", EMPTY);

  const value = useMemo<AuthValue>(
    () => ({
      authenticated: state.authenticated,
      email: state.email,
      login: async (email: string, password: string, force = false): Promise<LoginResult> => {
        const endpoint = loginEndpoint();
        // Modo desarrollo: sin backend configurado no se validan credenciales.
        if (!endpoint) {
          setState({ authenticated: true, email });
          return { ok: true };
        }
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, forzarSesion: force }),
          });
          const body: unknown = await res.json().catch(() => null);

          if (!res.ok) {
            const code =
              body && typeof body === "object"
                ? (body as Record<string, unknown>).code
                : undefined;
            if (res.status === 409 || code === "SESSION_EXISTS") {
              return {
                ok: false,
                sessionExists: true,
                error: errorMessage(res.status, body),
              };
            }
            return { ok: false, error: errorMessage(res.status, body) };
          }

          const token = extractToken(body);
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

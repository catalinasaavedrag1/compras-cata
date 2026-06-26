// ============================================================================
//  Cliente de datos.
//  - Sin backend (VITE_API_URL vacío, ej. en GitHub Pages): usa los datos mock
//    locales (modo demo), de forma síncrona como antes.
//  - Con backend (VITE_API_URL definido, ej. http://localhost:4100/api):
//    expone helpers fetch reales para que los módulos se conecten a la API.
// ============================================================================

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

/** ¿Hay un backend configurado? */
export const backendEnabled = API_BASE.length > 0;
export const apiBase = API_BASE;

/** Datos mock (modo demo). Mantiene la firma síncrona usada por los servicios. */
export function getMock<T>(data: T): T {
  return data;
}

/** Versión asíncrona: si hay backend devuelve la API, si no el mock. */
export async function getMockAsync<T>(data: T, collection?: string): Promise<T> {
  if (backendEnabled && collection) {
    try {
      return (await apiGet<T>(collection)) as T;
    } catch {
      return data; // fallback resiliente al mock
    }
  }
  return data;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status} en ${path}`);
  return res.json() as Promise<T>;
}

export const apiGet = <T>(collection: string) => req<T>(`/${collection}`);
export const apiGetOne = <T>(collection: string, id: string) => req<T>(`/${collection}/${id}`);
export const apiCreate = <T>(collection: string, body: unknown) =>
  req<T>(`/${collection}`, { method: "POST", body: JSON.stringify(body) });
export const apiPatch = <T>(collection: string, id: string, body: unknown) =>
  req<T>(`/${collection}/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDelete = <T>(collection: string, id: string) =>
  req<T>(`/${collection}/${id}`, { method: "DELETE" });

export interface HealthInfo {
  ok: boolean;
  collections: Record<string, number>;
}
export const apiHealth = () => req<HealthInfo>(`/health`);

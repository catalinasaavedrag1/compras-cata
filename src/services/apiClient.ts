// ============================================================================
//  Cliente de datos desacoplado.
//  Hoy devuelve datos mock locales de forma síncrona. Para conectar un backend
//  real, basta reemplazar la implementación de estos helpers por llamadas fetch
//  sin tocar los componentes (que solo consumen los *Service).
// ============================================================================

/** Devuelve datos mock. Reemplazar por fetch cuando exista backend. */
export function getMock<T>(data: T): T {
  return data;
}

/**
 * Versión asíncrona equivalente, lista para el día que haya API real.
 * Ej: return fetch(url).then(r => r.json())
 */
export async function getMockAsync<T>(data: T): Promise<T> {
  return data;
}

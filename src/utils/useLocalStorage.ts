import { useEffect, useState } from "react";

// ============================================================================
//  Hook de persistencia en localStorage.
//  Mantiene el estado sincronizado para que no se pierda al recargar la página
//  (borrador de OC, sugerencias ignoradas, estados de alertas, etc.).
// ============================================================================

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Espacio lleno o modo privado: se ignora silenciosamente.
    }
  }, [key, value]);

  return [value, setValue] as const;
}

import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// ============================================================================
//  Sincroniza un valor de filtro con la URL (query string).
//  Permite volver atrás conservando filtros y compartir vistas filtradas.
// ============================================================================

/** Filtro de texto/selección guardado en la URL. */
export function useUrlState(key: string, initial = "") {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? initial;

  const setValue = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (next) sp.set(key, next);
          else sp.delete(key);
          return sp;
        },
        { replace: true }
      );
    },
    [key, setParams]
  );

  return [value, setValue] as const;
}

/** Filtro booleano (chip) guardado en la URL como "1". */
export function useUrlToggle(key: string) {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) === "1";

  const toggle = useCallback(() => {
    setParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (sp.get(key) === "1") sp.delete(key);
        else sp.set(key, "1");
        return sp;
      },
      { replace: true }
    );
  }, [key, setParams]);

  return [value, toggle] as const;
}

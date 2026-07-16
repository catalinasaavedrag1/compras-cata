import { useEffect, useRef, type RefObject } from "react";

/**
 * Cierra un popover/menú al hacer clic fuera de `ref` o al presionar Escape.
 * Solo escucha mientras `active` es true. El callback se lee desde un ref para
 * que el efecto dependa solo de `[active, ref]` (no se re-suscribe en cada
 * render). Extraído de MoreActions/DateRangePicker.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, ref]);
}

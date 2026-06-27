import { useEffect, useRef } from "react";

// ============================================================================
//  Accesibilidad compartida para diálogos (Modal, Drawer, BottomSheet).
//  Mientras está abierto: cierra con Escape, mueve el foco al diálogo, atrapa
//  el foco con Tab y lo restaura al elemento previo al cerrar.
// ============================================================================
export function useDialogA11y(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocused = document.activeElement as HTMLElement | null;
    const node = ref.current;

    // Mover el foco al diálogo (o al primer elemento enfocable).
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.offsetParent !== null)
        : [];
    const first = focusables()[0];
    (first ?? node)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && node) {
        const items = focusables();
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocused?.focus?.();
    };
  }, [open, onClose]);

  return ref;
}

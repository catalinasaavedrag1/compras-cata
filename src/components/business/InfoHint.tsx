import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconInfo } from "../ui/icons";
import { BottomSheet } from "../ui/BottomSheet";
import { cn } from "../../utils/cn";

interface InfoHintProps {
  /** Nombre del indicador. Encabeza la hoja/popover y da el texto accesible. */
  label: string;
  /** Contenido de la explicación (párrafos, listas cortas, etc.). */
  children: ReactNode;
  className?: string;
  /** Tamaño del icono. Por defecto encaja junto a un texto pequeño. */
  size?: "sm" | "md";
}

const POPOVER_WIDTH = 300;

/**
 * Ayuda contextual bajo demanda. Un pequeño icono ⓘ junto a un indicador que,
 * al tocarlo, explica qué significa — sin ocupar espacio permanente en pantalla.
 *
 *  - Móvil / tablet: abre un Bottom Sheet (sube desde abajo, se cierra
 *    deslizando o tocando fuera).
 *  - Desktop: abre un popover anclado al icono (se cierra al tocar fuera o Escape).
 *
 * La información operativa siempre manda; esto es solo apoyo para interpretarla.
 */
export function InfoHint({ label, children, className, size = "sm" }: InfoHintProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const close = () => setOpen(false);

  const toggle = (e: React.MouseEvent) => {
    // No debe activar la fila/tarjeta que lo contiene.
    e.stopPropagation();
    e.preventDefault();
    if (open) {
      close();
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const left = Math.min(
        Math.max(8, r.left),
        window.innerWidth - POPOVER_WIDTH - 8
      );
      setPos({ top: r.bottom + 8, left });
    }
    setOpen(true);
  };

  // En desktop el popover es flotante: cerrar al hacer scroll, redimensionar o Escape.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const iconSize = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";

  return (
    <span
      className={cn("relative inline-flex align-middle", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={btnRef}
        type="button"
        aria-label={`Qué es ${label}`}
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex items-center justify-center rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <IconInfo className={iconSize} />
      </button>

      {/* Desktop: popover flotante anclado al icono */}
      {open && pos && (
        <span className="hidden lg:block">
          <span className="fixed inset-0 z-[54]" onClick={toggle} />
          <span
            role="dialog"
            aria-label={label}
            style={{ top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
            className="fixed z-[55] rounded-xl border border-slate-200 bg-white p-4 text-left normal-case tracking-normal shadow-xl"
          >
            <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
            <div className="space-y-2 text-sm font-normal leading-snug text-slate-600">
              {children}
            </div>
          </span>
        </span>
      )}

      {/* Móvil / tablet: bottom sheet */}
      <BottomSheet open={open} onClose={close} title={label}>
        <div className="space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
      </BottomSheet>
    </span>
  );
}

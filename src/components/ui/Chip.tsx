import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { IconClose } from "./icons";

// ============================================================================
//  Chip / pill reutilizable. Unifica los "chips" que antes se implementaban a
//  mano en FilterBar y varias páginas:
//    · Chip          → pill seleccionable (filtro rápido) o estático.
//    · RemovableChip  → filtro activo con botón de quitar.
//  Todos con estado de foco visible para navegación por teclado.
// ============================================================================

interface ChipProps {
  children: ReactNode;
  /** Marca el chip como seleccionado. */
  active?: boolean;
  /** Si se pasa, el chip es un botón (toggle); si no, es estático. */
  onClick?: () => void;
  /** Evita el salto de línea (útil en filas con scroll horizontal). */
  nowrap?: boolean;
  className?: string;
}

export function Chip({ children, active = false, onClick, nowrap, className }: ChipProps) {
  const base = cn(
    "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
    nowrap && "whitespace-nowrap flex-shrink-0",
    active
      ? "bg-brand-600 text-white border-brand-600"
      : "bg-white text-slate-600 border-slate-300",
    className
  );
  if (!onClick) {
    return <span className={base}>{children}</span>;
  }
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        base,
        !active && "hover:bg-slate-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      )}
    >
      {children}
    </button>
  );
}

interface RemovableChipProps {
  children: ReactNode;
  onRemove: () => void;
  removeLabel?: string;
}

export function RemovableChip({ children, onRemove, removeLabel = "Quitar filtro" }: RemovableChipProps) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap flex-shrink-0 rounded-full bg-brand-50 border border-brand-200 text-brand-700 pl-2.5 pr-1.5 py-1 text-xs font-medium">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        aria-label={removeLabel}
      >
        <IconClose className="w-3 h-3" />
      </button>
    </span>
  );
}

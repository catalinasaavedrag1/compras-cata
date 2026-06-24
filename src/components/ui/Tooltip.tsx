import type { ReactNode } from "react";
import { IconInfo } from "./icons";

interface TooltipProps {
  content: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Tooltip liviano basado en hover/focus (sin dependencias).
 * Si no se pasan children, muestra un icono de información.
 */
export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <span className={`relative inline-flex group ${className ?? ""}`} tabIndex={0}>
      {children ?? <IconInfo className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-normal normal-case leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
      >
        {content}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </span>
    </span>
  );
}

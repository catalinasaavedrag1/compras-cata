import { useRef, useState, type ReactNode } from "react";
import { IconDots } from "./icons";
import { useClickOutside } from "../../utils/useClickOutside";

export interface MoreAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  danger?: boolean;
}

/** Menú compacto "Más acciones" para acciones secundarias (exportar, etc.). */
export function MoreActions({
  actions,
  label = "Más acciones",
}: {
  actions: MoreAction[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Cierre por clic-fuera y por Escape (más robusto que onBlur + setTimeout).
  useClickOutside(wrapRef, open, () => setOpen(false));

  if (actions.length === 0) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <IconDots className="w-5 h-5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-52 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden z-40 py-1"
        >
          {actions.map((a) => (
            <button
              key={a.label}
              role="menuitem"
              onClick={() => {
                a.onClick();
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${a.danger ? "text-rose-600" : "text-slate-700"}`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

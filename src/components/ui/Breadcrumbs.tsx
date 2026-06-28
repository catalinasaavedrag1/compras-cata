import { Link } from "react-router-dom";
import { IconChevronRight } from "./icons";

export interface Crumb {
  label: string;
  to?: string;
}

/** Ruta de navegación: dónde está el usuario y cómo volver. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-3" aria-label="Ruta">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
            {c.to && !last ? (
              <Link to={c.to} className="hover:text-brand-600">
                {c.label}
              </Link>
            ) : (
              <span className={last ? "text-slate-600 font-medium" : ""}>{c.label}</span>
            )}
            {!last && <IconChevronRight className="w-3.5 h-3.5" />}
          </span>
        );
      })}
    </nav>
  );
}

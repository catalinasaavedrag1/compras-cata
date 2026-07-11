import { useMemo } from "react";
import { cn } from "../../utils/cn";
import { useRole } from "../../context/RoleContext";
import { useBuyer } from "../../context/BuyerContext";
import { useLocalStorage } from "../../utils/useLocalStorage";
import { IconCategories } from "../ui/icons";

// ============================================================================
//  Alcance del comprador ("mi cartera" vs "todas")
//  ---------------------------------------------------------------------------
//  Un comprador de categoría solo debería ver, por defecto, lo que tiene
//  asignado. Este hook + toggle aplica ese alcance de forma consistente en las
//  vistas de surtido (Productos, Categorías, Surtido, Campañas). El líder ve
//  todo por defecto, pero cualquiera puede alternar. La preferencia se comparte
//  entre vistas (localStorage) para que la app se sienta coherente.
// ============================================================================

export type Scope = "mine" | "all";

export interface CategoryScope {
  scope: Scope;
  setScope: (s: Scope) => void;
  /** ¿Está activo el filtro "mi cartera"? */
  scoped: boolean;
  /** ¿La categoría entra en el alcance actual? (sin categoría → fuera si scoped). */
  inScope: (category?: string) => boolean;
  myCategories: string[];
}

export function useCategoryScope(): CategoryScope {
  const { role } = useRole();
  const { myCategories } = useBuyer();
  const [scope, setScope] = useLocalStorage<Scope>(
    "compras:scope",
    role === "lider" ? "all" : "mine"
  );

  return useMemo(() => {
    const scoped = scope === "mine";
    return {
      scope,
      setScope,
      scoped,
      inScope: (category?: string) => !scoped || (!!category && myCategories.includes(category)),
      myCategories,
    };
  }, [scope, setScope, myCategories]);
}

interface ScopeToggleProps {
  scope: Scope;
  onChange: (s: Scope) => void;
  /** Nº de categorías del comprador, para dar contexto. */
  myCount?: number;
  className?: string;
}

/** Segmentado "Mi cartera / Todas" para acotar una vista al alcance del comprador. */
export function ScopeToggle({ scope, onChange, myCount, className }: ScopeToggleProps) {
  const options: { value: Scope; label: string }[] = [
    {
      value: "mine",
      label: myCount != null ? `Mi cartera · ${myCount} cat.` : "Mi cartera",
    },
    { value: "all", label: "Todas" },
  ];
  return (
    <div
      role="group"
      aria-label="Alcance de categorías"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5",
        className
      )}
    >
      <IconCategories className="ml-1.5 mr-0.5 h-3.5 w-3.5 text-slate-400" />
      {options.map((o) => {
        const active = o.value === scope;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { navGroupsFor } from "./navItems";
import { cn } from "../../utils/cn";
import { useLocalStorage } from "../../utils/useLocalStorage";
import { useRole } from "../../context/RoleContext";
import { IconChevronRight } from "../ui/icons";

/** Datos del tooltip flotante que se muestra en modo colapsado. */
interface HoverTip {
  label: string;
  hint: string;
  top: number;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useLocalStorage<boolean>("compras:sidebar-collapsed", false);
  const [tip, setTip] = useState<HoverTip | null>(null);
  const { role } = useRole();
  const navGroups = navGroupsFor(role);

  // Atajo de teclado: "[" colapsa/expande sin usar el mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "[") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCollapsed]);

  // Al colapsar desaparece cualquier tooltip que quedara visible.
  useEffect(() => {
    if (!collapsed) setTip(null);
  }, [collapsed]);

  const showTip = (e: React.MouseEvent, label: string, hint: string) => {
    if (!collapsed) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ label, hint, top: r.top + r.height / 2 });
  };

  return (
    <>
      {/* Espaciador: reserva el ancho del sidebar fijo para que no tape el contenido. */}
      <div className={cn("hidden lg:block flex-shrink-0 transition-[width] duration-200", collapsed ? "w-16" : "w-64")} aria-hidden />
      <aside
        onMouseLeave={() => setTip(null)}
        className={cn(
          "hidden lg:flex lg:flex-col border-r border-slate-200 bg-white h-screen fixed top-0 left-0 z-40 transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
      {/* Marca + botón colapsar */}
      <div className={cn("flex items-center h-16 border-b border-slate-100 flex-shrink-0", collapsed ? "justify-center px-0" : "px-3")}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <BrandLogo />
            <div className="leading-tight min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">Plataforma</p>
              <p className="text-xs text-slate-500 -mt-0.5">de Compras</p>
            </div>
          </div>
        )}
        {collapsed && <BrandLogo />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5",
            collapsed && "absolute top-4 -right-3 bg-white border border-slate-200 shadow-sm"
          )}
          title={`${collapsed ? "Expandir" : "Colapsar"} menú  ( [ )`}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          <IconChevronRight className={cn("w-4 h-4 transition-transform", !collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto no-scrollbar">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-3 last:mb-0">
            {!collapsed && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>
            )}
            {collapsed && <div className="h-px bg-slate-100 mx-2 mb-2" />}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? undefined : item.hint}
                  onMouseEnter={(e) => showTip(e, item.label, item.hint)}
                  onMouseLeave={() => setTip(null)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                      isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-brand-600" : "text-slate-400")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-xs font-medium text-slate-700">Demo con datos mock</p>
            <p className="text-xs text-slate-500 mt-0.5">Sin backend. Datos locales.</p>
          </div>
        </div>
      )}
      </aside>

      {/* Tooltip instantáneo del modo colapsado: aparece a la derecha del icono,
          con position fixed para no ser recortado por el scroll del nav. */}
      {collapsed && tip && (
        <div
          role="tooltip"
          style={{ top: tip.top, left: "4.25rem" }}
          className="hidden lg:block fixed z-50 -translate-y-1/2 pointer-events-none rounded-lg bg-slate-800 px-3 py-2 shadow-lg max-w-[15rem]"
        >
          <p className="text-xs font-semibold text-white leading-tight">{tip.label}</p>
          <p className="text-[11px] text-slate-300 leading-snug mt-0.5">{tip.hint}</p>
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
        </div>
      )}
    </>
  );
}

function BrandLogo() {
  return (
    <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white flex-shrink-0">
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 16l4-8 4 5 2-3 4 6" />
      </svg>
    </div>
  );
}

/** Marca usada en el menú móvil. */
export function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-100 flex-shrink-0">
      <BrandLogo />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-900">Plataforma</p>
        <p className="text-xs text-slate-500 -mt-0.5">de Compras</p>
      </div>
    </div>
  );
}

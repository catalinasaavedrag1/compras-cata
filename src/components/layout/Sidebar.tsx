import { NavLink } from "react-router-dom";
import { navGroups } from "./navItems";
import { cn } from "../../utils/cn";
import { useLocalStorage } from "../../utils/useLocalStorage";
import { IconChevronRight } from "../ui/icons";

export function Sidebar() {
  const [collapsed, setCollapsed] = useLocalStorage<boolean>("compras:sidebar-collapsed", false);

  return (
    <aside
      className={cn(
        "hidden lg:flex lg:flex-col flex-shrink-0 border-r border-slate-200 bg-white h-screen sticky top-0 transition-[width] duration-200",
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
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
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
                  title={item.label}
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

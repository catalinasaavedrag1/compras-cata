import { NavLink, useLocation } from "react-router-dom";
import { BrandLink } from "./Brand";
import { TopbarActions } from "./Topbar";
import { activeModuleFor, isPathActive, modulesFor } from "./navItems";
import { useNavBadges } from "./useNavBadges";
import { useRole } from "../../context/RoleContext";
import { cn } from "../../utils/cn";
import { PILL_TONE } from "../../utils/tone";

/**
 * Barra superior delgada: solo la marca (en móvil) y las acciones globales
 * (buscador, rol, notificaciones, borrador y cuenta). El título de cada vista
 * lo pone su propio PageHeader — aquí NO se repite.
 */
export function AppHeader() {
  const { pathname } = useLocation();
  const { role } = useRole();
  const modules = modulesFor(role);
  const activeModule = activeModuleFor(modules, pathname) ?? modules[0];
  const badges = useNavBadges();
  const activeChildren = activeModule.children.filter(
    (item) => !item.secondary || isPathActive(pathname, item.to)
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-2 lg:gap-3 h-16 px-4 lg:px-6">
        {/* En móvil mostramos la marca; en desktop vive en el sidebar. */}
        <div className="lg:hidden">
          <BrandLink />
        </div>
        <div className="flex-1 min-w-0" />
        <TopbarActions />
      </div>
      {activeChildren.length > 1 && (
        <div className="border-t border-slate-100 bg-white">
          <div className="px-3 py-2 lg:px-6">
            <div className="mb-1.5 flex items-center justify-between gap-2 lg:mb-2">
              <div className="flex min-w-0 items-center gap-2">
                <activeModule.icon className="h-4 w-4 flex-shrink-0 text-brand-600" />
                <span className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {activeModule.label}
                </span>
              </div>
              <span className="hidden text-[11px] text-slate-400 lg:inline">
                Usa [ para abrir el menú completo · / para buscar
              </span>
            </div>
            <nav
              aria-label={`Vistas de ${activeModule.label}`}
              className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar lg:gap-2"
            >
              {activeChildren.map((item) => {
                const b = item.badge ? badges[item.badge] : undefined;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    title={item.hint}
                    className={({ isActive }) =>
                      cn(
                        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors lg:px-3.5",
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn("h-3.5 w-3.5", isActive ? "text-white" : "text-slate-400")}
                        />
                        {item.label}
                        {b && b.count > 0 && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                              isActive ? "bg-white/20 text-white" : PILL_TONE[b.tone]
                            )}
                          >
                            {b.count > 99 ? "99+" : b.count}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

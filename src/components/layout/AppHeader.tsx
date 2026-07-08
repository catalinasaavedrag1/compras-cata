import { NavLink, useLocation } from "react-router-dom";
import { BrandLink } from "./Brand";
import { TopbarActions } from "./Topbar";
import { activeModuleFor, modulesFor } from "./navItems";
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

  const badgeForModule = (keys: (typeof modules)[number]["badgeKeys"]) => {
    if (!keys || keys.length === 0) return undefined;
    const active = keys.map((k) => badges[k]).filter((b) => b.count > 0);
    if (active.length === 0) return undefined;
    const count = active.reduce((sum, b) => sum + b.count, 0);
    const tone = active.some((b) => b.tone === "red")
      ? "red"
      : active.some((b) => b.tone === "amber")
        ? "amber"
        : active[0].tone;
    return { count, tone };
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center gap-2 lg:gap-3 h-16 px-4 lg:px-6">
        {/* En móvil mostramos la marca; en desktop vive en el sidebar. */}
        <div className="lg:hidden">
          <BrandLink />
        </div>
        <div className="flex-1 min-w-0" />
        <TopbarActions />
      </div>
      <div className="lg:hidden border-t border-slate-100 bg-white">
        <div className="px-3 py-2">
          <div className="mb-1.5 flex items-center gap-2">
            <activeModule.icon className="w-4 h-4 text-brand-600" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {activeModule.label}
            </span>
          </div>
          <nav
            aria-label={`Vistas de ${activeModule.label}`}
            className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
          >
            {activeModule.children.map((item) => {
              const b = item.badge ? badges[item.badge] : undefined;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.hint}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap",
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-slate-400")}
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
      <div className="hidden lg:block border-t border-slate-100">
        <div className="px-6 py-2 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <nav
              aria-label="Módulos principales"
              className="flex items-center gap-1 overflow-x-auto no-scrollbar pr-3"
            >
              {modules.map((module) => {
                const b = badgeForModule(module.badgeKeys);
                const isActive = module.key === activeModule.key;
                return (
                  <NavLink
                    key={module.key}
                    to={module.to}
                    end={module.end}
                    title={module.hint}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    )}
                  >
                    <module.icon
                      className={cn("w-4 h-4", isActive ? "text-brand-600" : "text-slate-400")}
                    />
                    {module.label}
                    {b && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                          PILL_TONE[b.tone]
                        )}
                      >
                        {b.count > 99 ? "99+" : b.count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
            {activeModule.children.length > 1 && (
              <nav
                aria-label={`Vistas de ${activeModule.label}`}
                className="flex items-center gap-1 overflow-x-auto no-scrollbar border-l border-slate-200 pl-3"
              >
                {activeModule.children.map((item) => {
                  const b = item.badge ? badges[item.badge] : undefined;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={item.hint}
                      className={({ isActive }) =>
                        cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                          isActive
                            ? "bg-slate-900 text-white"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={cn("w-4 h-4", isActive ? "text-white" : "text-slate-400")}
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
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

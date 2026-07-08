import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { activeModuleFor, modulesFor } from "./navItems";
import { cn } from "../../utils/cn";
import { useLocalStorage } from "../../utils/useLocalStorage";
import { useRole } from "../../context/RoleContext";
import { IconChevronRight } from "../ui/icons";
import { useNavBadges } from "./useNavBadges";
import { useRecentRoutes } from "./useRecentRoutes";
import { BrandLogo } from "./Brand";
import { PILL_TONE as BADGE_PILL, DOT_TONE as BADGE_DOT } from "../../utils/tone";

/** Datos del tooltip flotante que se muestra en modo colapsado. */
interface HoverTip {
  label: string;
  hint: string;
  top: number;
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useLocalStorage<boolean>("compras:sidebar-collapsed", false);
  const [tip, setTip] = useState<HoverTip | null>(null);
  const { pathname } = useLocation();
  const { role } = useRole();
  const modules = modulesFor(role);
  const activeModule = activeModuleFor(modules, pathname);
  const badges = useNavBadges();
  // Accesos rápidos: visitados recientemente dentro del menú del rol actual.
  const roleRoutes = new Set(modules.flatMap((m) => m.children.map((i) => i.to)));
  const recent = useRecentRoutes(3).filter((i) => roleRoutes.has(i.to));

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

  const moduleBadge = (keys: (typeof modules)[number]["badgeKeys"]) => {
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
    <>
      {/* Espaciador: reserva el ancho del sidebar fijo para que no tape el contenido. */}
      <div
        className={cn(
          "hidden lg:block flex-shrink-0 transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
        aria-hidden
      />
      <aside
        onMouseLeave={() => setTip(null)}
        className={cn(
          "hidden lg:flex lg:flex-col border-r border-slate-200 bg-white h-screen fixed top-0 left-0 z-40 transition-[width] duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Marca + botón colapsar */}
        <div
          className={cn(
            "flex items-center h-16 border-b border-slate-100 flex-shrink-0",
            collapsed ? "justify-center px-0" : "px-3"
          )}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <BrandLogo />
              <div className="leading-tight min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">Buyer</p>
                <p className="text-xs text-slate-500 -mt-0.5">Workspace</p>
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
            <IconChevronRight
              className={cn("w-4 h-4 transition-transform", !collapsed && "rotate-180")}
            />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 overflow-y-auto no-scrollbar">
          {!collapsed && recent.length > 0 && (
            <div className="mb-3">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Recientes
              </p>
              <div className="space-y-0.5">
                {recent.map((item) => (
                  <NavLink
                    key={`recent-${item.to}`}
                    to={item.to}
                    end={item.end}
                    className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0 text-slate-400" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
          <div className="mb-3">
            {!collapsed && (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Módulos
              </p>
            )}
            {collapsed && <div className="h-px bg-slate-100 mx-2 mb-2" />}
            <div className="space-y-0.5">
              {modules.map((module) => {
                const b = moduleBadge(module.badgeKeys);
                const showBadge = !!b && b.count > 0;
                const isActive = activeModule?.key === module.key;
                return (
                  <NavLink
                    key={module.key}
                    to={module.to}
                    end={module.end}
                    title={collapsed ? undefined : module.hint}
                    onMouseEnter={(e) => showTip(e, module.label, module.hint)}
                    onMouseLeave={() => setTip(null)}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-brand-600" />
                    )}
                    <span className="relative flex-shrink-0">
                      <module.icon
                        className={cn("w-5 h-5", isActive ? "text-brand-600" : "text-slate-400")}
                      />
                      {collapsed && showBadge && (
                        <span
                          className={cn(
                            "absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2 ring-white",
                            BADGE_DOT[b!.tone]
                          )}
                        />
                      )}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="truncate">{module.label}</span>
                        {showBadge && (
                          <span
                            className={cn(
                              "ml-auto text-[11px] font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center",
                              BADGE_PILL[b!.tone]
                            )}
                          >
                            {b!.count > 99 ? "99+" : b!.count}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        </nav>

        {!collapsed && (
          <div className="px-4 py-3 border-t border-slate-100">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-medium text-slate-700">Decisiones priorizadas</p>
              <p className="text-xs text-slate-500 mt-0.5">Venta · margen · stock · catálogo.</p>
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

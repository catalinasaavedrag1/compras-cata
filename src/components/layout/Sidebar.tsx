import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { activeModuleFor, modulesFor } from "./navItems";
import { cn } from "../../utils/cn";
import { useLocalStorage } from "../../utils/useLocalStorage";
import { useRole } from "../../context/RoleContext";
import { useOcDraft } from "../../context/OcDraftContext";
import {
  IconAlerts,
  IconCheck,
  IconChevronRight,
  IconClose,
  IconOrders,
  IconSearch,
} from "../ui/icons";
import { Input } from "../ui/Input";
import { useNavBadges } from "./useNavBadges";
import { BrandLogo } from "./Brand";
import { PILL_TONE as BADGE_PILL, DOT_TONE as BADGE_DOT } from "../../utils/tone";

/** Datos del tooltip flotante que se muestra en modo colapsado. */
interface HoverTip {
  label: string;
  hint: string;
  top: number;
}

export function Sidebar() {
  // Abierto por defecto para que un usuario nuevo lea los nombres de los
  // módulos; se recuerda "cerrado" solo si el usuario lo cierra explícitamente.
  const [panelOpen, setPanelOpen] = useLocalStorage<boolean>("compras:sidebar-panel-open", true);
  const [tip, setTip] = useState<HoverTip | null>(null);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { role } = useRole();
  const { count: draftCount } = useOcDraft();
  const modules = modulesFor(role);
  const activeModule = activeModuleFor(modules, pathname) ?? modules[0];
  const badges = useNavBadges();
  const primaryChildren = activeModule.children.filter((item) => !item.secondary);
  const extraChildren = activeModule.children.filter((item) => item.secondary);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const seen = new Set<string>();
    return modules
      .flatMap((module) =>
        module.children.map((item) => ({
          module,
          item,
          haystack:
            `${module.label} ${module.hint} ${item.label} ${item.hint} ${item.to}`.toLowerCase(),
        }))
      )
      .filter(({ item, haystack }) => {
        if (seen.has(item.to) || !haystack.includes(q)) return false;
        seen.add(item.to);
        return true;
      })
      .slice(0, 12);
  }, [modules, query]);

  // Atajo de teclado: "[" abre/cierra el panel sin usar el mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "[") {
        e.preventDefault();
        setPanelOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setPanelOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPanelOpen]);

  // Al abrir el panel desaparece cualquier tooltip que quedara visible.
  useEffect(() => {
    if (panelOpen) setTip(null);
  }, [panelOpen]);

  const showTip = (e: React.MouseEvent, label: string, hint: string) => {
    if (panelOpen) return;
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

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const first = searchResults[0];
    if (!first) return;
    navigate(first.item.to);
    setQuery("");
    setPanelOpen(false);
  };

  const pendingLinks = [
    {
      label: "Alertas",
      to: "/alertas",
      icon: IconAlerts,
      count: badges.alertas.count,
      tone: badges.alertas.tone,
    },
    {
      label: "Aprobaciones",
      to: "/comprar/aprobaciones",
      icon: IconCheck,
      count: badges.aprobaciones.count,
      tone: badges.aprobaciones.tone,
    },
    {
      label: "Borrador OC",
      to: "/comprar/borradores",
      icon: IconOrders,
      count: draftCount,
      tone: "blue" as const,
    },
  ];

  return (
    <>
      {/* Espaciador: reserva el ancho del sidebar fijo para que no tape el contenido. */}
      <div className="hidden w-16 flex-shrink-0 lg:block" aria-hidden />
      <aside
        onMouseLeave={() => setTip(null)}
        className="fixed left-0 top-0 z-50 hidden h-screen w-16 border-r border-slate-200 bg-white lg:flex"
      >
        <div className="flex h-full w-16 flex-col border-r border-slate-100 bg-white">
          <div className="flex h-16 items-center justify-center border-b border-slate-100">
            <NavLink to="/" end title="Inicio · Buyer Workspace" aria-label="Inicio">
              <BrandLogo />
            </NavLink>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3 no-scrollbar">
            {modules.map((module) => {
              const b = moduleBadge(module.badgeKeys);
              const showBadge = !!b && b.count > 0;
              const isActive = activeModule?.key === module.key;
              return (
                <NavLink
                  key={module.key}
                  to={module.to}
                  end={module.end}
                  title={panelOpen ? undefined : module.hint}
                  onClick={() => setPanelOpen(true)}
                  onMouseEnter={(e) => showTip(e, module.label, module.hint)}
                  onMouseLeave={() => setTip(null)}
                  className={cn(
                    "relative flex h-10 items-center justify-center rounded-xl transition-colors",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  )}
                >
                  <module.icon className="h-5 w-5" />
                  {showBadge && (
                    <>
                      <span
                        className={cn(
                          "absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-white",
                          BADGE_DOT[b!.tone]
                        )}
                      />
                      <span className="sr-only">{b!.count} pendientes</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 p-2">
            <button
              onClick={() => setPanelOpen(!panelOpen)}
              className={cn(
                "flex h-10 w-full items-center justify-center rounded-xl transition-colors",
                panelOpen
                  ? "bg-slate-900 text-white"
                  : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              )}
              title={`${panelOpen ? "Cerrar" : "Abrir"} menú  ( [ )`}
              aria-label={panelOpen ? "Cerrar panel de navegación" : "Abrir menú"}
              aria-expanded={panelOpen}
            >
              <IconChevronRight
                className={cn("h-4 w-4 transition-transform", panelOpen && "rotate-180")}
              />
            </button>
          </div>
        </div>
      </aside>

      {panelOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú al hacer clic fuera"
            onClick={() => setPanelOpen(false)}
            className="fixed inset-0 z-30 hidden cursor-default bg-slate-900/5 lg:block"
          />
          <div className="fixed left-16 top-0 z-40 hidden h-screen w-72 flex-col border-r border-slate-200 bg-white shadow-2xl lg:flex">
            <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-100 px-4">
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {activeModule.label}
                </p>
                <p className="truncate text-xs text-slate-500">Menú operativo</p>
              </div>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar menú lateral"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 no-scrollbar">
              <form onSubmit={submitSearch} className="mb-3">
                <Input
                  icon={<IconSearch className="h-4 w-4" />}
                  placeholder="Buscar vista o módulo..."
                  aria-label="Buscar vista o módulo"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </form>

              {query.trim().length >= 2 ? (
                <div>
                  <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Resultados
                  </p>
                  {searchResults.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      No encontré vistas para “{query.trim()}”.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {searchResults.map(({ module, item }) => {
                        const b = item.badge ? badges[item.badge] : undefined;
                        return (
                          <NavLink
                            key={`search-${item.to}`}
                            to={item.to}
                            end={item.end}
                            title={item.hint}
                            onClick={() => {
                              setQuery("");
                              setPanelOpen(false);
                            }}
                            className={({ isActive }) =>
                              cn(
                                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                                isActive
                                  ? "bg-slate-900 text-white"
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <item.icon
                                  className={cn(
                                    "h-4 w-4 flex-shrink-0",
                                    isActive ? "text-white" : "text-slate-400"
                                  )}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate">{item.label}</span>
                                  <span
                                    className={cn(
                                      "block truncate text-[11px]",
                                      isActive ? "text-white/65" : "text-slate-400"
                                    )}
                                  >
                                    {module.label}
                                  </span>
                                </span>
                                {b && b.count > 0 && (
                                  <span
                                    className={cn(
                                      "rounded-full px-1.5 py-0.5 text-[10px]",
                                      isActive ? "bg-white/20 text-white" : BADGE_PILL[b.tone]
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
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <NavLink
                      to={activeModule.to}
                      end={activeModule.end}
                      title={activeModule.hint}
                      onClick={() => setPanelOpen(false)}
                      className="flex items-start gap-3 rounded-lg p-1 text-slate-800 hover:text-brand-700"
                    >
                      <activeModule.icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {activeModule.label}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">
                          {activeModule.hint}
                        </span>
                      </span>
                    </NavLink>
                  </div>

                  <div className="mb-4">
                    <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Vistas principales
                    </p>
                    <div className="space-y-1">
                      {primaryChildren.map((item) => {
                        const b = item.badge ? badges[item.badge] : undefined;
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            title={item.hint}
                            onClick={() => setPanelOpen(false)}
                            className={({ isActive }) =>
                              cn(
                                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                                isActive
                                  ? "bg-slate-900 text-white"
                                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <item.icon
                                  className={cn(
                                    "h-4 w-4 flex-shrink-0",
                                    isActive ? "text-white" : "text-slate-400"
                                  )}
                                />
                                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                {b && b.count > 0 && (
                                  <span
                                    className={cn(
                                      "rounded-full px-1.5 py-0.5 text-[10px]",
                                      isActive ? "bg-white/20 text-white" : BADGE_PILL[b.tone]
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
                    </div>
                  </div>

                  {extraChildren.length > 0 && (
                    <div className="mb-4">
                      <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Vistas extra
                      </p>
                      <div className="space-y-1 border-l border-slate-100 pl-2">
                        {extraChildren.map((item) => {
                          const b = item.badge ? badges[item.badge] : undefined;
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              end={item.end}
                              title={item.hint}
                              onClick={() => setPanelOpen(false)}
                              className={({ isActive }) =>
                                cn(
                                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                                  isActive
                                    ? "bg-brand-50 text-brand-700"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                )
                              }
                            >
                              {({ isActive }) => (
                                <>
                                  <item.icon
                                    className={cn(
                                      "h-3.5 w-3.5 flex-shrink-0",
                                      isActive ? "text-brand-600" : "text-slate-400"
                                    )}
                                  />
                                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                  {b && b.count > 0 && (
                                    <span
                                      className={cn(
                                        "rounded-full px-1.5 py-0.5 text-[10px]",
                                        BADGE_PILL[b.tone]
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
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-slate-100 p-3">
              <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Trabajo pendiente
              </p>
              <div className="space-y-1">
                {pendingLinks.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setPanelOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.count > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          BADGE_PILL[item.tone]
                        )}
                      >
                        {item.count > 99 ? "99+" : item.count}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tooltip instantáneo del modo colapsado: aparece a la derecha del icono,
          con position fixed para no ser recortado por el scroll del nav. */}
      {!panelOpen && tip && (
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

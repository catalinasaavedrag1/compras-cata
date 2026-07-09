import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { activeModuleFor, modulesFor } from "./navItems";
import { Brand } from "./Brand";
import { cn } from "../../utils/cn";
import { Input } from "../ui/Input";
import { useRole } from "../../context/RoleContext";
import { IconClose, IconSearch } from "../ui/icons";
import { useNavBadges } from "./useNavBadges";
import { PILL_TONE as PILL } from "../../utils/tone";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [search, setSearch] = useState("");
  const { role } = useRole();
  const modules = modulesFor(role);
  const activeModule = activeModuleFor(modules, pathname) ?? modules[0];
  const activeChildren = activeModule.children.filter((item) => {
    if (!item.secondary) return true;
    return pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to + "/"));
  });
  const secondaryChildren = activeModule.children.filter(
    (item) =>
      item.secondary &&
      !(pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to + "/")))
  );
  const badges = useNavBadges();

  if (!open) return null;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/productos?q=${encodeURIComponent(search.trim())}`);
      setSearch("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="relative w-full h-full bg-white flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 pr-3">
          <Brand />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
            aria-label="Cerrar menú"
          >
            <IconClose />
          </button>
        </div>
        <form onSubmit={submitSearch} className="px-3 pt-3">
          <Input
            icon={<IconSearch className="w-4 h-4" />}
            placeholder="Buscar SKU o producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        <nav className="flex-1 px-3 py-3 pb-[calc(4.5rem+env(safe-area-inset-bottom))] overflow-y-auto scrollbar-thin">
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Módulo actual
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {activeChildren.map((item) => {
                const b = item.badge ? badges[item.badge] : undefined;
                const showBadge = !!b && b.count > 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    title={item.hint}
                    className={({ isActive }) =>
                      cn(
                        "min-h-16 rounded-lg border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-brand-200 bg-white text-brand-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-700"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <item.icon
                            className={cn(
                              "w-4 h-4",
                              isActive ? "text-brand-600" : "text-slate-400"
                            )}
                          />
                          {showBadge && (
                            <span
                              className={cn(
                                "text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center",
                                PILL[b!.tone] ?? "bg-slate-100 text-slate-600"
                              )}
                            >
                              {b!.count > 99 ? "99+" : b!.count}
                            </span>
                          )}
                        </div>
                        <span className="mt-1 block text-sm font-semibold leading-tight">
                          {item.label}
                        </span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
            {secondaryChildren.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                  Ver más vistas de {activeModule.label}
                </summary>
                <div className="mt-2 space-y-1">
                  {secondaryChildren.map((item) => {
                    const b = item.badge ? badges[item.badge] : undefined;
                    const showBadge = !!b && b.count > 0;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={onClose}
                        title={item.hint}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium",
                            isActive
                              ? "border-brand-200 bg-white text-brand-700"
                              : "border-slate-200 bg-white text-slate-600"
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <item.icon
                              className={cn(
                                "w-4 h-4",
                                isActive ? "text-brand-600" : "text-slate-400"
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {showBadge && (
                              <span
                                className={cn(
                                  "text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center",
                                  PILL[b!.tone] ?? "bg-slate-100 text-slate-600"
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
              </details>
            )}
          </div>

          <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Cambiar módulo
          </p>
          <div className="grid grid-cols-2 gap-2">
            {modules.map((module) => {
              const isActive = module.key === activeModule.key;
              const activeBadges = module.badgeKeys
                ?.map((k) => badges[k])
                .filter((b) => b.count > 0);
              const count = activeBadges?.reduce((sum, b) => sum + b.count, 0) ?? 0;
              const tone = activeBadges?.some((b) => b.tone === "red")
                ? "red"
                : activeBadges?.some((b) => b.tone === "amber")
                  ? "amber"
                  : activeBadges?.[0]?.tone;
              return (
                <NavLink
                  key={module.key}
                  to={module.to}
                  end={module.end}
                  onClick={onClose}
                  title={module.hint}
                  className={cn(
                    "rounded-xl border p-3 min-h-20 transition-colors",
                    isActive
                      ? "border-brand-200 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <module.icon
                      className={cn("w-5 h-5", isActive ? "text-brand-600" : "text-slate-400")}
                    />
                    {count > 0 && tone && (
                      <span
                        className={cn(
                          "text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center",
                          PILL[tone] ?? "bg-slate-100 text-slate-600"
                        )}
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </div>
                  <span className="mt-2 block text-sm font-semibold leading-tight">
                    {module.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-slate-500 line-clamp-2">
                    {module.hint}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

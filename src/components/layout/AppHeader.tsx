import { Link, NavLink, useLocation } from "react-router-dom";
import { cn } from "../../utils/cn";
import { useRole } from "../../context/RoleContext";
import {
  modulesFor,
  activeModuleFor,
  isPathActive,
  navItems,
  type NavModule,
} from "./navItems";
import { useNavBadges, type NavBadge } from "./useNavBadges";
import { TopbarActions } from "./Topbar";

const PILL: Record<string, string> = {
  red: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-brand-100 text-brand-700",
  green: "bg-emerald-100 text-emerald-700",
  violet: "bg-violet-100 text-violet-700",
  neutral: "bg-slate-100 text-slate-600",
  slate: "bg-slate-100 text-slate-600",
};

const TONE_RANK: Record<string, number> = { red: 3, amber: 2, violet: 2, blue: 1, green: 1, neutral: 0, slate: 0 };

/** Badge agregado del módulo: suma los conteos de sus badgeKeys, tono = el más severo. */
function moduleBadge(m: NavModule, badges: Record<string, NavBadge>): NavBadge | undefined {
  if (!m.badgeKeys?.length) return undefined;
  let count = 0;
  let tone = "blue";
  let rank = -1;
  for (const k of m.badgeKeys) {
    const b = badges[k];
    if (!b) continue;
    count += b.count;
    if (b.count > 0 && (TONE_RANK[b.tone] ?? 0) > rank) {
      rank = TONE_RANK[b.tone] ?? 0;
      tone = b.tone;
    }
  }
  return { count, tone: tone as NavBadge["tone"] };
}

function currentTitle(pathname: string): string {
  if (pathname.startsWith("/productos/")) return "Detalle de producto";
  let best: { label: string; len: number } | undefined;
  for (const it of navItems) {
    if (isPathActive(pathname, it.to, it.end) && (!best || it.to.length > best.len)) {
      best = { label: it.label, len: it.to.length };
    }
  }
  return best?.label ?? "Plataforma de Compras";
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

function BrandLink() {
  return (
    <Link to="/" className="flex items-center gap-2 flex-shrink-0" aria-label="Inicio · Plataforma de Compras" title="Plataforma de Compras">
      <BrandLogo />
      <div className="leading-tight hidden sm:block lg:hidden xl:block">
        <p className="text-sm font-semibold text-slate-900">Plataforma</p>
        <p className="text-xs text-slate-500 -mt-0.5">de Compras</p>
      </div>
    </Link>
  );
}

/** Barra de módulos (primer nivel). Reemplaza el menú lateral. */
function ModuleNav() {
  const { role } = useRole();
  const { pathname } = useLocation();
  const modules = modulesFor(role);
  const active = activeModuleFor(modules, pathname);
  const badges = useNavBadges();

  return (
    <nav className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto no-scrollbar" aria-label="Módulos">
      {modules.map((m) => {
        const isActive = active?.key === m.key;
        const b = moduleBadge(m, badges);
        return (
          <NavLink
            key={m.key}
            to={m.to}
            end={m.end}
            title={m.hint}
            className={cn(
              "relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <m.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-brand-600" : "text-slate-400")} />
            <span>{m.label}</span>
            {b && b.count > 0 && (
              <span className={cn("text-[11px] font-semibold rounded-full px-1.5 min-w-[18px] text-center", PILL[b.tone])}>
                {b.count > 99 ? "99+" : b.count}
              </span>
            )}
            {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
          </NavLink>
        );
      })}
    </nav>
  );
}

/** Sub-pestañas del módulo activo (segundo nivel). Solo si hay ≥ 2 vistas. */
function ModuleSubTabs() {
  const { role } = useRole();
  const { pathname } = useLocation();
  const modules = modulesFor(role);
  const active = activeModuleFor(modules, pathname);
  const badges = useNavBadges();

  if (!active || active.children.length < 2) return null;

  return (
    <div className="hidden lg:block border-t border-slate-100">
      <div className="flex gap-1 px-4 lg:px-6 max-w-[1600px] w-full mx-auto overflow-x-auto no-scrollbar">
        {active.children.map((c) => {
          const isActive = isPathActive(pathname, c.to, c.end);
          const b = c.badge ? badges[c.badge] : undefined;
          return (
            <NavLink
              key={c.to}
              to={c.to}
              end={c.end}
              title={c.hint}
              className={cn(
                "relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                isActive ? "text-brand-700" : "text-slate-500 hover:text-slate-700"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {c.label}
              {b && b.count > 0 && (
                <span className={cn("rounded-full px-1.5 text-xs", isActive ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500")}>
                  {b.count}
                </span>
              )}
              {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-brand-600 rounded-full" />}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Header de la aplicación: barra de módulos (primer nivel) + sub-pestañas
 * (segundo nivel). Una sola navegación, sin menú lateral secundario.
 */
export function AppHeader() {
  const { pathname } = useLocation();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center gap-2 lg:gap-3 h-16 px-4 lg:px-6">
        <BrandLink />
        <h2 className="text-sm font-semibold text-slate-700 lg:hidden flex-1 truncate">
          {currentTitle(pathname)}
        </h2>
        <ModuleNav />
        <TopbarActions />
      </div>
      <ModuleSubTabs />
    </header>
  );
}

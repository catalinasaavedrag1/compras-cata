import { NavLink } from "react-router-dom";
import { navGroups } from "./navItems";
import { cn } from "../../utils/cn";

export function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 border-r border-slate-200 bg-white h-screen sticky top-0">
      <Brand />
      <nav className="flex-1 px-3 py-3 overflow-y-auto scrollbar-thin">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-3 last:mb-0">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={item.hint}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        className={cn(
                          "w-5 h-5 flex-shrink-0",
                          isActive ? "text-brand-600" : "text-slate-400"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <Footer />
    </aside>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-100 flex-shrink-0">
      <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white">
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 16l4-8 4 5 2-3 4 6" />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-900">Plataforma</p>
        <p className="text-xs text-slate-500 -mt-0.5">de Compras</p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="px-4 py-3 border-t border-slate-100">
      <div className="rounded-lg bg-slate-50 px-3 py-2.5">
        <p className="text-xs font-medium text-slate-700">Demo con datos mock</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Sin backend. Datos locales de ejemplo.
        </p>
      </div>
    </div>
  );
}

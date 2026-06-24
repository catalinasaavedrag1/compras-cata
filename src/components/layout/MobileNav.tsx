import { NavLink } from "react-router-dom";
import { navGroups } from "./navItems";
import { Brand } from "./Sidebar";
import { cn } from "../../utils/cn";
import { IconClose } from "../ui/icons";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-72 max-w-[80%] h-full bg-white flex flex-col shadow-xl">
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
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-brand-50 text-brand-700"
                          : "text-slate-600 hover:bg-slate-100"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            "w-5 h-5",
                            isActive ? "text-brand-600" : "text-slate-400"
                          )}
                        />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

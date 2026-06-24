import { NavLink } from "react-router-dom";
import { cn } from "../../utils/cn";
import {
  IconDashboard,
  IconCheck,
  IconReplenish,
  IconAlerts,
  IconMenu,
} from "../ui/icons";

const items = [
  { to: "/", label: "Inicio", icon: IconDashboard, end: true },
  { to: "/mi-panel", label: "Mi panel", icon: IconCheck },
  { to: "/reposicion", label: "Reposición", icon: IconReplenish },
  { to: "/alertas", label: "Alertas", icon: IconAlerts },
];

/** Navegación inferior para móvil: secciones clave al alcance del pulgar. */
export function MobileBottomNav({ onMore }: { onMore: () => void }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex items-stretch h-16 pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              isActive ? "text-brand-700" : "text-slate-500"
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn("w-5 h-5", isActive ? "text-brand-600" : "text-slate-400")} />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
      <button
        onClick={onMore}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-500"
      >
        <IconMenu className="w-5 h-5 text-slate-400" />
        Más
      </button>
    </nav>
  );
}

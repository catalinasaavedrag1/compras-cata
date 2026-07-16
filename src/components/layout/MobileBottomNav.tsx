import { NavLink } from "react-router-dom";
import { cn } from "../../utils/cn";
import { IconMenu } from "../ui/icons";
import { mobilePrimaryNav } from "./navItems";

interface MobileBottomNavProps {
  /** El menú completo ("Más") está abierto. */
  menuOpen: boolean;
  /** Abre/cierra el menú completo. */
  onToggleMenu: () => void;
  /** Se navega a una sección: cierra el menú si estaba abierto. */
  onNavigate: () => void;
}

/**
 * Navegación inferior para móvil: secciones clave al alcance del pulgar.
 * Permanece visible por encima del menú completo (estilo Mercado Libre),
 * con "Más" resaltado mientras el menú está abierto.
 */
export function MobileBottomNav({ menuOpen, onToggleMenu, onNavigate }: MobileBottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 flex items-stretch h-16 pb-[env(safe-area-inset-bottom)]">
      {mobilePrimaryNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              // Mientras el menú está abierto, "Más" es la pestaña activa.
              isActive && !menuOpen ? "text-brand-700" : "text-slate-500"
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon
                className={cn(
                  "w-5 h-5",
                  isActive && !menuOpen ? "text-brand-600" : "text-slate-400"
                )}
              />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
      <button
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        className={cn(
          "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
          menuOpen ? "text-brand-700" : "text-slate-500"
        )}
      >
        <IconMenu className={cn("w-5 h-5", menuOpen ? "text-brand-600" : "text-slate-400")} />
        Más
      </button>
    </nav>
  );
}

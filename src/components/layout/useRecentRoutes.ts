import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { navItems, type NavItem } from "./navItems";
import { useLocalStorage } from "../../utils/useLocalStorage";

// ============================================================================
//  Rutas visitadas recientemente, para accesos rápidos en el menú.
//  Mapea la ruta actual (incluido el detalle, ej. /productos/CON-001) al ítem
//  de menú de su listado y recuerda los últimos visitados (por usuario).
// ============================================================================

/** Encuentra el ítem de menú que corresponde a una ruta (match más largo). */
function matchNav(pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const it of navItems) {
    if (pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to + "/"))) {
      if (!best || it.to.length > best.to.length) best = it;
    }
  }
  // Caso raíz exacto
  if (!best && pathname === "/") best = navItems.find((i) => i.to === "/");
  return best;
}

export function useRecentRoutes(max = 3): NavItem[] {
  const { pathname } = useLocation();
  const [recent, setRecent] = useLocalStorage<string[]>("compras:recent-routes", []);

  useEffect(() => {
    const item = matchNav(pathname);
    if (!item) return;
    setRecent((prev) => [item.to, ...prev.filter((p) => p !== item.to)].slice(0, 8));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const current = matchNav(pathname)?.to;
  return recent
    .filter((to) => to !== current)
    .map((to) => navItems.find((i) => i.to === to))
    .filter((i): i is NavItem => !!i)
    .slice(0, max);
}

import { BrandLink } from "./Brand";
import { TopbarActions } from "./Topbar";

/**
 * Barra superior delgada: solo la marca (en móvil) y las acciones globales
 * (buscador, rol, notificaciones, borrador y cuenta). El título de cada vista
 * lo pone su propio PageHeader — aquí NO se repite.
 */
export function AppHeader() {
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
    </header>
  );
}

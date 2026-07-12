import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { Sidebar } from "../components/layout/Sidebar";
import { MobileNav } from "../components/layout/MobileNav";
import { MobileBottomNav } from "../components/layout/MobileBottomNav";
import { ScrollToHash } from "../components/layout/ScrollToHash";
import { Toaster } from "../components/ui/Toaster";

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50">
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido principal
      </a>
      <ScrollToHash />
      {/* Menú lateral izquierdo (desktop): navegación principal. */}
      <Sidebar />
      {/* Menú completo a pantalla (móvil). */}
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />
        <main
          id="contenido-principal"
          tabIndex={-1}
          className="flex-1 px-4 py-4 pb-24 outline-none lg:px-6 lg:pb-6 max-w-[1600px] w-full mx-auto"
        >
          <Outlet />
        </main>
      </div>
      <MobileBottomNav
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
        onNavigate={() => setMenuOpen(false)}
      />
      <Toaster />
    </div>
  );
}

import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { MobileNav } from "../components/layout/MobileNav";
import { MobileBottomNav } from "../components/layout/MobileBottomNav";
import { ScrollToHash } from "../components/layout/ScrollToHash";
import { Toaster } from "../components/ui/Toaster";

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <ScrollToHash />
      <AppHeader />
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="flex-1 px-4 lg:px-6 py-4 pb-24 lg:pb-6 max-w-[1600px] w-full mx-auto">
        <Outlet />
      </main>
      <MobileBottomNav
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
        onNavigate={() => setMenuOpen(false)}
      />
      <Toaster />
    </div>
  );
}

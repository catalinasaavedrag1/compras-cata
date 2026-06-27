import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { MobileNav } from "../components/layout/MobileNav";
import { MobileBottomNav } from "../components/layout/MobileBottomNav";
import { ScrollToHash } from "../components/layout/ScrollToHash";
import { Toaster } from "../components/ui/Toaster";

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50">
      <ScrollToHash />
      <Sidebar />
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 px-4 lg:px-6 py-4 pb-24 lg:pb-4 max-w-[1600px] w-full mx-auto">
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

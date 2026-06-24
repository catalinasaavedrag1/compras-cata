import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { navItems } from "./navItems";
import { Input } from "../ui/Input";
import { IconSearch, IconMenu, IconOrders } from "../ui/icons";
import { useOcDraft } from "../../context/OcDraftContext";
import { formatDate } from "../../utils/formatters";

interface TopbarProps {
  onOpenMenu: () => void;
}

function currentTitle(pathname: string): string {
  if (pathname.startsWith("/productos/")) return "Detalle de producto";
  const match = navItems.find((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to)
  );
  return match?.label ?? "Plataforma de Compras";
}

const TODAY = "2026-06-24";

export function Topbar({ onOpenMenu }: TopbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { count } = useOcDraft();
  const [search, setSearch] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/productos?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 bg-white/90 backdrop-blur flex items-center gap-3 px-4 lg:px-6">
      <button
        onClick={onOpenMenu}
        className="lg:hidden text-slate-500 hover:text-slate-700 p-1.5 -ml-1 rounded-lg hover:bg-slate-100"
        aria-label="Abrir menú"
      >
        <IconMenu />
      </button>

      <h2 className="text-sm font-semibold text-slate-700 lg:hidden">
        {currentTitle(location.pathname)}
      </h2>

      <form onSubmit={handleSearch} className="hidden md:block w-80">
        <Input
          icon={<IconSearch className="w-4 h-4" />}
          placeholder="Buscar SKU o producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>

      <div className="flex-1" />

      <button
        onClick={() => navigate("/ordenes-compra")}
        className="relative inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        title="Borrador de orden de compra"
      >
        <IconOrders className="w-4 h-4" />
        <span className="hidden sm:inline">Borrador OC</span>
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-brand-600 text-white text-[10px] font-semibold flex items-center justify-center px-1">
            {count}
          </span>
        )}
      </button>

      <div className="hidden sm:flex flex-col items-end leading-tight">
        <span className="text-xs text-slate-400">{formatDate(TODAY)}</span>
        <span className="text-sm font-medium text-slate-700">Catalina Saavedra</span>
      </div>
      <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
        CS
      </div>
    </header>
  );
}

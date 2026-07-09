import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "../ui/Input";
import {
  IconSearch,
  IconOrders,
  IconProducts,
  IconSuppliers,
  IconCategories,
  IconDensity,
} from "../ui/icons";
import { useDensity } from "../../context/DensityContext";
import { useAuth } from "../../context/AuthContext";
import { IconLogout } from "../ui/icons";
import { useOcDraft } from "../../context/OcDraftContext";
import { useBuyer, initials } from "../../context/BuyerContext";
import { useRole } from "../../context/RoleContext";
import { cn } from "../../utils/cn";
import { NotificationCenter } from "./NotificationCenter";
import { BackendStatus } from "./BackendStatus";
import { TODAY_ISO } from "../../utils/constants";
import { formatDate, formatNumber, productLabel } from "../../utils/formatters";
import { products as mockProducts } from "../../data/mockProducts";
import { suppliers as mockSuppliers } from "../../data/mockSuppliers";
import { purchaseOrders as mockPOs } from "../../data/mockPurchaseOrders";
import { categories as mockCategories } from "../../data/mockCategories";
import { useCollection } from "../../context/DataContext";
import type { Product, Supplier, PurchaseOrder, Category } from "../../types/purchasing";

interface SearchResult {
  type: "product" | "supplier" | "order" | "category";
  title: string;
  subtitle: string;
  to: string;
}

export function TopbarActions() {
  const navigate = useNavigate();
  const { count } = useOcDraft();
  const { buyer, setBuyer, buyers } = useBuyer();
  const { role, setRole, persona } = useRole();
  const { compact, toggle: toggleDensity } = useDensity();
  const { email, logout } = useAuth();
  const [acctOpen, setAcctOpen] = useState(false);
  const acctRef = useRef<HTMLDivElement>(null);

  // Cierre del menú de cuenta por clic-fuera y Escape.
  useEffect(() => {
    if (!acctOpen) return;
    const onDown = (e: MouseEvent) => {
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAcctOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [acctOpen]);

  const products = useCollection<Product>("products", mockProducts);
  const suppliers = useCollection<Supplier>("suppliers", mockSuppliers);
  const purchaseOrders = useCollection<PurchaseOrder>("purchase-orders", mockPOs);
  const categories = useCollection<Category>("categories", mockCategories);

  const switchRole = (r: "comprador" | "lider") => {
    if (r === role) return;
    setRole(r);
    navigate(r === "lider" ? "/equipo" : "/");
  };
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Atajo global: ⌘K / Ctrl+K (o "/") enfoca el buscador desde cualquier vista.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const isK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      const isSlash = e.key === "/" && !typing;
      if (isK || isSlash) {
        e.preventDefault();
        const el = document.getElementById("global-search") as HTMLInputElement | null;
        el?.focus();
        el?.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: SearchResult[] = [];

    for (const p of products) {
      if (`${p.sku} ${p.name} ${p.brand}`.toLowerCase().includes(q)) {
        out.push({
          type: "product",
          title: productLabel(p.name, p.sku),
          subtitle: `${p.brand} · ${p.category} · disp. ${formatNumber(p.availableStock)}`,
          to: `/productos/${p.sku}`,
        });
      }
      if (out.filter((r) => r.type === "product").length >= 5) break;
    }
    for (const s of suppliers) {
      if (`${s.name} ${s.rut}`.toLowerCase().includes(q)) {
        out.push({
          type: "supplier",
          title: s.name,
          subtitle: `${s.rut} · ${s.categories.join(", ")}`,
          to: `/proveedores/${s.id}`,
        });
      }
      if (out.filter((r) => r.type === "supplier").length >= 3) break;
    }
    for (const c of categories) {
      if (c.name.toLowerCase().includes(q)) {
        out.push({
          type: "category",
          title: c.name,
          subtitle: `Categoría · ${formatNumber(c.activeSkus)} SKU · ${c.buyer}`,
          to: `/categorias/${c.id}`,
        });
      }
      if (out.filter((r) => r.type === "category").length >= 3) break;
    }
    for (const o of purchaseOrders) {
      if (`${o.number} ${o.supplierName}`.toLowerCase().includes(q)) {
        out.push({
          type: "order",
          title: o.number,
          subtitle: `${o.supplierName} · espera ${formatDate(o.expectedDate)}`,
          to: "/comprar/seguimiento",
        });
      }
      if (out.filter((r) => r.type === "order").length >= 3) break;
    }
    return out;
  }, [search, products, suppliers, categories, purchaseOrders]);

  const go = (to: string) => {
    setOpen(false);
    setSearch("");
    navigate(to);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results[0]) go(results[0].to);
    else if (search.trim()) go(`/productos?q=${encodeURIComponent(search.trim())}`);
  };

  const iconFor = (t: SearchResult["type"]) =>
    t === "product" ? (
      <IconProducts className="w-4 h-4 text-slate-400" />
    ) : t === "supplier" ? (
      <IconSuppliers className="w-4 h-4 text-slate-400" />
    ) : t === "category" ? (
      <IconCategories className="w-4 h-4 text-slate-400" />
    ) : (
      <IconOrders className="w-4 h-4 text-slate-400" />
    );

  const groupLabel = {
    product: "Productos",
    supplier: "Proveedores",
    category: "Categorías",
    order: "Órdenes de compra",
  };

  return (
    <>
      {/* Buscador global con resultados instantáneos */}
      <div
        className="hidden xl:block relative w-64 2xl:w-80"
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
      >
        <form onSubmit={handleSubmit}>
          <Input
            id="global-search"
            icon={<IconSearch className="w-4 h-4" />}
            placeholder="Buscar SKU, producto, proveedor, categoría u OC..."
            aria-label="Buscar en la plataforma"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
          />
          {!search && (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 pointer-events-none">
              ⌘K
            </kbd>
          )}
        </form>

        {open && search.trim().length >= 2 && (
          <div className="absolute mt-1.5 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden max-h-[70vh] overflow-y-auto scrollbar-thin">
            {results.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                Sin resultados para “{search.trim()}”.
              </p>
            ) : (
              (["product", "supplier", "category", "order"] as const).map((type) => {
                const group = results.filter((r) => r.type === type);
                if (group.length === 0) return null;
                return (
                  <div key={type} className="py-1">
                    <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {groupLabel[type]}
                    </p>
                    {group.map((r, i) => (
                      <button
                        key={`${type}-${i}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(r.to)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
                      >
                        {iconFor(r.type)}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-800 truncate">
                            {r.title}
                          </span>
                          <span className="block text-xs text-slate-500 truncate">
                            {r.subtitle}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <BackendStatus />

      {/* Densidad: cómodo / compacto */}
      <button
        onClick={toggleDensity}
        title={compact ? "Vista cómoda" : "Vista compacta (más información, menos scroll)"}
        className="hidden xl:inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <IconDensity className="w-4 h-4" />
        {compact ? "Compacto" : "Cómodo"}
      </button>

      {/* Cambio de rol: Comprador / Líder */}
      <div className="hidden lg:flex bg-slate-100 rounded-lg p-0.5">
        {(["comprador", "lider"] as const).map((r) => (
          <button
            key={r}
            onClick={() => switchRole(r)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              role === r
                ? r === "lider"
                  ? "bg-white text-violet-700 shadow-sm"
                  : "bg-white text-brand-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {r === "lider" ? "Líder" : "Comprador"}
          </button>
        ))}
      </div>

      <NotificationCenter />

      <button
        onClick={() => navigate("/comprar/borradores")}
        className="relative inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        title="Borrador de orden de compra"
        aria-label={
          count > 0 ? `Borrador de orden de compra, ${count} ítems` : "Borrador de orden de compra"
        }
      >
        <IconOrders className="w-4 h-4" />
        <span className="hidden sm:inline">Borrador OC</span>
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-brand-600 text-white text-[10px] font-semibold flex items-center justify-center px-1">
            {count}
          </span>
        )}
      </button>

      <div className="hidden 2xl:flex flex-col items-end leading-tight">
        <span className="text-xs text-slate-400">{formatDate(TODAY_ISO)}</span>
        {role === "lider" ? (
          <span className="text-sm font-medium text-slate-700">{persona.name}</span>
        ) : (
          <div className="relative group">
            <select
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              title="Cambiar de comprador"
              className="appearance-none bg-transparent text-sm font-medium text-slate-700 cursor-pointer focus:outline-none text-right pr-1 hover:text-brand-700"
            >
              {buyers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="relative" ref={acctRef}>
        <button
          onClick={() => setAcctOpen((v) => !v)}
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
            role === "lider" ? "bg-violet-100 text-violet-700" : "bg-brand-100 text-brand-700"
          )}
          title="Cuenta"
          aria-label="Menú de cuenta"
          aria-haspopup="menu"
          aria-expanded={acctOpen}
        >
          {role === "lider" ? persona.initials : initials(buyer)}
        </button>
        {acctOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-800 truncate">
                {role === "lider" ? persona.name : buyer}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {email || (role === "lider" ? "Líder de Compras" : "Comprador")}
              </p>
            </div>
            <button
              role="menuitem"
              onClick={() => {
                setAcctOpen(false);
                logout();
                navigate("/login");
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-slate-50"
            >
              <IconLogout className="w-4 h-4" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </>
  );
}

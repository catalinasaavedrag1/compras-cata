import { Link } from "react-router-dom";

/** Isotipo de la marca (cuadrado con el trazo). */
export function BrandLogo() {
  return (
    <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white flex-shrink-0">
      <svg
        viewBox="0 0 24 24"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 16l4-8 4 5 2-3 4 6" />
      </svg>
    </div>
  );
}

/** Marca enlazada a Inicio (logo + texto). Usada en la barra superior. */
export function BrandLink() {
  return (
    <Link
      to="/"
      className="flex items-center gap-2 flex-shrink-0"
      aria-label="Inicio · Plataforma de Compras"
      title="Plataforma de Compras"
    >
      <BrandLogo />
      <div className="leading-tight hidden sm:block">
        <p className="text-sm font-semibold text-slate-900">Plataforma</p>
        <p className="text-xs text-slate-500 -mt-0.5">de Compras</p>
      </div>
    </Link>
  );
}

/** Marca con encabezado (borde inferior). Usada en el menú móvil. */
export function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-100 flex-shrink-0">
      <BrandLogo />
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-900">Plataforma</p>
        <p className="text-xs text-slate-500 -mt-0.5">de Compras</p>
      </div>
    </div>
  );
}

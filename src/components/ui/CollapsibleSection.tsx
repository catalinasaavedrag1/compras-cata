import type { ReactNode } from "react";
import { Card, CardBody } from "./Card";
import { IconChevronRight } from "./icons";
import { useLocalStorage } from "../../utils/useLocalStorage";

// ============================================================================
//  Sección plegable para divulgación progresiva.
//  Muestra solo la cabecera; el contenido (análisis/secundario) se expande a
//  pedido. Recuerda el estado por clave en localStorage, así la app se siente
//  rápida: ves primero lo accionable y abres el detalle cuando lo necesitas.
// ============================================================================

export function CollapsibleSection({
  id,
  title,
  description,
  hint,
  defaultOpen = false,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  /** Texto/resumen compacto visible cuando está plegada (ej. "8 productos · $74M"). */
  hint?: ReactNode;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useLocalStorage<boolean>(`compras:section:${id}`, defaultOpen);
  return (
    <Card className={className}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50/70 rounded-xl transition-colors"
        aria-expanded={open}
      >
        <IconChevronRight
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
        {hint && !open && <div className="text-xs text-slate-400 flex-shrink-0">{hint}</div>}
        {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
      </button>
      {open && <CardBody className="pt-0">{children}</CardBody>}
    </Card>
  );
}

import type { ReactNode } from "react";
import { IconClose } from "./icons";
import { useDialogA11y } from "../../utils/useDialogA11y";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Hoja inferior (bottom sheet) para móvil. Más liviana que un modal:
 * sube desde abajo, con cabecera y acciones sticky. Solo se usa en móvil.
 */
export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  const ref = useDialogA11y(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] lg:hidden flex flex-col justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-[sheetUp_0.2s_ease-out] focus:outline-none"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto scrollbar-thin px-4 py-4 flex-1">{children}</div>
        {footer && (
          <div className="px-4 py-3 border-t border-slate-100 flex gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { IconClose } from "./icons";
import { useDialogA11y } from "../../utils/useDialogA11y";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}

const sizes = {
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "lg",
}: ModalProps) {
  const ref = useDialogA11y(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${sizes[size]} bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-4 sm:px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <IconClose />
          </button>
        </div>
        <div className="overflow-y-auto scrollbar-thin px-4 sm:px-6 py-5 flex-1">{children}</div>
        {footer && (
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

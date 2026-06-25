import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ============================================================================
//  Sistema de notificaciones (toasts) sin dependencias.
//  Da feedback visual a las acciones: agregar a OC, ignorar, resolver alertas...
// ============================================================================

export type ToastTone = "success" | "info" | "warning" | "error";

/** Acción opcional del toast (ej. "Ver borrador OC" → navega al detalle). */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
}

interface ToastContextValue {
  toasts: Toast[];
  show: (message: string, tone?: ToastTone, action?: ToastAction) => void;
  success: (message: string, action?: ToastAction) => void;
  info: (message: string, action?: ToastAction) => void;
  warning: (message: string, action?: ToastAction) => void;
  error: (message: string, action?: ToastAction) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "success", action?: ToastAction) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, tone, message, action }]);
      setTimeout(() => dismiss(id), action ? 6000 : 3500);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      show,
      success: (m, action) => show(m, "success", action),
      info: (m, action) => show(m, "info", action),
      warning: (m, action) => show(m, "warning", action),
      error: (m, action) => show(m, "error", action),
      dismiss,
    }),
    [toasts, show, dismiss]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}
